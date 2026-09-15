import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Client-Info, Apikey",
};

// Fixed, not derived from the request: Mercado Pago requires the redirect
// URI to be an exact match of whatever is registered in the Application's
// own OAuth settings (MP Developers panel), so it can't vary by environment
// the way a normal app callback might. Same reasoning as Olist's own
// REDIRECT_URI constant in merchant-erp-settings/index.ts.
const REDIRECT_URI = "https://vitrineturbo.com/dashboard/settings/payment/mercadopago/callback";

function maskSecret(value: string): string {
  if (!value || value.length < 8) return "****";
  return "****" + value.slice(-4);
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Não autorizado" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const {
      data: { user },
      error: authError,
    } = await userClient.auth.getUser();

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Não autorizado" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const admin = createClient(supabaseUrl, supabaseServiceKey);

    const { data: userProfile } = await admin
      .from("users")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();

    if (!userProfile || userProfile.role !== "admin") {
      return new Response(
        JSON.stringify({ error: "Acesso negado" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { action, payload } = await req.json();

    switch (action) {
      case "getConfig": {
        const { data: config, error } = await admin
          .from("mercadopago_marketplace_config")
          .select("*")
          .eq("id", 1)
          .maybeSingle();

        if (error) throw new Error(error.message);

        return new Response(
          JSON.stringify({
            config: config
              ? {
                  client_id: config.client_id,
                  client_secret: maskSecret(config.client_secret),
                  environment: config.environment,
                  webhook_secret: config.webhook_secret ? "****configurado" : "",
                  fee_percentage: config.fee_percentage,
                }
              : null,
            redirect_uri: REDIRECT_URI,
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case "saveConfig": {
        const { client_id, client_secret, environment, webhook_secret, fee_percentage } = payload as {
          client_id: string;
          client_secret: string;
          environment: string;
          webhook_secret: string;
          fee_percentage: number;
        };

        if (!client_id?.trim()) {
          return new Response(
            JSON.stringify({ error: "Informe o Client ID da Aplicação Mercado Pago." }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const feePercentageNumber = Number(fee_percentage);
        if (!Number.isFinite(feePercentageNumber) || feePercentageNumber < 0 || feePercentageNumber > 100) {
          return new Response(
            JSON.stringify({ error: "Percentual da taxa inválido." }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const { data: existing } = await admin
          .from("mercadopago_marketplace_config")
          .select("client_secret, webhook_secret")
          .eq("id", 1)
          .maybeSingle();

        const updateData: Record<string, unknown> = {
          client_id: client_id.trim(),
          environment: environment === "production" ? "production" : "test",
          fee_percentage: feePercentageNumber,
          redirect_uri: REDIRECT_URI,
          updated_at: new Date().toISOString(),
        };

        if (client_secret && !client_secret.startsWith("****")) {
          updateData.client_secret = client_secret.trim();
        } else if (existing) {
          updateData.client_secret = existing.client_secret;
        } else {
          return new Response(
            JSON.stringify({ error: "Informe o Client Secret da Aplicação Mercado Pago." }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        if (webhook_secret && !webhook_secret.startsWith("****")) {
          updateData.webhook_secret = webhook_secret.trim();
        } else if (existing) {
          updateData.webhook_secret = existing.webhook_secret;
        }

        const { error } = await admin
          .from("mercadopago_marketplace_config")
          .update(updateData)
          .eq("id", 1);

        if (error) throw error;

        return new Response(
          JSON.stringify({ success: true }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      default:
        return new Response(
          JSON.stringify({ error: "Ação não reconhecida" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro interno";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
