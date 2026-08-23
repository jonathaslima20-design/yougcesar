import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Client-Info, Apikey",
};

function maskToken(token: string): string {
  if (!token || token.length < 12) return "****";
  return "****" + token.slice(-8);
}

// Mercado Pago credentials are self-describing by prefix: production public
// keys/access tokens always start with "APP_USR-", sandbox ones with
// "TEST-". Catches the classic "pasted the wrong credential in the wrong
// slot" mistake before it reaches checkout — same check used in the admin's
// own Mercado Pago settings (supabase/functions/mp-admin/index.ts).
function validateCredentialPrefix(label: string, value: string, expectedPrefix: string): string | null {
  if (!value) return null;
  if (!value.startsWith(expectedPrefix)) {
    const envLabel = expectedPrefix === "TEST-" ? "teste" : "produção";
    return `${label} não parece ser uma credencial de ${envLabel} (deveria começar com "${expectedPrefix}")`;
  }
  return null;
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

    const { data: merchant, error: merchantError } = await admin
      .from("users")
      .select("id, currency, plan_status, payments_test_override")
      .eq("id", user.id)
      .maybeSingle();

    if (merchantError) throw new Error(merchantError.message);

    if (!merchant) {
      return new Response(
        JSON.stringify({ error: "Usuário não encontrado" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { action, payload } = await req.json();

    switch (action) {
      case "getConfig": {
        const { data: config, error: configError } = await admin
          .from("merchant_payment_credentials")
          .select("*")
          .eq("user_id", user.id)
          .eq("provider", "mercadopago")
          .maybeSingle();

        if (configError) throw new Error(configError.message);

        return new Response(
          JSON.stringify({
            config: config
              ? {
                  id: config.id,
                  environment: config.environment,
                  public_key_test: config.public_key_test,
                  access_token_test: maskToken(config.access_token_test),
                  public_key_prod: config.public_key_prod,
                  access_token_prod: maskToken(config.access_token_prod),
                  webhook_secret: config.webhook_secret ? "****configurado" : "",
                  mp_account_id: config.mp_account_id,
                  mp_account_email: config.mp_account_email,
                  is_active: config.is_active,
                  last_validated_at: config.last_validated_at,
                }
              : null,
            notification_url: `${supabaseUrl}/functions/v1/merchant-payment-webhook`,
            store_currency: merchant.currency || "BRL",
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case "saveConfig": {
        const {
          environment,
          public_key_test,
          access_token_test,
          public_key_prod,
          access_token_prod,
          webhook_secret,
          is_active,
        } = payload as {
          environment: string;
          public_key_test: string;
          access_token_test: string;
          public_key_prod: string;
          access_token_prod: string;
          webhook_secret: string;
          is_active: boolean;
        };

        const { data: existing, error: existingError } = await admin
          .from("merchant_payment_credentials")
          .select("id, access_token_test, access_token_prod, webhook_secret")
          .eq("user_id", user.id)
          .eq("provider", "mercadopago")
          .maybeSingle();

        if (existingError) throw new Error(existingError.message);

        const resolvedEnvironment = environment === "test" ? "test" : "production";
        const updateData: Record<string, unknown> = {
          environment: resolvedEnvironment,
          public_key_test: public_key_test || "",
          public_key_prod: public_key_prod || "",
          updated_at: new Date().toISOString(),
        };

        if (access_token_test && !access_token_test.startsWith("****")) {
          updateData.access_token_test = access_token_test;
        } else if (existing) {
          updateData.access_token_test = existing.access_token_test;
        }

        if (access_token_prod && !access_token_prod.startsWith("****")) {
          updateData.access_token_prod = access_token_prod;
        } else if (existing) {
          updateData.access_token_prod = existing.access_token_prod;
        }

        if (webhook_secret && !webhook_secret.startsWith("****")) {
          updateData.webhook_secret = webhook_secret;
        } else if (existing) {
          updateData.webhook_secret = existing.webhook_secret;
        }

        // Same "wrong credential in the wrong slot" guard as the admin's own
        // Mercado Pago settings (mp-admin/index.ts).
        const credentialErrors = [
          validateCredentialPrefix("Public Key de teste", updateData.public_key_test as string, "TEST-"),
          validateCredentialPrefix("Access Token de teste", updateData.access_token_test as string, "TEST-"),
          validateCredentialPrefix("Public Key de produção", updateData.public_key_prod as string, "APP_USR-"),
          validateCredentialPrefix("Access Token de produção", updateData.access_token_prod as string, "APP_USR-"),
        ].filter((e): e is string => !!e);

        if (credentialErrors.length > 0) {
          return new Response(
            JSON.stringify({ error: credentialErrors.join(" | ") }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const finalAccessToken = resolvedEnvironment === "production"
          ? (updateData.access_token_prod as string) || ""
          : (updateData.access_token_test as string) || "";
        const finalPublicKey = resolvedEnvironment === "production"
          ? (updateData.public_key_prod as string) || ""
          : (updateData.public_key_test as string) || "";
        const finalWebhookSecret = (updateData.webhook_secret as string) || "";
        const storeCurrency = (merchant.currency || "BRL").toUpperCase();

        if (is_active) {
          const { data: platformSettings, error: platformError } = await admin
            .from("platform_payment_settings")
            .select("online_payments_enabled")
            .maybeSingle();

          if (platformError) throw new Error(platformError.message);

          if (!platformSettings?.online_payments_enabled && !merchant.payments_test_override) {
            return new Response(
              JSON.stringify({ error: "Pagamento online está temporariamente indisponível na plataforma." }),
              { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }

          if (!finalAccessToken || !finalPublicKey) {
            return new Response(
              JSON.stringify({ error: "Configure a Public Key e o Access Token antes de ativar." }),
              { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }
          if (!finalWebhookSecret) {
            return new Response(
              JSON.stringify({ error: "Configure o Webhook Secret antes de ativar o pagamento online." }),
              { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }
          if (storeCurrency !== "BRL") {
            return new Response(
              JSON.stringify({ error: "Pagamento online disponível apenas para lojas em Real (BRL) por enquanto." }),
              { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }
        }

        updateData.is_active = !!is_active;

        if (existing) {
          const { error } = await admin
            .from("merchant_payment_credentials")
            .update(updateData)
            .eq("id", existing.id);

          if (error) throw error;
        } else {
          const { error } = await admin
            .from("merchant_payment_credentials")
            .insert({ ...updateData, user_id: user.id, provider: "mercadopago" });

          if (error) throw error;
        }

        return new Response(
          JSON.stringify({ success: true }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case "testCredentials": {
        const { data: existing, error: existingError } = await admin
          .from("merchant_payment_credentials")
          .select("environment, access_token_test, access_token_prod")
          .eq("user_id", user.id)
          .eq("provider", "mercadopago")
          .maybeSingle();

        if (existingError) throw new Error(existingError.message);

        const accessToken = existing?.environment === "production"
          ? existing?.access_token_prod
          : existing?.access_token_test;

        if (!accessToken) {
          return new Response(
            JSON.stringify({ success: false, error: "Access Token não configurado" }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const testResponse = await fetch("https://api.mercadopago.com/users/me", {
          headers: { Authorization: `Bearer ${accessToken}` },
        });

        if (!testResponse.ok) {
          return new Response(
            JSON.stringify({ success: false, error: "Credenciais inválidas" }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const mpUser = await testResponse.json();

        await admin
          .from("merchant_payment_credentials")
          .update({
            mp_account_id: String(mpUser.id ?? ""),
            mp_account_email: mpUser.email ?? "",
            last_validated_at: new Date().toISOString(),
          })
          .eq("user_id", user.id)
          .eq("provider", "mercadopago");

        return new Response(
          JSON.stringify({
            success: true,
            account: {
              id: mpUser.id,
              email: mpUser.email,
              nickname: mpUser.nickname,
              site_id: mpUser.site_id,
            },
          }),
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
