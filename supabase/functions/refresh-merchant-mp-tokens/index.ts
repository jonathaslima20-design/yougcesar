import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Client-Info, Apikey",
};

const OAUTH_TOKEN_URL = "https://api.mercadopago.com/oauth/token";

// Access tokens from the "Conectar com Mercado Pago" OAuth flow are valid
// for 180 days. Refreshing this far ahead of expiry keeps a wide safety
// margin (a merchant's payment creation never blocks on a refresh — it just
// uses whatever token is currently stored) without needing to run this job
// more than once a day.
const REFRESH_WINDOW_DAYS = 15;

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    // Internal-only endpoint: bypasses RLS via the service role key and is
    // meant to be triggered only by the pg_cron job carrying the shared cron secret.
    const cronSecret = Deno.env.get("CRON_SECRET") ?? "";
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: marketplace, error: marketplaceError } = await admin
      .from("mercadopago_marketplace_config")
      .select("client_id, client_secret")
      .eq("id", 1)
      .maybeSingle();

    if (marketplaceError) throw marketplaceError;

    if (!marketplace?.client_id || !marketplace.client_secret) {
      return new Response(
        JSON.stringify({ success: true, refreshed_count: 0, failed_count: 0, note: "Marketplace not configured yet" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const cutoff = new Date(Date.now() + REFRESH_WINDOW_DAYS * 24 * 60 * 60 * 1000).toISOString();

    const { data: rows, error: rowsError } = await admin
      .from("merchant_payment_credentials")
      .select("id, environment, refresh_token")
      .eq("provider", "mercadopago")
      .not("refresh_token", "is", null)
      .lt("token_expires_at", cutoff);

    if (rowsError) throw rowsError;

    let refreshedCount = 0;
    let failedCount = 0;

    for (const row of rows || []) {
      try {
        const tokenResponse = await fetch(OAUTH_TOKEN_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            client_id: marketplace.client_id,
            client_secret: marketplace.client_secret,
            grant_type: "refresh_token",
            refresh_token: row.refresh_token,
          }),
        });

        if (!tokenResponse.ok) {
          const errorBody = await tokenResponse.text().catch(() => "");
          console.error("Failed to refresh MP token for credential", row.id, tokenResponse.status, errorBody);
          failedCount++;
          continue;
        }

        const tokenData = await tokenResponse.json() as {
          access_token: string;
          refresh_token: string;
          expires_in: number;
        };

        const updateData: Record<string, unknown> = {
          refresh_token: tokenData.refresh_token,
          token_expires_at: new Date(Date.now() + tokenData.expires_in * 1000).toISOString(),
          updated_at: new Date().toISOString(),
        };
        if (row.environment === "production") {
          updateData.access_token_prod = tokenData.access_token;
        } else {
          updateData.access_token_test = tokenData.access_token;
        }

        const { error: updateError } = await admin
          .from("merchant_payment_credentials")
          .update(updateData)
          .eq("id", row.id);

        if (updateError) {
          console.error("Failed to save refreshed MP token for credential", row.id, updateError);
          failedCount++;
        } else {
          refreshedCount++;
        }
      } catch (e) {
        console.error("Unexpected error refreshing MP token for credential", row.id, e);
        failedCount++;
      }
    }

    return new Response(
      JSON.stringify({ success: true, refreshed_count: refreshedCount, failed_count: failedCount }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("refresh-merchant-mp-tokens error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
