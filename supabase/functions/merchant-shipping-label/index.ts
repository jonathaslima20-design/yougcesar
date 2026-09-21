import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Client-Info, Apikey",
};

const USER_AGENT = "VitrineTurbo/1.0 (contato@vitrineturbo.com)";
const PLATFORM_NAME = "VitrineTurbo";

// Small-parcel default applied whenever an item is missing one or more
// shipping dimensions — mirrors src/lib/shippingUtils.ts's FALLBACK_DIMENSIONS
// so a label can still be generated instead of failing outright.
const FALLBACK_DIMENSIONS = { weight: 0.3, height: 2, width: 11, length: 16 };

const SERVICE_CARRIER_NAMES: Record<string, string> = {
  "1": "Correios (PAC)",
  "2": "Correios (SEDEX)",
  "17": "Correios (Mini Envios)",
  "3": "Jadlog",
  "33": "J&T",
  "31": "Loggi",
};

function superFreteBaseUrl(environment: string): string {
  return environment === "production"
    ? "https://api.superfrete.com"
    : "https://sandbox.superfrete.com";
}

function onlyDigits(value: string | null | undefined): string {
  return (value || "").replace(/\D/g, "");
}

interface ProductDims {
  weight_kg: number | null;
  height_cm: number | null;
  width_cm: number | null;
  length_cm: number | null;
  package_type?: string | null;
  diameter_cm?: number | null;
}

function resolveDims(dims?: Partial<ProductDims> | null) {
  const isCylinder = dims?.package_type === "cylinder" && dims?.diameter_cm && dims.diameter_cm > 0;
  const heightCm = isCylinder ? dims!.diameter_cm! : dims?.height_cm;
  const widthCm = isCylinder ? dims!.diameter_cm! : dims?.width_cm;

  return {
    weight: dims?.weight_kg && dims.weight_kg > 0 ? dims.weight_kg : FALLBACK_DIMENSIONS.weight,
    height: heightCm && heightCm > 0 ? heightCm : FALLBACK_DIMENSIONS.height,
    width: widthCm && widthCm > 0 ? widthCm : FALLBACK_DIMENSIONS.width,
    length: dims?.length_cm && dims.length_cm > 0 ? dims.length_cm : FALLBACK_DIMENSIONS.length,
  };
}

