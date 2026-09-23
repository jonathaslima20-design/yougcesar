import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface PayerInfo {
  email: string;
  first_name: string;
  last_name: string;
  doc: string;
}

interface PixPaymentPayload {
  order_id: string;
  payer: PayerInfo;
}

interface CardPaymentPayload {
  order_id: string;
  token: string;
  installments: number;
  payment_method_id: string;
  issuer_id: string;
  payer: { email: string; first_name: string; last_name: string; doc: string };
  device_id?: string;
}

async function getBuyerId(
  supabaseUrl: string,
  supabaseAnonKey: string,
  authHeader: string | null
): Promise<string | null> {
  if (!authHeader) return null;
  const userClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: { user }, error } = await userClient.auth.getUser();
  if (error || !user) return null;
  return user.id;
}

async function getActiveCredentials(
  admin: ReturnType<typeof createClient>,
  storeOwnerId: string
) {
  const { data, error } = await admin
    .from("merchant_payment_credentials")
    .select("*")
    .eq("user_id", storeOwnerId)
    .eq("provider", "mercadopago")
    .eq("is_active", true)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  // Same env-pair resolution as mercadopago/index.ts's getAccessToken/
  // getPublicKeyFromConfig — every other spot in this file keeps reading
  // credentials.public_key/access_token exactly as before.
  return {
    ...data,
    public_key: data.environment === "production" ? data.public_key_prod : data.public_key_test,
    access_token: data.environment === "production" ? data.access_token_prod : data.access_token_test,
  };
}

// Platform-wide kill switch, checked per store: a merchant with an
// admin-granted test override (users.payments_test_override) can process
// online payments even while the switch stays off for every other store.
async function isPaymentsEnabledForStore(
  admin: ReturnType<typeof createClient>,
  storeOwnerId: string
): Promise<boolean> {
  const [{ data: platformSettings, error: platformError }, { data: storeOwner, error: storeOwnerError }] = await Promise.all([
    admin.from("platform_payment_settings").select("online_payments_enabled").maybeSingle(),
    admin.from("users").select("payments_test_override").eq("id", storeOwnerId).maybeSingle(),
  ]);
  if (platformError) throw new Error(platformError.message);
  if (storeOwnerError) throw new Error(storeOwnerError.message);
  return !!platformSettings?.online_payments_enabled || !!storeOwner?.payments_test_override;
}

