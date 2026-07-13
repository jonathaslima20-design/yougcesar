/*
  # Fix validate_all_price_tiers_for_product trigger for exact quantity pricing mode

  ## Problem
  The trigger function `validate_all_price_tiers_for_product` raises an exception when
  `min_quantity >= max_quantity`. In exact quantity pricing mode, the frontend correctly
  sets `max_quantity = min_quantity` (e.g., both = 1), which triggers the error:
  "Each tier must have min_quantity < max_quantity".

  ## Solution
  1. Change the tier validation condition from `min_quantity >= max_quantity` to
     `min_quantity > max_quantity` so that exact pricing rows (min = max) are allowed.
  2. Fix the overlap detection so that exact quantity tiers (where min = max) correctly
     detect duplicates but not false positives between distinct exact quantities.

  ## Changes
  - Updated `validate_all_price_tiers_for_product` function:
    - Validation: `min_quantity > max_quantity` (was `>=`)
    - Overlap check: excludes cases where both tiers are exact (min = max) with different quantities
*/

CREATE OR REPLACE FUNCTION validate_all_price_tiers_for_product()
RETURNS TRIGGER AS $$
DECLARE
  product_record RECORD;
  tier_count integer;
  null_max_count integer;
  max_min_quantity integer;
  unlimited_tier_min_quantity integer;
  has_overlaps boolean;
BEGIN
  FOR product_record IN
    SELECT DISTINCT product_id
    FROM product_price_tiers
  LOOP
    SELECT COUNT(*) INTO tier_count
    FROM product_price_tiers
    WHERE product_id = product_record.product_id;

    IF tier_count = 0 THEN
      CONTINUE;
    END IF;

    SELECT COUNT(*) INTO null_max_count
    FROM product_price_tiers
    WHERE product_id = product_record.product_id AND max_quantity IS NULL;

    IF null_max_count > 1 THEN
      RAISE EXCEPTION 'Only one tier can have unlimited (NULL) max_quantity for product %',
        product_record.product_id;
    END IF;

    IF null_max_count = 1 THEN
      SELECT MAX(min_quantity) INTO max_min_quantity
      FROM product_price_tiers
      WHERE product_id = product_record.product_id;

      SELECT min_quantity INTO unlimited_tier_min_quantity
      FROM product_price_tiers
      WHERE product_id = product_record.product_id AND max_quantity IS NULL;

      IF unlimited_tier_min_quantity != max_min_quantity THEN
        RAISE EXCEPTION 'Only the last tier (highest min_quantity) can have unlimited (NULL) max_quantity for product %',
          product_record.product_id;
      END IF;
    END IF;

    -- Check for overlapping ranges, allowing exact quantity tiers (min_quantity = max_quantity)
    -- to coexist as long as they don't share the same exact quantity
    SELECT EXISTS (
      SELECT 1
      FROM product_price_tiers t1
      JOIN product_price_tiers t2 ON t1.product_id = t2.product_id AND t1.id != t2.id
      WHERE t1.product_id = product_record.product_id
      AND (
        t1.min_quantity <= COALESCE(t2.max_quantity, 999999) AND
        COALESCE(t1.max_quantity, 999999) >= t2.min_quantity
      )
    ) INTO has_overlaps;

    IF has_overlaps THEN
      RAISE EXCEPTION 'Price tiers cannot have overlapping quantity ranges for product %',
        product_record.product_id;
    END IF;

    -- Validate that min_quantity < max_quantity for each tier (when max_quantity is not NULL)
    -- Allow min_quantity = max_quantity for exact quantity pricing mode
    IF EXISTS (
      SELECT 1
      FROM product_price_tiers
      WHERE product_id = product_record.product_id
        AND max_quantity IS NOT NULL
        AND min_quantity > max_quantity
    ) THEN
      RAISE EXCEPTION 'Each tier must have min_quantity <= max_quantity for product %',
        product_record.product_id;
    END IF;

    IF EXISTS (
      SELECT 1
      FROM product_price_tiers
      WHERE product_id = product_record.product_id
        AND (unit_price <= 0 OR (discounted_unit_price IS NOT NULL AND discounted_unit_price <= 0))
    ) THEN
      RAISE EXCEPTION 'All prices must be greater than zero for product %',
        product_record.product_id;
    END IF;

    IF EXISTS (
      SELECT 1
      FROM product_price_tiers
      WHERE product_id = product_record.product_id
        AND discounted_unit_price IS NOT NULL
        AND discounted_unit_price >= unit_price
    ) THEN
      RAISE EXCEPTION 'Discounted price must be less than unit price for product %',
        product_record.product_id;
    END IF;

  END LOOP;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql;
