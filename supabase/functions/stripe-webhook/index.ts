import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import Stripe from "npm:stripe@17";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Stripe-Signature",
};

function received(extra: Record<string, unknown> = {}, status = 200) {
  return new Response(JSON.stringify({ received: true, ...extra }), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

type Admin = ReturnType<typeof createClient>;

function toDateOnly(unixSeconds: number): string {
  return new Date(unixSeconds * 1000).toISOString().split("T")[0];
}

/**
 * Grava direto em users (não em subscriptions/mp_payments — essas são do
 * Mercado Pago). O trigger que sincroniza subscription_end_date a partir de
 * subscriptions não dispara para assinantes Stripe, então essas datas
 * precisam ser escritas aqui.
 */
async function upsertActiveSubscription(
  admin: Admin,
  userId: string,
  stripeCustomerId: string,
  stripeSubscriptionId: string,
  currentPeriodEnd: number
) {
  const endDate = toDateOnly(currentPeriodEnd);
  await admin
    .from("users")
    .update({
      plan_status: "active",
      billing_provider: "stripe",
      stripe_customer_id: stripeCustomerId,
      stripe_subscription_id: stripeSubscriptionId,
      subscription_end_date: endDate,
      next_payment_date: endDate,
    })
    .eq("id", userId);
}

async function findUserIdBySubscriptionOrCustomer(
  admin: Admin,
  stripeSubscriptionId: string | null,
  stripeCustomerId: string | null
): Promise<string | null> {
  if (stripeSubscriptionId) {
    const { data } = await admin
      .from("users")
      .select("id")
      .eq("stripe_subscription_id", stripeSubscriptionId)
      .maybeSingle();
    if (data) return data.id;
  }
  if (stripeCustomerId) {
    const { data } = await admin
      .from("users")
      .select("id")
      .eq("stripe_customer_id", stripeCustomerId)
      .maybeSingle();
    if (data) return data.id;
  }
  return null;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  const signature = req.headers.get("stripe-signature");
  if (!signature) {
    console.error("stripe-webhook: missing stripe-signature header");
    return received({}, 400);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(supabaseUrl, supabaseServiceKey);

  const { data: stripeConfig } = await admin
    .from("stripe_config")
    .select("secret_key_test, secret_key_prod, webhook_secret_test, webhook_secret_prod")
    .eq("is_active", true)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!stripeConfig) {
    console.error("stripe-webhook: stripe_config not set up");
    return received({}, 400);
  }

  const rawBody = await req.text();

  // The same endpoint receives both test-mode and live-mode events, and the
  // secret needed to verify the signature depends on which one it is — try
  // both configured secrets rather than guessing from the payload.
  const candidates: { secretKey: string; webhookSecret: string }[] = [
    { secretKey: stripeConfig.secret_key_test, webhookSecret: stripeConfig.webhook_secret_test },
    { secretKey: stripeConfig.secret_key_prod, webhookSecret: stripeConfig.webhook_secret_prod },
  ].filter((c) => c.secretKey && c.webhookSecret);

  let event: Stripe.Event | null = null;
  let stripeSecretKey = "";

  for (const candidate of candidates) {
    try {
      const stripeAttempt = new Stripe(candidate.secretKey, { apiVersion: "2024-06-20" });
      event = await stripeAttempt.webhooks.constructEventAsync(rawBody, signature, candidate.webhookSecret);
      stripeSecretKey = candidate.secretKey;
      break;
    } catch {
      // try the next candidate
    }
  }

  if (!event) {
    console.error("stripe-webhook: invalid signature (no configured secret matched)");
    return received({}, 400);
  }

  const stripe = new Stripe(stripeSecretKey, { apiVersion: "2024-06-20" });

  const { error: idempotencyError } = await admin
    .from("stripe_webhook_events")
    .insert({ stripe_event_id: event.id, event_type: event.type });

  if (idempotencyError?.code === "23505") {
    return received({ duplicate: true });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const userId = session.client_reference_id;
        const stripeSubscriptionId = session.subscription as string | null;
        const stripeCustomerId = session.customer as string | null;

        if (!userId || !stripeSubscriptionId || !stripeCustomerId) {
          console.error("checkout.session.completed missing identifiers", event.id);
          break;
        }

        const subscription = await stripe.subscriptions.retrieve(stripeSubscriptionId);
        await upsertActiveSubscription(
          admin,
          userId,
          stripeCustomerId,
          stripeSubscriptionId,
          subscription.current_period_end
        );
        break;
      }

      case "invoice.paid": {
        const invoice = event.data.object as Stripe.Invoice;
        const stripeSubscriptionId = invoice.subscription as string | null;
        const stripeCustomerId = invoice.customer as string | null;
        if (!stripeSubscriptionId) break;

        const userId = await findUserIdBySubscriptionOrCustomer(
          admin,
          stripeSubscriptionId,
          stripeCustomerId
        );
        if (!userId) {
          console.error("invoice.paid: user not found", event.id);
          break;
        }

        const subscription = await stripe.subscriptions.retrieve(stripeSubscriptionId);
        await upsertActiveSubscription(
          admin,
          userId,
          stripeCustomerId ?? subscription.customer as string,
          stripeSubscriptionId,
          subscription.current_period_end
        );
        break;
      }

      case "invoice.payment_failed": {
        // Stripe já cuida dos retries (Smart Retries); não derruba o acesso
        // aqui. O rebaixamento real acontece via customer.subscription.deleted.
        console.warn("invoice.payment_failed", event.id);
        break;
      }

      case "customer.subscription.updated": {
        const subscription = event.data.object as Stripe.Subscription;
        const userId = await findUserIdBySubscriptionOrCustomer(
          admin,
          subscription.id,
          subscription.customer as string
        );
        if (!userId) {
          console.error("customer.subscription.updated: user not found", event.id);
          break;
        }

        const endDate = toDateOnly(subscription.current_period_end);
        await admin
          .from("users")
          .update({ subscription_end_date: endDate, next_payment_date: endDate })
          .eq("id", userId);
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        const userId = await findUserIdBySubscriptionOrCustomer(
          admin,
          subscription.id,
          subscription.customer as string
        );
        if (!userId) {
          console.error("customer.subscription.deleted: user not found", event.id);
          break;
        }

        await admin.from("users").update({ plan_status: "expired" }).eq("id", userId);
        break;
      }

      default:
        break;
    }
  } catch (err) {
    console.error(`stripe-webhook: error processing ${event.type}`, event.id, err);
  }

  return received();
});
