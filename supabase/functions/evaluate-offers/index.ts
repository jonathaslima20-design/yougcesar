import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.46.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const now = new Date().toISOString();

    // 1. Deactivate expired offers
    const { data: expiredOffers } = await supabase
      .from("promotional_offers")
      .update({ is_active: false })
      .eq("is_active", true)
      .lt("data_fim", now)
      .not("data_fim", "is", null)
      .select("id");

    const expiredCount = expiredOffers?.length || 0;

    // 2. Mark assignments as expired for deactivated offers
    if (expiredOffers && expiredOffers.length > 0) {
      const expiredIds = expiredOffers.map((o: { id: string }) => o.id);
      await supabase
        .from("offer_user_assignments")
        .update({ status: "expirada", status_updated_at: now })
        .in("offer_id", expiredIds)
        .in("status", ["pendente", "visualizada"]);
    }

    // 3. Evaluate active offers with targeting rules and create auto-assignments
    const { data: activeOffers } = await supabase
      .from("promotional_offers")
      .select("id")
      .eq("is_active", true)
      .lte("data_inicio", now)
      .or(`data_fim.is.null,data_fim.gte.${now}`);

    let autoAssignments = 0;

    if (activeOffers && activeOffers.length > 0) {
      const offerIds = activeOffers.map((o: { id: string }) => o.id);

      // Get targeting rules for active offers
      const { data: rules } = await supabase
        .from("offer_targeting_rules")
        .select("*")
        .in("offer_id", offerIds);

      if (rules && rules.length > 0) {
        // Get display configs to check for manual-only offers
        const { data: configs } = await supabase
          .from("offer_display_config")
          .select("offer_id, gatilho_acao")
          .in("offer_id", offerIds);

        const manualOnlyOffers = new Set(
          (configs || [])
            .filter((c: { gatilho_acao: string }) => c.gatilho_acao === "manual_apenas")
            .map((c: { offer_id: string }) => c.offer_id)
        );

        // Group rules by offer
        const rulesByOffer = new Map<string, typeof rules>();
        for (const rule of rules) {
          if (manualOnlyOffers.has(rule.offer_id)) continue;
          const existing = rulesByOffer.get(rule.offer_id) || [];
          existing.push(rule);
          rulesByOffer.set(rule.offer_id, existing);
        }

        // Get all non-admin users
        const { data: users } = await supabase
          .from("users")
          .select("id, plan_status, billing_cycle, created_at, subscription_end_date, subscription_plan_name, last_login_at")
          .neq("role", "admin");

        if (users && users.length > 0) {
          // Get product counts
          const { data: products } = await supabase
            .from("products")
            .select("user_id");

          const productCountMap = new Map<string, number>();
          for (const p of products || []) {
            productCountMap.set(p.user_id, (productCountMap.get(p.user_id) || 0) + 1);
          }

          // Get existing assignments to avoid duplicates
          const { data: existingAssignments } = await supabase
            .from("offer_user_assignments")
            .select("offer_id, user_id")
            .in("offer_id", Array.from(rulesByOffer.keys()));

          const existingSet = new Set(
            (existingAssignments || []).map((a: { offer_id: string; user_id: string }) => `${a.offer_id}:${a.user_id}`)
          );

          const nowDate = new Date();
          const newAssignments: { offer_id: string; user_id: string; status: string; assigned_by: null }[] = [];

          for (const user of users) {
            const createdAt = new Date(user.created_at);
            const diasCadastro = Math.floor((nowDate.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24));
            const endDate = user.subscription_end_date ? new Date(user.subscription_end_date) : null;
            const diasAteVencimento = endDate ? Math.floor((endDate.getTime() - nowDate.getTime()) / (1000 * 60 * 60 * 24)) : 999;
            const lastLogin = user.last_login_at ? new Date(user.last_login_at) : null;
            const ultimaAtividadeDias = lastLogin ? Math.floor((nowDate.getTime() - lastLogin.getTime()) / (1000 * 60 * 60 * 24)) : 999;

            const ctx = {
              plan_status: user.plan_status || "free",
              dias_cadastro: diasCadastro,
              qtd_produtos: productCountMap.get(user.id) || 0,
              billing_cycle: user.billing_cycle || "",
              dias_ate_vencimento: diasAteVencimento,
              ultima_atividade_dias: ultimaAtividadeDias,
              plano_nome: user.subscription_plan_name || "",
            };

            for (const [offerId, offerRules] of rulesByOffer) {
              if (existingSet.has(`${offerId}:${user.id}`)) continue;

              const passes = evaluateRules(offerRules, ctx);
              if (passes) {
                newAssignments.push({
                  offer_id: offerId,
                  user_id: user.id,
                  status: "pendente",
                  assigned_by: null,
                });
              }
            }
          }

          if (newAssignments.length > 0) {
            // Insert in batches of 100
            for (let i = 0; i < newAssignments.length; i += 100) {
              const batch = newAssignments.slice(i, i + 100);
              await supabase.from("offer_user_assignments").insert(batch);
            }
            autoAssignments = newAssignments.length;
          }
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        expired_offers: expiredCount,
        auto_assignments: autoAssignments,
        evaluated_at: now,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: (error as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

function evaluateRules(
  rules: { grupo_logico: number; tipo_regra: string; operador: string; valor: string; valor_secundario: string }[],
  ctx: {
    plan_status: string;
    dias_cadastro: number;
    qtd_produtos: number;
    billing_cycle: string;
    dias_ate_vencimento: number;
    ultima_atividade_dias: number;
    plano_nome: string;
  }
): boolean {
  if (rules.length === 0) return true;

  const groups = new Map<number, typeof rules>();
  for (const rule of rules) {
    const existing = groups.get(rule.grupo_logico) || [];
    existing.push(rule);
    groups.set(rule.grupo_logico, existing);
  }

  for (const [, groupRules] of groups) {
    const groupPasses = groupRules.every((rule) => {
      let fieldValue: string | number;
      switch (rule.tipo_regra) {
        case "plan_status": fieldValue = ctx.plan_status; break;
        case "dias_cadastro": fieldValue = ctx.dias_cadastro; break;
        case "qtd_produtos": fieldValue = ctx.qtd_produtos; break;
        case "billing_cycle": fieldValue = ctx.billing_cycle; break;
        case "dias_ate_vencimento": fieldValue = ctx.dias_ate_vencimento; break;
        case "atividade_recente": fieldValue = ctx.ultima_atividade_dias; break;
        case "plano_especifico": fieldValue = ctx.plano_nome; break;
        default: return false;
      }

      const numValue = typeof fieldValue === "number" ? fieldValue : parseFloat(fieldValue);
      const ruleNum = parseFloat(rule.valor);
      const ruleNum2 = parseFloat(rule.valor_secundario);

      switch (rule.operador) {
        case "igual": return String(fieldValue) === rule.valor;
        case "diferente": return String(fieldValue) !== rule.valor;
        case "maior_que": return !isNaN(numValue) && !isNaN(ruleNum) && numValue > ruleNum;
        case "menor_que": return !isNaN(numValue) && !isNaN(ruleNum) && numValue < ruleNum;
        case "entre": return !isNaN(numValue) && !isNaN(ruleNum) && !isNaN(ruleNum2) && numValue >= ruleNum && numValue <= ruleNum2;
        case "contem": return String(fieldValue).toLowerCase().includes(rule.valor.toLowerCase());
        default: return false;
      }
    });
    if (groupPasses) return true;
  }

  return false;
}
