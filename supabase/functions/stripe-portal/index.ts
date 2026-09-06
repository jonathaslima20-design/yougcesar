import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import Stripe from "npm:stripe@17";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Client-Info, Apikey",
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

/**
 * Creates a Stripe Billing Portal session for the authenticated user so they
 * can update their card, see invoices, or cancel — mirrors stripe-checkout's
 * auth/config-loading pattern. BR/Mercado Pago users never reach this
 * (billing_provider check below); they keep using the existing MP flow.
 */
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return jsonResponse({ error: "Não autorizado" }, 401);
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
      return jsonResponse({ error: "Não autorizado" }, 401);
    }

    const admin = createClient(supabaseUrl, supabaseServiceKey);

    const { data: profile, error: profileError } = await admin
      .from("users")
      .select("id, billing_provider, stripe_customer_id")
      .eq("id", user.id)
      .maybeSingle();

    if (profileError || !profile) {
      return jsonResponse({ error: "Usuário não encontrado" }, 404);
    }

    if (profile.billing_provider !== "stripe" || !profile.stripe_customer_id) {
      return jsonResponse(
        { error: "Este usuário não tem uma assinatura Stripe ativa" },
        422
      );
    }

    const { data: stripeConfig } = await admin
      .from("stripe_config")
      .select("environment, secret_key_test, secret_key_prod")
      .eq("is_active", true)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const stripeSecretKey =
      stripeConfig?.environment === "production"
        ? stripeConfig?.secret_key_prod
        : stripeConfig?.secret_key_test;

    if (!stripeSecretKey) {
      console.error("Stripe not configured (stripe_config missing secret key)");
      return jsonResponse({ error: "Pagamento internacional indisponível no momento" }, 502);
    }

    const stripe = new Stripe(stripeSecretKey, { apiVersion: "2024-06-20" });

    const origin = req.headers.get("origin") || "https://vitrineturbo.com";

    const portalSession = await stripe.billingPortal.sessions.create({
      customer: profile.stripe_customer_id,
      return_url: `${origin}/dashboard/account`,
    });

    return jsonResponse({ url: portalSession.url });
  } catch (error) {
    console.error("stripe-portal error", error);
    return jsonResponse({ error: "Erro ao abrir portal de gerenciamento" }, 502);
  }
});
