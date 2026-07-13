import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Client-Info, Apikey, X-API-Key",
};

// ─── Response Helpers ───────────────────────────────────────────────

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function errorResponse(code: string, message: string, status: number) {
  return jsonResponse({ error: { code, message } }, status);
}

function paginatedResponse(
  data: unknown[],
  total: number,
  page: number,
  perPage: number
) {
  return jsonResponse({
    data,
    meta: {
      page,
      per_page: perPage,
      total,
      total_pages: Math.ceil(total / perPage),
    },
  });
}

// ─── Auth Middleware ─────────────────────────────────────────────────

interface AuthContext {
  userId: string;
  permissions: string[];
  keyId: string;
}

async function authenticateApiKey(req: Request): Promise<AuthContext | Response> {
  const apiKey =
    req.headers.get("X-API-Key") ||
    req.headers.get("Authorization")?.replace("Bearer ", "");

  if (!apiKey) {
    return errorResponse("unauthorized", "Missing API key. Provide via X-API-Key header.", 401);
  }

  const encoder = new TextEncoder();
  const data = encoder.encode(apiKey);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const keyHash = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");

  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );

  const { data: keyData, error: keyError } = await supabaseAdmin
    .from("api_keys")
    .select("id, user_id, permissions, is_active, expires_at, rate_limit_per_minute")
    .eq("key_hash", keyHash)
    .maybeSingle();

  if (keyError || !keyData) {
    return errorResponse("unauthorized", "Invalid API key.", 401);
  }

  if (!keyData.is_active) {
    return errorResponse("unauthorized", "API key is inactive.", 401);
  }

  if (keyData.expires_at && new Date(keyData.expires_at) < new Date()) {
    return errorResponse("unauthorized", "API key has expired.", 401);
  }

  // Verify user has active annual plan
  const { data: userData, error: userError } = await supabaseAdmin
    .from("users")
    .select("plan_status, billing_cycle, is_blocked")
    .eq("id", keyData.user_id)
    .maybeSingle();

  if (userError || !userData) {
    return errorResponse("unauthorized", "User not found.", 401);
  }

  if (userData.is_blocked) {
    return errorResponse("forbidden", "User account is blocked.", 403);
  }

  if (userData.plan_status !== "active" || userData.billing_cycle !== "annually") {
    return errorResponse(
      "forbidden",
      "API access is available only for annual plan subscribers.",
      403
    );
  }

  // Update last_used_at
  await supabaseAdmin
    .from("api_keys")
    .update({ last_used_at: new Date().toISOString() })
    .eq("id", keyData.id);

  return {
    userId: keyData.user_id,
    permissions: keyData.permissions || [],
    keyId: keyData.id,
  };
}

function hasPermission(ctx: AuthContext, permission: string): boolean {
  return ctx.permissions.includes(permission);
}

// ─── Route Parser ───────────────────────────────────────────────────

interface ParsedRoute {
  resource: string;
  id?: string;
  subResource?: string;
  subId?: string;
}

