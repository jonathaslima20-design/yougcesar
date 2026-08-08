/*
  # Add shipping dimensions to products

  1. Modified Tables
    - `products`
      - `weight_kg` (numeric, nullable) - physical shipping weight, in kilograms.
      - `height_cm` (numeric, nullable) - package height, in centimeters.
      - `width_cm` (numeric, nullable) - package width, in centimeters.
      - `length_cm` (numeric, nullable) - package length, in centimeters.

  2. Notes
    - These are physical shipping attributes used to request live carrier
      quotes (SuperFrete). They are UNRELATED to `product_weight_variants` /
      `has_weight_variants` (an existing PRICING-variant concept, e.g. "500g"
      vs "1kg" sold as different-priced SKUs) — do not confuse the two.
    - Nullable, no default. A product missing one or more of these falls back
      to a small-parcel default in application code (`shippingUtils.ts`), not
      here, so the fallback values can be tuned without a migration.
*/

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS weight_kg numeric,
  ADD COLUMN IF NOT EXISTS height_cm numeric,
  ADD COLUMN IF NOT EXISTS width_cm numeric,
  ADD COLUMN IF NOT EXISTS length_cm numeric;
