import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Client-Info, Apikey",
};

const CAKTO_API_BASE = "https://api.cakto.com.br/public_api";

interface CustomerInfo {
  email: string;
  name: string;
  phone: string;
  doc: string;
  fingerprint: string;
}

interface PixPaymentPayload {
  plan_id: string;
  billing_cycle: string;
  customer: CustomerInfo;
  early_renewal?: boolean;
  offer_id?: string;
  referral_code?: string;
}

interface CardPaymentPayload {
  plan_id: string;
  billing_cycle: string;
  card_token: string;
  antifraud_reference: string;
  installments: number;
  customer: CustomerInfo;
  early_renewal?: boolean;
  offer_id?: string;
  referral_code?: string;
}

function docType(doc: string): "cpf" | "cnpj" {
  return doc.replace(/\D/g, "").length > 11 ? "cnpj" : "cpf";
}

async function getConfig(admin: ReturnType<typeof createClient>) {
  const { data, error } = await admin
    .from("cakto_config")
    .select("*")
    .eq("is_active", true)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) {
    throw new Error("Cakto não configurada");
  }
  return data;
}

function isProd(config: any): boolean {
  return config.environment === "production";
}

async function getCaktoToken(config: any): Promise<string> {
  const clientId = isProd(config) ? config.client_id_prod : config.client_id_test;
  const clientSecret = isProd(config) ? config.client_secret_prod : config.client_secret_test;

  const resp = await fetch(`${CAKTO_API_BASE}/token/`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId || "",
      client_secret: clientSecret || "",
      grant_type: "client_credentials",
    }),
  });

  const data = await resp.json();
  if (!resp.ok || !data.access_token) {
    throw new Error("Falha ao autenticar com a Cakto");
  }
  return data.access_token as string;
}

async function getOfferForPlan(
  admin: ReturnType<typeof createClient>,
  planId: string,
  billingCycle: string,
  environment: string
): Promise<string | null> {
  const { data } = await admin
    .from("cakto_offers")
    .select("offer_id")
    .eq("plan_id", planId)
    .eq("billing_cycle", billingCycle)
    .eq("environment", environment)
    .maybeSingle();

  return data?.offer_id || null;
}

// Referral eligibility must look across every BR provider's payment history —
// mp_payments and cakto_payments are separate tables, so checking only one
// would let a user claim the first-payment referral discount twice.
async function hasAnyApprovedPayment(
  admin: ReturnType<typeof createClient>,
  userId: string
): Promise<boolean> {
  const [{ data: mpRows }, { data: caktoRows }] = await Promise.all([
    admin.from("mp_payments").select("id").eq("user_id", userId).eq("status", "approved").limit(1),
    admin.from("cakto_payments").select("id").eq("user_id", userId).eq("status", "paid").limit(1),
  ]);
  return !!(mpRows && mpRows.length > 0) || !!(caktoRows && caktoRows.length > 0);
}

interface ResolvedDiscount {
  offer_id: string;
  coupon_id: string | null;
  base_amount: number;
  final_amount: number;
  discount_cents: number;
}