function parseRoute(url: URL): ParsedRoute {
  const pathname = url.pathname.replace(/^\/api-gateway/, "");
  const parts = pathname
    .replace(/^\/api\/v1\//, "")
    .split("/")
    .filter(Boolean);

  return {
    resource: parts[0] || "",
    id: parts[1],
    subResource: parts[2],
    subId: parts[3],
  };
}

// ─── Pagination Helper ──────────────────────────────────────────────

function getPagination(url: URL): { page: number; perPage: number; from: number; to: number } {
  const page = Math.max(1, parseInt(url.searchParams.get("page") || "1"));
  const perPage = Math.min(100, Math.max(1, parseInt(url.searchParams.get("per_page") || "20")));
  const from = (page - 1) * perPage;
  const to = from + perPage - 1;
  return { page, perPage, from, to };
}

// ─── Products Handler ───────────────────────────────────────────────

async function handleProducts(
  req: Request,
  ctx: AuthContext,
  route: ParsedRoute,
  url: URL
): Promise<Response> {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );

  // Sub-resources
  if (route.id && route.subResource === "images") {
    return handleProductImages(req, ctx, route, supabase);
  }
  if (route.id && route.subResource === "stock") {
    return handleProductStock(req, ctx, route, url, supabase);
  }
  if (route.id && route.subResource === "tags") {
    return handleProductTags(req, ctx, route, supabase);
  }

  switch (req.method) {
    case "GET": {
      if (!hasPermission(ctx, "products:read")) {
        return errorResponse("forbidden", "Missing permission: products:read", 403);
      }

      if (route.id) {
        // GET single product with full details
        const { data: product, error } = await supabase
          .from("products")
          .select("*")
          .eq("id", route.id)
          .eq("user_id", ctx.userId)
          .maybeSingle();

        if (error) return errorResponse("internal_error", error.message, 500);
        if (!product) return errorResponse("not_found", "Product not found", 404);

        // Fetch related data
        const [imagesRes, tiersRes, weightsRes, stockRes] = await Promise.all([
          supabase
            .from("product_images")
            .select("id, url, is_featured, media_type, display_order")
            .eq("product_id", route.id)
            .order("display_order"),
          supabase
            .from("product_price_tiers")
            .select("id, min_quantity, max_quantity, unit_price, discounted_unit_price")
            .eq("product_id", route.id)
            .order("min_quantity"),
          supabase
            .from("product_weight_variants")
            .select("id, label, unit_value, unit_type, price, discounted_price, display_order")
            .eq("product_id", route.id)
            .order("display_order"),
          supabase
            .from("product_variant_stock")
            .select("id, color, size, flavor, weight_variant_id, quantity, reserved_quantity")
            .eq("product_id", route.id),
        ]);

        return jsonResponse({
          data: {
            ...product,
            images: imagesRes.data || [],
            price_tiers: tiersRes.data || [],
            weight_variants: weightsRes.data || [],
            variant_stock: stockRes.data || [],
          },
        });
      }

      // GET list with pagination and filters
      const { page, perPage, from, to } = getPagination(url);

      let query = supabase
        .from("products")
        .select("*", { count: "exact" })
        .eq("user_id", ctx.userId);

      const status = url.searchParams.get("status");
      if (status) query = query.eq("status", status);

      const category = url.searchParams.get("category");
      if (category) query = query.contains("category", [category]);

      const brand = url.searchParams.get("brand");
      if (brand) query = query.ilike("brand", `%${brand}%`);

      const gender = url.searchParams.get("gender");
      if (gender) query = query.eq("gender", gender);

      const minPrice = url.searchParams.get("min_price");
      if (minPrice) query = query.gte("price", parseFloat(minPrice));

      const maxPrice = url.searchParams.get("max_price");
      if (maxPrice) query = query.lte("price", parseFloat(maxPrice));

      const search = url.searchParams.get("search");
      if (search) query = query.ilike("title", `%${search}%`);

      const visible = url.searchParams.get("visible");
      if (visible === "true") query = query.eq("is_visible_on_storefront", true);
      if (visible === "false") query = query.eq("is_visible_on_storefront", false);

      const sortBy = url.searchParams.get("sort_by") || "created_at";
      const sortOrder = url.searchParams.get("sort_order") === "asc";
      query = query.order(sortBy, { ascending: sortOrder }).range(from, to);

      const { data: products, error, count } = await query;

      if (error) return errorResponse("internal_error", error.message, 500);
      return paginatedResponse(products || [], count || 0, page, perPage);
    }

    case "POST": {
      if (!hasPermission(ctx, "products:write")) {
        return errorResponse("forbidden", "Missing permission: products:write", 403);
      }

      const body = await req.json();
      if (!body.title) {
        return errorResponse("validation_error", "Field 'title' is required", 400);
      }

      const productData = {
        user_id: ctx.userId,
        title: body.title,
        description: body.description || "",
        price: body.price || 0,
        discounted_price: body.discounted_price || null,
        status: body.status || "disponivel",
        condition: body.condition || "novo",
        category: body.category || [],
        brand: body.brand || "",
        model: body.model || "",
        gender: body.gender || "unissex",
        colors: body.colors || [],
        sizes: body.sizes || [],
        flavors: body.flavors || [],
        is_visible_on_storefront: body.is_visible_on_storefront ?? true,
        track_inventory: body.track_inventory ?? false,
        stock_quantity: body.stock_quantity || 0,
        low_stock_threshold: body.low_stock_threshold || 5,
        featured_image_url: body.featured_image_url || "",
        has_tiered_pricing: body.has_tiered_pricing ?? false,
        has_weight_variants: body.has_weight_variants ?? false,
        pricing_mode: body.pricing_mode || "simple",
      };

      const { data: product, error } = await supabase
        .from("products")
        .insert(productData)
        .select()
        .single();

      if (error) return errorResponse("internal_error", error.message, 500);

      // Insert images if provided
      if (body.images && Array.isArray(body.images) && body.images.length > 0) {
        const imageRecords = body.images.map((img: { url: string; is_featured?: boolean; media_type?: string }, i: number) => ({
          product_id: product.id,
          url: typeof img === "string" ? img : img.url,
          is_featured: i === 0,
          media_type: (typeof img === "object" && img.media_type) || "image",
          display_order: i,
        }));
        await supabase.from("product_images").insert(imageRecords);
      }

      // Insert price tiers if provided
      if (body.price_tiers && Array.isArray(body.price_tiers)) {
        const tierRecords = body.price_tiers.map((tier: { min_quantity: number; max_quantity: number; unit_price: number; discounted_unit_price?: number }) => ({
          product_id: product.id,
          user_id: ctx.userId,
          min_quantity: tier.min_quantity,
          max_quantity: tier.max_quantity,
          unit_price: tier.unit_price,
          discounted_unit_price: tier.discounted_unit_price || null,
        }));
        await supabase.from("product_price_tiers").insert(tierRecords);
      }

      // Insert weight variants if provided
      if (body.weight_variants && Array.isArray(body.weight_variants)) {
        const variantRecords = body.weight_variants.map((v: { label: string; unit_value: number; unit_type: string; price: number; discounted_price?: number }, i: number) => ({
          product_id: product.id,
          user_id: ctx.userId,
          label: v.label,
          unit_value: v.unit_value,
          unit_type: v.unit_type,
          price: v.price,
          discounted_price: v.discounted_price || null,
          display_order: i,
        }));
        await supabase.from("product_weight_variants").insert(variantRecords);
      }

      return jsonResponse({ data: product }, 201);
    }

    case "PUT": {
      if (!hasPermission(ctx, "products:write")) {
        return errorResponse("forbidden", "Missing permission: products:write", 403);
      }
      if (!route.id) return errorResponse("validation_error", "Product ID required", 400);

      const body = await req.json();
      const { data: existing } = await supabase
        .from("products")
        .select("id")
        .eq("id", route.id)
        .eq("user_id", ctx.userId)
        .maybeSingle();

      if (!existing) return errorResponse("not_found", "Product not found", 404);

      const updateData: Record<string, unknown> = {};
      const allowedFields = [
        "title", "description", "price", "discounted_price", "status",
        "condition", "category", "brand", "model", "gender", "colors",
        "sizes", "flavors", "is_visible_on_storefront", "track_inventory",
        "stock_quantity", "low_stock_threshold", "featured_image_url",
        "has_tiered_pricing", "has_weight_variants", "pricing_mode",
        "video_url", "external_checkout_url", "short_description",
        "featured_offer_price", "featured_offer_installment",
        "featured_offer_description", "is_starting_price",
      ];

      for (const field of allowedFields) {
        if (body[field] !== undefined) {
          updateData[field] = body[field];
        }
      }

      const { data: product, error } = await supabase
        .from("products")
        .update(updateData)
        .eq("id", route.id)
        .eq("user_id", ctx.userId)
        .select()
        .single();

      if (error) return errorResponse("internal_error", error.message, 500);
      return jsonResponse({ data: product });
    }

    case "PATCH": {
      if (!hasPermission(ctx, "products:write")) {
        return errorResponse("forbidden", "Missing permission: products:write", 403);
      }
      if (!route.id) return errorResponse("validation_error", "Product ID required", 400);

      const body = await req.json();
      const { data: existing } = await supabase
        .from("products")
        .select("id")
        .eq("id", route.id)
        .eq("user_id", ctx.userId)
        .maybeSingle();

      if (!existing) return errorResponse("not_found", "Product not found", 404);

      const { data: product, error } = await supabase
        .from("products")
        .update(body)
        .eq("id", route.id)
        .eq("user_id", ctx.userId)
        .select()
        .single();

      if (error) return errorResponse("internal_error", error.message, 500);
      return jsonResponse({ data: product });
    }

    case "DELETE": {
      if (!hasPermission(ctx, "products:write")) {
        return errorResponse("forbidden", "Missing permission: products:write", 403);
      }
      if (!route.id) return errorResponse("validation_error", "Product ID required", 400);

      const { data: existing } = await supabase
        .from("products")
        .select("id")
        .eq("id", route.id)
        .eq("user_id", ctx.userId)
        .maybeSingle();

      if (!existing) return errorResponse("not_found", "Product not found", 404);

      const { error } = await supabase
        .from("products")
        .delete()
        .eq("id", route.id)
        .eq("user_id", ctx.userId);

      if (error) return errorResponse("internal_error", error.message, 500);
      return jsonResponse({ data: { deleted: true } });
    }

    default:
      return errorResponse("method_not_allowed", "Method not allowed", 405);
  }
}

