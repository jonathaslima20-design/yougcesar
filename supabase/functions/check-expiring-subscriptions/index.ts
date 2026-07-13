import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.46.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Client-Info, Apikey",
};

const GRACE_PERIOD_DAYS = 2;

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const now = new Date();
    const sevenDaysFromNow = new Date(
      now.getTime() + 7 * 24 * 60 * 60 * 1000
    );
    const todayStr = now.toISOString().split("T")[0];
    const futureStr = sevenDaysFromNow.toISOString().split("T")[0];
    const graceCutoff = new Date(
      now.getTime() - GRACE_PERIOD_DAYS * 24 * 60 * 60 * 1000
    );
    const graceCutoffStr = graceCutoff.toISOString().split("T")[0];

    let notificationsCreated = 0;
    let notificationsSkipped = 0;
    let usersBlocked = 0;
    let usersSynced = 0;

    // 0. Sync users.subscription_end_date from subscriptions table
    // This prevents desync issues where admin updates subscriptions.next_payment_date
    // but users.subscription_end_date stays stale.
    const { data: activeSubscriptions } = await supabase
      .from("subscriptions")
      .select("user_id, next_payment_date")
      .eq("status", "active")
      .not("next_payment_date", "is", null);

    for (const sub of activeSubscriptions || []) {
      const nextPayment = sub.next_payment_date?.split("T")[0];
      if (!nextPayment) continue;

      const { data: user } = await supabase
        .from("users")
        .select("id, subscription_end_date")
        .eq("id", sub.user_id)
        .maybeSingle();

      if (user && user.subscription_end_date !== nextPayment) {
        await supabase
          .from("users")
          .update({ subscription_end_date: nextPayment })
          .eq("id", user.id);
        usersSynced++;
      }
    }

    // 1. Notify users with subscriptions expiring in the next 7 days
    const { data: expiringUsers, error: queryError } = await supabase
      .from("users")
      .select("id, name, subscription_end_date, plan_status")
      .eq("plan_status", "active")
      .not("subscription_end_date", "is", null)
      .not("role", "in", '("admin","parceiro")')
      .gte("subscription_end_date", todayStr)
      .lte("subscription_end_date", futureStr);

    if (queryError) throw queryError;

    for (const user of expiringUsers || []) {
      const { data: existing } = await supabase
        .from("notifications")
        .select("id")
        .eq("user_id", user.id)
        .eq("type", "subscription_expiring")
        .gte(
          "created_at",
          new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000).toISOString()
        )
        .limit(1);

      if (existing && existing.length > 0) {
        notificationsSkipped++;
        continue;
      }

      const endDate = new Date(user.subscription_end_date);
      const daysLeft = Math.ceil(
        (endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
      );

      await supabase.from("notifications").insert({
        user_id: user.id,
        type: "subscription_expiring",
        title: "Assinatura expirando",
        message:
          daysLeft <= 1
            ? "Sua assinatura expira hoje! Renove para manter sua vitrine ativa."
            : `Sua assinatura expira em ${daysLeft} dias. Renove para manter sua vitrine ativa.`,
        related_entity_type: "subscription",
      });

      notificationsCreated++;
    }

    // 2. Notify users whose subscription just expired (within grace period)
    const { data: recentlyExpiredUsers } = await supabase
      .from("users")
      .select("id, name, subscription_end_date, plan_status")
      .eq("plan_status", "active")
      .not("subscription_end_date", "is", null)
      .not("role", "in", '("admin","parceiro")')
      .lt("subscription_end_date", todayStr)
      .gte("subscription_end_date", graceCutoffStr);

    for (const user of recentlyExpiredUsers || []) {
      const { data: existing } = await supabase
        .from("notifications")
        .select("id")
        .eq("user_id", user.id)
        .eq("type", "subscription_expired")
        .gte(
          "created_at",
          new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000).toISOString()
        )
        .limit(1);

      if (existing && existing.length > 0) {
        notificationsSkipped++;
        continue;
      }

      const endDate = new Date(user.subscription_end_date);
      const daysOverdue = Math.ceil(
        (now.getTime() - endDate.getTime()) / (1000 * 60 * 60 * 24)
      );
      const daysRemaining = GRACE_PERIOD_DAYS - daysOverdue;

      await supabase.from("notifications").insert({
        user_id: user.id,
        type: "subscription_expired",
        title: "Assinatura vencida",
        message:
          daysRemaining > 0
            ? `Sua assinatura venceu. Voce tem mais ${daysRemaining} dia(s) para renovar antes do bloqueio automatico.`
            : "Sua assinatura venceu. Renove agora para evitar o bloqueio da sua vitrine.",
        related_entity_type: "subscription",
      });

      notificationsCreated++;
    }

    // 3. Auto-block users whose subscription expired beyond the grace period
    const { data: usersToBlock } = await supabase
      .from("users")
      .select("id, name, subscription_end_date")
      .eq("plan_status", "active")
      .not("subscription_end_date", "is", null)
      .not("role", "in", '("admin","parceiro")')
      .lt("subscription_end_date", graceCutoffStr);

    for (const user of usersToBlock || []) {
      // Double-check: skip if there's an active subscription with a future date
      const { data: activeSub } = await supabase
        .from("subscriptions")
        .select("id, next_payment_date")
        .eq("user_id", user.id)
        .eq("status", "active")
        .gt("next_payment_date", todayStr)
        .limit(1);

      if (activeSub && activeSub.length > 0) {
        // Subscription is actually valid - sync the date instead of expiring
        await supabase
          .from("users")
          .update({
            subscription_end_date:
              activeSub[0].next_payment_date.split("T")[0],
          })
          .eq("id", user.id);
        usersSynced++;
        continue;
      }

      await supabase
        .from("users")
        .update({ plan_status: "expired" })
        .eq("id", user.id);

      await supabase
        .from("subscriptions")
        .update({
          status: "cancelled",
          payment_status: "overdue",
          updated_at: now.toISOString(),
        })
        .eq("user_id", user.id)
        .eq("status", "active");

      await supabase.from("notifications").insert({
        user_id: user.id,
        type: "subscription_expired",
        title: "Vitrine bloqueada",
        message:
          "Sua vitrine foi bloqueada por falta de pagamento. Renove seu plano para reativar o acesso completo.",
        related_entity_type: "subscription",
      });

      usersBlocked++;
      notificationsCreated++;
    }

    return new Response(
      JSON.stringify({
        success: true,
        grace_period_days: GRACE_PERIOD_DAYS,
        expiring_users_found: expiringUsers?.length || 0,
        recently_expired_in_grace: recentlyExpiredUsers?.length || 0,
        users_blocked: usersBlocked,
        users_synced: usersSynced,
        notifications_created: notificationsCreated,
        notifications_skipped: notificationsSkipped,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("check-expiring-subscriptions error:", error);
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
