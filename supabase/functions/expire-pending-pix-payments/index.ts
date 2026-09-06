import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.46.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Client-Info, Apikey",
};

// A PIX that simply times out unattended never triggers a Mercado Pago
// webhook notification — only actions taken against the payment do. This
// job is the only thing that ever learns about that kind of abandonment.
const SAFETY_NET_MINUTES = 60;

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    // Internal-only endpoint: bypasses RLS via the service role key and is
    // meant to be triggered only by the pg_cron job carrying the shared cron secret.
    const cronSecret = Deno.env.get("CRON_SECRET") ?? "";
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const now = new Date();
    let expiredCount = 0;
    let safetyReleasedCount = 0;

    // Pass 1: PIX charges past their own Mercado Pago expiration.
    const { data: expiredPayments, error: pixError } = await admin
      .from("order_payments")
      .select("id, order_id")
      .eq("status", "pending")
      .eq("payment_method", "pix")
      .not("pix_expires_at", "is", null)
      .lt("pix_expires_at", now.toISOString());

    if (pixError) throw pixError;

    for (const payment of expiredPayments || []) {
      await admin
        .from("order_payments")
        .update({ status: "expired", updated_at: now.toISOString() })
        .eq("id", payment.id);

      const { error: releaseError } = await admin.rpc("release_order_stock_reservation", {
        p_order_id: payment.order_id,
      });
      if (releaseError) {
        console.error("Failed to release reservation for expired PIX:", payment.order_id, releaseError);
      } else {
        expiredCount++;
      }
    }

    // Pass 2: safety net for orders that never got a payment attempt at all
    // (buyer abandoned the payment page before generating a PIX/submitting a
    // card) or a card stuck in async review — nothing about order/payment
    // status changes here, only the stock hold is released.
    const safetyCutoff = new Date(now.getTime() - SAFETY_NET_MINUTES * 60 * 1000).toISOString();
    const { data: staleOrders, error: staleError } = await admin
      .from("orders")
      .select("id")
      .eq("payment_status", "pending")
      .not("stock_reserved_at", "is", null)
      .lt("stock_reserved_at", safetyCutoff);

    if (staleError) throw staleError;

    for (const order of staleOrders || []) {
      const { error: releaseError } = await admin.rpc("release_order_stock_reservation", {
        p_order_id: order.id,
      });
      if (releaseError) {
        console.error("Failed to release stale reservation:", order.id, releaseError);
      } else {
        safetyReleasedCount++;
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        expired_count: expiredCount,
        safety_released_count: safetyReleasedCount,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("expire-pending-pix-payments error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