// ─── Product Images Sub-Handler ─────────────────────────────────────

async function handleProductImages(
  req: Request,
  ctx: AuthContext,
  route: ParsedRoute,
  supabase: ReturnType<typeof createClient>
): Promise<Response> {
  // Verify product ownership
  const { data: product } = await supabase
    .from("products")
    .select("id")
    .eq("id", route.id)
    .eq("user_id", ctx.userId)
    .maybeSingle();

  if (!product) return errorResponse("not_found", "Product not found", 404);

  switch (req.method) {
    case "GET": {
      if (!hasPermission(ctx, "products:read")) {
        return errorResponse("forbidden", "Missing permission: products:read", 403);
      }

      const { data: images, error } = await supabase
        .from("product_images")
        .select("id, url, is_featured, media_type, display_order")
        .eq("product_id", route.id)
        .order("display_order");

      if (error) return errorResponse("internal_error", error.message, 500);
      return jsonResponse({ data: images });
    }

    case "POST": {
      if (!hasPermission(ctx, "products:write")) {
        return errorResponse("forbidden", "Missing permission: products:write", 403);
      }

      const body = await req.json();
      if (!body.url) {
        return errorResponse("validation_error", "Field 'url' is required", 400);
      }

      const { data: image, error } = await supabase
        .from("product_images")
        .insert({
          product_id: route.id,
          url: body.url,
          is_featured: body.is_featured ?? false,
          media_type: body.media_type || "image",
          display_order: body.display_order || 0,
        })
        .select()
        .single();

      if (error) return errorResponse("internal_error", error.message, 500);
      return jsonResponse({ data: image }, 201);
    }

    case "DELETE": {
      if (!hasPermission(ctx, "products:write")) {
        return errorResponse("forbidden", "Missing permission: products:write", 403);
      }

      if (!route.subId) {
        return errorResponse("validation_error", "Image ID required", 400);
      }

      const { error } = await supabase
        .from("product_images")
        .delete()
        .eq("id", route.subId)
        .eq("product_id", route.id);

      if (error) return errorResponse("internal_error", error.message, 500);
      return jsonResponse({ data: { deleted: true } });
    }

    default:
      return errorResponse("method_not_allowed", "Method not allowed", 405);
  }
}

// ─── Product Stock Sub-Handler ──────────────────────────────────────

