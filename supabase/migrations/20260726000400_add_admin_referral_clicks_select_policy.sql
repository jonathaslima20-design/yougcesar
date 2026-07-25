/*
  # Allow admins to view all referral_clicks rows

  1. Problem
    - `referral_clicks` only has a SELECT policy scoped to `referrer_id = auth.uid()`,
      so the admin panel cannot read a partner's (or any user's) click count when
      viewing their profile from `/admin/users/:userId` — the query silently
      returns 0 under RLS instead of erroring.

  2. Changes
    - New SELECT policy: admins (via the existing `public.is_admin()` helper) can
      read any row. Purely additive — does not touch the existing owner-only policy.
*/

DROP POLICY IF EXISTS "Admins can view all referral clicks" ON public.referral_clicks;
CREATE POLICY "Admins can view all referral clicks"
  ON public.referral_clicks FOR SELECT
  TO authenticated
  USING (public.is_admin());
