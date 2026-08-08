import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

const OLIST_API_BASE = "https://api.tiny.com.br/public-api/v3";
const OAUTH_TOKEN_URL = "https://accounts.tiny.com.br/realms/tiny/protocol/openid-connect/token";

// Each merchant has their own Olist account/token, so their rate-limit
// buckets don't share — merchants are safe to sync concurrently. The 2s
// spacing is still needed *within* a single merchant's product loop, same
// reasoning as merchant-erp-sync's pullStock.
const REQUEST_SPACING_MS = 2000;
// Smaller than the manual "Sincronizar Estoque" button's cap (50): this runs
// unattended every 15 minutes, so a merchant with a big catalog just gets
// caught up over a few runs instead of risking the whole invocation timing
// out. Whichever merchants don't fit in MAX_MERCHANTS_PER_RUN this time get
// priority next run (ordered by oldest last_synced_at first).
const MAX_PRODUCTS_PER_MERCHANT = 20;
const MAX_MERCHANTS_PER_RUN = 10;
const MERCHANT_CONCURRENCY = 5;

interface ErpCredentials {
  id: string;
  user_id: string;
  client_id: string;
  client_secret: string;
  access_token: string | null;
  refresh_token: string | null;
  token_expires_at: string | null;
}

async function getValidAccessToken(
  admin: ReturnType<typeof createClient>,
  credentials: ErpCredentials
): Promise<string | null> {
  const expiresAt = credentials.token_expires_at ? new Date(credentials.token_expires_at).getTime() : 0;
  if (expiresAt - Date.now() >= 60_000 && credentials.access_token) {
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

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function syncMerchantStock(
  admin: ReturnType<typeof createClient>,
  credentials: ErpCredentials
): Promise<{ user_id: string; synced: number; failed: number }> {
  const accessToken = await getValidAccessToken(admin, credentials);
  if (!accessToken) {
    // Expired/revoked connection with no usable refresh token — leave it
    // alone here; the merchant will see "desconectado" next time they open
    // the dashboard and can reconnect. A cron job isn't the place to
    // surface that to them.
    return { user_id: credentials.user_id, synced: 0, failed: 0 };
  }

  const { data: linkedProducts } = await admin
    .from("products")
    .select("id, olist_product_id")
    .eq("user_id", credentials.user_id)
    .not("olist_product_id", "is", null)
    .limit(MAX_PRODUCTS_PER_MERCHANT);

  const products = linkedProducts || [];
  let synced = 0;
  let failed = 0;

  for (let i = 0; i < products.length; i++) {
    const product = products[i];
    try {
      const response = await fetch(`${OLIST_API_BASE}/estoque/${product.olist_product_id}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!response.ok) {
        failed++;
      } else {
        const stock = await response.json() as { saldo?: number; disponivel?: number };
        const quantity = stock.disponivel ?? stock.saldo ?? 0;
        const { error } = await admin
          .from("products")
          .update({ stock_quantity: Math.max(0, Math.round(quantity)) })
          .eq("id", product.id);
        if (error) throw error;
        synced++;
      }
    } catch {
      failed++;
    }

    if (i < products.length - 1) await sleep(REQUEST_SPACING_MS);
  }

  await admin
    .from("merchant_erp_credentials")
    .update({ last_synced_at: new Date().toISOString() })
    .eq("id", credentials.id);

  return { user_id: credentials.user_id, synced, failed };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  const cronSecret = Deno.env.get("CRON_SECRET") ?? "";
  const authHeader = req.headers.get("Authorization");
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return new Response(
      JSON.stringify({ error: "Não autorizado" }),
      { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(supabaseUrl, supabaseServiceKey);

    const { data: merchants } = await admin
      .from("merchant_erp_credentials")
      .select("id, user_id, client_id, client_secret, access_token, refresh_token, token_expires_at")
      .eq("provider", "olist")
      .eq("is_active", true)
      .order("last_synced_at", { ascending: true, nullsFirst: true })
      .limit(MAX_MERCHANTS_PER_RUN);

    const list = (merchants || []) as ErpCredentials[];
    const results: Array<{ user_id: string; synced: number; failed: number }> = [];

    for (let i = 0; i < list.length; i += MERCHANT_CONCURRENCY) {
      const batch = list.slice(i, i + MERCHANT_CONCURRENCY);
      const batchResults = await Promise.all(batch.map((m) => syncMerchantStock(admin, m)));
      results.push(...batchResults);
    }

    return new Response(
      JSON.stringify({ merchants_processed: results.length, results }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("merchant-erp-cron-sync error:", error);
    const message = error instanceof Error ? error.message : "Erro interno";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