async function handleProductStock(
  req: Request,
  ctx: AuthContext,
  route: ParsedRoute,
  url: URL,
  supabase: ReturnType<typeof createClient>
): Promise<Response> {
  const { data: product } = await supabase
    .from("products")
    .select("id, stock_quantity, track_inventory, low_stock_threshold")
    .eq("id", route.id)
    .eq("user_id", ctx.userId)
    .maybeSingle();

  if (!product) return errorResponse("not_found", "Product not found", 404);

  // Handle adjust sub-route
  if (route.subId === "adjust" && req.method === "POST") {
    if (!hasPermission(ctx, "stock:write")) {
      return errorResponse("forbidden", "Missing permission: stock:write", 403);
    }

    const body = await req.json();
    if (typeof body.adjustment !== "number") {
      return errorResponse("validation_error", "Field 'adjustment' (number) is required", 400);
    }

    // Find the variant stock record if variant specified
    if (body.color || body.size || body.flavor) {
      let stockQuery = supabase
        .from("product_variant_stock")
        .select("*")
        .eq("product_id", route.id);

      if (body.color) stockQuery = stockQuery.eq("color", body.color);
      if (body.size) stockQuery = stockQuery.eq("size", body.size);
      if (body.flavor) stockQuery = stockQuery.eq("flavor", body.flavor);

      const { data: variantStock } = await stockQuery.maybeSingle();

      if (!variantStock) {
        return errorResponse("not_found", "Variant stock not found", 404);
      }

      const newQuantity = Math.max(0, variantStock.quantity + body.adjustment);

      await supabase
        .from("product_variant_stock")
        .update({ quantity: newQuantity })
        .eq("id", variantStock.id);

      // Record stock movement
      await supabase.from("stock_movements").insert({
        product_id: route.id,
        variant_stock_id: variantStock.id,
        movement_type: body.adjustment > 0 ? "entrada" : "saida",
        quantity: Math.abs(body.adjustment),
        previous_quantity: variantStock.quantity,
        new_quantity: newQuantity,
        reference_type: "manual",
        reason: body.reason || "API adjustment",
        performed_by: ctx.userId,
      });

      return jsonResponse({
        data: { previous_quantity: variantStock.quantity, new_quantity: newQuantity },
      });
    }

    // Adjust main product stock
    const newQuantity = Math.max(0, (product.stock_quantity || 0) + body.adjustment);
    await supabase
      .from("products")
      .update({ stock_quantity: newQuantity })
      .eq("id", route.id);

    // Record movement
    await supabase.from("stock_movements").insert({
      product_id: route.id,
      movement_type: body.adjustment > 0 ? "entrada" : "saida",
      quantity: Math.abs(body.adjustment),
      previous_quantity: product.stock_quantity || 0,
      new_quantity: newQuantity,
      reference_type: "manual",
      reason: body.reason || "API adjustment",
      performed_by: ctx.userId,
    });

    return jsonResponse({
      data: { previous_quantity: product.stock_quantity || 0, new_quantity: newQuantity },
    });
  }

  switch (req.method) {
    case "GET": {
      if (!hasPermission(ctx, "stock:read")) {
        return errorResponse("forbidden", "Missing permission: stock:read", 403);
      }

      const { data: variantStock } = await supabase
        .from("product_variant_stock")
        .select("id, color, size, flavor, weight_variant_id, quantity, reserved_quantity")
        .eq("product_id", route.id);

      return jsonResponse({
        data: {
          product_id: route.id,
          total_stock: product.stock_quantity,
          track_inventory: product.track_inventory,
          low_stock_threshold: product.low_stock_threshold,
          variants: variantStock || [],
        },
      });
    }

    case "PUT": {
      if (!hasPermission(ctx, "stock:write")) {
        return errorResponse("forbidden", "Missing permission: stock:write", 403);
      }

      const body = await req.json();
      if (typeof body.quantity !== "number") {
        return errorResponse("validation_error", "Field 'quantity' (number) is required", 400);
      }

      // Update variant stock or product stock
      if (body.color || body.size || body.flavor) {
        let stockQuery = supabase
          .from("product_variant_stock")
          .select("*")
          .eq("product_id", route.id);

        if (body.color) stockQuery = stockQuery.eq("color", body.color);
        if (body.size) stockQuery = stockQuery.eq("size", body.size);
        if (body.flavor) stockQuery = stockQuery.eq("flavor", body.flavor);

        const { data: existing } = await stockQuery.maybeSingle();

        if (existing) {
          await supabase
            .from("product_variant_stock")
            .update({ quantity: body.quantity })
            .eq("id", existing.id);
        } else {
          await supabase.from("product_variant_stock").insert({
            product_id: route.id,
            color: body.color || null,
            size: body.size || null,
            flavor: body.flavor || null,
            quantity: body.quantity,
            reserved_quantity: 0,
          });
        }

        return jsonResponse({ data: { updated: true, quantity: body.quantity } });
      }

      await supabase
        .from("products")
        .update({ stock_quantity: body.quantity })
        .eq("id", route.id);

      return jsonResponse({ data: { updated: true, quantity: body.quantity } });
    }

    default:
      return errorResponse("method_not_allowed", "Method not allowed", 405);
  }
}

// ─── Product Tags Sub-Handler ───────────────────────────────────────

async function handleProductTags(
  req: Request,
  ctx: AuthContext,
  route: ParsedRoute,
  supabase: ReturnType<typeof createClient>
): Promise<Response> {
  const { data: product } = await supabase
    .from("products")
    .select("id")
    .eq("id", route.id)
    .eq("user_id", ctx.userId)
    .maybeSingle();

  if (!product) return errorResponse("not_found", "Product not found", 404);

  switch (req.method) {
    case "POST": {
      if (!hasPermission(ctx, "products:write")) {
        return errorResponse("forbidden", "Missing permission: products:write", 403);
      }

      const body = await req.json();
      if (!body.tag_id) {
        return errorResponse("validation_error", "Field 'tag_id' is required", 400);
      }

      const { error } = await supabase
        .from("product_tag_assignments")
        .insert({ product_id: route.id, tag_id: body.tag_id });

      if (error) return errorResponse("internal_error", error.message, 500);
      return jsonResponse({ data: { assigned: true } }, 201);
    }

    case "DELETE": {
      if (!hasPermission(ctx, "products:write")) {
        return errorResponse("forbidden", "Missing permission: products:write", 403);
      }

      if (!route.subId) {
        return errorResponse("validation_error", "Tag ID required", 400);
      }

      const { error } = await supabase
        .from("product_tag_assignments")
        .delete()
        .eq("product_id", route.id)
        .eq("tag_id", route.subId);

      if (error) return errorResponse("internal_error", error.message, 500);
      return jsonResponse({ data: { removed: true } });
    }

    default:
      return errorResponse("method_not_allowed", "Method not allowed", 405);
  }
}