async function resolveOfferDiscount(
  admin: ReturnType<typeof createClient>,
  offerId: string | undefined,
  userId: string,
  basePrice: number,
  planId?: string | null
): Promise<ResolvedDiscount | null> {
  if (!offerId) return null;

  const { data: offerUser } = await admin
    .from("users")
    .select("referred_by")
    .eq("id", userId)
    .maybeSingle();
  if (offerUser?.referred_by) return null;

  const nowIso = new Date().toISOString();

  const { data: offer } = await admin
    .from("promotional_offers")
    .select("id, is_active, data_inicio, data_fim, desconto_percentual, desconto_valor_fixo, cupom_id, contador_modo, contador_horas_apos_cadastro, planos_aplicaveis")
    .eq("id", offerId)
    .maybeSingle();

  if (!offer || !offer.is_active) return null;
  if (offer.data_inicio && offer.data_inicio > nowIso) return null;
  if (offer.data_fim && offer.data_fim < nowIso) return null;

  const { data: assignment } = await admin
    .from("offer_user_assignments")
    .select("id, status")
    .eq("offer_id", offerId)
    .eq("user_id", userId)
    .maybeSingle();
  const hasAssignment = !!assignment && assignment.status !== "expirada";

  // The "Desconto de Boas-vindas" (contador_modo = 'apos_cadastro') has no manual
  // assignment and no targeting rules by design — its personal countdown below is
  // what proves eligibility, not the generic rules table. Mirrors the same
  // isSignupDiscount check in offerService.ts (fetchOfferForCheckout) on the
  // frontend and in supabase/functions/mercadopago/index.ts.
  const isSignupDiscount = offer.contador_modo === "apos_cadastro";

  if (!hasAssignment && !isSignupDiscount) {
    const { count } = await admin
      .from("offer_targeting_rules")
      .select("id", { count: "exact", head: true })
      .eq("offer_id", offerId);
    if (!count || count === 0) return null;
  }

  // Signup offer's personal countdown: re-check server-side against this user's
  // own signup date, so it can't keep being applied after that user's window closed.
  if (isSignupDiscount && offer.contador_horas_apos_cadastro) {
    const { data: userRow } = await admin
      .from("users")
      .select("created_at")
      .eq("id", userId)
      .maybeSingle();
    if (!userRow) return null;
    const deadline = new Date(userRow.created_at).getTime() + offer.contador_horas_apos_cadastro * 60 * 60 * 1000;
    if (Date.now() > deadline) return null;
  }

  if (planId && offer.planos_aplicaveis && offer.planos_aplicaveis.length > 0 && !offer.planos_aplicaveis.includes(planId)) {
    return null;
  }

  let discountType: "percent" | "fixed" | null = null;
  let discountValue = 0;
  let maxDiscount: number | null = null;
  let couponId: string | null = null;

  if (offer.cupom_id) {
    const { data: coupon } = await admin
      .from("coupons")
      .select("id, discount_type, discount_value, max_discount_amount, is_active")
      .eq("id", offer.cupom_id)
      .maybeSingle();
    if (coupon && coupon.is_active) {
      couponId = coupon.id;
      discountType = coupon.discount_type === "percentage" || coupon.discount_type === "percent" ? "percent" : "fixed";
      discountValue = Number(coupon.discount_value) || 0;
      maxDiscount = coupon.max_discount_amount ? Number(coupon.max_discount_amount) : null;
    }
  }

  if (!discountType) {
    if (Number(offer.desconto_percentual) > 0) {
      discountType = "percent";
      discountValue = Number(offer.desconto_percentual);
    } else if (Number(offer.desconto_valor_fixo) > 0) {
      discountType = "fixed";
      discountValue = Number(offer.desconto_valor_fixo);
    }
  }

  if (!discountType || discountValue <= 0) return null;

  let discount = discountType === "percent" ? (basePrice * discountValue) / 100 : discountValue;
  if (maxDiscount && discount > maxDiscount) discount = maxDiscount;
  if (discount > basePrice) discount = basePrice;
  const finalAmount = Math.max(0, Math.round((basePrice - discount) * 100) / 100);
  const discountCents = Math.round(discount * 100);

  return {
    offer_id: offer.id,
    coupon_id: couponId,
    base_amount: basePrice,
    final_amount: finalAmount,
    discount_cents: discountCents,
  };
}

interface ReferralDiscountResult {
  referrer_id: string;
  discount_percentage: number;
  base_amount: number;
  final_amount: number;
  discount_cents: number;
}

async function resolveReferralDiscount(
  admin: ReturnType<typeof createClient>,
  referralCode: string | undefined,
  userId: string,
  basePrice: number
): Promise<ReferralDiscountResult | null> {
  if (!referralCode) return null;

  const { data: referrer } = await admin
    .from("users")
    .select("id, referral_code, created_at")
    .ilike("referral_code", referralCode.trim())
    .maybeSingle();

  if (!referrer || referrer.id === userId) return null;

  if (await hasAnyApprovedPayment(admin, userId)) return null;

  const { data: currentUser } = await admin
    .from("users")
    .select("created_at, plan_status")
    .eq("id", userId)
    .maybeSingle();

  if (currentUser && referrer.created_at && currentUser.created_at < referrer.created_at) {
    return null;
  }

  if (currentUser?.plan_status && currentUser.plan_status !== "free") {
    return null;
  }

  const { data: settings } = await admin
    .from("referral_settings")
    .select("discount_percentage")
    .limit(1)
    .maybeSingle();

  const discountPct = settings?.discount_percentage ?? 20;
  if (discountPct <= 0) return null;

  const discount = Math.round(basePrice * (discountPct / 100) * 100) / 100;
  const finalAmount = Math.max(0, Math.round((basePrice - discount) * 100) / 100);
  const discountCents = Math.round(discount * 100);

  return {
    referrer_id: referrer.id,
    discount_percentage: discountPct,
    base_amount: basePrice,
    final_amount: finalAmount,
    discount_cents: discountCents,
  };
}

