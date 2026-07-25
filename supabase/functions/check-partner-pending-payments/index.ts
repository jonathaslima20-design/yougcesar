import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.46.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    // Internal-only endpoint: this batch job bypasses RLS via the service role key and is
    // meant to be triggered only by the pg_cron job carrying the shared cron secret.
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

    const now = new Date();
    let usersBlocked = 0;

    // Only rows from the partner-assigned-plan flow ever have payment_due_at
    // set, so this filter alone scopes the job — no extra discriminator needed.
    const { data: overdueSubs, error: queryError } = await supabase
      .from("subscriptions")
      .select("id, user_id, plan_name")
      .eq("status", "pending")
      .not("payment_due_at", "is", null)
      .lt("payment_due_at", now.toISOString());

    if (queryError) throw queryError;

    for (const sub of overdueSubs || []) {
      await supabase
        .from("users")
        .update({ plan_status: "expired" })
        .eq("id", sub.user_id);

      await supabase
        .from("subscriptions")
        .update({
          status: "cancelled",
          payment_status: "overdue",
          updated_at: now.toISOString(),
        })
        .eq("id", sub.id);

      await supabase.from("notifications").insert({
        user_id: sub.user_id,
        type: "subscription_expired",
        title: "Vitrine bloqueada",
        message:
          `O prazo para pagamento do plano ${sub.plan_name || ""} expirou. Sua vitrine foi bloqueada — regularize o pagamento para reativar o acesso.`,
        related_entity_type: "subscription",
      });

      usersBlocked++;
    }

    return new Response(
      JSON.stringify({
        success: true,
        users_blocked: usersBlocked,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("check-partner-pending-payments error:", error);
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
