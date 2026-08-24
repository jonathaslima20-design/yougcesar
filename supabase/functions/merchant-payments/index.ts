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

        // transaction_amount always comes from the order row itself, resolved
        // server-side — never from the request body — so a manipulated client
        // can never pay less than the real order total.
        const finalAmount = Number(order.total);
        const amountCents = Math.round(finalAmount * 100);
        const accessToken = credentials.access_token;
        const notificationUrl = `${supabaseUrl}/functions/v1/merchant-payment-webhook`;

        if (action === "createPixPayment") {
          const { payer } = payload as PixPaymentPayload;

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
            await admin
              .from("order_payments")
              .update({ status: "rejected", status_detail: mpData.message || "API error", raw_response: mpData, updated_at: new Date().toISOString() })
              .eq("id", paymentRow.id);

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
              status: mpData.status || "pending",
              status_detail: mpData.status_detail || "",
              pix_qr_code: pixData?.qr_code || "",
              pix_qr_code_base64: pixData?.qr_code_base64 || "",
              pix_ticket_url: pixData?.ticket_url || "",
              pix_expires_at: expiresAt,
              raw_response: mpData,
              updated_at: new Date().toISOString(),
            })
            .eq("id", paymentRow.id);

          if (mpData.status === "approved") {
            await admin.from("orders").update({ payment_status: "approved" }).eq("id", order.id);
          }

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
        const { token, installments, payment_method_id, issuer_id, payer: cardPayer } =
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
          await admin
            .from("order_payments")
            .update({ status: "rejected", status_detail: mpData.message || "API error", raw_response: mpData, updated_at: new Date().toISOString() })
            .eq("id", paymentRow.id);

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
            status: mpData.status || "rejected",
            status_detail: mpData.status_detail || "",
            card_last4: last4,
            card_brand: brand,
            raw_response: mpData,
            updated_at: new Date().toISOString(),
          })
          .eq("id", paymentRow.id);

        if (mpData.status === "approved") {
          await admin.from("orders").update({ payment_status: "approved" }).eq("id", order.id);
        }

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
                  await admin
                    .from("order_payments")
                    .update({ status: mpStatus, status_detail: mpData.status_detail || "", raw_response: mpData, updated_at: new Date().toISOString() })
                    .eq("id", payment.id);

                  if (mpStatus === "approved") {
                    await admin.from("orders").update({ payment_status: "approved" }).eq("id", payment.order_id);
                  }

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