async function saveReferredBy(
  admin: ReturnType<typeof createClient>,
  userId: string,
  referrerId: string
): Promise<void> {
  await admin
    .from("users")
    .update({ referred_by: referrerId })
    .eq("id", userId)
    .is("referred_by", null);
}

async function recordOfferConversion(
  admin: ReturnType<typeof createClient>,
  offerId: string | null | undefined,
  userId: string,
  source: string
) {
  if (!offerId) return;
  const nowIso = new Date().toISOString();
  await admin
    .from("offer_user_assignments")
    .update({ status: "aceita", status_updated_at: nowIso, converted_at: nowIso })
    .eq("offer_id", offerId)
    .eq("user_id", userId);
  await admin.from("offer_impressions").insert({
    offer_id: offerId,
    user_id: userId,
    action: "convertida",
    session_context: { source },
  });
}

// Mirrors mercadopago/index.ts's activatePlan() exactly, except it marks
// billing_provider='cakto' — check-expiring-subscriptions already handles
// any non-stripe provider uniformly, so no cron changes are needed.
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
      billing_provider: "cakto",
      billing_cycle: billingCycleDb,
      subscription_end_date: expiresAt.toISOString().split("T")[0],
      next_payment_date: expiresAt.toISOString().split("T")[0],
    })
    .eq("id", userId);
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const {
      data: { user },
      error: authError,
    } = await userClient.auth.getUser();

    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(supabaseUrl, supabaseServiceKey);
    const { action, payload } = await req.json();

    switch (action) {
      case "getPublicKey": {
        const config = await getConfig(admin);
        const sdkClientId = isProd(config) ? config.sdk_client_id_prod : config.sdk_client_id_test;
        return new Response(
          JSON.stringify({
            sdk_client_id: sdkClientId,
            environment: config.environment,
            pix_enabled: config.pix_enabled,
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case "createPixPayment": {
        const { plan_id, billing_cycle, customer, early_renewal, offer_id, referral_code } =
          payload as PixPaymentPayload;

        const config = await getConfig(admin);
        if (!config.pix_enabled) {
          return new Response(
            JSON.stringify({ error: "Pagamento via Pix indisponível no momento" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const { data: plan } = await admin
          .from("subscription_plans")
          .select("id, name, price")
          .eq("id", plan_id)
          .maybeSingle();

        if (!plan) {
          return new Response(JSON.stringify({ error: "Plano não encontrado" }), {
            status: 404,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const caktoOfferId = await getOfferForPlan(admin, plan_id, billing_cycle, config.environment);
        if (!caktoOfferId) {
          return new Response(
            JSON.stringify({ error: "Oferta Cakto não configurada para este plano/ciclo" }),
            { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const basePrice = Number(plan.price);
        const referralInfo = await resolveReferralDiscount(admin, referral_code, user.id, basePrice);
        const discountInfo = referralInfo ? null : await resolveOfferDiscount(admin, offer_id, user.id, basePrice, plan.id);
        const finalPrice = referralInfo ? referralInfo.final_amount : discountInfo ? discountInfo.final_amount : basePrice;
        const amountCents = Math.round(finalPrice * 100);

        const { data: paymentRow, error: insertErr } = await admin
          .from("cakto_payments")
          .insert({
            user_id: user.id,
            plan_id: plan.id,
            billing_cycle,
            amount_cents: amountCents,
            payment_method: "pix",
            payer_email: customer.email,
            payer_doc: customer.doc,
            environment: config.environment,
            early_renewal: early_renewal ?? false,
            offer_id: discountInfo?.offer_id ?? null,
            coupon_id: discountInfo?.coupon_id ?? null,
            discount_cents: referralInfo ? referralInfo.discount_cents : discountInfo?.discount_cents ?? 0,
          })
          .select("id")
          .single();

        if (insertErr || !paymentRow) {
          throw new Error("Erro ao registrar pagamento");
        }

        if (referralInfo) {
          await saveReferredBy(admin, user.id, referralInfo.referrer_id);
        }

        const accessToken = await getCaktoToken(config);

        const caktoBody = {
          paymentMethod: "pix",
          customer: {
            name: customer.name,
            email: customer.email,
            phone: customer.phone,
            fingerprint: customer.fingerprint,
            docType: docType(customer.doc),
            docNumber: customer.doc.replace(/\D/g, ""),
          },
          items: [{ offerId: caktoOfferId, quantity: 1, offerType: "main" }],
        };

        const caktoResponse = await fetch(`${CAKTO_API_BASE}/payments/`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
            "X-Idempotency-Key": paymentRow.id,
          },
          body: JSON.stringify(caktoBody),
        });

        const caktoData = await caktoResponse.json();

        if (!caktoResponse.ok) {
          await admin
            .from("cakto_payments")
            .update({
              status: "declined",
              status_detail: caktoData.detail || JSON.stringify(caktoData),
              raw_response: caktoData,
              updated_at: new Date().toISOString(),
            })
            .eq("id", paymentRow.id);

          return new Response(
            JSON.stringify({ error: caktoData.detail || "Erro ao criar pagamento Pix" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        await admin
          .from("cakto_payments")
          .update({
            cakto_order_id: String(caktoData.id),
            status: caktoData.status || "waiting_payment",
            pix_qr_code: caktoData.pix?.qrCode || "",
            pix_expires_at: caktoData.pix?.expirationDate || null,
            raw_response: caktoData,
            updated_at: new Date().toISOString(),
          })
          .eq("id", paymentRow.id);

        return new Response(
          JSON.stringify({
            payment_id: paymentRow.id,
            cakto_order_id: String(caktoData.id),
            status: caktoData.status,
            pix_qr_code: caktoData.pix?.qrCode || "",
            expires_at: caktoData.pix?.expirationDate || null,
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case "createCardPayment": {
        const {
          plan_id,
          billing_cycle,
          card_token,
          antifraud_reference,
          installments,
          customer,
          early_renewal,
          offer_id,
          referral_code,
        } = payload as CardPaymentPayload;

        const config = await getConfig(admin);

        const { data: plan } = await admin
          .from("subscription_plans")
          .select("id, name, price")
          .eq("id", plan_id)
          .maybeSingle();

        if (!plan) {
          return new Response(JSON.stringify({ error: "Plano não encontrado" }), {
            status: 404,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const caktoOfferId = await getOfferForPlan(admin, plan_id, billing_cycle, config.environment);
        if (!caktoOfferId) {
          return new Response(
            JSON.stringify({ error: "Oferta Cakto não configurada para este plano/ciclo" }),
            { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const basePrice = Number(plan.price);
        const referralInfo = await resolveReferralDiscount(admin, referral_code, user.id, basePrice);
        const discountInfo = referralInfo ? null : await resolveOfferDiscount(admin, offer_id, user.id, basePrice, plan.id);
        const finalPrice = referralInfo ? referralInfo.final_amount : discountInfo ? discountInfo.final_amount : basePrice;
        const amountCents = Math.round(finalPrice * 100);

        const { data: paymentRow, error: insertErr } = await admin
          .from("cakto_payments")
          .insert({
            user_id: user.id,
            plan_id: plan.id,
            billing_cycle,
            amount_cents: amountCents,
            payment_method: "credit_card",
            payer_email: customer.email,
            payer_doc: customer.doc,
            installments,
            environment: config.environment,
            early_renewal: early_renewal ?? false,
            offer_id: discountInfo?.offer_id ?? null,
            coupon_id: discountInfo?.coupon_id ?? null,
            discount_cents: referralInfo ? referralInfo.discount_cents : discountInfo?.discount_cents ?? 0,
          })
          .select("id")
          .single();

        if (insertErr || !paymentRow) {
          throw new Error("Erro ao registrar pagamento");
        }

        if (referralInfo) {
          await saveReferredBy(admin, user.id, referralInfo.referrer_id);
        }

        const accessToken = await getCaktoToken(config);

        const caktoBody = {
          paymentMethod: "credit_card",
          customer: {
            name: customer.name,
            email: customer.email,
            phone: customer.phone,
            fingerprint: customer.fingerprint,
            docType: docType(customer.doc),
            docNumber: customer.doc.replace(/\D/g, ""),
          },
          items: [{ offerId: caktoOfferId, quantity: 1, offerType: "main" }],
          card: { token: card_token },
          antifraud_profiling_attempt_reference: antifraud_reference,
          ...(installments && installments > 1 ? { installments } : {}),
        };

        const caktoResponse = await fetch(`${CAKTO_API_BASE}/payments/`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
            "X-Idempotency-Key": paymentRow.id,
          },
          body: JSON.stringify(caktoBody),
        });

        const caktoData = await caktoResponse.json();

        if (!caktoResponse.ok) {
          await admin
            .from("cakto_payments")
            .update({
              status: "declined",
              status_detail: caktoData.detail || JSON.stringify(caktoData),
              raw_response: caktoData,
              updated_at: new Date().toISOString(),
            })
            .eq("id", paymentRow.id);

          return new Response(
            JSON.stringify({ error: caktoData.detail || "Erro ao processar pagamento com cartão" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        await admin
          .from("cakto_payments")
          .update({
            cakto_order_id: String(caktoData.id),
            status: caktoData.status || "declined",
            raw_response: caktoData,
            updated_at: new Date().toISOString(),
          })
          .eq("id", paymentRow.id);

        if (caktoData.status === "paid") {
          await activatePlan(admin, user.id, plan.id, billing_cycle, early_renewal ?? false);
          if (discountInfo) {
            await recordOfferConversion(admin, discountInfo.offer_id, user.id, "cakto-card");
          }
        }

        return new Response(
          JSON.stringify({
            payment_id: paymentRow.id,
            cakto_order_id: String(caktoData.id),
            status: caktoData.status,
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case "getPaymentStatus": {
        const { payment_id } = payload as { payment_id: string };

        const { data: payment } = await admin
          .from("cakto_payments")
          .select(
            "id, status, status_detail, cakto_order_id, plan_id, billing_cycle, early_renewal, offer_id, pix_qr_code, pix_expires_at, card_last4, card_brand, payment_method, updated_at"
          )
          .eq("id", payment_id)
          .eq("user_id", user.id)
          .maybeSingle();

        if (!payment) {
          return new Response(JSON.stringify({ error: "Pagamento não encontrado" }), {
            status: 404,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const stillOpen = payment.status !== "paid" && payment.status !== "declined" && payment.status !== "refused";

        if (stillOpen && payment.cakto_order_id) {
          try {
            const config = await getConfig(admin);
            const accessToken = await getCaktoToken(config);

            const orderResponse = await fetch(`${CAKTO_API_BASE}/orders/${payment.cakto_order_id}/`, {
              headers: { Authorization: `Bearer ${accessToken}` },
            });

            if (orderResponse.ok) {
              const orderData = await orderResponse.json();
              const newStatus = orderData.status || "";

              if (newStatus && newStatus !== payment.status) {
                await admin
                  .from("cakto_payments")
                  .update({
                    status: newStatus,
                    raw_response: orderData,
                    updated_at: new Date().toISOString(),
                  })
                  .eq("id", payment.id);

                if (newStatus === "paid") {
                  await activatePlan(admin, user.id, payment.plan_id, payment.billing_cycle, payment.early_renewal ?? false);
                  if (payment.offer_id) {
                    await recordOfferConversion(admin, payment.offer_id, user.id, "cakto-poll");
                  }
                }

                return new Response(JSON.stringify({ ...payment, status: newStatus }), {
                  headers: { ...corsHeaders, "Content-Type": "application/json" },
                });
              }
            }
          } catch (e) {
            console.error("Error checking Cakto order status during polling:", e);
          }
        }

        return new Response(JSON.stringify(payment), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      default:
        return new Response(JSON.stringify({ error: "Ação não reconhecida" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro interno";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
