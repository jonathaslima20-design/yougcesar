/*
  # Add shipping_weight_kg to product_weight_variants

  1. Modified Tables
    - `product_weight_variants`
      - `shipping_weight_kg` (numeric, nullable) - the real physical shipping
        weight of this specific variant (e.g. a "500g" coffee bag variant
        might really weigh 0.55kg packaged). Optional and independent from
        `unit_value`/`unit_type`, which describe the sales unit shown to the
        buyer, not a reliable shipping weight (unit_type can be 'un'/'cps',
        which has no weight equivalent at all).

  2. Notes
    - Nullable, no default: when unset, checkout code
      (src/lib/shippingUtils.ts buildSuperFreteProducts) falls back to the
      parent product's own weight_kg, exactly like before this column
      existed — this is purely additive and changes no existing behavior
      for merchants who don't fill it in.
    - Package dimensions (height/width/length) are NOT duplicated here:
      weight variants of the same product are assumed to share the same
      physical footprint, only weight was found to meaningfully differ.
*/

ALTER TABLE product_weight_variants ADD COLUMN IF NOT EXISTS shipping_weight_kg numeric;
