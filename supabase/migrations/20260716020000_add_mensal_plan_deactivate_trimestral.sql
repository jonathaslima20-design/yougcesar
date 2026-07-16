/*
  # Replace Trimestral with a Mensal plan

  1. Summary
    - Adds a new "Plano Mensal" (R$ 57,00, 1 month) with the same benefits as the
      retired Trimestral tier.
    - Deactivates the existing Trimestral plan so it no longer appears as a choice
      for new subscribers, WITHOUT touching its row. Existing subscribers whose
      subscription still references this exact plan id keep renewing under their
      original Trimestral terms (R$ 149 / 3 months) — CheckoutPage resolves plans
      by id regardless of is_active, and mp-webhook snapshots plan_name/plan_price
      per payment, so nothing about their billing changes retroactively.

  2. Changes
    - INSERT a new subscription_plans row: Mensal, R$ 57.00, is_active = true.
    - UPDATE the Trimestral row (id 8a882a0c-7400-4917-8983-c52e4443b37a) to
      is_active = false.
*/

INSERT INTO subscription_plans (name, duration, price, is_active, display_order)
VALUES ('Plano Mensal', 'Mensal', 57.00, true, 1);

UPDATE subscription_plans
SET is_active = false, updated_at = now()
WHERE id = '8a882a0c-7400-4917-8983-c52e4443b37a';
