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
// own OAuth settings (MP Developers panel) — same constant used by the
// admin config screen (mercadopago-marketplace-admin/index.ts).
const REDIRECT_URI = "https://vitrineturbo.com/dashboard/settings/payment/mercadopago/callback";
const OAUTH_AUTHORIZE_URL = "https://auth.mercadopago.com/authorization";
const OAUTH_TOKEN_URL = "https://api.mercadopago.com/oauth/token";

// state freshness window for the CSRF check on callback — same value used by
// the Olist ERP OAuth flow (merchant-erp-settings/index.ts).
const STATE_TTL_MINUTES = 15;

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
          .select("environment, is_active, mp_account_email, mp_user_id, refresh_token, updated_at")
          .eq("user_id", user.id)
          .eq("provider", "mercadopago")
          .maybeSingle();

        if (configError) throw new Error(configError.message);

        return new Response(
          JSON.stringify({
            config: config
              ? {
                  connected: !!config.refresh_token,
                  environment: config.environment,
                  mp_account_email: config.mp_account_email,
                  mp_user_id: config.mp_user_id,
                  is_active: config.is_active,
                  updated_at: config.updated_at,
                }
              : null,
            store_currency: merchant.currency || "BRL",
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case "getAuthorizeUrl": {
        const storeCurrency = (merchant.currency || "BRL").toUpperCase();
        if (storeCurrency !== "BRL") {
          return new Response(
            JSON.stringify({ error: "Pagamento online disponível apenas para lojas em Real (BRL) por enquanto." }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

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

        const { data: marketplace, error: marketplaceError } = await admin
          .from("mercadopago_marketplace_config")
          .select("client_id")
          .eq("id", 1)
          .maybeSingle();

        if (marketplaceError) throw new Error(marketplaceError.message);

        if (!marketplace?.client_id) {
          return new Response(
            JSON.stringify({ error: "Split de pagamentos ainda não configurado pela plataforma." }),
            { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const state = crypto.randomUUID();

        const { data: existing } = await admin
          .from("merchant_payment_credentials")
          .select("id")
          .eq("user_id", user.id)
          .eq("provider", "mercadopago")
          .maybeSingle();

        if (existing) {
          const { error } = await admin
            .from("merchant_payment_credentials")
            .update({ oauth_state: state, updated_at: new Date().toISOString() })
            .eq("id", existing.id);
          if (error) throw error;
        } else {
          const { error } = await admin
            .from("merchant_payment_credentials")
            .insert({ user_id: user.id, provider: "mercadopago", oauth_state: state });
          if (error) throw error;
        }

        const url = new URL(OAUTH_AUTHORIZE_URL);
        url.searchParams.set("client_id", marketplace.client_id);
        url.searchParams.set("response_type", "code");
        url.searchParams.set("platform_id", "mp");
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
            JSON.stringify({ error: "Retorno do Mercado Pago incompleto (code/state ausente)." }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const { data: existing } = await admin
          .from("merchant_payment_credentials")
          .select("id, oauth_state, updated_at")
          .eq("user_id", user.id)
          .eq("provider", "mercadopago")
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

        const { data: marketplace, error: marketplaceError } = await admin
          .from("mercadopago_marketplace_config")
          .select("client_id, client_secret, environment")
          .eq("id", 1)
          .maybeSingle();

        if (marketplaceError) throw new Error(marketplaceError.message);

        if (!marketplace?.client_id || !marketplace.client_secret) {
          return new Response(
            JSON.stringify({ error: "Split de pagamentos ainda não configurado pela plataforma." }),
            { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const tokenResponse = await fetch(OAUTH_TOKEN_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            client_id: marketplace.client_id,
            client_secret: marketplace.client_secret,
            grant_type: "authorization_code",
            code,
            redirect_uri: REDIRECT_URI,
          }),
        });

        if (!tokenResponse.ok) {
          const errorBody = await tokenResponse.text().catch(() => "");
          console.error("Mercado Pago token exchange failed:", tokenResponse.status, errorBody);
          return new Response(
            JSON.stringify({ error: "Não foi possível concluir a conexão com o Mercado Pago." }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const tokenData = await tokenResponse.json() as {
          access_token: string;
          refresh_token: string;
          expires_in: number;
          public_key: string;
          user_id: number | string;
        };

        const resolvedEnvironment = marketplace.environment === "production" ? "production" : "test";
        const updateData: Record<string, unknown> = {
          environment: resolvedEnvironment,
          refresh_token: tokenData.refresh_token,
          token_expires_at: new Date(Date.now() + tokenData.expires_in * 1000).toISOString(),
          mp_user_id: String(tokenData.user_id ?? ""),
          is_active: true,
          oauth_state: null,
          updated_at: new Date().toISOString(),
        };
        if (resolvedEnvironment === "production") {
          updateData.access_token_prod = tokenData.access_token;
          updateData.public_key_prod = tokenData.public_key || "";
        } else {
          updateData.access_token_test = tokenData.access_token;
          updateData.public_key_test = tokenData.public_key || "";
        }

        const { error } = await admin
          .from("merchant_payment_credentials")
          .update(updateData)
          .eq("id", existing.id);
        if (error) throw error;

        // Best-effort account label for display in the dashboard — not
        // required for payments to work (the OAuth access_token already
        // identifies the seller), so a failure here doesn't fail the whole
        // connection.
        try {
          const meResponse = await fetch("https://api.mercadopago.com/users/me", {
            headers: { Authorization: `Bearer ${tokenData.access_token}` },
          });
          if (meResponse.ok) {
            const me = await meResponse.json();
            await admin
              .from("merchant_payment_credentials")
              .update({ mp_account_email: me.email ?? "" })
              .eq("id", existing.id);
          }
        } catch (e) {
          console.error("Failed to fetch MP account label after OAuth connect:", e);
        }

        return new Response(
          JSON.stringify({ success: true }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case "disconnect": {
        const { error } = await admin
          .from("merchant_payment_credentials")
          .update({
            refresh_token: null,
            token_expires_at: null,
            mp_user_id: null,
            mp_account_email: "",
            oauth_state: null,
            is_active: false,
            updated_at: new Date().toISOString(),
          })
          .eq("user_id", user.id)
          .eq("provider", "mercadopago");
        if (error) throw error;

        return new Response(
          JSON.stringify({ success: true }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case "refundPayment": {
        const { order_payment_id } = payload as { order_payment_id: string };

        const { data: payment, error: paymentError } = await admin
          .from("order_payments")
          .select("id, order_id, store_owner_id, status, mp_payment_id")
          .eq("id", order_payment_id)
          .maybeSingle();

        if (paymentError) throw new Error(paymentError.message);

        if (!payment || payment.store_owner_id !== user.id) {
          return new Response(
            JSON.stringify({ error: "Pagamento não encontrado" }),
            { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        if (payment.status !== "approved" || !payment.mp_payment_id) {
          return new Response(
            JSON.stringify({ error: "Este pagamento não pode ser reembolsado" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const { data: credentials, error: credentialsError } = await admin
          .from("merchant_payment_credentials")
          .select("environment, access_token_test, access_token_prod")
          .eq("user_id", user.id)
          .eq("provider", "mercadopago")
          .maybeSingle();

        if (credentialsError) throw new Error(credentialsError.message);

        const accessToken = credentials?.environment === "production"
          ? credentials?.access_token_prod
          : credentials?.access_token_test;

        if (!accessToken) {
          return new Response(
            JSON.stringify({ error: "Credenciais do Mercado Pago não configuradas" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // Reembolso total (sem body = 100% do valor). A API do Mercado Pago
        // aceita { amount } para parcial, mas o payment_status de orders é
        // binário (approved -> refunded) e não haveria regra óbvia de quanto
        // estoque devolver num parcial — fora de escopo por ora.
        const mpResponse = await fetch(
          `https://api.mercadopago.com/v1/payments/${payment.mp_payment_id}/refunds`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${accessToken}`,
              "Content-Type": "application/json",
              "X-Idempotency-Key": `${payment.id}-refund`,
            },
          }
        );

        const mpData = await mpResponse.json();

        if (!mpResponse.ok) {
          return new Response(
            JSON.stringify({ error: mpData.message || "Erro ao reembolsar pagamento" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        await admin
          .from("order_payments")
          .update({ status: "refunded", raw_response: mpData, updated_at: new Date().toISOString() })
          .eq("id", payment.id);

        await admin
          .from("orders")
          .update({ payment_status: "refunded" })
          .eq("id", payment.order_id);

        // Mesma logica do merchant-payment-webhook ao ver 'refunded' vindo de
        // um pagamento que estava 'approved' — devolve o estoque real que
        // havia sido deduzido. Duplicada de proposito (nao compartilhada com
        // o webhook) para dar feedback imediato aqui; quando a notificacao
        // assincrona do MP chegar depois, o webhook ve o status ja
        // 'refunded' e nao faz nada de novo (idempotente).
        const { error: restoreError } = await admin.rpc("restore_stock_for_order", {
          p_order_id: payment.order_id,
        });
        if (restoreError) {
          console.error("Failed to restore stock after refund:", payment.order_id, restoreError);
        }

        return new Response(
          JSON.stringify({ success: true, status: "refunded" }),
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
