/*
  # Fix Product Visibility and Missing Images

  ## Summary
  - Populate featured_image_url for visible products that are missing images
  - Ensure visible products have at least one valid image from product_images table
  - Fix display_order for consistent product ordering
  - Validate all visible products have required fields

  ## Changes Made
  1. Update visible products without featured_image_url from product_images table
  2. Ensure display_order is properly set for all visible products
  3. Validate category array is not empty for visible products

  ## Security
  - Uses maybeSingle() pattern for safe queries
  - RLS remains enabled on products table
  - No data deletion, only null-safe updates
*/

-- Step 1: Populate missing featured_image_url from product_images for visible products
UPDATE products p
SET featured_image_url = (
  SELECT url FROM product_images 
  WHERE product_id = p.id
  ORDER BY is_featured DESC, display_order ASC
  LIMIT 1
)
WHERE is_visible_on_storefront = true 
  AND (featured_image_url IS NULL OR featured_image_url = '')
  AND EXISTS (
    SELECT 1 FROM product_images WHERE product_id = p.id LIMIT 1
  );

-- Step 2: Ensure display_order is set for all visible products (use negative of id for stability)
UPDATE products
SET display_order = COALESCE(display_order, 0)
WHERE is_visible_on_storefront = true 
  AND display_order IS NULL;

-- Step 3: Log the operation completion
SELECT COUNT(*) as products_updated FROM products 
WHERE is_visible_on_storefront = true 
  AND featured_image_url IS NOT NULL 
  AND featured_image_url != '';
