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

type BillingCycle = "monthly" | "annual";

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

    const { cycle } = (await req.json()) as { cycle?: BillingCycle };
    if (cycle !== "monthly" && cycle !== "annual") {
      return jsonResponse({ error: "Ciclo de cobrança inválido" }, 422);
    }

    const admin = createClient(supabaseUrl, supabaseServiceKey);

    const { data: profile, error: profileError } = await admin
      .from("users")
      .select("id, email, name, country, billing_currency, billing_provider, plan_status, stripe_customer_id")
      .eq("id", user.id)
      .maybeSingle();

    if (profileError || !profile) {
      return jsonResponse({ error: "Usuário não encontrado" }, 404);
    }

    if (profile.billing_currency === "BRL") {
      return jsonResponse(
        { error: "Assinaturas do Brasil usam o checkout Mercado Pago" },
        422
      );
    }

    if (profile.billing_provider === "stripe" && profile.plan_status === "active") {
      return jsonResponse(
        { error: "Assinatura Stripe já ativa. Use o portal de gerenciamento." },
        409
      );
    }

    const priceEnvVar = `STRIPE_PRICE_${profile.billing_currency}_${cycle.toUpperCase()}`;
    const priceId = Deno.env.get(priceEnvVar);

    if (!priceId) {
      console.error(`Missing Stripe price env var: ${priceEnvVar}`);
      return jsonResponse(
        { error: `Plano ${cycle} em ${profile.billing_currency} não está configurado` },
        422
      );
    }

    const stripeSecretKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeSecretKey) {
      console.error("Missing STRIPE_SECRET_KEY");
      return jsonResponse({ error: "Pagamento internacional indisponível no momento" }, 502);
    }

    const stripe = new Stripe(stripeSecretKey, { apiVersion: "2024-06-20" });

    let stripeCustomerId = profile.stripe_customer_id as string | null;
    if (!stripeCustomerId) {
      const customer = await stripe.customers.create({
        email: profile.email,
        name: profile.name ?? undefined,
        metadata: { supabase_user_id: profile.id },
      });
      stripeCustomerId = customer.id;
      await admin.from("users").update({ stripe_customer_id: stripeCustomerId }).eq("id", profile.id);
    }

    const origin = req.headers.get("origin") || "https://vitrineturbo.com";

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: stripeCustomerId,
      client_reference_id: profile.id,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${origin}/dashboard/settings?stripe=success`,
      cancel_url: `${origin}/dashboard/settings?stripe=cancel`,
      locale: "auto",
      allow_promotion_codes: true,
      automatic_tax: { enabled: true },
    });

    if (!session.url) {
      return jsonResponse({ error: "Falha ao criar sessão de pagamento" }, 502);
    }

    return jsonResponse({ url: session.url });
  } catch (error) {
    console.error("stripe-checkout error", error);
    return jsonResponse({ error: "Erro ao processar pagamento" }, 502);
  }
});