// The platform's commission on every sale, applied via Mercado Pago's own
// split-payment mechanism (application_fee) — only works because
// credentials.access_token is obtained via OAuth (see
// merchant-payment-settings' getAuthorizeUrl/exchangeCode), never with a
// manually pasted token.
async function getPlatformFeePercentage(admin: ReturnType<typeof createClient>): Promise<number> {
  const { data, error } = await admin
    .from("mercadopago_marketplace_config")
    .select("fee_percentage")
    .eq("id", 1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return Number(data?.fee_percentage ?? 0);
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const admin = createClient(supabaseUrl, supabaseServiceKey);

    const { action, payload } = await req.json();
    const authHeader = req.headers.get("Authorization");

    switch (action) {
      case "getSellerPublicKey": {
        const { store_owner_id } = payload as { store_owner_id: string };

        if (!(await isPaymentsEnabledForStore(admin, store_owner_id))) {
          return new Response(
            JSON.stringify({ error: "Pagamento online está temporariamente indisponível." }),
            { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const credentials = await getActiveCredentials(admin, store_owner_id);

        if (!credentials) {
          return new Response(
            JSON.stringify({ error: "Pagamento online não disponível para esta loja." }),
            { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        return new Response(
          JSON.stringify({ public_key: credentials.public_key, environment: credentials.environment }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case "createPixPayment":
      case "createCardPayment": {
        const buyerId = await getBuyerId(supabaseUrl, supabaseAnonKey, authHeader);
        if (!buyerId) {
          return new Response(
            JSON.stringify({ error: "Não autorizado" }),
            { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const orderId = (payload as { order_id: string }).order_id;

        const { data: order, error: orderError } = await admin
          .from("orders")
          .select("id, store_owner_id, buyer_id, order_type, payment_status, total")
          .eq("id", orderId)
          .maybeSingle();

        if (orderError) throw new Error(orderError.message);

        if (!order || order.buyer_id !== buyerId) {
          return new Response(
            JSON.stringify({ error: "Pedido não encontrado" }),
            { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        if (order.order_type !== "ecommerce") {
          return new Response(
            JSON.stringify({ error: "Este pedido não é de pagamento online" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        if (order.payment_status === "approved") {
          return new Response(
            JSON.stringify({ error: "Este pedido já foi pago" }),
            { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        if (!(await isPaymentsEnabledForStore(admin, order.store_owner_id))) {
          return new Response(
            JSON.stringify({ error: "Pagamento online está temporariamente indisponível." }),
            { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const credentials = await getActiveCredentials(admin, order.store_owner_id);
        if (!credentials) {
          return new Response(
            JSON.stringify({ error: "Pagamento online não disponível para esta loja." }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // application_fee (the platform's split commission) only works with
        // an OAuth-obtained access token — a row left over from the old
        // paste-your-own-key flow (or one that started "Conectar" but never
        // finished) has no refresh_token, so it's treated as not connected
        // rather than silently processing payments with no platform fee.
        if (!credentials.refresh_token) {
          return new Response(
            JSON.stringify({ error: "Reconecte sua conta Mercado Pago em Configurações > Pagamento." }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // Reserve stock before ever contacting Mercado Pago — idempotent, so
        // this is a no-op when the order already holds a reservation (the
        // common case) and only does real work on a first attempt or a retry
        // after a prior reservation was released (PIX expired, card declined).
        const { error: reserveError } = await admin.rpc("reserve_stock_for_order", {
          p_order_id: order.id,
        });
        if (reserveError) {
          return new Response(
            JSON.stringify({ error: reserveError.message || "Produto sem estoque suficiente" }),
            { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // transaction_amount always comes from the order row itself, resolved
        // server-side — never from the request body — so a manipulated client
        // can never pay less than the real order total.
        const finalAmount = Number(order.total);
        const amountCents = Math.round(finalAmount * 100);
        const accessToken = credentials.access_token;
        const notificationUrl = `${supabaseUrl}/functions/v1/merchant-payment-webhook`;

        // application_fee is in the same currency unit as transaction_amount
        // (decimal reais), never cents.
        const feePercentage = await getPlatformFeePercentage(admin);
        const applicationFee = Number((finalAmount * feePercentage / 100).toFixed(2));

        if (action === "createPixPayment") {
          const { payer } = payload as PixPaymentPayload;

          // Reuse an already-pending, still-valid Pix for this order instead
          // of minting a second one on every retry/page reload — otherwise
          // two separate QR codes stay simultaneously payable for the same
          // order, and both could get paid.
          const { data: existingPending } = await admin
            .from("order_payments")
            .select("id, mp_payment_id, status, pix_qr_code, pix_qr_code_base64, pix_ticket_url, pix_expires_at")
            .eq("order_id", order.id)
            .eq("payment_method", "pix")
            .eq("status", "pending")
            .not("mp_payment_id", "is", null)
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();

          if (
            existingPending &&
            (!existingPending.pix_expires_at || new Date(existingPending.pix_expires_at) > new Date())
          ) {
            return new Response(
              JSON.stringify({
                order_payment_id: existingPending.id,
                mp_payment_id: existingPending.mp_payment_id,
                status: existingPending.status,
                pix_qr_code: existingPending.pix_qr_code || "",
                pix_qr_code_base64: existingPending.pix_qr_code_base64 || "",
                pix_ticket_url: existingPending.pix_ticket_url || "",
                expires_at: existingPending.pix_expires_at,
              }),
              { headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }

          const { data: paymentRow, error: insertErr } = await admin
            .from("order_payments")
            .insert({
              order_id: order.id,
              store_owner_id: order.store_owner_id,
              amount_cents: amountCents,
              payment_method: "pix",
              payer_email: payer.email,
              payer_doc: payer.doc,
              environment: credentials.environment,
            })
            .select("id")
            .single();

          if (insertErr || !paymentRow) {
            throw new Error("Erro ao registrar pagamento");
          }

          const docType = payer.doc.replace(/\D/g, "").length > 11 ? "CNPJ" : "CPF";

          const mpBody = {
            transaction_amount: finalAmount,
            payment_method_id: "pix",
            payer: {
              email: payer.email,
              first_name: payer.first_name,
              last_name: payer.last_name,
              identification: { type: docType, number: payer.doc.replace(/\D/g, "") },
            },
            notification_url: notificationUrl,
            external_reference: paymentRow.id,
            application_fee: applicationFee,
          };

          const mpResponse = await fetch("https://api.mercadopago.com/v1/payments", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${accessToken}`,
              "Content-Type": "application/json",
              "X-Idempotency-Key": paymentRow.id,
            },
            body: JSON.stringify(mpBody),
          });

          const mpData = await mpResponse.json();

          if (!mpResponse.ok) {
            await admin.rpc("process_order_payment_result", {
              p_order_payment_id: paymentRow.id,
              p_mp_status: "rejected",
              p_status_detail: mpData.message || "API error",
              p_raw_response: mpData,
            });

            return new Response(
              JSON.stringify({ error: mpData.message || "Erro ao criar pagamento PIX" }),
              { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }

          const pixData = mpData.point_of_interaction?.transaction_data;
          const expiresAt = mpData.date_of_expiration || null;

          await admin
            .from("order_payments")
            .update({
              mp_payment_id: String(mpData.id),
              pix_qr_code: pixData?.qr_code || "",
              pix_qr_code_base64: pixData?.qr_code_base64 || "",
              pix_ticket_url: pixData?.ticket_url || "",
              pix_expires_at: expiresAt,
              updated_at: new Date().toISOString(),
            })
            .eq("id", paymentRow.id);

          // Funnels through the same locked, idempotent RPC that the
          // webhook and the buyer's status polling also call — whichever
          // of the three reaches "approved" first is the one that actually
          // deducts stock and credits cashback; the others become no-ops
          // instead of silently skipping those side effects.
          await admin.rpc("process_order_payment_result", {
            p_order_payment_id: paymentRow.id,
            p_mp_status: mpData.status || "pending",
            p_status_detail: mpData.status_detail || "",
            p_raw_response: mpData,
          });

          return new Response(
            JSON.stringify({
              order_payment_id: paymentRow.id,
              mp_payment_id: String(mpData.id),
              status: mpData.status,
              pix_qr_code: pixData?.qr_code || "",
              pix_qr_code_base64: pixData?.qr_code_base64 || "",
              pix_ticket_url: pixData?.ticket_url || "",
              expires_at: expiresAt,
            }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // createCardPayment
        const { token, installments, payment_method_id, issuer_id, payer: cardPayer, device_id } =
          payload as CardPaymentPayload;

        const { data: paymentRow, error: insertErr } = await admin
          .from("order_payments")
          .insert({
            order_id: order.id,
            store_owner_id: order.store_owner_id,
            amount_cents: amountCents,
            payment_method: "credit_card",
            payer_email: cardPayer.email,
            payer_doc: cardPayer.doc,
            installments,
            environment: credentials.environment,
          })
          .select("id")
          .single();

        if (insertErr || !paymentRow) {
          throw new Error("Erro ao registrar pagamento");
        }

        const docType = cardPayer.doc.replace(/\D/g, "").length > 11 ? "CNPJ" : "CPF";

        // first_name/last_name come from the payment form itself (same as
        // the Pix flow), not from the buyer's account profile — Mercado
        // Pago's own test-card simulation (APRO/CONT/OTHE) keys off this
        // exact field, so pulling it from a stale/unrelated account name
        // silently breaks test payments. It's also more correct for real
        // payments: the account name can differ from the card's actual
        // holder.
        const mpBody = {
          transaction_amount: finalAmount,
          token,
          installments,
          payment_method_id,
          issuer_id,
          // Without this, Mercado Pago is free to leave a card payment
          // "in_process"/pending_contingency for extra async review instead
          // of deciding immediately — including for the APRO test card,
          // which is what caused pending results in testing. With it, the
          // buyer always leaves this screen with a final approved/rejected
          // result instead of an indefinite "em análise".
          binary_mode: true,
          payer: {
            email: cardPayer.email,
            first_name: cardPayer.first_name || undefined,
            last_name: cardPayer.last_name || undefined,
            identification: { type: docType, number: cardPayer.doc.replace(/\D/g, "") },
          },
          notification_url: notificationUrl,
          external_reference: paymentRow.id,
          application_fee: applicationFee,
        };

        const mpResponse = await fetch("https://api.mercadopago.com/v1/payments", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
            "X-Idempotency-Key": paymentRow.id,
            // Device fingerprint (window.MP_DEVICE_SESSION_ID on the client,
            // set by the security.js script OrderPaymentPage now loads via
            // loadMpDeviceFingerprintScript()). This storefront checkout
            // never sent this before — same header the platform-subscription
            // checkout already sends in mercadopago/index.ts. Without it MP's
            // fraud engine has much less signal about the buyer's device and
            // defaults to rejecting more card charges (cc_rejected_high_risk
            // / cc_rejected_other_reason).
            ...(device_id ? { "X-meli-session-id": device_id } : {}),
          },
          body: JSON.stringify(mpBody),
        });

        const mpData = await mpResponse.json();

        if (!mpResponse.ok) {
          // Card declines resolve synchronously, unlike Pix — no need to wait
          // for the webhook to free the stock back up for another buyer.
          // The RPC releases the reservation itself as part of the
          // pending->rejected transition.
          await admin.rpc("process_order_payment_result", {
            p_order_payment_id: paymentRow.id,
            p_mp_status: "rejected",
            p_status_detail: mpData.message || "API error",
            p_raw_response: mpData,
          });

          return new Response(
            JSON.stringify({ error: mpData.message || "Erro ao processar pagamento com cartão" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const cardInfo = mpData.card || {};
        const last4 = cardInfo.last_four_digits || "";
        const brand = mpData.payment_method_id || "";

        await admin
          .from("order_payments")
          .update({
            mp_payment_id: String(mpData.id),
            card_last4: last4,
            card_brand: brand,
            updated_at: new Date().toISOString(),
          })
          .eq("id", paymentRow.id);

        // Same shared RPC as Pix — binary_mode means a declined card
        // resolves here synchronously (separate from the !mpResponse.ok
        // branch above), and this is also what makes an approved card
        // actually deduct stock/credit cashback now, which it never did
        // before (the webhook's own guard used to skip it because this
        // code path had already written status="approved" first).
        await admin.rpc("process_order_payment_result", {
          p_order_payment_id: paymentRow.id,
          p_mp_status: mpData.status || "rejected",
          p_status_detail: mpData.status_detail || "",
          p_raw_response: mpData,
        });

        return new Response(
          JSON.stringify({
            order_payment_id: paymentRow.id,
            mp_payment_id: String(mpData.id),
            status: mpData.status,
            status_detail: mpData.status_detail || "",
            card_last4: last4,
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case "getPaymentStatus": {
        const buyerId = await getBuyerId(supabaseUrl, supabaseAnonKey, authHeader);
        if (!buyerId) {
          return new Response(
            JSON.stringify({ error: "Não autorizado" }),
            { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const { order_payment_id } = payload as { order_payment_id: string };

        const { data: payment, error: paymentError } = await admin
          .from("order_payments")
          .select("id, order_id, status, status_detail, mp_payment_id, pix_qr_code, pix_qr_code_base64, pix_expires_at, card_last4, card_brand, payment_method, store_owner_id, updated_at")
          .eq("id", order_payment_id)
          .maybeSingle();

        if (paymentError) throw new Error(paymentError.message);

        if (!payment) {
          return new Response(
            JSON.stringify({ error: "Pagamento não encontrado" }),
            { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const { data: order, error: orderError } = await admin
          .from("orders")
          .select("buyer_id")
          .eq("id", payment.order_id)
          .maybeSingle();

        if (orderError) throw new Error(orderError.message);

        if (!order || order.buyer_id !== buyerId) {
          return new Response(
            JSON.stringify({ error: "Pagamento não encontrado" }),
            { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        if (payment.status === "pending" && payment.mp_payment_id) {
          try {
            const credentials = await getActiveCredentials(admin, payment.store_owner_id);
            if (credentials) {
              const mpResponse = await fetch(
                `https://api.mercadopago.com/v1/payments/${payment.mp_payment_id}`,
                { headers: { Authorization: `Bearer ${credentials.access_token}` } }
              );

              if (mpResponse.ok) {
                const mpData = await mpResponse.json();
                const mpStatus = mpData.status || "";

                if (mpStatus !== payment.status) {
                  // Same locked, idempotent RPC the webhook and the
                  // synchronous payment-creation paths call — this used to
                  // write "approved" here directly with none of the stock
                  // deduction/cashback side effects, which then made the
                  // webhook's own guard skip processing entirely once it
                  // arrived and saw the status already "approved". Now
                  // whichever of the two actually gets here first is the
                  // one that runs those side effects, exactly once.
                  await admin.rpc("process_order_payment_result", {
                    p_order_payment_id: payment.id,
                    p_mp_status: mpStatus,
                    p_status_detail: mpData.status_detail || "",
                    p_raw_response: mpData,
                  });

                  return new Response(
                    JSON.stringify({ ...payment, status: mpStatus, status_detail: mpData.status_detail || payment.status_detail }),
                    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
                  );
                }
              }
            }
          } catch (e) {
            console.error("Error checking MP API during polling:", e);
          }
        }

        return new Response(
          JSON.stringify(payment),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      default:
        return new Response(
          JSON.stringify({ error: "Ação não reconhecida" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro interno";
    console.error("Error in merchant-payments:", error);
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
