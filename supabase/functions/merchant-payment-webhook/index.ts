import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Client-Info, Apikey",
};

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

async function verifySignature(
  req: Request,
  dataId: string,
  webhookSecret: string
): Promise<boolean> {
  // Unlike mp-webhook (platform subscription billing), there is no "skip
  // verification if no secret configured" fallback here: money settles
  // directly and irreversibly into a merchant's own account, so a missing or
  // invalid signature always means the notification is rejected.
  if (!webhookSecret) return false;

  const xSignature = req.headers.get("x-signature");
  const xRequestId = req.headers.get("x-request-id");
  if (!xSignature || !xRequestId) return false;

  const parts: Record<string, string> = {};
  xSignature.split(",").forEach((part) => {
    const [key, value] = part.split("=");
    if (key && value) parts[key.trim()] = value.trim();
  });

  const ts = parts["ts"];
  const v1 = parts["v1"];
  if (!ts || !v1) return false;

  const manifest = `id:${dataId};request-id:${xRequestId};ts:${ts};`;

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(webhookSecret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(manifest));
  const hexHash = Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  return timingSafeEqual(hexHash, v1);
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(supabaseUrl, supabaseServiceKey);

    const body = await req.json();
    const action = body.action || body.type || "";
    const dataId = body.data?.id ? String(body.data.id) : "";

    if (!dataId) {
      return new Response(JSON.stringify({ received: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Identify which merchant this notification belongs to via our own
    // order_payments row (mp_payment_id was stored synchronously right after
    // the payment was created — no need to call the MP API to learn who owns
    // this notification, which is what lets us gate signature verification
    // per-merchant instead of against a single global secret).
    const { data: paymentRow } = await admin
      .from("order_payments")
      .select("id, order_id, store_owner_id, status")
      .eq("mp_payment_id", dataId)
      .maybeSingle();

    if (!paymentRow) {
      // Not one of ours (or arrived before our own write finished) — ack and move on.
      return new Response(JSON.stringify({ received: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: credentials } = await admin
      .from("merchant_payment_credentials")
      .select("access_token, webhook_secret")
      .eq("user_id", paymentRow.store_owner_id)
      .eq("provider", "mercadopago")
      .maybeSingle();

    const validSignature = credentials
      ? await verifySignature(req, dataId, credentials.webhook_secret)
      : false;

    if (!validSignature) {
      console.error("Invalid or missing webhook signature for order_payment:", paymentRow.id);
      return new Response(JSON.stringify({ received: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { error: idempotencyError } = await admin
      .from("order_payment_webhook_events")
      .insert({
        mp_event_id: `${dataId}_${action}`,
        event_type: action,
        mp_payment_id: dataId,
        payload: body,
      });

    if (idempotencyError?.code === "23505") {
      return new Response(JSON.stringify({ received: true, duplicate: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Re-fetch the payment from MP's authenticated API using the merchant's
    // own token before writing any state — never trust the webhook payload's
    // own status field.
    const mpResponse = await fetch(`https://api.mercadopago.com/v1/payments/${dataId}`, {
      headers: { Authorization: `Bearer ${credentials!.access_token}` },
    });

    if (!mpResponse.ok) {
      console.error("Failed to fetch payment from MP:", mpResponse.status);
      return new Response(JSON.stringify({ received: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const mpPayment = await mpResponse.json();
    const mpStatus = mpPayment.status || "";

    await admin
      .from("order_payments")
      .update({
        status: mpStatus,
        status_detail: mpPayment.status_detail || "",
        raw_response: mpPayment,
        updated_at: new Date().toISOString(),
      })
      .eq("id", paymentRow.id);

    if (mpStatus === "approved" && paymentRow.status !== "approved") {
      await admin.from("orders").update({ payment_status: "approved" }).eq("id", paymentRow.order_id);
    }

    await admin
      .from("order_payment_webhook_events")
      .update({ processed: true })
      .eq("mp_event_id", `${dataId}_${action}`);

    return new Response(JSON.stringify({ received: true, status: mpStatus }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Webhook error:", error);
    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
