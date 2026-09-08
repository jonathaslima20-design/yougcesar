import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

interface CopyProductsRequest {
  sourceUserId: string
  targetUserId: string
  productIds: string[]
}

interface CopyStats {
  copiedProducts: number
  copiedImages: number
  copiedPriceTiers: number
  copiedWeightVariants: number
  copiedCategories: number
}

const STORAGE_BUCKET = 'public'

// Public Storage URLs look like ".../object/public/<bucket>/<path>" — pull
// just the "<path>" part back out so it can be passed to storage.copy().
function getStorageObjectPath(publicUrl: string): string | null {
  const marker = '/object/public/'
  const idx = publicUrl.indexOf(marker)
  if (idx === -1) return null
  const afterMarker = publicUrl.slice(idx + marker.length)
  const firstSlash = afterMarker.indexOf('/')
  if (firstSlash === -1) return null
  return afterMarker.slice(firstSlash + 1)
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    // Validate environment variables
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')

    if (!supabaseUrl || !supabaseServiceKey || !supabaseAnonKey) {
      console.error('Missing environment variables:', {
        hasUrl: !!supabaseUrl,
        hasServiceKey: !!supabaseServiceKey,
        hasAnonKey: !!supabaseAnonKey
      })
      return new Response(
        JSON.stringify({
          error: 'Server configuration error: Missing required environment variables'
        }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Require a valid logged-in admin — this endpoint bypasses RLS via the service role key
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Initialize Supabase client with service role key
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })

    const supabaseUser = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    })

    const { data: { user }, error: userError } = await supabaseUser.auth.getUser()
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const { data: callerProfile } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .maybeSingle()

    if (!callerProfile || callerProfile.role !== 'admin') {
      return new Response(
        JSON.stringify({ error: 'Insufficient permissions' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Parse request body
    let requestData: CopyProductsRequest
    try {
      requestData = await req.json()
    } catch (parseError) {
      console.error('Failed to parse request body:', parseError)
      return new Response(
        JSON.stringify({ error: 'Invalid request body' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    const { sourceUserId, targetUserId, productIds } = requestData

    // Validate required fields
    if (!sourceUserId || !targetUserId || !productIds || !Array.isArray(productIds)) {
      return new Response(
        JSON.stringify({ 
          error: 'Missing required fields: sourceUserId, targetUserId, and productIds array' 
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    if (productIds.length === 0) {
      return new Response(
        JSON.stringify({ 
          error: 'No products specified for copying' 
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    console.log(`Copying ${productIds.length} products from user ${sourceUserId} to user ${targetUserId}`)

    const stats: CopyStats = {
      copiedProducts: 0,
      copiedImages: 0,
      copiedPriceTiers: 0,
      copiedWeightVariants: 0,
      copiedCategories: 0
    }

    // Fetch products to copy
    const { data: products, error: fetchError } = await supabase
      .from('products')
      .select('*')
      .eq('user_id', sourceUserId)
      .in('id', productIds)

    if (fetchError) {
      console.error('Error fetching products:', fetchError)
      return new Response(
        JSON.stringify({ 
          error: 'Failed to fetch products to copy',
          details: fetchError.message 
        }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    if (!products || products.length === 0) {
      return new Response(
        JSON.stringify({ 
          error: 'No products found to copy' 
        }),
        { 
          status: 404, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Copy categories first
    const uniqueCategories = new Set<string>()
    products.forEach(product => {
      // Handle category as either array or string
      if (product.category) {
        if (Array.isArray(product.category)) {
          product.category.forEach((cat: string) => {
            if (cat && typeof cat === 'string') {
              uniqueCategories.add(cat.trim())
            }
          })
        } else if (typeof product.category === 'string') {
          const trimmedCat = product.category.trim()
          if (trimmedCat) {
            uniqueCategories.add(trimmedCat)
          }
        }
      }
    })

    if (uniqueCategories.size > 0) {
      // Get existing categories for target user
      const { data: existingCategories, error: fetchCategoriesError } = await supabase
        .from('user_product_categories')
        .select('name')
        .eq('user_id', targetUserId)

      if (fetchCategoriesError) {
        console.error('Error fetching existing categories:', fetchCategoriesError)
      }

      const existingCategoryNames = new Set(
        existingCategories?.map(cat => cat.name) || []
      )

      // Filter out categories that already exist
      const categoriesToCreate = Array.from(uniqueCategories)
        .filter(cat => !existingCategoryNames.has(cat))
        .map(name => ({
          user_id: targetUserId,
          name,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }))

      if (categoriesToCreate.length > 0) {
        const { error: categoryError } = await supabase
          .from('user_product_categories')
          .insert(categoriesToCreate)

        if (categoryError) {
          console.error('Error copying categories:', categoryError)
          // Don't fail the entire operation for category errors
        } else {
          stats.copiedCategories = categoriesToCreate.length
        }
      }
    }

    // Get the target user's existing SKUs so a copy never collides with
    // UNIQUE(user_id, sku) — only the colliding row's sku gets blanked, the
    // product itself still copies fine (e.g. re-running a copy that was
    // already done once for this pair of users).
    const { data: existingSkuRows } = await supabase
      .from('products')
      .select('sku')
      .eq('user_id', targetUserId)
      .not('sku', 'is', null)

    const existingSkuSet = new Set(
      (existingSkuRows || [])
        .map(p => (p.sku || '').trim())
        .filter(sku => sku.length > 0)
    )

    // Prepare products for insertion. Per-merchant references (packaging
    // preset, ERP link) must never carry over to a different user's product.
    const productsToInsert = products.map(product => {
      const { id, created_at, updated_at, package_preset_id, olist_product_id, sku, ...productData } = product
      const trimmedSku = (sku || '').trim()
      const skuCollides = trimmedSku.length > 0 && existingSkuSet.has(trimmedSku)
      if (trimmedSku.length > 0 && !skuCollides) {
        existingSkuSet.add(trimmedSku)
      }

      return {
        ...productData,
        sku: skuCollides ? null : sku,
        package_preset_id: null,
        olist_product_id: null,
        user_id: targetUserId,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }
    })

    // Insert copied products
    const { data: insertedProducts, error: insertError } = await supabase
      .from('products')
      .insert(productsToInsert)
      .select()

    if (insertError) {
      console.error('Error inserting products:', insertError)
      return new Response(
        JSON.stringify({
          error: 'Erro ao inserir produtos copiados',
          details: insertError.message
        }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    if (!insertedProducts || insertedProducts.length === 0) {
      console.error('No products were inserted')
      return new Response(
        JSON.stringify({
          error: 'Nenhum produto foi inserido.'
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    stats.copiedProducts = insertedProducts.length

    // Create mapping of old product IDs to new product IDs
    const productIdMapping = new Map<string, string>()
    products.forEach((originalProduct, index) => {
      if (insertedProducts && insertedProducts[index]) {
        productIdMapping.set(originalProduct.id, insertedProducts[index].id)
      }
    })

    // Copy product images — duplicate the actual file in Storage under the
    // target user's own folder (not just the DB row), so the two accounts
    // never end up pointing at the same physical object.
    const { data: productImages, error: imagesError } = await supabase
      .from('product_images')
      .select('*')
      .in('product_id', productIds)

    if (imagesError) {
      console.error('Error fetching product images:', imagesError)
    } else if (productImages && productImages.length > 0) {
      const imagesToInsert = (await Promise.all(productImages.map(async (image) => {
        const { id, created_at, ...imageData } = image
        const newProductId = productIdMapping.get(image.product_id)

        if (!newProductId) {
          console.error(`No mapping found for product ID: ${image.product_id}`)
          return null
        }

        let newUrl = image.url
        const oldPath = image.url ? getStorageObjectPath(image.url) : null

        if (oldPath) {
          const ext = oldPath.split('.').pop() || 'jpg'
          const randomSuffix = Math.random().toString(36).slice(2, 11)
          const newPath = `product/${targetUserId}/product-${newProductId}-${Date.now()}-${randomSuffix}.${ext}`

          const { error: copyError } = await supabase.storage
            .from(STORAGE_BUCKET)
            .copy(oldPath, newPath)

          if (copyError) {
            console.error(`Error copying storage object ${oldPath} -> ${newPath}:`, copyError)
          } else {
            const { data: publicUrlData } = supabase.storage
              .from(STORAGE_BUCKET)
              .getPublicUrl(newPath)
            newUrl = publicUrlData.publicUrl
          }
        }

        return {
          ...imageData,
          url: newUrl,
          product_id: newProductId,
          created_at: new Date().toISOString()
        }
      }))).filter(Boolean)

      if (imagesToInsert.length > 0) {
        const { error: insertImagesError } = await supabase
          .from('product_images')
          .insert(imagesToInsert)

        if (insertImagesError) {
          console.error('Error copying product images:', insertImagesError)
        } else {
          stats.copiedImages = imagesToInsert.length
        }
      }
    }

    // Copy price tiers
    const { data: priceTiers, error: tiersError } = await supabase
      .from('product_price_tiers')
      .select('*')
      .in('product_id', productIds)

    if (tiersError) {
      console.error('Error fetching price tiers:', tiersError)
      // Non-critical error - log but don't fail
    } else if (priceTiers && priceTiers.length > 0) {
      const tiersToInsert = priceTiers.map(tier => {
        const { id, created_at, updated_at, ...tierData } = tier
        const newProductId = productIdMapping.get(tier.product_id)
        
        if (!newProductId) {
          console.error(`No mapping found for product ID: ${tier.product_id}`)
          return null
        }

        return {
          ...tierData,
          product_id: newProductId,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }
      }).filter(Boolean)

      if (tiersToInsert.length > 0) {
        const { error: insertTiersError } = await supabase
          .from('product_price_tiers')
          .insert(tiersToInsert)

        if (insertTiersError) {
          console.error('Error copying price tiers:', insertTiersError)
          // Non-critical error - log but don't fail
        } else {
          stats.copiedPriceTiers = tiersToInsert.length
        }
      }
    }

    // Copy weight variants (the pricing structure for has_weight_variants
    // products, parallel to price tiers above). products.min_variant_price /
    // max_variant_price are recalculated automatically by the
    // trg_pwv_recalc trigger once these rows are inserted, so they don't
    // need to be set here.
    const { data: weightVariants, error: weightVariantsError } = await supabase
      .from('product_weight_variants')
      .select('*')
      .in('product_id', productIds)

    if (weightVariantsError) {
      console.error('Error fetching weight variants:', weightVariantsError)
      // Non-critical error - log but don't fail
    } else if (weightVariants && weightVariants.length > 0) {
      const weightVariantsToInsert = weightVariants.map(variant => {
        const { id, created_at, updated_at, ...variantData } = variant
        const newProductId = productIdMapping.get(variant.product_id)

        if (!newProductId) {
          console.error(`No mapping found for product ID: ${variant.product_id}`)
          return null
        }

        return {
          ...variantData,
          product_id: newProductId,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }
      }).filter(Boolean)

      if (weightVariantsToInsert.length > 0) {
        const { error: insertWeightVariantsError } = await supabase
          .from('product_weight_variants')
          .insert(weightVariantsToInsert)

        if (insertWeightVariantsError) {
          console.error('Error copying weight variants:', insertWeightVariantsError)
          // Non-critical error - log but don't fail
        } else {
          stats.copiedWeightVariants = weightVariantsToInsert.length
        }
      }
    }

    console.log('Copy operation completed:', stats)

    return new Response(
      JSON.stringify({
        success: true,
        message: `Successfully copied ${stats.copiedProducts} products with ${stats.copiedImages} images, ${stats.copiedPriceTiers} price tiers, ${stats.copiedWeightVariants} weight variants, and ${stats.copiedCategories} categories`,
        stats
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )

  } catch (error) {
    console.error('Unexpected error in copy-products-between-users function:', error)
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})
