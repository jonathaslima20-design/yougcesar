import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Client-Info, Apikey",
};

const OLIST_API_BASE = "https://api.tiny.com.br/public-api/v3";
const OAUTH_TOKEN_URL = "https://accounts.tiny.com.br/realms/tiny/protocol/openid-connect/token";

// Olist's per-account rate limit is 30-140 req/min depending on plan (undocumented
// which tier any given merchant is on). 2s between calls stays under the floor
// (30/min) for every plan rather than risking 429s against the slowest one.
const REQUEST_SPACING_MS = 2000;
// Stock sync is one HTTP call per linked product (Olist's v3 API has no bulk
// stock-listing endpoint — GET /estoque/{idProduto} is per-product only). Capped
// so a merchant with a large catalog can't push a single invocation past the
// edge function's execution time limit; the caller re-invokes for the rest.
const MAX_PRODUCTS_PER_RUN = 50;

interface ErpCredentials {
  id: string;
  client_id: string;
  client_secret: string;
  access_token: string | null;
  refresh_token: string | null;
  token_expires_at: string | null;
  is_active: boolean;
}

class ErpNotConnectedError extends Error {}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function getValidAccessToken(
  admin: ReturnType<typeof createClient>,
  userId: string
): Promise<string> {
  const { data: creds } = await admin
    .from("merchant_erp_credentials")
    .select("*")
    .eq("user_id", userId)
    .eq("provider", "olist")
    .maybeSingle();

  const credentials = creds as ErpCredentials | null;

  if (!credentials || !credentials.is_active || !credentials.access_token) {
    throw new ErpNotConnectedError("Conecte sua conta Olist ERP antes de sincronizar.");
  }

  const expiresAt = credentials.token_expires_at ? new Date(credentials.token_expires_at).getTime() : 0;
  const needsRefresh = expiresAt - Date.now() < 60_000;

  if (!needsRefresh) {
    return credentials.access_token;
  }

  if (!credentials.refresh_token) {
    throw new ErpNotConnectedError("Conexão com a Olist expirou. Reconecte sua conta.");
  }

  const basicAuth = btoa(`${credentials.client_id}:${credentials.client_secret}`);
  const refreshResponse = await fetch(OAUTH_TOKEN_URL, {
    method: "POST",
    headers: {
      Authorization: `Basic ${basicAuth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: credentials.refresh_token,
    }),
  });

  if (!refreshResponse.ok) {
    // Refresh tokens can themselves expire/get revoked; surface this as
    // "not connected" so the UI prompts a reconnect instead of a generic error.
    throw new ErpNotConnectedError("Conexão com a Olist expirou. Reconecte sua conta.");
  }

  const refreshed = await refreshResponse.json() as {
    access_token: string;
    refresh_token: string;
    expires_in: number;
  };

  await admin
    .from("merchant_erp_credentials")
    .update({
      access_token: refreshed.access_token,
      refresh_token: refreshed.refresh_token,
      token_expires_at: new Date(Date.now() + refreshed.expires_in * 1000).toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", credentials.id);

  return refreshed.access_token;
}

async function olistFetch(accessToken: string, path: string, init?: RequestInit): Promise<Response> {
  return fetch(`${OLIST_API_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });
}

// Capped, not "all anexos": a product imported from an ERP catalog is meant
// to be reviewed before publishing anyway (see the is_visible_on_storefront
// note below), and re-hosting every attachment for every bulk-imported
// product would multiply the number of external downloads + storage writes
// per import for little practical benefit — most catalog photos are 1-5 shots.
const MAX_IMPORTED_IMAGES = 5;

async function importOlistImages(
  admin: ReturnType<typeof createClient>,
  accessToken: string,
  userId: string,
  productId: string,
  olistProductId: string
): Promise<void> {
  const response = await olistFetch(accessToken, `/produtos/${olistProductId}/anexos`);
  if (!response.ok) return;

  const anexos = await response.json() as Array<{ id?: number; url?: string }>;
  const urls = anexos.map((a) => a.url).filter((u): u is string => !!u).slice(0, MAX_IMPORTED_IMAGES);
  if (urls.length === 0) return;

  const uploaded: Array<{ url: string; display_order: number }> = [];

  for (let i = 0; i < urls.length; i++) {
    try {
      const imageResponse = await fetch(urls[i]);
      if (!imageResponse.ok) continue;

      const blob = await imageResponse.blob();
      const contentType = imageResponse.headers.get("content-type") || "image/jpeg";
      const ext = contentType.includes("png") ? "png" : contentType.includes("webp") ? "webp" : "jpg";
      const filePath = `product/${userId}/olist-${productId}-${Date.now()}-${i}.${ext}`;

      const { error: uploadError } = await admin.storage.from("public").upload(filePath, blob, {
        contentType,
        cacheControl: "3600",
        upsert: false,
      });
      if (uploadError) continue;

      const { data: { publicUrl } } = admin.storage.from("public").getPublicUrl(filePath);
      uploaded.push({ url: publicUrl, display_order: uploaded.length });
    } catch {
      // one bad image shouldn't sink the whole import
      continue;
    }
  }

  if (uploaded.length === 0) return;

  await admin.from("product_images").insert(
    uploaded.map((img) => ({
      product_id: productId,
      url: img.url,
      is_featured: img.display_order === 0,
      media_type: "image",
      display_order: img.display_order,
    }))
  );

  await admin.from("products").update({ featured_image_url: uploaded[0].url }).eq("id", productId);
}

interface OlistGrade {
  chave?: string;
  valor?: string;
}

interface OlistVariation {
  id: number;
  precos?: { preco?: number };
  estoque?: { quantidade?: number };
  grade?: OlistGrade[];
}

interface OlistProductDetail {
  descricao?: string;
  tipoVariacao?: "N" | "P" | "V" | null;
  precos?: { preco?: number };
  variacoes?: OlistVariation[];
}

// Maps a variacao's grade (e.g. [{chave:"Cor",valor:"Azul"},{chave:"Tamanho",
// valor:"42"}]) onto our fixed color/size/flavor columns. Grade keys outside
// those three known axes fall into whichever column is still free, so an
// odd/custom attribute label doesn't silently disappear.
function parseVariantGrade(grade: OlistGrade[] | undefined): {
  color: string | null;
  size: string | null;
  flavor: string | null;
} {
  let color: string | null = null;
  let size: string | null = null;
  let flavor: string | null = null;
  const leftovers: string[] = [];

  for (const g of grade || []) {
    const key = (g.chave || "").trim().toLowerCase();
    const value = (g.valor || "").trim();
    if (!value) continue;
    if (key.includes("cor")) color = value;
    else if (key.includes("tam")) size = value;
    else if (key.includes("sabor")) flavor = value;
    else leftovers.push(value);
  }

  for (const value of leftovers) {
    if (color === null) color = value;
    else if (size === null) size = value;
    else if (flavor === null) flavor = value;
  }

  return { color, size, flavor };
}

// Imports one Olist catalog product as a brand-new, unpublished product.
// A "P" (pai) product has no stock/price of its own in the Olist — each
// cor/tamanho combination is its own child SKU ("variacao") — so instead of
// one flat product we create ONE product here with one product_variant_stock
// row per combination, each carrying its own olist_product_id link. Flat
// (non-grouped) products keep the simple one-to-one behavior.
async function importOlistProductAsNew(
  admin: ReturnType<typeof createClient>,
  accessToken: string,
  userId: string,
  olistProductId: string
): Promise<{ product_id: string; variant_count: number }> {
  const response = await olistFetch(accessToken, `/produtos/${olistProductId}`);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  const erpProduct = await response.json() as OlistProductDetail;

  const baseFields = {
    user_id: userId,
    title: erpProduct.descricao || "Produto sem nome",
    description: "",
    category: [],
    condition: "novo",
    status: "disponivel",
    // Import lands unpublished so the merchant reviews it (images, category,
    // description) before it can appear on the storefront — importing
    // straight from an ERP catalog with none of that context filled in
    // should never go live silently.
    is_visible_on_storefront: false,
  };

  const isGrouped = erpProduct.tipoVariacao === "P" && Array.isArray(erpProduct.variacoes) && erpProduct.variacoes.length > 0;

  if (!isGrouped) {
    const { data: created, error } = await admin
      .from("products")
      .insert({
        ...baseFields,
        price: erpProduct.precos?.preco ?? 0,
        olist_product_id: olistProductId,
      })
      .select("id")
      .single();
    if (error) throw error;

    await importOlistImages(admin, accessToken, userId, created.id, olistProductId);
    return { product_id: created.id, variant_count: 0 };
  }

  const parsedVariants = erpProduct.variacoes!.map((v) => ({
    olist_product_id: String(v.id),
    quantity: Math.max(0, Math.round(v.estoque?.quantidade ?? 0)),
    price: v.precos?.preco,
    ...parseVariantGrade(v.grade),
  }));

  const colors = Array.from(new Set(parsedVariants.map((v) => v.color).filter((v): v is string => !!v)));
  const sizes = Array.from(new Set(parsedVariants.map((v) => v.size).filter((v): v is string => !!v)));
  const flavors = Array.from(new Set(parsedVariants.map((v) => v.flavor).filter((v): v is string => !!v)));
  const firstPrice = parsedVariants.find((v) => v.price != null)?.price ?? erpProduct.precos?.preco ?? 0;

  const { data: created, error } = await admin
    .from("products")
    .insert({
      ...baseFields,
      price: firstPrice,
      track_inventory: true,
      colors,
      sizes,
      flavors,
    })
    .select("id")
    .single();
  if (error) throw error;

  const { error: variantError } = await admin.from("product_variant_stock").insert(
    parsedVariants.map((v) => ({
      product_id: created.id,
      color: v.color,
      size: v.size,
      flavor: v.flavor,
      quantity: v.quantity,
      reserved_quantity: 0,
      olist_product_id: v.olist_product_id,
    }))
  );
  if (variantError) throw variantError;

  // recalc_product_aggregate_stock only sums rows whose color/size/flavor
  // match products.colors/sizes/flavors — without setting those arrays above,
  // every row we just inserted would be treated as an "orphan" and excluded.
  await admin.rpc("recalc_product_aggregate_stock", { p_product_id: created.id });
  await importOlistImages(admin, accessToken, userId, created.id, olistProductId);

  return { product_id: created.id, variant_count: parsedVariants.length };
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

    const { action, payload } = await req.json();

    switch (action) {
      case "listErpProducts": {
        const { search, limit, offset } = (payload || {}) as {
          search?: string;
          limit?: number;
          offset?: number;
        };

        const accessToken = await getValidAccessToken(admin, user.id);

        const url = new URL(`${OLIST_API_BASE}/produtos`);
        if (search?.trim()) url.searchParams.set("nome", search.trim());
        url.searchParams.set("limit", String(Math.min(Math.max(limit || 25, 1), 100)));
        url.searchParams.set("offset", String(Math.max(offset || 0, 0)));

        const response = await fetch(url, {
          headers: { Authorization: `Bearer ${accessToken}` },
        });

        if (!response.ok) {
          return new Response(
            JSON.stringify({ error: "Não foi possível listar os produtos da Olist." }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const data = await response.json() as {
          itens: Array<{
            id: number;
            sku: string;
            descricao: string;
            situacao: string;
            tipoVariacao?: "N" | "P" | "V" | null;
            precos?: { preco?: number };
          }>;
          paginacao: { limit: number; offset: number; total: number };
        };

        return new Response(
          JSON.stringify({
            // Olist's /produtos endpoint returns excluded products alongside
            // active/inactive ones with no status filter param — drop them here
            // so a product the merchant deleted in Olist can't be picked to
            // import/link on this side. Each cor/tamanho combination of a
            // grouped product is ALSO its own item here (tipoVariacao "V"),
            // repeating the parent's name — that's the "mesmo tenis em 8
            // linhas" symptom. Only the parent ("P") and ungrouped ("N"/null)
            // items are surfaced; importing a "P" brings every combination in
            // together as one product (see importOlistProductAsNew).
            products: data.itens
              .filter((item) => item.situacao !== "E" && item.tipoVariacao !== "V")
              .map((item) => ({
                olist_product_id: String(item.id),
                sku: item.sku,
                name: item.descricao,
                situacao: item.situacao,
                price: item.precos?.preco ?? null,
                has_variations: item.tipoVariacao === "P",
              })),
            pagination: data.paginacao,
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case "linkProduct":
      case "unlinkProduct": {
        const { product_id, olist_product_id, variant_stock_id } = payload as {
          product_id: string;
          olist_product_id?: string;
          variant_stock_id?: string;
        };

        if (!product_id || (action === "linkProduct" && !olist_product_id)) {
          return new Response(
            JSON.stringify({ error: "Dados incompletos para vincular o produto." }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const { data: product } = await admin
          .from("products")
          .select("id")
          .eq("id", product_id)
          .eq("user_id", user.id)
          .maybeSingle();

        if (!product) {
          return new Response(
            JSON.stringify({ error: "Produto não encontrado." }),
            { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // A combinacao cor/tamanho e um SKU proprio na Olist, entao o vinculo
        // fica na linha da variante — nao no produto — quando variant_stock_id
        // e informado. Sem isso, um produto so poderia apontar pra um unico
        // SKU da Olist, impossivel pra quem tem grade de cor/tamanho.
        if (variant_stock_id) {
          const { data: variant } = await admin
            .from("product_variant_stock")
            .select("id")
            .eq("id", variant_stock_id)
            .eq("product_id", product_id)
            .maybeSingle();

          if (!variant) {
            return new Response(
              JSON.stringify({ error: "Variante não encontrada." }),
              { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }

          const { error } = await admin
            .from("product_variant_stock")
            .update({ olist_product_id: action === "linkProduct" ? olist_product_id : null })
            .eq("id", variant_stock_id);
          if (error) throw error;

          return new Response(
            JSON.stringify({ success: true }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const { error } = await admin
          .from("products")
          .update({ olist_product_id: action === "linkProduct" ? olist_product_id : null })
          .eq("id", product_id);
        if (error) throw error;

        return new Response(
          JSON.stringify({ success: true }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case "pushPrice": {
        const { product_id } = payload as { product_id: string };

        const { data: product } = await admin
          .from("products")
          .select("id, price, discounted_price, olist_product_id")
          .eq("id", product_id)
          .eq("user_id", user.id)
          .maybeSingle();

        if (!product?.olist_product_id) {
          return new Response(
            JSON.stringify({ error: "Este produto não está vinculado a um produto na Olist." }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const accessToken = await getValidAccessToken(admin, user.id);

        const response = await olistFetch(accessToken, `/produtos/${product.olist_product_id}/preco`, {
          method: "PUT",
          body: JSON.stringify({
            preco: product.price ?? 0,
            precoPromocional: product.discounted_price ?? null,
          }),
        });

        if (!response.ok) {
          const body = await response.text().catch(() => "");
          console.error("Olist price push failed:", response.status, body);
          return new Response(
            JSON.stringify({ error: "Não foi possível atualizar o preço na Olist." }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        return new Response(
          JSON.stringify({ success: true }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case "pullProduct": {
        const { olist_product_id, product_id } = payload as {
          olist_product_id: string;
          product_id?: string;
        };

        if (!olist_product_id) {
          return new Response(
            JSON.stringify({ error: "Produto da Olist não informado." }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const accessToken = await getValidAccessToken(admin, user.id);

        if (product_id) {
          const response = await olistFetch(accessToken, `/produtos/${olist_product_id}`);
          if (!response.ok) {
            return new Response(
              JSON.stringify({ error: "Produto não encontrado na Olist." }),
              { headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }
          const erpProduct = await response.json() as { descricao?: string; precos?: { preco?: number } };

          const { data: existing } = await admin
            .from("products")
            .select("id")
            .eq("id", product_id)
            .eq("user_id", user.id)
            .maybeSingle();

          if (!existing) {
            return new Response(
              JSON.stringify({ error: "Produto não encontrado." }),
              { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }

          const { error } = await admin
            .from("products")
            .update({
              title: erpProduct.descricao || "Produto sem nome",
              price: erpProduct.precos?.preco ?? 0,
              olist_product_id,
            })
            .eq("id", product_id);
          if (error) throw error;

          return new Response(
            JSON.stringify({ success: true, product_id }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        try {
          const result = await importOlistProductAsNew(admin, accessToken, user.id, olist_product_id);
          return new Response(
            JSON.stringify({ success: true, product_id: result.product_id, variant_count: result.variant_count }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        } catch (err) {
          return new Response(
            JSON.stringify({ error: err instanceof Error ? err.message : "Erro ao importar produto" }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      }

      case "bulkImportProducts": {
        const { olist_product_ids } = payload as { olist_product_ids: string[] };

        if (!Array.isArray(olist_product_ids) || olist_product_ids.length === 0) {
          return new Response(
            JSON.stringify({ error: "Nenhum produto selecionado." }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const accessToken = await getValidAccessToken(admin, user.id);
        const ids = olist_product_ids.slice(0, MAX_PRODUCTS_PER_RUN);

        let imported = 0;
        const errors: Array<{ olist_product_id: string; error: string }> = [];

        for (let i = 0; i < ids.length; i++) {
          const olistProductId = ids[i];
          try {
            await importOlistProductAsNew(admin, accessToken, user.id, olistProductId);
            imported++;
          } catch (err) {
            errors.push({
              olist_product_id: olistProductId,
              error: err instanceof Error ? err.message : "Erro desconhecido",
            });
          }

          if (i < ids.length - 1) await sleep(1000);
        }

        return new Response(
          JSON.stringify({ imported, failed: errors.length, errors }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case "pullStock": {
        const accessToken = await getValidAccessToken(admin, user.id);

        const { data: linkedProducts } = await admin
          .from("products")
          .select("id, olist_product_id")
          .eq("user_id", user.id)
          .not("olist_product_id", "is", null)
          .limit(MAX_PRODUCTS_PER_RUN);

        // Variant-linked rows: same pull, but each row is one cor/tamanho SKU
        // in the Olist and writes to product_variant_stock.quantity instead of
        // the product's flat stock_quantity. Scoped to this user via a join
        // through products (product_variant_stock has no user_id of its own).
        const { data: ownedProducts } = await admin
          .from("products")
          .select("id")
          .eq("user_id", user.id);
        const ownedProductIds = (ownedProducts || []).map((p) => p.id);

        const { data: linkedVariants } = ownedProductIds.length
          ? await admin
              .from("product_variant_stock")
              .select("id, product_id, olist_product_id")
              .in("product_id", ownedProductIds)
              .not("olist_product_id", "is", null)
              .limit(MAX_PRODUCTS_PER_RUN)
          : { data: [] };

        const products = linkedProducts || [];
        const variants = linkedVariants || [];
        let synced = 0;
        const errors: Array<{ product_id: string; error: string }> = [];
        const affectedProductIds = new Set<string>();

        for (let i = 0; i < products.length; i++) {
          const product = products[i];
          try {
            const response = await olistFetch(accessToken, `/estoque/${product.olist_product_id}`);
            if (!response.ok) {
              errors.push({ product_id: product.id, error: `HTTP ${response.status}` });
            } else {
              const stock = await response.json() as { saldo?: number; disponivel?: number };
              // `saldo` is the real physical balance Olist tracks; `disponivel`
              // (saldo minus reservations) frequently comes back as a real 0 on
              // this API, and `??` doesn't fall through on 0 — reading
              // disponivel first was silently zeroing every synced product.
              const quantity = stock.saldo ?? stock.disponivel ?? 0;
              const { error } = await admin
                .from("products")
                .update({ stock_quantity: Math.max(0, Math.round(quantity)) })
                .eq("id", product.id);
              if (error) throw error;
              synced++;
            }
          } catch (err) {
            errors.push({
              product_id: product.id,
              error: err instanceof Error ? err.message : "Erro desconhecido",
            });
          }

          if (i < products.length - 1 || variants.length > 0) await sleep(REQUEST_SPACING_MS);
        }

        for (let i = 0; i < variants.length; i++) {
          const variant = variants[i];
          try {
            const response = await olistFetch(accessToken, `/estoque/${variant.olist_product_id}`);
            if (!response.ok) {
              errors.push({ product_id: variant.product_id, error: `HTTP ${response.status}` });
            } else {
              const stock = await response.json() as { saldo?: number; disponivel?: number };
              // See the same fix in the flat-products loop above: `saldo` is
              // the real balance, `disponivel` frequently comes back as a
              // real 0 on this API and `??` doesn't fall through on 0.
              const quantity = stock.saldo ?? stock.disponivel ?? 0;
              const { error } = await admin
                .from("product_variant_stock")
                .update({ quantity: Math.max(0, Math.round(quantity)), updated_at: new Date().toISOString() })
                .eq("id", variant.id);
              if (error) throw error;
              affectedProductIds.add(variant.product_id);
              synced++;
            }
          } catch (err) {
            errors.push({
              product_id: variant.product_id,
              error: err instanceof Error ? err.message : "Erro desconhecido",
            });
          }

          if (i < variants.length - 1) await sleep(REQUEST_SPACING_MS);
        }

        // Variant rows only feed the aggregate on recalc — without this, a
        // product's displayed stock_quantity would keep the number from
        // before this sync even though its variants just changed.
        for (const productId of affectedProductIds) {
          await admin.rpc("recalc_product_aggregate_stock", { p_product_id: productId });
        }

        await admin
          .from("merchant_erp_credentials")
          .update({ last_synced_at: new Date().toISOString() })
          .eq("user_id", user.id)
          .eq("provider", "olist");

        return new Response(
          JSON.stringify({
            synced,
            failed: errors.length,
            errors,
            has_more: products.length === MAX_PRODUCTS_PER_RUN || variants.length === MAX_PRODUCTS_PER_RUN,
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case "pushStockAdjustment": {
        const { product_id, variant_stock_id, delta } = payload as {
          product_id: string;
          variant_stock_id?: string | null;
          delta: number;
        };

        if (!product_id || !Number.isFinite(delta) || delta === 0) {
          return new Response(
            JSON.stringify({ pushed: false, skipped: true, reason: "no_change" }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        let olistProductId: string | null = null;

        if (variant_stock_id) {
          const { data: variant } = await admin
            .from("product_variant_stock")
            .select("olist_product_id, product_id")
            .eq("id", variant_stock_id)
            .eq("product_id", product_id)
            .maybeSingle();
          olistProductId = variant?.olist_product_id ?? null;
        } else {
          const { data: product } = await admin
            .from("products")
            .select("olist_product_id")
            .eq("id", product_id)
            .eq("user_id", user.id)
            .maybeSingle();
          olistProductId = product?.olist_product_id ?? null;
        }

        if (!olistProductId) {
          return new Response(
            JSON.stringify({ pushed: false, skipped: true, reason: "not_linked" }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        try {
          const accessToken = await getValidAccessToken(admin, user.id);
          const pushBody = {
            tipo: delta > 0 ? "E" : "S",
            quantidade: Math.abs(delta),
            observacoes: "Ajuste manual de estoque na VitrineTurbo",
          };
          const response = await olistFetch(accessToken, `/estoque/${olistProductId}`, {
            method: "POST",
            body: JSON.stringify(pushBody),
          });

          if (!response.ok) {
            const body = await response.text().catch(() => "");
            console.error("Olist stock adjustment push failed:", olistProductId, JSON.stringify(pushBody), response.status, body);
            return new Response(
              JSON.stringify({ pushed: false, error: `HTTP ${response.status}` }),
              { headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }

          // TEMP DEBUG — remove once we confirm the push actually moves the
          // needle on Olist's side (not just that the call returned 2xx).
          const okBody = await response.text().catch(() => "");
          console.log("[olist debug] stock push OK", olistProductId, "sent:", JSON.stringify(pushBody), "response:", okBody);

          return new Response(
            JSON.stringify({ pushed: true }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        } catch (err) {
          // Best-effort: a manual stock edit inside VitrineTurbo must never
          // fail because Olist happened to be unreachable.
          return new Response(
            JSON.stringify({ pushed: false, error: err instanceof Error ? err.message : "Erro desconhecido" }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      }

      default:
        return new Response(
          JSON.stringify({ error: "Ação não reconhecida" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }
  } catch (error) {
    if (error instanceof ErpNotConnectedError) {
      return new Response(
        JSON.stringify({ error: error.message }),
        { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    const message = error instanceof Error ? error.message : "Erro interno";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
