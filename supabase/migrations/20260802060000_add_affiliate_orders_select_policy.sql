/*
  # Allow affiliates to view their own attributed orders

  1. Problem
    - The affiliate dashboard needs to show "orders generated" and a
      click-to-order conversion rate. `affiliate_commissions` alone
      undercounts this: a WhatsApp order only gets a commission row once it
      reaches the store's configured commissionTrigger status (confirmed or
      delivered), so an order still pending/preparing would be invisible to
      an affiliate relying only on the commissions ledger, even though it
      already carries their attribution.

  2. Changes
    - New SELECT policy on `orders`: an affiliate can view orders where
      `affiliate_id = auth.uid()`. Read-only, additive to the existing
      owner/buyer SELECT policies — does not change who can INSERT/UPDATE/
      DELETE orders.
*/

DROP POLICY IF EXISTS "Affiliates can view own attributed orders" ON public.orders;
CREATE POLICY "Affiliates can view own attributed orders"
  ON public.orders FOR SELECT
  TO authenticated
  USING (affiliate_id = auth.uid());
