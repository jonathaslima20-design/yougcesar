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

    // credentials.access_token is resolved per-merchant (environment ->
    // access_token_test/prod, populated by the OAuth "Conectar com Mercado
    // Pago" flow — see merchant-payment-settings' exchangeCode), but the
    // x-signature secret is no longer per-merchant: split payments are all
    // created under the platform's own MP Application, so MP signs every
    // notification with that Application's single webhook secret
    // (mercadopago_marketplace_config.webhook_secret), regardless of which
    // connected seller the payment belongs to.
    const [{ data: credentialsRow }, { data: marketplaceConfig }] = await Promise.all([
      admin
        .from("merchant_payment_credentials")
        .select("environment, access_token_test, access_token_prod")
        .eq("user_id", paymentRow.store_owner_id)
        .eq("provider", "mercadopago")
        .maybeSingle(),
      admin
        .from("mercadopago_marketplace_config")
        .select("webhook_secret")
        .eq("id", 1)
        .maybeSingle(),
    ]);

    const credentials = credentialsRow
      ? {
          access_token: credentialsRow.environment === "production"
            ? credentialsRow.access_token_prod
            : credentialsRow.access_token_test,
        }
      : null;

    const validSignature = marketplaceConfig
      ? await verifySignature(req, dataId, marketplaceConfig.webhook_secret)
      : false;

    if (!validSignature) {
      console.error("Invalid or missing webhook signature for order_payment:", paymentRow.id);
      return new Response(JSON.stringify({ received: true }), {
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

    // Approved/rejected/cancelled all funnel through the same locked,
    // idempotent RPC that the buyer's own status polling and the
    // synchronous payment-creation paths call — whichever of them reaches
    // a given transition first is the one that actually runs the stock/
    // cashback side effects, and the others become safe no-ops instead of
    // silently skipping those side effects (the original bug this fixes).
    //
    // Refund/chargeback reversal is intentionally NOT routed through that
    // RPC yet (out of scope for this change) and keeps its own handling
    // below, unchanged from before.
    let processingError: string | null = null;

    if (["approved", "rejected", "cancelled"].includes(mpStatus)) {
      const { error } = await admin.rpc("process_order_payment_result", {
        p_order_payment_id: paymentRow.id,
        p_mp_status: mpStatus,
        p_status_detail: mpPayment.status_detail || "",
        p_raw_response: mpPayment,
      });
      if (error) {
        console.error("process_order_payment_result failed:", paymentRow.id, error);
        processingError = error.message;
      }
    } else if (
      ["refunded", "charged_back"].includes(mpStatus) &&
      paymentRow.status !== mpStatus
    ) {
      const orderPaymentStatus = mpStatus === "charged_back" ? "refunded" : mpStatus;

      await admin
        .from("order_payments")
        .update({
          status: mpStatus,
          status_detail: mpPayment.status_detail || "",
          raw_response: mpPayment,
          updated_at: new Date().toISOString(),
        })
        .eq("id", paymentRow.id);

      await admin
        .from("orders")
        .update({ payment_status: orderPaymentStatus })
        .eq("id", paymentRow.order_id);

      // Se o pagamento foi aprovado antes e agora voltou atras (estorno /
      // chargeback), o estoque que saiu precisa voltar.
      if (paymentRow.status === "approved") {
        const { error: restoreError } = await admin.rpc("restore_stock_for_order", {
          p_order_id: paymentRow.order_id,
        });
        if (restoreError) {
          console.error("Failed to restore stock after reversal:", paymentRow.order_id, restoreError);
        }
      } else {
        const { error: releaseError } = await admin.rpc("release_order_stock_reservation", {
          p_order_id: paymentRow.order_id,
        });
        if (releaseError) {
          console.error("Failed to release stock reservation:", paymentRow.order_id, releaseError);
        }
      }
    }

    // Audit log only from here on — inserted AFTER processing, never used
    // to gate whether processing happens. A duplicate MP retry hitting the
    // unique constraint is expected and harmless (the RPC above is already
    // idempotent on its own), so it's swallowed rather than surfaced.
    await admin
      .from("order_payment_webhook_events")
      .insert({
        mp_event_id: `${dataId}_${action}`,
        event_type: action,
        mp_payment_id: dataId,
        payload: body,
        processed: !processingError,
      })
      .then(
        () => {},
        () => {}
      );

    if (processingError) {
      // Unlike before, a real processing failure is NOT acked as 200 — MP
      // needs to retry this notification instead of the payment getting
      // stuck approved-at-MP/pending-in-our-database forever.
      return new Response(JSON.stringify({ received: true, error: processingError }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ received: true, status: mpStatus }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Webhook error:", error);
    // A genuine unexpected failure (not one of the intentional early acks
    // above) must not be swallowed as 200 — that used to permanently strand
    // an already-approved MP payment as "pending" on our side whenever
    // something here threw (e.g. missing merchant credentials), because MP
    // stops retrying once it gets a 200.
    return new Response(JSON.stringify({ received: true, error: String(error) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
