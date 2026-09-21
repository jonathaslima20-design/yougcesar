/*
  # Add delivery_distance_km / delivery_weight_kg to orders

  1. Changes
    - `orders`
      - New columns `delivery_distance_km`, `delivery_weight_kg` (numeric,
        nullable) - a snapshot of the computed input used to price the
        delivery option at order time, for support/audit visibility only
        (e.g. "why did this order get charged R$25 for local delivery?").
        Only one of the two is ever populated, depending on which delivery
        calculation mode was used (`distance_tier` vs `weight_tier`); both
        stay null for every other mode (flat/region/carrier/pickup).
      - Same snapshot precedent as `pickup_instructions`
        (20260817110000_add_tracking_to_orders.sql's sibling migration) -
        frozen at order-creation time so it survives the merchant later
        editing or deleting the delivery option config.
    - Not used for server-side recomputation or validation of `delivery_fee`
      — that trust model (client-computed, not re-verified server-side) is
      unchanged by this migration; see the "Riscos assumidos" note in the
      delivery-options redesign this ships with.
*/

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS delivery_distance_km numeric,
  ADD COLUMN IF NOT EXISTS delivery_weight_kg numeric;
