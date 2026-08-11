import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Client-Info, Apikey",
};

// Mirrors src/hooks/usePlanLimits.ts — enforced here too because this
// endpoint is callable directly with a bearer token, bypassing whatever the
// client UI checks.
const FREE_PLAN_PRODUCT_LIMIT = 20;

// One CSV row's worth of a single color/size/flavor combination. `quantity:
// null` means "leave whatever is already in product_variant_stock alone" —
// distinct from `0`, which zeroes it — so a price-only re-import can never
// silently wipe stock the merchant manages by hand in the dashboard.
interface BulkImportVariant {
  color: string | null;
  size: string | null;
  flavor: string | null;
  quantity: number | null;
}

interface BulkImportGroup {
  grupo_id: string;
  sku: string | null;
  title: string;
  description: string | null;
  price: number;
  discounted_price: number | null;
  category: string[] | null;
  brand: string | null;
  model: string | null;
  condition: string | null;
  gender: string | null;
  status: string | null;
  is_visible_on_storefront: boolean | null;
  weight_kg: number | null;
  height_cm: number | null;
  width_cm: number | null;
  length_cm: number | null;
  // Only meaningful when `variants` is empty — a non-variant product's flat
  // stock. null = leave untouched on update.
  flat_stock_quantity: number | null;
  images: string[];
  variants: BulkImportVariant[];
}

interface ImportBatchPayload {
  groups: BulkImportGroup[];
  options?: { update_images_on_existing?: boolean };
}

interface GroupResult {
  grupo_id: string;
  status: "created" | "updated" | "failed";
  product_id?: string;
  variant_count?: number;
  images_imported?: number;
  error?: string;
}

function normKey(v: string | null): string {
  return (v ?? "").trim().toLowerCase();
}

function variantKey(color: string | null, size: string | null, flavor: string | null): string {
  return `${normKey(color)}|${normKey(size)}|${normKey(flavor)}`;
}

function uniqueNonEmpty(values: (string | null)[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const v of values) {
    const trimmed = (v ?? "").trim();
    if (!trimmed) continue;
    const k = trimmed.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(trimmed);
  }
  return out;
}

// Blocks the edge function's service-role fetch() from being used as an
// SSRF proxy against internal/private network targets. Not exhaustive DNS
// rebinding protection — a pragmatic baseline for CSV-supplied URLs, which
// (unlike the Olist-image importer this is modeled on) come from arbitrary
// merchant input rather than a trusted API.
function isBlockedImageHost(hostname: string): boolean {
  const h = hostname.toLowerCase();
  if (h === "localhost" || h.endsWith(".local")) return true;
  if (h === "169.254.169.254") return true;
  if (h === "0.0.0.0" || h === "::1") return true;

  const ipv4 = h.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (ipv4) {
    const [a, b] = [parseInt(ipv4[1], 10), parseInt(ipv4[2], 10)];
    if (a === 127) return true; // loopback
    if (a === 10) return true; // 10.0.0.0/8
    if (a === 172 && b >= 16 && b <= 31) return true; // 172.16.0.0/12
    if (a === 192 && b === 168) return true; // 192.168.0.0/16
    if (a === 169 && b === 254) return true; // link-local
  }
  return false;
}

const MAX_IMPORTED_IMAGES_DEFAULT = 10;
const IMAGE_FETCH_TIMEOUT_MS = 12000;

