import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Client-Info, Apikey",
};

const USER_AGENT = "VitrineTurbo/1.0 (contato@vitrineturbo.com)";

function superFreteBaseUrl(environment: string): string {
  return environment === "production"
    ? "https://api.superfrete.com"
    : "https://sandbox.superfrete.com";
}

function maskToken(token: string): string {
  if (!token || token.length < 12) return "****";
  return "****" + token.slice(-8);
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
          .from("merchant_shipping_credentials")
          .select("*")
          .eq("user_id", user.id)
          .eq("provider", "superfrete")
          .maybeSingle();

        return new Response(
          JSON.stringify({
            config: config
              ? {
                  id: config.id,
                  environment: config.environment,
                  api_token: maskToken(config.api_token),
                  origin_zip_code: config.origin_zip_code,
                  is_active: config.is_active,
                  last_validated_at: config.last_validated_at,
                }
              : null,
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case "saveConfig": {
        const { environment, api_token, origin_zip_code, is_active } = payload as {
          environment: string;
          api_token: string;
          origin_zip_code: string;
          is_active: boolean;
        };

        const { data: existing } = await admin
          .from("merchant_shipping_credentials")
          .select("id, api_token")
          .eq("user_id", user.id)
          .eq("provider", "superfrete")
          .maybeSingle();

        const updateData: Record<string, unknown> = {
          environment: environment === "production" ? "production" : "sandbox",
          origin_zip_code: (origin_zip_code || "").replace(/\D/g, ""),
          updated_at: new Date().toISOString(),
        };

        if (api_token && !api_token.startsWith("****")) {
          updateData.api_token = api_token;
        } else if (existing) {
          updateData.api_token = existing.api_token;
        }

        const finalApiToken = (updateData.api_token as string) || "";
        const finalOriginZip = (updateData.origin_zip_code as string) || "";

        if (is_active) {
          if (!finalApiToken) {
            return new Response(
              JSON.stringify({ error: "Configure o Token da API antes de ativar." }),
              { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }
          if (finalOriginZip.length !== 8) {
            return new Response(
              JSON.stringify({ error: "Configure o CEP de origem antes de ativar." }),
              { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }
        }

        updateData.is_active = !!is_active;

        if (existing) {
          const { error } = await admin
            .from("merchant_shipping_credentials")
            .update(updateData)
            .eq("id", existing.id);

          if (error) throw error;
        } else {
          const { error } = await admin
            .from("merchant_shipping_credentials")
            .insert({ ...updateData, user_id: user.id, provider: "superfrete" });

          if (error) throw error;
        }

        return new Response(
          JSON.stringify({ success: true }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case "testCredentials": {
        const testPayload = payload as
          | { api_token?: string; environment?: string; origin_zip_code?: string }
          | undefined;
        let apiToken: string | undefined = testPayload?.api_token;

        const { data: existing } = await admin
          .from("merchant_shipping_credentials")
          .select("api_token, environment, origin_zip_code")
          .eq("user_id", user.id)
          .eq("provider", "superfrete")
          .maybeSingle();

        if (!apiToken || apiToken.startsWith("****")) {
          apiToken = existing?.api_token;
        }

        // Always test against whatever the merchant currently has typed in the
        // form (environment/origin CEP), not stale values from the last save —
        // otherwise testing a freshly-pasted token before hitting "Salvar" can
        // silently test against the wrong environment and report a false
        // "invalid token".
        const originZipRaw = testPayload?.origin_zip_code || existing?.origin_zip_code || "";
        const originZip = originZipRaw.replace(/\D/g, "");
        const environment = testPayload?.environment === "production" ? "production" : (testPayload?.environment === "sandbox" ? "sandbox" : (existing?.environment || "sandbox"));

        if (!apiToken) {
          return new Response(
            JSON.stringify({ success: false, error: "Token da API não configurado" }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        if (originZip.length !== 8) {
          return new Response(
            JSON.stringify({ success: false, error: "Configure o CEP de origem antes de testar." }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        try {
          const testResponse = await fetch(`${superFreteBaseUrl(environment)}/api/v0/calculator`, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${apiToken}`,
              "User-Agent": USER_AGENT,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              from: { postal_code: originZip },
              to: { postal_code: originZip },
              services: "1,2",
              options: { own_hand: false, receipt: false, insurance_value: 0, use_insurance_value: false },
              products: [{ quantity: 1, height: 2, length: 11, width: 16, weight: 0.3 }],
            }),
          });

          if (!testResponse.ok) {
            return new Response(
              JSON.stringify({ success: false, error: "Token inválido ou serviço indisponível" }),
              { headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }

          const quotes = await testResponse.json();
          const hasValidQuote = Array.isArray(quotes) && quotes.some((q) => !q.has_error);

          if (!hasValidQuote) {
            return new Response(
              JSON.stringify({ success: false, error: "Token inválido ou serviço indisponível" }),
              { headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }

          await admin
            .from("merchant_shipping_credentials")
            .update({ last_validated_at: new Date().toISOString() })
            .eq("user_id", user.id)
            .eq("provider", "superfrete");

          return new Response(
            JSON.stringify({ success: true }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        } catch {
          return new Response(
            JSON.stringify({ success: false, error: "Não foi possível conectar à SuperFrete" }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
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
