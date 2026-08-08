import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Client-Info, Apikey",
};

// Fixed, not derived from the request: Olist requires the redirect URI to be an
// exact match of whatever the merchant pasted into their own Olist ERP
// "Aplicativo" registration (Configurações > Aplicativos), so it cannot vary by
// environment the way a normal app callback might.
const REDIRECT_URI = "https://vitrineturbo.com/dashboard/settings/integrations/olist/callback";

const OAUTH_AUTHORIZE_URL = "https://accounts.tiny.com.br/realms/tiny/protocol/openid-connect/auth";
const OAUTH_TOKEN_URL = "https://accounts.tiny.com.br/realms/tiny/protocol/openid-connect/token";

// state freshness window for the CSRF check on callback — generous enough that a
// merchant who gets interrupted mid-login at Olist (2FA, password reset) doesn't
// get bounced back with a stale-state error.
const STATE_TTL_MINUTES = 15;

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

    const { action, payload } = await req.json();

    switch (action) {
      case "getConfig": {
        const { data: config } = await admin
          .from("merchant_erp_credentials")
          .select("*")
          .eq("user_id", user.id)
          .eq("provider", "olist")
          .maybeSingle();

        return new Response(
          JSON.stringify({
            config: config
              ? {
                  id: config.id,
                  client_id: config.client_id,
                  client_secret: maskSecret(config.client_secret),
                  connected: !!config.access_token,
                  is_active: config.is_active,
                  last_synced_at: config.last_synced_at,
                }
              : null,
            redirect_uri: REDIRECT_URI,
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case "saveClientCredentials": {
        const { client_id, client_secret } = payload as {
          client_id: string;
          client_secret: string;
        };

        if (!client_id?.trim()) {
          return new Response(
            JSON.stringify({ error: "Informe o Client ID gerado no seu Olist ERP." }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const { data: existing } = await admin
          .from("merchant_erp_credentials")
          .select("id, client_secret")
          .eq("user_id", user.id)
          .eq("provider", "olist")
          .maybeSingle();

        const updateData: Record<string, unknown> = {
          client_id: client_id.trim(),
          updated_at: new Date().toISOString(),
        };

        if (client_secret && !client_secret.startsWith("****")) {
          updateData.client_secret = client_secret.trim();
        } else if (existing) {
          updateData.client_secret = existing.client_secret;
        } else {
          return new Response(
            JSON.stringify({ error: "Informe o Client Secret gerado no seu Olist ERP." }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        if (existing) {
          const { error } = await admin
            .from("merchant_erp_credentials")
            .update(updateData)
            .eq("id", existing.id);
          if (error) throw error;
        } else {
          const { error } = await admin
            .from("merchant_erp_credentials")
            .insert({ ...updateData, user_id: user.id, provider: "olist" });
          if (error) throw error;
        }

        return new Response(
          JSON.stringify({ success: true }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case "getAuthorizeUrl": {
        const { data: existing } = await admin
          .from("merchant_erp_credentials")
          .select("id, client_id")
          .eq("user_id", user.id)
          .eq("provider", "olist")
          .maybeSingle();

        if (!existing?.client_id) {
          return new Response(
            JSON.stringify({ error: "Salve o Client ID e Client Secret antes de conectar." }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const state = crypto.randomUUID();

        const { error } = await admin
          .from("merchant_erp_credentials")
          .update({ oauth_state: state, updated_at: new Date().toISOString() })
          .eq("id", existing.id);
        if (error) throw error;

        const url = new URL(OAUTH_AUTHORIZE_URL);
        url.searchParams.set("response_type", "code");
        url.searchParams.set("client_id", existing.client_id);
        url.searchParams.set("redirect_uri", REDIRECT_URI);
        url.searchParams.set("state", state);

        return new Response(
          JSON.stringify({ authorize_url: url.toString() }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case "exchangeCode": {
        const { code, state } = payload as { code: string; state: string };

        if (!code || !state) {
          return new Response(
            JSON.stringify({ error: "Retorno da Olist incompleto (code/state ausente)." }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const { data: existing } = await admin
          .from("merchant_erp_credentials")
          .select("id, client_id, client_secret, oauth_state, updated_at")
          .eq("user_id", user.id)
          .eq("provider", "olist")
          .maybeSingle();

        if (!existing || !existing.oauth_state || existing.oauth_state !== state) {
          return new Response(
            JSON.stringify({ error: "Estado de autorização inválido. Tente conectar novamente." }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const stateAgeMs = Date.now() - new Date(existing.updated_at).getTime();
        if (stateAgeMs > STATE_TTL_MINUTES * 60 * 1000) {
          return new Response(
            JSON.stringify({ error: "Autorização expirada. Tente conectar novamente." }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const basicAuth = btoa(`${existing.client_id}:${existing.client_secret}`);

        const tokenResponse = await fetch(OAUTH_TOKEN_URL, {
          method: "POST",
          headers: {
            Authorization: `Basic ${basicAuth}`,
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: new URLSearchParams({
            grant_type: "authorization_code",
            code,
            redirect_uri: REDIRECT_URI,
          }),
        });

        if (!tokenResponse.ok) {
          const errorBody = await tokenResponse.text().catch(() => "");
          console.error("Olist token exchange failed:", tokenResponse.status, errorBody);
          return new Response(
            JSON.stringify({ error: "Não foi possível concluir a conexão com a Olist. Verifique o Client ID/Secret." }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const tokenData = await tokenResponse.json() as {
          access_token: string;
          refresh_token: string;
          expires_in: number;
        };

        const { error } = await admin
          .from("merchant_erp_credentials")
          .update({
            access_token: tokenData.access_token,
            refresh_token: tokenData.refresh_token,
            token_expires_at: new Date(Date.now() + tokenData.expires_in * 1000).toISOString(),
            oauth_state: null,
            is_active: true,
            updated_at: new Date().toISOString(),
          })
          .eq("id", existing.id);
        if (error) throw error;

        return new Response(
          JSON.stringify({ success: true }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case "disconnect": {
        const { error } = await admin
          .from("merchant_erp_credentials")
          .update({
            access_token: null,
            refresh_token: null,
            token_expires_at: null,
            oauth_state: null,
            is_active: false,
            updated_at: new Date().toISOString(),
          })
          .eq("user_id", user.id)
          .eq("provider", "olist");
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