async function fetchImageWithTimeout(url: string): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), IMAGE_FETCH_TIMEOUT_MS);
  try {
    return await fetch(url, { signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

async function importImagesFromUrls(
  admin: ReturnType<typeof createClient>,
  userId: string,
  productId: string,
  urls: string[],
  maxImages: number
): Promise<number> {
  const uploaded: Array<{ url: string; display_order: number }> = [];
  const capped = urls.slice(0, Math.max(0, maxImages));

  for (let i = 0; i < capped.length; i++) {
    const rawUrl = capped[i];
    try {
      const parsed = new URL(rawUrl);
      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") continue;
      if (isBlockedImageHost(parsed.hostname)) continue;

      const imageResponse = await fetchImageWithTimeout(rawUrl);
      if (!imageResponse.ok) continue;

      const blob = await imageResponse.blob();
      const contentType = imageResponse.headers.get("content-type") || "image/jpeg";
      const ext = contentType.includes("png") ? "png" : contentType.includes("webp") ? "webp" : "jpg";
      const filePath = `product/${userId}/csv-import-${productId}-${Date.now()}-${i}.${ext}`;

      const { error: uploadError } = await admin.storage.from("public").upload(filePath, blob, {
        contentType,
        cacheControl: "3600",
        upsert: false,
      });
      if (uploadError) continue;

      const { data: { publicUrl } } = admin.storage.from("public").getPublicUrl(filePath);
      uploaded.push({ url: publicUrl, display_order: uploaded.length });
    } catch {
      // one bad/slow URL shouldn't sink the whole product group
      continue;
    }
  }

  if (uploaded.length === 0) return 0;

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
  return uploaded.length;
}

// Only overwrites a field when the CSV actually supplied a value — mirrors
// the quantity blank/0 distinction so a partial re-import (e.g. price +
// stock only) can't silently clear description, brand, images, etc.
function buildProductUpdatePatch(group: BulkImportGroup): Record<string, unknown> {
  const patch: Record<string, unknown> = {};
  if (group.title?.trim()) patch.title = group.title.trim();
  if (group.description !== null && group.description !== undefined) patch.description = group.description;
  if (group.price !== null && group.price !== undefined) patch.price = group.price;
  if (group.discounted_price !== null) patch.discounted_price = group.discounted_price;
  if (group.category && group.category.length > 0) patch.category = group.category;
  if (group.brand) patch.brand = group.brand;
  if (group.model) patch.model = group.model;
  if (group.condition) patch.condition = group.condition;
  if (group.gender) patch.gender = group.gender;
  if (group.status) patch.status = group.status;
  if (group.is_visible_on_storefront !== null) patch.is_visible_on_storefront = group.is_visible_on_storefront;
  if (group.weight_kg !== null) patch.weight_kg = group.weight_kg;
  if (group.height_cm !== null) patch.height_cm = group.height_cm;
  if (group.width_cm !== null) patch.width_cm = group.width_cm;
  if (group.length_cm !== null) patch.length_cm = group.length_cm;
  return patch;
}

async function upsertVariants(
  admin: ReturnType<typeof createClient>,
  productId: string,
  variants: BulkImportVariant[]
): Promise<void> {
  const { data: existingRows } = await admin
    .from("product_variant_stock")
    .select("id, color, size, flavor")
    .eq("product_id", productId);

  const existingByKey = new Map<string, string>();
  for (const row of existingRows || []) {
    existingByKey.set(variantKey(row.color, row.size, row.flavor), row.id as string);
  }

  const toInsert: Array<{ product_id: string; color: string | null; size: string | null; flavor: string | null; quantity: number; reserved_quantity: number }> = [];

  for (const v of variants) {
    const color = v.color?.trim() || null;
    const size = v.size?.trim() || null;
    const flavor = v.flavor?.trim() || null;
    const key = variantKey(color, size, flavor);
    const existingId = existingByKey.get(key);

    if (existingId) {
      if (v.quantity !== null) {
        await admin.from("product_variant_stock").update({ quantity: Math.max(0, v.quantity) }).eq("id", existingId);
      }
    } else {
      toInsert.push({
        product_id: productId,
        color,
        size,
        flavor,
        quantity: Math.max(0, v.quantity ?? 0),
        reserved_quantity: 0,
      });
    }
  }

  if (toInsert.length > 0) {
    await admin.from("product_variant_stock").insert(toInsert);
  }

  // Variants dropped from the CSV are intentionally left alone here — once
  // products.colors/sizes/flavors is updated to the new set (below), they
  // become "orphans" that recalc_product_aggregate_stock already excludes
  // from the total, same as manual removal in the dashboard would produce.
  const colors = uniqueNonEmpty(variants.map((v) => v.color));
  const sizes = uniqueNonEmpty(variants.map((v) => v.size));
  const flavors = uniqueNonEmpty(variants.map((v) => v.flavor));

  await admin.from("products").update({ colors, sizes, flavors, track_inventory: true }).eq("id", productId);
  await admin.rpc("recalc_product_aggregate_stock", { p_product_id: productId });
}

async function processGroup(
  admin: ReturnType<typeof createClient>,
  userId: string,
  group: BulkImportGroup,
  maxImages: number,
  updateImagesOnExisting: boolean,
  canCreateNewProduct: () => boolean,
  onProductCreated: () => void
): Promise<GroupResult> {
  const sku = group.sku?.trim() || null;

  let existingProductId: string | null = null;
  if (sku) {
    const { data: match } = await admin
      .from("products")
      .select("id")
      .eq("user_id", userId)
      .eq("sku", sku)
      .maybeSingle();
    existingProductId = (match?.id as string) || null;
  }

  if (existingProductId) {
    const patch = buildProductUpdatePatch(group);
    if (Object.keys(patch).length > 0) {
      const { error: updateError } = await admin.from("products").update(patch).eq("id", existingProductId).eq("user_id", userId);
      if (updateError) {
        return { grupo_id: group.grupo_id, status: "failed", error: updateError.message };
      }
    }

    if (group.variants.length > 0) {
      await upsertVariants(admin, existingProductId, group.variants);
    } else if (group.flat_stock_quantity !== null) {
      await admin.from("products").update({
        stock_quantity: Math.max(0, group.flat_stock_quantity),
        track_inventory: true,
      }).eq("id", existingProductId).eq("user_id", userId);
    }

    let imagesImported = 0;
    if (updateImagesOnExisting && group.images.length > 0) {
      imagesImported = await importImagesFromUrls(admin, userId, existingProductId, group.images, maxImages);
    }

    return {
      grupo_id: group.grupo_id,
      status: "updated",
      product_id: existingProductId,
      variant_count: group.variants.length,
      images_imported: imagesImported,
    };
  }

  if (!canCreateNewProduct()) {
    return {
      grupo_id: group.grupo_id,
      status: "failed",
      error: "Limite de produtos do plano atingido",
    };
  }

  const colors = uniqueNonEmpty(group.variants.map((v) => v.color));
  const sizes = uniqueNonEmpty(group.variants.map((v) => v.size));
  const flavors = uniqueNonEmpty(group.variants.map((v) => v.flavor));
  const hasVariants = group.variants.length > 0;

  const { data: created, error: insertError } = await admin
    .from("products")
    .insert({
      user_id: userId,
      sku,
      title: group.title.trim(),
      description: group.description || "",
      price: group.price,
      discounted_price: group.discounted_price,
      category: group.category || [],
      brand: group.brand,
      model: group.model,
      condition: group.condition || "novo",
      gender: group.gender,
      status: group.status || "disponivel",
      // Lands unpublished so the merchant reviews it before it appears on
      // the storefront — same rationale as importOlistProductAsNew.
      is_visible_on_storefront: false,
      weight_kg: group.weight_kg,
      height_cm: group.height_cm,
      width_cm: group.width_cm,
      length_cm: group.length_cm,
      track_inventory: hasVariants || group.flat_stock_quantity !== null,
      stock_quantity: !hasVariants && group.flat_stock_quantity !== null ? Math.max(0, group.flat_stock_quantity) : 0,
      colors,
      sizes,
      flavors,
    })
    .select("id")
    .single();

  if (insertError || !created) {
    return { grupo_id: group.grupo_id, status: "failed", error: insertError?.message || "Falha ao criar produto" };
  }

  onProductCreated();

  if (hasVariants) {
    const { error: variantError } = await admin.from("product_variant_stock").insert(
      group.variants.map((v) => ({
        product_id: created.id,
        color: v.color?.trim() || null,
        size: v.size?.trim() || null,
        flavor: v.flavor?.trim() || null,
        quantity: Math.max(0, v.quantity ?? 0),
        reserved_quantity: 0,
      }))
    );
    if (variantError) {
      return { grupo_id: group.grupo_id, status: "failed", product_id: created.id, error: variantError.message };
    }
    await admin.rpc("recalc_product_aggregate_stock", { p_product_id: created.id });
  }

  let imagesImported = 0;
  if (group.images.length > 0) {
    imagesImported = await importImagesFromUrls(admin, userId, created.id, group.images, maxImages);
  }

  return {
    grupo_id: group.grupo_id,
    status: "created",
    product_id: created.id,
    variant_count: group.variants.length,
    images_imported: imagesImported,
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

    const { action, payload } = await req.json();

    if (action !== "importBatch") {
      return new Response(
        JSON.stringify({ error: "Ação não reconhecida" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { groups, options } = payload as ImportBatchPayload;
    if (!Array.isArray(groups) || groups.length === 0) {
      return new Response(
        JSON.stringify({ error: "Nenhum produto para importar" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: profile } = await admin
      .from("users")
      .select("plan_status, role, max_images_per_product")
      .eq("id", user.id)
      .maybeSingle();

    const isAdminOrParceiro = profile?.role === "admin" || profile?.role === "parceiro";
    const isActivePlan = profile?.plan_status === "active";
    const isExpired = profile?.plan_status === "expired";
    const isFreePlan = profile?.plan_status === "free";

    // Mirrors usePlanLimits.ts exactly: only 'free' carries an actual cap,
    // 'expired' blocks new products entirely, everything else is unlimited.
    let productLimit: number | null = null;
    if (isExpired) productLimit = 0;
    else if (isFreePlan && !isAdminOrParceiro && !isActivePlan) productLimit = FREE_PLAN_PRODUCT_LIMIT;

    let currentProductCount = 0;
    if (productLimit !== null) {
      const { count } = await admin
        .from("products")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id);
      currentProductCount = count ?? 0;
    }

    const maxImages = Math.min(Math.max(profile?.max_images_per_product || MAX_IMPORTED_IMAGES_DEFAULT, 1), 50);
    const updateImagesOnExisting = options?.update_images_on_existing === true;

    const results: GroupResult[] = [];
    for (const group of groups) {
      const result = await processGroup(
        admin,
        user.id,
        group,
        maxImages,
        updateImagesOnExisting,
        () => productLimit === null || currentProductCount < productLimit,
        () => { currentProductCount += 1; }
      );
      results.push(result);
    }

    const summary = {
      created: results.filter((r) => r.status === "created").length,
      updated: results.filter((r) => r.status === "updated").length,
      failed: results.filter((r) => r.status === "failed").length,
    };

    return new Response(
      JSON.stringify({ results, summary }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro interno";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
