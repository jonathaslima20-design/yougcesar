#!/usr/bin/env node
/*
 * Cria (ou reaproveita) o Product + 8 Prices da assinatura internacional do
 * VitrineTurbo na Stripe (MXN/CLP/EUR/USD x mensal/anual). Idempotente:
 * pode ser rodado várias vezes sem duplicar nada.
 *
 * Uso (rode uma vez com a chave de teste, outra com a de produção):
 *   STRIPE_SECRET_KEY=sk_test_... node scripts/setup-stripe-products.js
 *   STRIPE_SECRET_KEY=sk_live_... node scripts/setup-stripe-products.js
 *
 * A chave nunca é lida daqui além de process.env — não roda em CI, não é
 * chamado pelo app, é para o dono do produto rodar localmente. Os price_id
 * impressos no final vão colados no painel Admin do VitrineTurbo
 * (Admin > Stripe > Preços por país), não em variável de ambiente.
 */

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
if (!STRIPE_SECRET_KEY) {
  console.error("Defina STRIPE_SECRET_KEY no ambiente antes de rodar este script.");
  process.exit(1);
}

const STRIPE_API = "https://api.stripe.com/v1";
const PRODUCT_ID = "vitrineturbo_pro";
const PRODUCT_NAME = "VitrineTurbo Pro";

// Zero-decimal currencies não multiplicam por 100 (CLP).
const PLANS = [
  { currency: "MXN", monthly: 199.0, annual: 1199.0, taxBehavior: "exclusive" },
  { currency: "CLP", monthly: 9990, annual: 59990, taxBehavior: "exclusive", zeroDecimal: true },
  { currency: "EUR", monthly: 12.99, annual: 79.0, taxBehavior: "inclusive" },
  { currency: "USD", monthly: 14.99, annual: 89.0, taxBehavior: "exclusive" },
];

async function stripeRequest(method, path, body) {
  const res = await fetch(`${STRIPE_API}${path}`, {
    method,
    headers: {
      Authorization: `Basic ${Buffer.from(`${STRIPE_SECRET_KEY}:`).toString("base64")}`,
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

async function getOrCreateProduct() {
  try {
    return await stripeRequest("GET", `/products/${PRODUCT_ID}`);
  } catch {
    return stripeRequest("POST", "/products", { id: PRODUCT_ID, name: PRODUCT_NAME });
  }
}

async function getOrCreatePrice({ productId, currency, amount, interval, taxBehavior, zeroDecimal }) {
  const lookupKey = `vitrineturbo_${currency.toLowerCase()}_${interval === "month" ? "monthly" : "annual"}`;

  const existing = await stripeRequest(
    "GET",
    `/prices?lookup_keys[]=${encodeURIComponent(lookupKey)}&active=true`
  );
  if (existing.data && existing.data.length > 0) {
    return { id: existing.data[0].id, lookupKey, reused: true };
  }

  const unitAmount = zeroDecimal ? Math.round(amount) : Math.round(amount * 100);

  const price = await stripeRequest("POST", "/prices", {
    product: productId,
    currency: currency.toLowerCase(),
    unit_amount: String(unitAmount),
    "recurring[interval]": interval,
    tax_behavior: taxBehavior,
    lookup_key: lookupKey,
  });

  return { id: price.id, lookupKey, reused: false };
}

async function main() {
  console.log(`Criando/reaproveitando produto "${PRODUCT_NAME}" (${PRODUCT_ID})...`);
  const product = await getOrCreateProduct();
  console.log(`Product: ${product.id}\n`);

  const envVars = [];

  for (const plan of PLANS) {
    for (const [cycle, interval] of [["monthly", "month"], ["annual", "year"]]) {
      const amount = cycle === "monthly" ? plan.monthly : plan.annual;
      const price = await getOrCreatePrice({
        productId: product.id,
        currency: plan.currency,
        amount,
        interval,
        taxBehavior: plan.taxBehavior,
        zeroDecimal: plan.zeroDecimal,
      });

      const envName = `STRIPE_PRICE_${plan.currency}_${cycle.toUpperCase()}`;
      envVars.push([envName, price.id]);

      console.log(
        `${plan.currency} ${cycle}: ${price.id} (${price.reused ? "reaproveitado" : "criado"})`
      );
    }
  }

  console.log("\nCole estes Price IDs no painel Admin do VitrineTurbo (Admin > Stripe > Preços por país):\n");
  for (const [name, value] of envVars) {
    console.log(`${name}=${value}`);
  }
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
