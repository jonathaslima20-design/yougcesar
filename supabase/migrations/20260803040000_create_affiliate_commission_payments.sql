/*
  # Create affiliate_commission_payments (payout batches + receipts)

  1. Problem
    - A store owner typically pays several pending commissions for the same
      affiliate in one transfer (one Pix, one receipt) rather than one
      payment per commission line. The previous "mark as paid" flow
      (markCommissionsPaid in useAffiliates.ts) just flipped
      affiliate_commissions.status directly with no record of the payout
      itself — no way to attach a receipt, no audit trail of "when was this
      batch paid and how much".

  2. New Table
    - `affiliate_commission_payments`: one row per payout event. Snapshots
      `total_amount` at payment time (sum of the commissions included) so
      the record stays accurate even if something about the commissions
      changes later. `affiliate_id` is ON DELETE SET NULL (not CASCADE),
      matching the same audit-preservation rationale as
      affiliate_commissions.affiliate_id — a payment record must outlive the
      affiliate being removed. `receipt_url` points at the existing shared
      `public` storage bucket (same one product images already use, see
      productImageService.ts) — this project has no per-file-private-ACL
      storage pattern anywhere else, so this follows the same convention
      rather than introducing a new one.

  3. Changes
    - `affiliate_commissions.payment_id`: nullable FK to the payment batch
      that paid it. ON DELETE SET NULL — deleting a payment record (should
      that ever happen) reverts the commissions to unlinked rather than
      cascading into data loss; it does NOT revert their `status` back to
      pending automatically, since that's a business decision, not a data
      integrity one.

  4. Security
    - Store owner: full access (create payments, view, update notes/receipt)
      scoped to their own store (`store_owner_id = auth.uid()`).
    - Affiliate: read-only access to payments made to them
      (`affiliate_id = auth.uid()`).
    - No public/anon access.
*/

CREATE TABLE IF NOT EXISTS public.affiliate_commission_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  affiliate_id uuid REFERENCES public.affiliates(id) ON DELETE SET NULL,
  store_owner_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  total_amount numeric NOT NULL,
  receipt_url text,
  notes text,
  paid_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_affiliate_commission_payments_affiliate_id
  ON public.affiliate_commission_payments (affiliate_id);
CREATE INDEX IF NOT EXISTS idx_affiliate_commission_payments_store_owner_id
  ON public.affiliate_commission_payments (store_owner_id, paid_at DESC);

ALTER TABLE public.affiliate_commission_payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Store owners can manage own affiliate payments" ON public.affiliate_commission_payments;
CREATE POLICY "Store owners can manage own affiliate payments"
  ON public.affiliate_commission_payments FOR ALL
  TO authenticated
  USING (store_owner_id = auth.uid())
  WITH CHECK (store_owner_id = auth.uid());

DROP POLICY IF EXISTS "Affiliates can view own payments" ON public.affiliate_commission_payments;
CREATE POLICY "Affiliates can view own payments"
  ON public.affiliate_commission_payments FOR SELECT
  TO authenticated
  USING (affiliate_id = auth.uid());

DROP POLICY IF EXISTS "Admins can manage all affiliate payments" ON public.affiliate_commission_payments;
CREATE POLICY "Admins can manage all affiliate payments"
  ON public.affiliate_commission_payments FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

ALTER TABLE public.affiliate_commissions
  ADD COLUMN IF NOT EXISTS payment_id uuid REFERENCES public.affiliate_commission_payments(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_affiliate_commissions_payment_id ON public.affiliate_commissions (payment_id);
