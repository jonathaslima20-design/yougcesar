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
            precos?: { preco?: number };
          }>;
          paginacao: { limit: number; offset: number; total: number };
        };

        return new Response(
          JSON.stringify({
            products: data.itens.map((item) => ({
              olist_product_id: String(item.id),
              sku: item.sku,
              name: item.descricao,
              situacao: item.situacao,
              price: item.precos?.preco ?? null,
            })),
            pagination: data.paginacao,
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case "linkProduct":
      case "unlinkProduct": {
        const { product_id, olist_product_id } = payload as {
          product_id: string;
          olist_product_id?: string;
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

        const response = await olistFetch(accessToken, `/produtos/${olist_product_id}`);
        if (!response.ok) {
          return new Response(
            JSON.stringify({ error: "Produto não encontrado na Olist." }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const erpProduct = await response.json() as {
          descricao?: string;
          precos?: { preco?: number };
        };

        const fields = {
          title: erpProduct.descricao || "Produto sem nome",
          price: erpProduct.precos?.preco ?? 0,
          olist_product_id,
        };

        if (product_id) {
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
            .update(fields)
            .eq("id", product_id);
          if (error) throw error;

          return new Response(
            JSON.stringify({ success: true, product_id }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // No target product: import as a new, unpublished product so the merchant
        // reviews it (images, category, description) before it can appear on the
        // storefront — importing straight from an ERP catalog with none of that
        // context filled in should never go live silently.
        const { data: created, error } = await admin
          .from("products")
          .insert({
            user_id: user.id,
            title: fields.title,
            description: "",
            price: fields.price,
            category: [],
            condition: "novo",
            status: "disponivel",
            is_visible_on_storefront: false,
            olist_product_id,
          })
          .select("id")
          .single();
        if (error) throw error;

        await importOlistImages(admin, accessToken, user.id, created.id, olist_product_id);

        return new Response(
          JSON.stringify({ success: true, product_id: created.id }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
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
            const productResponse = await olistFetch(accessToken, `/produtos/${olistProductId}`);
            if (!productResponse.ok) {
              errors.push({ olist_product_id: olistProductId, error: `HTTP ${productResponse.status}` });
              continue;
            }
            const erpProduct = await productResponse.json() as {
              descricao?: string;
              precos?: { preco?: number };
            };

            const { data: created, error } = await admin
              .from("products")
              .insert({
                user_id: user.id,
                title: erpProduct.descricao || "Produto sem nome",
                description: "",
                price: erpProduct.precos?.preco ?? 0,
                category: [],
                condition: "novo",
                status: "disponivel",
                is_visible_on_storefront: false,
                olist_product_id: olistProductId,
              })
              .select("id")
              .single();
            if (error) throw error;

            await importOlistImages(admin, accessToken, user.id, created.id, olistProductId);
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

        const products = linkedProducts || [];
        let synced = 0;
        const errors: Array<{ product_id: string; error: string }> = [];

        for (let i = 0; i < products.length; i++) {
          const product = products[i];
          try {
            const response = await olistFetch(accessToken, `/estoque/${product.olist_product_id}`);
            if (!response.ok) {
              errors.push({ product_id: product.id, error: `HTTP ${response.status}` });
            } else {
              const stock = await response.json() as { saldo?: number; disponivel?: number };
              const quantity = stock.disponivel ?? stock.saldo ?? 0;
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

          if (i < products.length - 1) await sleep(REQUEST_SPACING_MS);
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
            has_more: products.length === MAX_PRODUCTS_PER_RUN,
          }),
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
