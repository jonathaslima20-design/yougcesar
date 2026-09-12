import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, X-Cakto-Signature, X-Cakto-Timestamp",
};

function received(extra: Record<string, unknown> = {}, status = 200) {
  return new Response(JSON.stringify({ received: true, ...extra }), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  const encoder = new TextEncoder();
  const bufA = encoder.encode(a);
  const bufB = encoder.encode(b);
  let result = 0;
  for (let i = 0; i < bufA.length; i++) {
    result |= bufA[i] ^ bufB[i];
  }
  return result === 0;
}

async function verifySignature(rawBody: string, timestamp: string, signature: string, secret: string): Promise<boolean> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const digest = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${timestamp}.${rawBody}`));

  const hexHash = Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  return timingSafeEqual(hexHash, signature);
}

type Admin = ReturnType<typeof createClient>;

// Mirrors cakto/index.ts's activatePlan() — kept in sync manually, same as
// the existing duplication between mercadopago/index.ts and mp-webhook/index.ts.
async function activatePlan(admin: Admin, userId: string, planId: string, billingCycle: string, earlyRenewal = false) {
  const monthsMap: Record<string, number> = {
    Mensal: 1,
    monthly: 1,
    Trimestral: 3,
    quarterly: 3,
    Semestral: 6,
    semiannually: 6,
    Anual: 12,
    annually: 12,
  };

  const months = monthsMap[billingCycle] || 1;
  const now = new Date();

  let baseDate = now;
  if (earlyRenewal) {
    const { data: currentUser } = await admin
      .from("users")
      .select("subscription_end_date, plan_status")
      .eq("id", userId)
      .maybeSingle();

    if (currentUser?.plan_status === "active" && currentUser?.subscription_end_date) {
      const currentEnd = new Date(currentUser.subscription_end_date);
      if (currentEnd > now) {
        baseDate = currentEnd;
      }
    }
  }

  const expiresAt = new Date(baseDate);
  expiresAt.setMonth(expiresAt.getMonth() + months);

  const billingCycleDb =
    months === 1 ? "monthly" : months === 3 ? "quarterly" : months === 6 ? "semiannually" : "annually";

  const { data: plan } = await admin.from("subscription_plans").select("name, price").eq("id", planId).maybeSingle();

  const { data: existingSub } = await admin
    .from("subscriptions")
    .select("id")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existingSub) {
    await admin
      .from("subscriptions")
      .update({
        plan_name: plan?.name || "Plano Pago",
        plan_price: plan?.price || 0,
        billing_cycle: billingCycleDb,
        status: "active",
        payment_status: "paid",
        start_date: now.toISOString().split("T")[0],
        next_payment_date: expiresAt.toISOString().split("T")[0],
        updated_at: now.toISOString(),
      })
      .eq("id", existingSub.id);
  } else {
    await admin.from("subscriptions").insert({
      user_id: userId,
      plan_name: plan?.name || "Plano Pago",
      plan_price: plan?.price || 0,
      billing_cycle: billingCycleDb,
      status: "active",
      payment_status: "paid",
      start_date: now.toISOString().split("T")[0],
      next_payment_date: expiresAt.toISOString().split("T")[0],
    });
  }

  await admin
    .from("users")
    .update({
      plan_status: "active",
      billing_provider: "cakto",
      billing_cycle: billingCycleDb,
      subscription_end_date: expiresAt.toISOString().split("T")[0],
      next_payment_date: expiresAt.toISOString().split("T")[0],
    })
    .eq("id", userId);
}

async function recordOfferConversion(admin: Admin, offerId: string | null | undefined, userId: string) {
  if (!offerId) return;
  const nowIso = new Date().toISOString();
  try {
    await admin
      .from("offer_user_assignments")
      .update({ status: "aceita", status_updated_at: nowIso, converted_at: nowIso })
      .eq("offer_id", offerId)
      .eq("user_id", userId);
    await admin.from("offer_impressions").insert({
      offer_id: offerId,
      user_id: userId,
      action: "convertida",
      session_context: { source: "cakto-webhook" },
    });
  } catch (err) {
    console.error("Failed to record offer conversion", err);
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(supabaseUrl, supabaseServiceKey);

  const rawBody = await req.text();
  let body: any;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return received({}, 400);
  }

  const { data: config } = await admin
    .from("cakto_config")
    .select("webhook_secret")
    .eq("is_active", true)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (config?.webhook_secret) {
    const timestamp = req.headers.get("X-Cakto-Timestamp") || "";
    const signature = req.headers.get("X-Cakto-Signature") || "";

    if (!timestamp || !signature) {
      console.error("cakto-webhook: missing signature headers");
      return received({}, 400);
    }

    const valid = await verifySignature(rawBody, timestamp, signature, config.webhook_secret);
    if (!valid) {
      console.error("cakto-webhook: invalid signature");
      return received({}, 400);
    }
  }

  const eventType = body.event || "";
  const eventId = body.data?.id ? String(body.data.id) : `${eventType}_${Date.now()}`;

  const { error: idempotencyError } = await admin
    .from("cakto_webhook_events")
    .insert({ cakto_event_id: eventId, event_type: eventType });

  if (idempotencyError?.code === "23505") {
    return received({ duplicate: true });
  }

  try {
    const orderId = body.data?.id ? String(body.data.id) : null;
    if (!orderId) {
      return received({});
    }

    const { data: payment } = await admin
      .from("cakto_payments")
      .select("id, user_id, plan_id, billing_cycle, status, early_renewal, offer_id")
      .eq("cakto_order_id", orderId)
      .maybeSingle();

    if (!payment) {
      console.error("cakto-webhook: payment row not found for order", orderId);
      return received({});
    }

    switch (eventType) {
      case "purchase_approved": {
        await admin
          .from("cakto_payments")
          .update({ status: "paid", raw_response: body, updated_at: new Date().toISOString() })
          .eq("id", payment.id);

        if (payment.status !== "paid") {
          await activatePlan(admin, payment.user_id, payment.plan_id, payment.billing_cycle, payment.early_renewal ?? false);
          await recordOfferConversion(admin, payment.offer_id, payment.user_id);
        }
        break;
      }

      case "purchase_refused": {
        await admin
          .from("cakto_payments")
          .update({ status: "declined", raw_response: body, updated_at: new Date().toISOString() })
          .eq("id", payment.id);
        break;
      }

      case "refund":
      case "chargeback": {
        await admin
          .from("cakto_payments")
          .update({ status: eventType, raw_response: body, updated_at: new Date().toISOString() })
          .eq("id", payment.id);
        break;
      }

      default:
        break;
    }
  } catch (err) {
    console.error(`cakto-webhook: error processing ${eventType}`, eventId, err);
  }

  return received({ status: eventType });
});