// ─── Stock Low Endpoint ─────────────────────────────────────────────

async function handleStockLow(
  ctx: AuthContext,
  url: URL
): Promise<Response> {
  if (!hasPermission(ctx, "stock:read")) {
    return errorResponse("forbidden", "Missing permission: stock:read", 403);
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );

  const { page, perPage, from, to } = getPagination(url);

  const { data: products, error, count } = await supabase
    .from("products")
    .select("id, title, stock_quantity, low_stock_threshold, featured_image_url", { count: "exact" })
    .eq("user_id", ctx.userId)
    .eq("track_inventory", true)
    .filter("stock_quantity", "lte", supabase.rpc ? "low_stock_threshold" : "10")
    .range(from, to);

  if (error) {
    // Fallback: fetch products where stock is low manually
    const { data: allProducts, count: totalCount } = await supabase
      .from("products")
      .select("id, title, stock_quantity, low_stock_threshold, featured_image_url", { count: "exact" })
      .eq("user_id", ctx.userId)
      .eq("track_inventory", true)
      .lte("stock_quantity", 10)
      .range(from, to);

    return paginatedResponse(allProducts || [], totalCount || 0, page, perPage);
  }

  return paginatedResponse(products || [], count || 0, page, perPage);
}

// ─── Categories Handler ─────────────────────────────────────────────

async function handleCategories(
  req: Request,
  ctx: AuthContext,
  route: ParsedRoute,
  url: URL
): Promise<Response> {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );

  switch (req.method) {
    case "GET": {
      if (!hasPermission(ctx, "categories:read")) {
        return errorResponse("forbidden", "Missing permission: categories:read", 403);
      }

      if (route.id) {
        const { data: category, error } = await supabase
          .from("product_categories")
          .select("*")
          .eq("id", route.id)
          .eq("user_id", ctx.userId)
          .maybeSingle();

        if (error) return errorResponse("internal_error", error.message, 500);
        if (!category) return errorResponse("not_found", "Category not found", 404);
        return jsonResponse({ data: category });
      }

      const { data: categories, error } = await supabase
        .from("product_categories")
        .select("*")
        .eq("user_id", ctx.userId)
        .order("name");

      if (error) return errorResponse("internal_error", error.message, 500);
      return jsonResponse({ data: categories });
    }

    case "POST": {
      if (!hasPermission(ctx, "categories:write")) {
        return errorResponse("forbidden", "Missing permission: categories:write", 403);
      }

      const body = await req.json();
      if (!body.name) {
        return errorResponse("validation_error", "Field 'name' is required", 400);
      }

      const { data: category, error } = await supabase
        .from("product_categories")
        .insert({ user_id: ctx.userId, name: body.name })
        .select()
        .single();

      if (error) return errorResponse("internal_error", error.message, 500);
      return jsonResponse({ data: category }, 201);
    }

    case "PUT": {
      if (!hasPermission(ctx, "categories:write")) {
        return errorResponse("forbidden", "Missing permission: categories:write", 403);
      }
      if (!route.id) return errorResponse("validation_error", "Category ID required", 400);

      const body = await req.json();
      const { data: category, error } = await supabase
        .from("product_categories")
        .update({ name: body.name })
        .eq("id", route.id)
        .eq("user_id", ctx.userId)
        .select()
        .single();

      if (error) return errorResponse("internal_error", error.message, 500);
      return jsonResponse({ data: category });
    }

    case "DELETE": {
      if (!hasPermission(ctx, "categories:write")) {
        return errorResponse("forbidden", "Missing permission: categories:write", 403);
      }
      if (!route.id) return errorResponse("validation_error", "Category ID required", 400);

      const { error } = await supabase
        .from("product_categories")
        .delete()
        .eq("id", route.id)
        .eq("user_id", ctx.userId);

      if (error) return errorResponse("internal_error", error.message, 500);
      return jsonResponse({ data: { deleted: true } });
    }

    default:
      return errorResponse("method_not_allowed", "Method not allowed", 405);
  }
}

// ─── Tags Handler ───────────────────────────────────────────────────

async function handleTags(
  req: Request,
  ctx: AuthContext,
  route: ParsedRoute
): Promise<Response> {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );

  switch (req.method) {
    case "GET": {
      if (!hasPermission(ctx, "categories:read")) {
        return errorResponse("forbidden", "Missing permission: categories:read", 403);
      }

      const { data: tags, error } = await supabase
        .from("product_tags")
        .select("*")
        .eq("user_id", ctx.userId)
        .order("name");

      if (error) return errorResponse("internal_error", error.message, 500);
      return jsonResponse({ data: tags });
    }

    case "POST": {
      if (!hasPermission(ctx, "categories:write")) {
        return errorResponse("forbidden", "Missing permission: categories:write", 403);
      }

      const body = await req.json();
      if (!body.name) {
        return errorResponse("validation_error", "Field 'name' is required", 400);
      }

      const { data: tag, error } = await supabase
        .from("product_tags")
        .insert({ user_id: ctx.userId, name: body.name, color: body.color || "#3B82F6" })
        .select()
        .single();

      if (error) return errorResponse("internal_error", error.message, 500);
      return jsonResponse({ data: tag }, 201);
    }

    case "PUT": {
      if (!hasPermission(ctx, "categories:write")) {
        return errorResponse("forbidden", "Missing permission: categories:write", 403);
      }
      if (!route.id) return errorResponse("validation_error", "Tag ID required", 400);

      const body = await req.json();
      const updateData: Record<string, unknown> = {};
      if (body.name !== undefined) updateData.name = body.name;
      if (body.color !== undefined) updateData.color = body.color;

      const { data: tag, error } = await supabase
        .from("product_tags")
        .update(updateData)
        .eq("id", route.id)
        .eq("user_id", ctx.userId)
        .select()
        .single();

      if (error) return errorResponse("internal_error", error.message, 500);
      return jsonResponse({ data: tag });
    }

    case "DELETE": {
      if (!hasPermission(ctx, "categories:write")) {
        return errorResponse("forbidden", "Missing permission: categories:write", 403);
      }
      if (!route.id) return errorResponse("validation_error", "Tag ID required", 400);

      const { error } = await supabase
        .from("product_tags")
        .delete()
        .eq("id", route.id)
        .eq("user_id", ctx.userId);

      if (error) return errorResponse("internal_error", error.message, 500);
      return jsonResponse({ data: { deleted: true } });
    }

    default:
      return errorResponse("method_not_allowed", "Method not allowed", 405);
  }
}

