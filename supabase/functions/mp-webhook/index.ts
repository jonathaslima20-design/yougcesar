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
  if (!webhookSecret) return true;

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

  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(manifest)
  );

  const hexHash = Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  return timingSafeEqual(hexHash, v1);
}

async function activatePlan(
  admin: ReturnType<typeof createClient>,
  userId: string,
  planId: string,
  billingCycle: string,
  earlyRenewal = false
) {
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

    if (
      currentUser?.plan_status === "active" &&
      currentUser?.subscription_end_date
    ) {
      const currentEnd = new Date(currentUser.subscription_end_date);
      if (currentEnd > now) {
        baseDate = currentEnd;
      }
    }
  }

  const expiresAt = new Date(baseDate);
  expiresAt.setMonth(expiresAt.getMonth() + months);

  const billingCycleDb =
    months === 1
      ? "monthly"
      : months === 3
        ? "quarterly"
        : months === 6
          ? "semiannually"
          : "annually";

  const { data: plan } = await admin
    .from("subscription_plans")
    .select("name, price")
    .eq("id", planId)
    .maybeSingle();

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
      billing_cycle: billingCycleDb,
    })
    .eq("id", userId);
}

async function recordOfferConversion(
  admin: ReturnType<typeof createClient>,
  offerId: string | null | undefined,
  userId: string
) {
  if (!offerId) return;
  const nowIso = new Date().toISOString();
  try {
    await admin
      .from("offer_user_assignments")
      .update({
        status: "aceita",
        status_updated_at: nowIso,
        converted_at: nowIso,
      })
      .eq("offer_id", offerId)
      .eq("user_id", userId);

    await admin.from("offer_impressions").insert({
      offer_id: offerId,
      user_id: userId,
      action: "convertida",
      session_context: { source: "mp-webhook" },
    });
  } catch (err) {
    console.error("Failed to record offer conversion", err);
  }
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

    const { data: config } = await admin
      .from("mercadopago_config")
      .select("webhook_secret, environment, access_token_test, access_token_prod")
      .eq("is_active", true)
      .limit(1)
      .maybeSingle();

    if (config?.webhook_secret) {
      const valid = await verifySignature(req, dataId, config.webhook_secret);
      if (!valid) {
        console.error("Invalid webhook signature");
        return new Response(JSON.stringify({ received: true }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const { error: idempotencyError } = await admin
      .from("payment_webhook_events")
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

    const accessToken =
      config?.environment === "production"
        ? config?.access_token_prod
        : config?.access_token_test;

    if (!accessToken) {
      console.error("No access token configured");
      return new Response(JSON.stringify({ received: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const mpResponse = await fetch(
      `https://api.mercadopago.com/v1/payments/${dataId}`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );

    if (!mpResponse.ok) {
      console.error("Failed to fetch payment from MP:", mpResponse.status);
      return new Response(JSON.stringify({ received: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const mpPayment = await mpResponse.json();
    const externalRef = mpPayment.external_reference;
    const mpStatus = mpPayment.status || "";

    if (!externalRef) {
      console.error("No external_reference in payment");
      return new Response(JSON.stringify({ received: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: paymentRow } = await admin
      .from("mp_payments")
      .select("id, user_id, plan_id, billing_cycle, status, early_renewal, offer_id")
      .eq("id", externalRef)
      .maybeSingle();

    if (!paymentRow) {
      const { data: paymentByMpId } = await admin
        .from("mp_payments")
        .select("id, user_id, plan_id, billing_cycle, status, early_renewal, offer_id")
        .eq("mp_payment_id", dataId)
        .maybeSingle();

      if (!paymentByMpId) {
        console.error("Payment row not found for ref:", externalRef);
        return new Response(JSON.stringify({ received: true }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      await admin
        .from("mp_payments")
        .update({
          status: mpStatus,
          status_detail: mpPayment.status_detail || "",
          raw_response: mpPayment,
          updated_at: new Date().toISOString(),
        })
        .eq("id", paymentByMpId.id);

      if (mpStatus === "approved" && paymentByMpId.status !== "approved") {
        await activatePlan(
          admin,
          paymentByMpId.user_id,
          paymentByMpId.plan_id,
          paymentByMpId.billing_cycle,
          paymentByMpId.early_renewal ?? false
        );
        await recordOfferConversion(admin, paymentByMpId.offer_id, paymentByMpId.user_id);
      }
    } else {
      await admin
        .from("mp_payments")
        .update({
          status: mpStatus,
          status_detail: mpPayment.status_detail || "",
          mp_payment_id: dataId,
          raw_response: mpPayment,
          updated_at: new Date().toISOString(),
        })
        .eq("id", paymentRow.id);

      if (mpStatus === "approved" && paymentRow.status !== "approved") {
        await activatePlan(
          admin,
          paymentRow.user_id,
          paymentRow.plan_id,
          paymentRow.billing_cycle,
          paymentRow.early_renewal ?? false
        );
        await recordOfferConversion(admin, paymentRow.offer_id, paymentRow.user_id);
      }
    }

    await admin
      .from("payment_webhook_events")
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
