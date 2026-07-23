/*
  # Add 'partner' role scoping (VitrineTurbo Partners panel)

  1. Problem
    - New "partner" role: refers and directly registers merchant (corretor)
      accounts, and needs a scoped-down admin-like panel where they can only
      see/manage the users they themselves brought onto the platform.
    - `role` on `users` is unconstrained text (no CHECK), so the 'partner'
      value itself needs no schema change — only new authorization plumbing.
    - The existing `referred_by` column belongs to the corretor money-referral
      commission program (see 20260527200726, 20260531...) and must not be
      reused for partner management scope, to avoid cross-contaminating the
      two concepts. A dedicated column is added instead.

  2. Changes
    - `users.managed_by_partner_id` (uuid, FK -> users.id, ON DELETE SET NULL):
      authoritative "who manages this account" field for the Partners panel.
      Set either when a partner directly creates a user (create-user edge
      function) or when someone signs up through a partner's referral link
      (registerUser/completeGoogleProfile in simpleAuth.ts).
    - `public.is_partner()`: SECURITY DEFINER helper mirroring `public.is_admin()`
      (20260716180000_enable_rls_on_users_table.sql), avoids self-referential
      RLS recursion.
    - New RLS policies: partners can SELECT/UPDATE only rows where
      `managed_by_partner_id = auth.uid()`. No DELETE policy for partners —
      account deletion stays admin-only, matching product decision that
      partners get full management minus delete/impersonate.

  3. Notes
    - Column-level restriction (partners shouldn't be able to change a managed
      user's `role` or `managed_by_partner_id` itself) is NOT enforced by RLS
      here (Postgres RLS is row-level, not column-level) — the Partners panel
      UI/API layer must only ever send safe fields (name, contact info,
      is_blocked) in its update calls.
*/

ALTER TABLE users ADD COLUMN IF NOT EXISTS managed_by_partner_id uuid REFERENCES users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_users_managed_by_partner_id ON users(managed_by_partner_id);

CREATE OR REPLACE FUNCTION public.is_partner()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'partner'
  );
$$;

-- Referral-code lookups at signup (registerUser/completeGoogleProfile in
-- simpleAuth.ts) run as anon-or-just-signed-up and need to resolve a partner
-- referrer the same way they already resolve a corretor referrer via the
-- "Public can view active corretor storefronts" policy. Mirrors that policy's
-- exposure level (id/name/etc. of active, non-blocked accounts) rather than
-- introducing a new class of exposure.
DROP POLICY IF EXISTS "Public can view active partner profiles" ON public.users;
CREATE POLICY "Public can view active partner profiles"
  ON public.users FOR SELECT
  TO anon, authenticated
  USING (role = 'partner' AND is_blocked = false);

DROP POLICY IF EXISTS "Partners can view managed users" ON public.users;
CREATE POLICY "Partners can view managed users"
  ON public.users FOR SELECT
  TO authenticated
  USING (public.is_partner() AND managed_by_partner_id = auth.uid());

DROP POLICY IF EXISTS "Partners can update managed users" ON public.users;
CREATE POLICY "Partners can update managed users"
  ON public.users FOR UPDATE
  TO authenticated
  USING (public.is_partner() AND managed_by_partner_id = auth.uid())
  WITH CHECK (public.is_partner() AND managed_by_partner_id = auth.uid());