// SuperFrete's booking endpoint (/api/v0/cart) takes a single volume per
// label, unlike the quote calculator which accepts one entry per product and
// lets SuperFrete work out the cubagem itself. We approximate a combined
// package here: sum the weight of every item, use the largest single-item
// dimension on each axis as the box size. This is a deliberate v1 heuristic,
// not real bin-packing.
function combineVolume(
  items: { product_id: string; quantity: number }[],
  dimsById: Map<string, ProductDims>
) {
  let weight = 0;
  let height = 0;
  let width = 0;
  let length = 0;

  for (const item of items) {
    const resolved = resolveDims(dimsById.get(item.product_id));
    const qty = Math.max(1, item.quantity || 1);
    weight += resolved.weight * qty;
    height = Math.max(height, resolved.height);
    width = Math.max(width, resolved.width);
    length = Math.max(length, resolved.length);
  }

  return {
    weight: weight > 0 ? Math.round(weight * 100) / 100 : FALLBACK_DIMENSIONS.weight,
    height: height > 0 ? height : FALLBACK_DIMENSIONS.height,
    width: width > 0 ? width : FALLBACK_DIMENSIONS.width,
    length: length > 0 ? length : FALLBACK_DIMENSIONS.length,
  };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Não autorizado" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
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
      return new Response(
        JSON.stringify({ error: "Não autorizado" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const admin = createClient(supabaseUrl, supabaseServiceKey);

    const { data: merchant, error: merchantError } = await admin
      .from("users")
      .select("id, shipping_test_override")
      .eq("id", user.id)
      .maybeSingle();

    if (merchantError) throw new Error(merchantError.message);
    if (!merchant) {
      return new Response(
        JSON.stringify({ error: "Usuário não encontrado" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { action, payload } = await req.json();
    const orderId = (payload as { order_id?: string } | undefined)?.order_id;

    if (!orderId) {
      return new Response(
        JSON.stringify({ error: "order_id é obrigatório" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: order, error: orderError } = await admin
      .from("orders")
      .select(
        "id, store_owner_id, customer_name, customer_whatsapp, customer_country_code, customer_cpf, delivery_option, shipping_street, shipping_number, shipping_complement, shipping_neighborhood, shipping_city, shipping_state, shipping_zip_code"
      )
      .eq("id", orderId)
      .maybeSingle();

    if (orderError) throw new Error(orderError.message);
    if (!order || order.store_owner_id !== user.id) {
      return new Response(
        JSON.stringify({ error: "Pedido não encontrado" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const getLatestLabel = async () => {
      const { data, error } = await admin
        .from("order_shipping_labels")
        .select("*")
        .eq("order_id", orderId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw new Error(error.message);
      return data;
    };

    switch (action) {
      case "getLabel": {
        const label = await getLatestLabel();
        return new Response(
          JSON.stringify({ label }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case "purchaseLabel": {
        const { data: credentials, error: credentialsError } = await admin
          .from("merchant_shipping_credentials")
          .select("*")
          .eq("user_id", user.id)
          .eq("provider", "superfrete")
          .eq("is_active", true)
          .maybeSingle();

        if (credentialsError) throw new Error(credentialsError.message);

        if (!merchant.shipping_test_override) {
          return new Response(
            JSON.stringify({ error: "Integrações de frete estão disponíveis apenas para contas de teste no momento." }),
            { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        if (!credentials || !credentials.label_purchase_enabled) {
          return new Response(
            JSON.stringify({ error: "Compra de etiqueta não está ativada nas configurações de Frete." }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const originZip = onlyDigits(credentials.origin_zip_code);
        const senderFields = [
          credentials.sender_name,
          credentials.sender_document,
          credentials.sender_phone,
          credentials.sender_street,
          credentials.sender_neighborhood,
          credentials.sender_city,
          credentials.sender_state,
        ];
        if (originZip.length !== 8 || senderFields.some((f) => !f)) {
          return new Response(
            JSON.stringify({ error: "Preencha os dados do remetente nas configurações de Frete antes de comprar uma etiqueta." }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const serviceMatch = /^superfrete:(\d+)$/.exec(order.delivery_option || "");
        if (!serviceMatch) {
          return new Response(
            JSON.stringify({ error: "Este pedido não usou uma opção de entrega SuperFrete." }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        const serviceId = serviceMatch[1];

        const destinationZip = onlyDigits(order.shipping_zip_code);
        const destinationDocument = onlyDigits(order.customer_cpf);
        const destinationPhone = onlyDigits(order.customer_whatsapp);
        if (
          destinationZip.length !== 8 ||
          !destinationDocument ||
          !order.shipping_street ||
          !order.shipping_neighborhood ||
          !order.shipping_city ||
          !order.shipping_state
        ) {
          return new Response(
            JSON.stringify({ error: "Endereço ou CPF/CNPJ do comprador incompletos para gerar a etiqueta." }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const existingLabel = await getLatestLabel();
        if (existingLabel && ["released", "posted", "delivered"].includes(existingLabel.status)) {
          return new Response(
            JSON.stringify({ error: "Este pedido já tem uma etiqueta ativa. Cancele-a antes de comprar outra." }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const reusableLabel =
          existingLabel && existingLabel.status === "pending" && existingLabel.superfrete_order_id
            ? existingLabel
            : null;

        const headers = {
          Authorization: `Bearer ${credentials.api_token}`,
          "User-Agent": USER_AGENT,
          "Content-Type": "application/json",
        };
        const baseUrl = superFreteBaseUrl(credentials.environment);

        let superfreteOrderId = reusableLabel?.superfrete_order_id as string | undefined;
        let labelRowId = reusableLabel?.id as string | undefined;

        if (!superfreteOrderId) {
          const { data: orderItems, error: itemsError } = await admin
            .from("order_items")
            .select("product_id, product_title, quantity, unit_price")
            .eq("order_id", orderId);
          if (itemsError) throw new Error(itemsError.message);
          if (!orderItems || orderItems.length === 0) {
            return new Response(
              JSON.stringify({ error: "Pedido sem itens." }),
              { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }

          const productIds = [...new Set(orderItems.map((i) => i.product_id))];
          const { data: products } = await admin
            .from("products")
            .select("id, weight_kg, height_cm, width_cm, length_cm, package_type, diameter_cm")
            .in("id", productIds);
          const dimsById = new Map((products || []).map((p) => [p.id, p]));

          const volume = combineVolume(orderItems, dimsById);

          const cartBody = {
            from: {
              name: credentials.sender_name,
              address: credentials.sender_street,
              district: credentials.sender_neighborhood,
              city: credentials.sender_city,
              state_abbr: credentials.sender_state,
              postal_code: originZip,
              complement: credentials.sender_complement || "",
              number: credentials.sender_number || "",
              document: onlyDigits(credentials.sender_document),
            },
            to: {
              name: order.customer_name,
              address: order.shipping_street,
              district: order.shipping_neighborhood,
              city: order.shipping_city,
              state_abbr: order.shipping_state,
              postal_code: destinationZip,
              document: destinationDocument,
              phone: destinationPhone || null,
              complement: order.shipping_complement || "",
              number: order.shipping_number || "",
            },
            service: Number(serviceId),
            volumes: volume,
            products: orderItems.map((item) => ({
              name: item.product_title,
              quantity: String(item.quantity),
              unitary_value: String(item.unit_price),
            })),
            options: {
              insurance_value: null,
              receipt: false,
              own_hand: false,
              non_commercial: true,
            },
            platform: PLATFORM_NAME,
          };

          let cartResponse: Response;
          try {
            cartResponse = await fetch(`${baseUrl}/api/v0/cart`, {
              method: "POST",
              headers,
              body: JSON.stringify(cartBody),
            });
          } catch {
            return new Response(
              JSON.stringify({ error: "Não foi possível conectar à SuperFrete." }),
              { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }

          const cartData = await cartResponse.json().catch(() => ({}));

          if (!cartResponse.ok || !cartData?.id) {
            const errorMessage = cartData?.message || cartData?.error || "Falha ao reservar a etiqueta na SuperFrete.";
            if (labelRowId) {
              await admin
                .from("order_shipping_labels")
                .update({ status: "error", error_message: errorMessage, service_id: serviceId })
                .eq("id", labelRowId);
            } else {
              const { data: inserted } = await admin
                .from("order_shipping_labels")
                .insert({ order_id: orderId, service_id: serviceId, status: "error", error_message: errorMessage })
                .select("id")
                .maybeSingle();
              labelRowId = inserted?.id;
            }
            return new Response(
              JSON.stringify({ error: errorMessage }),
              { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }

          superfreteOrderId = String(cartData.id);

          if (labelRowId) {
            await admin
              .from("order_shipping_labels")
              .update({
                status: "pending",
                superfrete_order_id: superfreteOrderId,
                service_id: serviceId,
                price: cartData.price ?? null,
                error_message: null,
              })
              .eq("id", labelRowId);
          } else {
            const { data: inserted, error: insertError } = await admin
              .from("order_shipping_labels")
              .insert({
                order_id: orderId,
                superfrete_order_id: superfreteOrderId,
                service_id: serviceId,
                status: "pending",
                price: cartData.price ?? null,
              })
              .select("id")
              .maybeSingle();
            if (insertError) throw new Error(insertError.message);
            labelRowId = inserted?.id;
          }
        }

        let checkoutResponse: Response;
        try {
          checkoutResponse = await fetch(`${baseUrl}/api/v0/checkout`, {
            method: "POST",
            headers,
            body: JSON.stringify({ orders: [superfreteOrderId] }),
          });
        } catch {
          return new Response(
            JSON.stringify({ error: "Não foi possível conectar à SuperFrete para finalizar o pagamento da etiqueta." }),
            { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const checkoutData = await checkoutResponse.json().catch(() => ({}));
        const purchasedOrder = checkoutData?.purchase?.orders?.[0];

        if (!checkoutResponse.ok || !checkoutData?.success || !purchasedOrder) {
          const errorMessage =
            checkoutData?.message || checkoutData?.error || "Falha ao pagar a etiqueta — verifique o saldo da sua conta SuperFrete.";
          await admin
            .from("order_shipping_labels")
            .update({ status: "error", error_message: errorMessage })
            .eq("id", labelRowId);
          return new Response(
            JSON.stringify({ error: errorMessage }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const trackingCode: string | undefined = purchasedOrder.tracking;
        const labelPdfUrl: string | undefined = purchasedOrder.print?.url;

        await admin
          .from("order_shipping_labels")
          .update({
            status: "released",
            price: purchasedOrder.price ?? null,
            tracking_code: trackingCode || null,
            label_pdf_url: labelPdfUrl || null,
            error_message: null,
            purchased_at: new Date().toISOString(),
          })
          .eq("id", labelRowId);

        await admin
          .from("orders")
          .update({
            carrier: SERVICE_CARRIER_NAMES[serviceId] || "SuperFrete",
            tracking_code: trackingCode || null,
          })
          .eq("id", orderId);

        const { data: finalLabel } = await admin
          .from("order_shipping_labels")
          .select("*")
          .eq("id", labelRowId)
          .maybeSingle();

        return new Response(
          JSON.stringify({ success: true, label: finalLabel }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case "cancelLabel": {
        const label = await getLatestLabel();
        if (!label || !["pending", "released"].includes(label.status) || !label.superfrete_order_id) {
          return new Response(
            JSON.stringify({ error: "Nenhuma etiqueta ativa para cancelar." }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const { data: credentials, error: credentialsError } = await admin
          .from("merchant_shipping_credentials")
          .select("api_token, environment")
          .eq("user_id", user.id)
          .eq("provider", "superfrete")
          .maybeSingle();
        if (credentialsError) throw new Error(credentialsError.message);
        if (!credentials) {
          return new Response(
            JSON.stringify({ error: "Credenciais da SuperFrete não configuradas." }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        let cancelResponse: Response;
        try {
          cancelResponse = await fetch(`${superFreteBaseUrl(credentials.environment)}/api/v0/order/cancel`, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${credentials.api_token}`,
              "User-Agent": USER_AGENT,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ order: { id: label.superfrete_order_id, description: "Cancelado pelo lojista" } }),
          });
        } catch {
          return new Response(
            JSON.stringify({ error: "Não foi possível conectar à SuperFrete para cancelar a etiqueta." }),
            { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const cancelData = await cancelResponse.json().catch(() => ({}));
        const cancelled = cancelData?.[label.superfrete_order_id]?.canceled;

        if (!cancelResponse.ok || !cancelled) {
          const errorMessage = cancelData?.message || cancelData?.error || "Não foi possível cancelar a etiqueta (pode já ter sido postada).";
          return new Response(
            JSON.stringify({ error: errorMessage }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        await admin
          .from("order_shipping_labels")
          .update({ status: "cancelled", cancelled_at: new Date().toISOString() })
          .eq("id", label.id);

        await admin
          .from("orders")
          .update({ carrier: null, tracking_code: null })
          .eq("id", orderId);

        return new Response(
          JSON.stringify({ success: true }),
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
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
