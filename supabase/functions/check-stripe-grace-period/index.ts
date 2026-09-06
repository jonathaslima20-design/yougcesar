import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.46.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Client-Info, Apikey",
};

const GRACE_PERIOD_DAYS = 7;

/**
 * Stripe counterpart to check-expiring-subscriptions (which is Mercado-Pago-
 * only). Blocks Stripe subscribers whose payment has been failing for more
 * than GRACE_PERIOD_DAYS — stripe-webhook sets users.payment_failed_at on the
 * first invoice.payment_failed and clears it on the next successful payment,
 * so this job only ever sees users who never recovered.
 */
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    // Internal-only endpoint: triggered by the pg_cron job carrying the shared cron secret
    // (same secret as check-expiring-subscriptions-cron / check-partner-pending-payments-cron).
    const cronSecret = Deno.env.get("CRON_SECRET") ?? "";
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const graceCutoff = new Date(
      Date.now() - GRACE_PERIOD_DAYS * 24 * 60 * 60 * 1000
    ).toISOString();

    const { data: usersToBlock, error } = await supabase
      .from("users")
      .select("id, name")
      .eq("billing_provider", "stripe")
      .eq("plan_status", "active")
      .not("payment_failed_at", "is", null)
      .lt("payment_failed_at", graceCutoff);

    if (error) throw error;

    let usersBlocked = 0;

    for (const user of usersToBlock || []) {
      await supabase
        .from("users")
        .update({ plan_status: "expired" })
        .eq("id", user.id);

      await supabase.from("notifications").insert({
        user_id: user.id,
        type: "subscription_expired",
        title: "Vitrine bloqueada",
        message:
          "Sua assinatura foi bloqueada por falha no pagamento. Atualize seu método de pagamento para reativar o acesso.",
        related_entity_type: "subscription",
      });

      usersBlocked++;
    }

    return new Response(
      JSON.stringify({
        success: true,
        grace_period_days: GRACE_PERIOD_DAYS,
        users_checked: usersToBlock?.length || 0,
        users_blocked: usersBlocked,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("check-stripe-grace-period error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
