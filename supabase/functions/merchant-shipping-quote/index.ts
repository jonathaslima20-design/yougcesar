import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Client-Info, Apikey",
};

const USER_AGENT = "VitrineTurbo/1.0 (contato@vitrineturbo.com)";
const ALL_SERVICE_IDS = "1,2,17,3,33,31";

function superFreteBaseUrl(environment: string): string {
  return environment === "production"
    ? "https://api.superfrete.com"
    : "https://sandbox.superfrete.com";
}

interface QuoteProduct {
  quantity: number;
  weight: number;
  height: number;
  width: number;
  length: number;
}

// This endpoint is intentionally "best effort, never blocking": checkout must
// keep working (falling back to the merchant's manual delivery options) no
// matter what goes wrong here, so almost every failure path below returns
// `{ quotes: [] }` with a 200 rather than an error status. Only a malformed
// request body from our own frontend is treated as a real 400.
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(supabaseUrl, supabaseServiceKey);

    const { action, payload } = await req.json();

    if (action !== "getQuote") {
      return new Response(
        JSON.stringify({ error: "Ação não reconhecida" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const {
      store_owner_id,
      destination_zip_code,
      products,
      services,
    } = payload as {
      store_owner_id?: string;
      destination_zip_code?: string;
      products?: QuoteProduct[];
      services?: string;
    };

    const destinationZip = (destination_zip_code || "").replace(/\D/g, "");

    if (!store_owner_id || destinationZip.length !== 8 || !Array.isArray(products) || products.length === 0) {
      return new Response(
        JSON.stringify({ error: "Requisição inválida" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: credentials } = await admin
      .from("merchant_shipping_credentials")
      .select("*")
      .eq("user_id", store_owner_id)
      .eq("provider", "superfrete")
      .eq("is_active", true)
      .maybeSingle();

    const originZip = (credentials?.origin_zip_code || "").replace(/\D/g, "");

    if (!credentials || originZip.length !== 8) {
      return new Response(
        JSON.stringify({ quotes: [] }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body = {
      from: { postal_code: originZip },
      to: { postal_code: destinationZip },
      services: services && services.trim() ? services : ALL_SERVICE_IDS,
      options: { own_hand: false, receipt: false, insurance_value: 0, use_insurance_value: false },
      products: products.map((p) => ({
        quantity: Math.max(1, Math.round(p.quantity) || 1),
        weight: Math.max(0.01, p.weight || 0.01),
        height: Math.max(1, p.height || 1),
        width: Math.max(1, p.width || 1),
        length: Math.max(1, p.length || 1),
      })),
    };

    try {
      const response = await fetch(`${superFreteBaseUrl(credentials.environment)}/api/v0/calculator`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${credentials.api_token}`,
          "User-Agent": USER_AGENT,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        return new Response(
          JSON.stringify({ quotes: [] }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const data = await response.json();
      const quotes = (Array.isArray(data) ? data : [])
        .filter((item) => !item.has_error)
        .map((item) => ({
          id: String(item.id),
          name: item.name,
          price: Number(item.price),
          deliveryTimeDays: item.delivery_time ?? null,
          companyName: item.company?.name,
        }));

      return new Response(
        JSON.stringify({ quotes }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    } catch {
      return new Response(
        JSON.stringify({ quotes: [] }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
  } catch {
    return new Response(
      JSON.stringify({ quotes: [] }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