// ─── Orders Handler ─────────────────────────────────────────────────

async function handleOrders(
  req: Request,
  ctx: AuthContext,
  route: ParsedRoute,
  url: URL
): Promise<Response> {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );

  // Sub-resources
  if (route.id && route.subResource === "items") {
    if (!hasPermission(ctx, "orders:read")) {
      return errorResponse("forbidden", "Missing permission: orders:read", 403);
    }

    const { data: items, error } = await supabase
      .from("order_items")
      .select("*")
      .eq("order_id", route.id);

    if (error) return errorResponse("internal_error", error.message, 500);
    return jsonResponse({ data: items });
  }

  if (route.id && route.subResource === "status" && req.method === "PATCH") {
    if (!hasPermission(ctx, "orders:write")) {
      return errorResponse("forbidden", "Missing permission: orders:write", 403);
    }

    const body = await req.json();
    const validStatuses = ["pending", "confirmed", "preparing", "shipped", "delivered", "cancelled"];
    if (!body.status || !validStatuses.includes(body.status)) {
      return errorResponse(
        "validation_error",
        `Invalid status. Must be one of: ${validStatuses.join(", ")}`,
        400
      );
    }

    const { data: order, error } = await supabase
      .from("orders")
      .update({ status: body.status })
      .eq("id", route.id)
      .eq("store_owner_id", ctx.userId)
      .select()
      .single();

    if (error) return errorResponse("internal_error", error.message, 500);
    return jsonResponse({ data: order });
  }

  switch (req.method) {
    case "GET": {
      if (!hasPermission(ctx, "orders:read")) {
        return errorResponse("forbidden", "Missing permission: orders:read", 403);
      }

      if (route.id) {
        const { data: order, error } = await supabase
          .from("orders")
          .select("*")
          .eq("id", route.id)
          .eq("store_owner_id", ctx.userId)
          .maybeSingle();

        if (error) return errorResponse("internal_error", error.message, 500);
        if (!order) return errorResponse("not_found", "Order not found", 404);

        const { data: items } = await supabase
          .from("order_items")
          .select("*")
          .eq("order_id", route.id);

        return jsonResponse({ data: { ...order, items: items || [] } });
      }

      const { page, perPage, from, to } = getPagination(url);

      let query = supabase
        .from("orders")
        .select("*", { count: "exact" })
        .eq("store_owner_id", ctx.userId);

      const status = url.searchParams.get("status");
      if (status) query = query.eq("status", status);

      const orderType = url.searchParams.get("order_type");
      if (orderType) query = query.eq("order_type", orderType);

      const dateFrom = url.searchParams.get("date_from");
      if (dateFrom) query = query.gte("created_at", dateFrom);

      const dateTo = url.searchParams.get("date_to");
      if (dateTo) query = query.lte("created_at", dateTo);

      const customerName = url.searchParams.get("customer_name");
      if (customerName) query = query.ilike("customer_name", `%${customerName}%`);

      query = query.order("created_at", { ascending: false }).range(from, to);

      const { data: orders, error, count } = await query;

      if (error) return errorResponse("internal_error", error.message, 500);
      return paginatedResponse(orders || [], count || 0, page, perPage);
    }

    case "POST": {
      if (!hasPermission(ctx, "orders:write")) {
        return errorResponse("forbidden", "Missing permission: orders:write", 403);
      }

      const body = await req.json();
      if (!body.customer_name || !body.items || !Array.isArray(body.items) || body.items.length === 0) {
        return errorResponse(
          "validation_error",
          "Fields 'customer_name' and 'items' (non-empty array) are required",
          400
        );
      }

      // Calculate totals
      let subtotal = 0;
      const orderItems = [];

      for (const item of body.items) {
        if (!item.product_id || !item.quantity || !item.unit_price) {
          return errorResponse(
            "validation_error",
            "Each item must have product_id, quantity, and unit_price",
            400
          );
        }

        const itemSubtotal = item.quantity * item.unit_price;
        subtotal += itemSubtotal;

        // Get product info for snapshot
        const { data: prod } = await supabase
          .from("products")
          .select("title, featured_image_url")
          .eq("id", item.product_id)
          .eq("user_id", ctx.userId)
          .maybeSingle();

        orderItems.push({
          product_id: item.product_id,
          product_title: prod?.title || item.product_title || "",
          product_image_url: prod?.featured_image_url || "",
          quantity: item.quantity,
          unit_price: item.unit_price,
          subtotal: itemSubtotal,
          selected_color: item.selected_color || null,
          selected_size: item.selected_size || null,
          selected_flavor: item.selected_flavor || null,
          selected_variant_label: item.selected_variant_label || null,
          item_notes: item.notes || null,
        });
      }

      const deliveryFee = body.delivery_fee || 0;
      const discountAmount = body.discount_amount || 0;
      const total = subtotal + deliveryFee - discountAmount;

      const { data: order, error: orderError } = await supabase
        .from("orders")
        .insert({
          store_owner_id: ctx.userId,
          customer_name: body.customer_name,
          customer_whatsapp: body.customer_whatsapp || null,
          customer_country_code: body.customer_country_code || "55",
          status: body.status || "pending",
          order_type: body.order_type || "ecommerce",
          source: body.source || "api",
          subtotal,
          total,
          discount_amount: discountAmount,
          delivery_fee: deliveryFee,
          payment_method: body.payment_method || null,
          delivery_option: body.delivery_option || null,
          notes: body.notes || null,
          coupon_code: body.coupon_code || null,
        })
        .select()
        .single();

      if (orderError) return errorResponse("internal_error", orderError.message, 500);

      // Insert order items
      const itemsWithOrderId = orderItems.map((item) => ({
        ...item,
        order_id: order.id,
      }));

      await supabase.from("order_items").insert(itemsWithOrderId);

      return jsonResponse({ data: order }, 201);
    }

    default:
      return errorResponse("method_not_allowed", "Method not allowed", 405);
  }
}

