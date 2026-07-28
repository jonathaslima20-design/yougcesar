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

    const { data: merchant } = await admin
      .from("users")
      .select("id, currency, plan_status, payments_test_override")
      .eq("id", user.id)
      .maybeSingle();

    if (!merchant) {
      return new Response(
        JSON.stringify({ error: "Usuário não encontrado" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { action, payload } = await req.json();

    switch (action) {
      case "getConfig": {
        const { data: config } = await admin
          .from("merchant_payment_credentials")
          .select("*")
          .eq("user_id", user.id)
          .eq("provider", "mercadopago")
          .maybeSingle();

        return new Response(
          JSON.stringify({
            config: config
              ? {
                  id: config.id,
                  environment: config.environment,
                  public_key: config.public_key,
                  access_token: maskToken(config.access_token),
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
          public_key,
          access_token,
          webhook_secret,
          is_active,
        } = payload as {
          environment: string;
          public_key: string;
          access_token: string;
          webhook_secret: string;
          is_active: boolean;
        };

        const { data: existing } = await admin
          .from("merchant_payment_credentials")
          .select("id, access_token, webhook_secret")
          .eq("user_id", user.id)
          .eq("provider", "mercadopago")
          .maybeSingle();

        const updateData: Record<string, unknown> = {
          environment: environment === "test" ? "test" : "production",
          public_key: public_key || "",
          updated_at: new Date().toISOString(),
        };

        if (access_token && !access_token.startsWith("****")) {
          updateData.access_token = access_token;
        } else if (existing) {
          updateData.access_token = existing.access_token;
        }

        if (webhook_secret && !webhook_secret.startsWith("****")) {
          updateData.webhook_secret = webhook_secret;
        } else if (existing) {
          updateData.webhook_secret = existing.webhook_secret;
        }

        const finalAccessToken = (updateData.access_token as string) || "";
        const finalPublicKey = (updateData.public_key as string) || "";
        const finalWebhookSecret = (updateData.webhook_secret as string) || "";
        const storeCurrency = (merchant.currency || "BRL").toUpperCase();

        if (is_active) {
          const { data: platformSettings } = await admin
            .from("platform_payment_settings")
            .select("online_payments_enabled")
            .maybeSingle();

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
        let accessToken: string | undefined = (payload as { access_token?: string } | undefined)?.access_token;

        if (!accessToken || accessToken.startsWith("****")) {
          const { data: existing } = await admin
            .from("merchant_payment_credentials")
            .select("access_token")
            .eq("user_id", user.id)
            .eq("provider", "mercadopago")
            .maybeSingle();
          accessToken = existing?.access_token;
        }

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
