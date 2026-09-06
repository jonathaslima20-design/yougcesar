import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

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

const PRODUCT_ID = "vitrineturbo_pro";
const PRODUCT_NAME = "VitrineTurbo Pro";

// Mirrors scripts/setup-stripe-products.js's PLANS exactly — same amounts,
// same tax_behavior per currency. Kept as an admin-triggered Edge Function
// (instead of a local Node script) so it can be run entirely from
// /admin/stripe, reusing the credentials already saved in stripe_config.
const PLANS: {
  currency: "MXN" | "CLP" | "EUR" | "USD";
  monthly: number;
  annual: number;
  taxBehavior: "inclusive" | "exclusive";
  zeroDecimal?: boolean;
}[] = [
  { currency: "MXN", monthly: 199.0, annual: 1199.0, taxBehavior: "exclusive" },
  { currency: "CLP", monthly: 9990, annual: 59990, taxBehavior: "exclusive", zeroDecimal: true },
  { currency: "EUR", monthly: 12.99, annual: 79.0, taxBehavior: "inclusive" },
  { currency: "USD", monthly: 14.99, annual: 89.0, taxBehavior: "exclusive" },
];

async function stripeRequest(
  secretKey: string,
  method: string,
  path: string,
  body?: Record<string, string>
) {
  const res = await fetch(`https://api.stripe.com/v1${path}`, {
    method,
    headers: {
      Authorization: `Basic ${btoa(`${secretKey}:`)}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: body ? new URLSearchParams(body) : undefined,
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(`Stripe ${method} ${path} failed: ${data.error?.message || res.statusText}`);
  }
  return data;
}

async function getOrCreateProduct(secretKey: string) {
  try {
    return await stripeRequest(secretKey, "GET", `/products/${PRODUCT_ID}`);
  } catch {
    return stripeRequest(secretKey, "POST", "/products", { id: PRODUCT_ID, name: PRODUCT_NAME });
  }
}

async function getOrCreatePrice(
  secretKey: string,
  opts: {
    productId: string;
    currency: string;
    amount: number;
    interval: "month" | "year";
    taxBehavior: string;
    zeroDecimal?: boolean;
  }
) {
  const lookupKey = `vitrineturbo_${opts.currency.toLowerCase()}_${opts.interval === "month" ? "monthly" : "annual"}`;

  const existing = await stripeRequest(
    secretKey,
    "GET",
    `/prices?lookup_keys[]=${encodeURIComponent(lookupKey)}&active=true`
  );
  if (existing.data && existing.data.length > 0) {
    return { id: existing.data[0].id as string, reused: true };
  }

  const unitAmount = opts.zeroDecimal ? Math.round(opts.amount) : Math.round(opts.amount * 100);

  const price = await stripeRequest(secretKey, "POST", "/prices", {
    product: opts.productId,
    currency: opts.currency.toLowerCase(),
    unit_amount: String(unitAmount),
    "recurring[interval]": opts.interval,
    tax_behavior: opts.taxBehavior,
    lookup_key: lookupKey,
  });

  return { id: price.id as string, reused: false };
}

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

    const { data: profile } = await admin
      .from("users")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();

    if (!profile || profile.role !== "admin") {
      return jsonResponse({ error: "Acesso negado" }, 403);
    }

    const { environment } = (await req.json()) as { environment?: string };
    const env = environment === "production" ? "production" : "test";

    const { data: config } = await admin
      .from("stripe_config")
      .select("secret_key_test, secret_key_prod")
      .eq("is_active", true)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const secretKey = env === "production" ? config?.secret_key_prod : config?.secret_key_test;

    if (!secretKey) {
      return jsonResponse(
        { error: `Chave secreta de ${env === "production" ? "produção" : "teste"} não configurada. Salve as credenciais primeiro.` },
        422
      );
    }

    const product = await getOrCreateProduct(secretKey);

    const results: { currency: string; cycle: string; price_id: string; reused: boolean }[] = [];

    for (const plan of PLANS) {
      for (const [cycle, interval] of [["monthly", "month"], ["annual", "year"]] as const) {
        const amount = cycle === "monthly" ? plan.monthly : plan.annual;
        const price = await getOrCreatePrice(secretKey, {
          productId: product.id,
          currency: plan.currency,
          amount,
          interval,
          taxBehavior: plan.taxBehavior,
          zeroDecimal: plan.zeroDecimal,
        });

        await admin.from("stripe_prices").upsert(
          {
            environment: env,
            currency: plan.currency,
            cycle,
            price_id: price.id,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "environment,currency,cycle" }
        );

        results.push({ currency: plan.currency, cycle, price_id: price.id, reused: price.reused });
      }
    }

    return jsonResponse({ success: true, environment: env, product_id: product.id, prices: results });
  } catch (error) {
    console.error("setup-stripe-products error", error);
    return jsonResponse({ error: error instanceof Error ? error.message : "Erro interno" }, 500);
  }
});