// ─── Coupons Handler ────────────────────────────────────────────────

async function handleCoupons(
  req: Request,
  ctx: AuthContext,
  route: ParsedRoute,
  url: URL
): Promise<Response> {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );

  // Validate endpoint
  if (route.id === "validate" && req.method === "POST") {
    if (!hasPermission(ctx, "coupons:read")) {
      return errorResponse("forbidden", "Missing permission: coupons:read", 403);
    }

    const body = await req.json();
    if (!body.code) {
      return errorResponse("validation_error", "Field 'code' is required", 400);
    }

    const { data: coupon } = await supabase
      .from("coupons")
      .select("*")
      .eq("user_id", ctx.userId)
      .eq("code", body.code.toUpperCase())
      .eq("is_active", true)
      .maybeSingle();

    if (!coupon) {
      return jsonResponse({ data: { is_valid: false, reason: "Coupon not found or inactive" } });
    }

    const now = new Date();
    if (coupon.valid_from && new Date(coupon.valid_from) > now) {
      return jsonResponse({ data: { is_valid: false, reason: "Coupon not yet valid" } });
    }
    if (coupon.valid_until && new Date(coupon.valid_until) < now) {
      return jsonResponse({ data: { is_valid: false, reason: "Coupon expired" } });
    }
    if (coupon.max_uses && coupon.current_uses >= coupon.max_uses) {
      return jsonResponse({ data: { is_valid: false, reason: "Coupon usage limit reached" } });
    }

    const cartTotal = body.cart_total || 0;
    if (coupon.min_order_value && cartTotal < coupon.min_order_value) {
      return jsonResponse({
        data: { is_valid: false, reason: `Minimum order value: ${coupon.min_order_value}` },
      });
    }

    let discountAmount = 0;
    if (coupon.discount_type === "percentage") {
      discountAmount = cartTotal * (coupon.discount_value / 100);
      if (coupon.max_discount_amount) {
        discountAmount = Math.min(discountAmount, coupon.max_discount_amount);
      }
    } else {
      discountAmount = coupon.discount_value;
    }

    return jsonResponse({
      data: {
        is_valid: true,
        coupon_id: coupon.id,
        discount_type: coupon.discount_type,
        discount_value: coupon.discount_value,
        discount_amount: discountAmount,
      },
    });
  }

  switch (req.method) {
    case "GET": {
      if (!hasPermission(ctx, "coupons:read")) {
        return errorResponse("forbidden", "Missing permission: coupons:read", 403);
      }

      if (route.id) {
        const { data: coupon, error } = await supabase
          .from("coupons")
          .select("*")
          .eq("id", route.id)
          .eq("user_id", ctx.userId)
          .maybeSingle();

        if (error) return errorResponse("internal_error", error.message, 500);
        if (!coupon) return errorResponse("not_found", "Coupon not found", 404);
        return jsonResponse({ data: coupon });
      }

      const { data: coupons, error } = await supabase
        .from("coupons")
        .select("*")
        .eq("user_id", ctx.userId)
        .order("created_at", { ascending: false });

      if (error) return errorResponse("internal_error", error.message, 500);
      return jsonResponse({ data: coupons });
    }

    case "POST": {
      if (!hasPermission(ctx, "coupons:write")) {
        return errorResponse("forbidden", "Missing permission: coupons:write", 403);
      }

      const body = await req.json();
      if (!body.code || !body.discount_type || body.discount_value === undefined) {
        return errorResponse(
          "validation_error",
          "Fields 'code', 'discount_type', and 'discount_value' are required",
          400
        );
      }

      const { data: coupon, error } = await supabase
        .from("coupons")
        .insert({
          user_id: ctx.userId,
          code: body.code.toUpperCase(),
          name: body.name || body.code,
          discount_type: body.discount_type,
          discount_value: body.discount_value,
          min_order_value: body.min_order_value || null,
          max_discount_amount: body.max_discount_amount || null,
          max_uses: body.max_uses || null,
          max_uses_per_customer: body.max_uses_per_customer || null,
          valid_from: body.valid_from || null,
          valid_until: body.valid_until || null,
          is_active: body.is_active ?? true,
          applies_to: body.applies_to || "all_products",
        })
        .select()
        .single();

      if (error) return errorResponse("internal_error", error.message, 500);
      return jsonResponse({ data: coupon }, 201);
    }

    case "PUT": {
      if (!hasPermission(ctx, "coupons:write")) {
        return errorResponse("forbidden", "Missing permission: coupons:write", 403);
      }
      if (!route.id) return errorResponse("validation_error", "Coupon ID required", 400);

      const body = await req.json();
      const { data: coupon, error } = await supabase
        .from("coupons")
        .update(body)
        .eq("id", route.id)
        .eq("user_id", ctx.userId)
        .select()
        .single();

      if (error) return errorResponse("internal_error", error.message, 500);
      return jsonResponse({ data: coupon });
    }

    case "DELETE": {
      if (!hasPermission(ctx, "coupons:write")) {
        return errorResponse("forbidden", "Missing permission: coupons:write", 403);
      }
      if (!route.id) return errorResponse("validation_error", "Coupon ID required", 400);

      const { error } = await supabase
        .from("coupons")
        .delete()
        .eq("id", route.id)
        .eq("user_id", ctx.userId);

      if (error) return errorResponse("internal_error", error.message, 500);
      return jsonResponse({ data: { deleted: true } });
    }

    default:
      return errorResponse("method_not_allowed", "Method not allowed", 405);
  }
}

