/*
  # Add early_renewal field to mp_payments table

  ## Summary
  Adds a boolean flag `early_renewal` to the `mp_payments` table to track when a
  user is renewing their subscription before the current plan expires (early renewal).

  ## Changes
  - `mp_payments`: new column `early_renewal` (boolean, default false)

  ## Why
  When a user renews early, the new expiry date must be calculated from the current
  subscription_end_date rather than from today. This flag travels with the payment
  record so the webhook handler knows to apply the offset-from-expiry logic.
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'mp_payments' AND column_name = 'early_renewal'
  ) THEN
    ALTER TABLE mp_payments ADD COLUMN early_renewal boolean NOT NULL DEFAULT false;
  END IF;
END $$;
