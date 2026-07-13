/*
  # Fix valid_max_quantity constraint for exact quantity pricing mode

  ## Problem
  The existing constraint requires max_quantity > min_quantity, but in exact quantity
  pricing mode, both values can be equal (e.g., min_quantity = 1, max_quantity = 1).

  ## Solution
  Update the constraint to allow max_quantity >= min_quantity, which supports both:
  - Range-based pricing (min_quantity < max_quantity)
  - Exact quantity pricing (min_quantity = max_quantity)

  ## Changes
  1. Drop the existing valid_max_quantity constraint
  2. Create new constraint that allows max_quantity >= min_quantity
*/

ALTER TABLE product_price_tiers
DROP CONSTRAINT IF EXISTS valid_max_quantity;

ALTER TABLE product_price_tiers
ADD CONSTRAINT valid_max_quantity 
CHECK ((max_quantity IS NULL) OR (max_quantity >= min_quantity));