// ─── Store Handler ──────────────────────────────────────────────────

async function handleStore(
  req: Request,
  ctx: AuthContext,
  route: ParsedRoute
): Promise<Response> {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );

  // Sub-resources
  if (route.id === "appearance") {
    if (!hasPermission(ctx, "store:read")) {
      return errorResponse("forbidden", "Missing permission: store:read", 403);
    }

    const { data: appearance, error } = await supabase
      .from("storefront_appearance")
      .select("*")
      .eq("user_id", ctx.userId)
      .maybeSingle();

    if (error) return errorResponse("internal_error", error.message, 500);
    return jsonResponse({ data: appearance });
  }

  if (route.id === "settings") {
    switch (req.method) {
      case "GET": {
        if (!hasPermission(ctx, "store:read")) {
          return errorResponse("forbidden", "Missing permission: store:read", 403);
        }

        // Get checkout settings from user profile
        const { data: user, error } = await supabase
          .from("users")
          .select("checkout_settings, storefront_settings")
          .eq("id", ctx.userId)
          .maybeSingle();

        if (error) return errorResponse("internal_error", error.message, 500);
        return jsonResponse({ data: user });
      }

      case "PUT": {
        if (!hasPermission(ctx, "store:write")) {
          return errorResponse("forbidden", "Missing permission: store:write", 403);
        }

        const body = await req.json();
        const updateData: Record<string, unknown> = {};
        if (body.checkout_settings !== undefined) updateData.checkout_settings = body.checkout_settings;
        if (body.storefront_settings !== undefined) updateData.storefront_settings = body.storefront_settings;

        const { data: user, error } = await supabase
          .from("users")
          .update(updateData)
          .eq("id", ctx.userId)
          .select("checkout_settings, storefront_settings")
          .single();

        if (error) return errorResponse("internal_error", error.message, 500);
        return jsonResponse({ data: user });
      }

      default:
        return errorResponse("method_not_allowed", "Method not allowed", 405);
    }
  }

  switch (req.method) {
    case "GET": {
      if (!hasPermission(ctx, "store:read")) {
        return errorResponse("forbidden", "Missing permission: store:read", 403);
      }

      const { data: store, error } = await supabase
        .from("users")
        .select(
          "id, name, slug, bio, email, whatsapp, country_code, instagram, location_url, theme, avatar_url, cover_url_desktop, cover_url_mobile, promotional_banner_url, owner_name"
        )
        .eq("id", ctx.userId)
        .maybeSingle();

      if (error) return errorResponse("internal_error", error.message, 500);
      return jsonResponse({ data: store });
    }

    case "PUT": {
      if (!hasPermission(ctx, "store:write")) {
        return errorResponse("forbidden", "Missing permission: store:write", 403);
      }

      const body = await req.json();
      const allowedFields = [
        "name", "bio", "whatsapp", "country_code", "instagram",
        "location_url", "theme", "owner_name",
      ];

      const updateData: Record<string, unknown> = {};
      for (const field of allowedFields) {
        if (body[field] !== undefined) {
          updateData[field] = body[field];
        }
      }

      const { data: store, error } = await supabase
        .from("users")
        .update(updateData)
        .eq("id", ctx.userId)
        .select(
          "id, name, slug, bio, email, whatsapp, country_code, instagram, location_url, theme, avatar_url, cover_url_desktop, cover_url_mobile, owner_name"
        )
        .single();

      if (error) return errorResponse("internal_error", error.message, 500);
      return jsonResponse({ data: store });
    }

    default:
      return errorResponse("method_not_allowed", "Method not allowed", 405);
  }
}

// ─── Main Router ────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const route = parseRoute(url);

    // Health check (no auth required)
    if (route.resource === "health") {
      return jsonResponse({ status: "ok", version: "1.0.0" });
    }

    // Authenticate
    const authResult = await authenticateApiKey(req);
    if (authResult instanceof Response) {
      return authResult;
    }
    const ctx = authResult;

    // Route to handlers
    switch (route.resource) {
      case "products":
        return await handleProducts(req, ctx, route, url);

      case "stock":
        if (route.id === "low") {
          return await handleStockLow(ctx, url);
        }
        return errorResponse("not_found", "Endpoint not found", 404);

      case "categories":
        return await handleCategories(req, ctx, route, url);

      case "tags":
        return await handleTags(req, ctx, route);

      case "orders":
        return await handleOrders(req, ctx, route, url);

      case "coupons":
        return await handleCoupons(req, ctx, route, url);

      case "store":
        return await handleStore(req, ctx, route);

      default:
        return errorResponse("not_found", "Endpoint not found. Available: products, stock, categories, tags, orders, coupons, store", 404);
    }
  } catch (error) {
    console.error("API Gateway error:", error);
    return errorResponse("internal_error", "An unexpected error occurred", 500);
  }
});
