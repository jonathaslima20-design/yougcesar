import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Client-Info, Apikey",
};

const OLIST_API_BASE = "https://api.tiny.com.br/public-api/v3";
const OAUTH_TOKEN_URL = "https://accounts.tiny.com.br/realms/tiny/protocol/openid-connect/token";

interface ErpCredentials {
  id: string;
  client_id: string;
  client_secret: string;
  access_token: string | null;
  refresh_token: string | null;
  token_expires_at: string | null;
  is_active: boolean;
}

async function getValidAccessToken(
  admin: ReturnType<typeof createClient>,
  userId: string
): Promise<string | null> {
  const { data: creds } = await admin
    .from("merchant_erp_credentials")
    .select("*")
    .eq("user_id", userId)
    .eq("provider", "olist")
    .maybeSingle();

  const credentials = creds as ErpCredentials | null;
  if (!credentials || !credentials.is_active || !credentials.access_token) {
    return null;
  }

  const expiresAt = credentials.token_expires_at ? new Date(credentials.token_expires_at).getTime() : 0;
  if (expiresAt - Date.now() >= 60_000) {
    return credentials.access_token;
  }
  if (!credentials.refresh_token) return null;

  const basicAuth = btoa(`${credentials.client_id}:${credentials.client_secret}`);
  const refreshResponse = await fetch(OAUTH_TOKEN_URL, {
    method: "POST",
    headers: {
      Authorization: `Basic ${basicAuth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({ grant_type: "refresh_token", refresh_token: credentials.refresh_token }),
  });
  if (!refreshResponse.ok) return null;

  const refreshed = await refreshResponse.json() as {
    access_token: string;
    refresh_token: string;
    expires_in: number;
  };

  await admin
    .from("merchant_erp_credentials")
    .update({
      access_token: refreshed.access_token,
      refresh_token: refreshed.refresh_token,
      token_expires_at: new Date(Date.now() + refreshed.expires_in * 1000).toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", credentials.id);

  return refreshed.access_token;
}

interface DeductionItem {
  product_id: string;
  quantity: number;
  unit_price?: number;
}

// This endpoint mirrors merchant-shipping-quote's "best effort, never blocking"
// posture: it's called from the storefront checkout flow right after an order
// is placed, with no merchant session available (the buyer is the one whose
// browser calls it), so there's no Authorization check — only store_owner_id
// scoping, same as the shipping quote endpoint. A store that never connected
// Olist, or whose token is stale, must never make checkout fail; every
// failure path below returns 200 with a per-item error list instead of a
// non-2xx status.
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(supabaseUrl, supabaseServiceKey);

    const { action, payload } = await req.json();

    if (action !== "pushStockDeduction") {
      return new Response(
        JSON.stringify({ error: "Ação não reconhecida" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { store_owner_id, items } = payload as {
      store_owner_id?: string;
      items?: DeductionItem[];
    };

    if (!store_owner_id || !Array.isArray(items) || items.length === 0) {
      return new Response(
        JSON.stringify({ pushed: 0, skipped: true, reason: "invalid_request" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const accessToken = await getValidAccessToken(admin, store_owner_id);
    if (!accessToken) {
      // Not connected to Olist (or token expired without a refresh token) —
      // this is the common case for most stores, not an error.
      return new Response(
        JSON.stringify({ pushed: 0, skipped: true, reason: "not_connected" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const productIds = items.map((i) => i.product_id);
    const { data: products } = await admin
      .from("products")
      .select("id, olist_product_id")
      .eq("user_id", store_owner_id)
      .in("id", productIds)
      .not("olist_product_id", "is", null);

    const olistIdByProduct = new Map((products || []).map((p) => [p.id, p.olist_product_id as string]));

    let pushed = 0;
    const errors: Array<{ product_id: string; error: string }> = [];

    for (const item of items) {
      const olistProductId = olistIdByProduct.get(item.product_id);
      if (!olistProductId) continue; // not linked to Olist — nothing to push

      try {
        const response = await fetch(`${OLIST_API_BASE}/estoque/${olistProductId}`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            tipo: "S",
            quantidade: item.quantity,
            precoUnitario: item.unit_price ?? 0,
            observacoes: "Baixa automática por venda na VitrineTurbo",
          }),
        });

        if (!response.ok) {
          const body = await response.text().catch(() => "");
          console.error("Olist stock deduction push failed:", response.status, body);
          errors.push({ product_id: item.product_id, error: `HTTP ${response.status}` });
        } else {
          pushed++;
        }
      } catch (err) {
        errors.push({
          product_id: item.product_id,
          error: err instanceof Error ? err.message : "Erro desconhecido",
        });
      }
    }

    return new Response(
      JSON.stringify({ pushed, failed: errors.length, errors }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("merchant-erp-order-sync error:", error);
    // Never fail the caller — checkout must complete regardless.
    return new Response(
      JSON.stringify({ pushed: 0, failed: 0, errors: [] }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
