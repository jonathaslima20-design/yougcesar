/*
  # Allow partners to view their managed users' subscriptions

  1. Problem
    - The Partners user listing needs to show a "Pagamento Pendente" badge
      for accounts the partner assigned a plan to (a `pending` subscription
      row with `payment_due_at` set). `subscriptions` has no tracked RLS
      history (predates this repo's migration tracking) and no existing
      policy grants a partner visibility into their managed users' rows,
      so this query would silently return nothing under RLS.

  2. Changes
    - New SELECT policy: a partner can read `subscriptions` rows belonging
      to users they manage (`users.managed_by_partner_id = auth.uid()`),
      mirroring the EXISTS-subquery pattern already used for admin policies
      elsewhere in this schema. Purely additive — does not touch any
      existing policy on this table.
*/

DROP POLICY IF EXISTS "Partners can view managed users subscriptions" ON public.subscriptions;
CREATE POLICY "Partners can view managed users subscriptions"
  ON public.subscriptions FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = subscriptions.user_id
        AND users.managed_by_partner_id = auth.uid()
    )
  );
