/*
  # Enable Row Level Security on public.users

  1. Problem
    - The `users` table currently has RLS disabled (or effectively open), which means
      the public anon API key can SELECT and UPDATE every row of every user with no
      authentication at all — verified live: an unauthenticated request was able to
      read all 571 users (email, whatsapp, plan_status, role, referral_code, etc.)
      and successfully overwrite a row's `email` column.
    - This exposes PII for every user and allows privilege escalation (e.g. an
      anonymous caller could set their own `role` to 'admin' or `is_blocked` to false
      once they know their own row id, or tamper with anyone else's row).

  2. Constraints this migration must respect (confirmed by code audit)
    - Public storefront pages (`/:slug`, `/:slug/produtos/:id`, custom domains) read
      an active corretor's profile with NO authenticated session
      (src/hooks/useCorretorData.ts, src/pages/ProductDetailsPage.tsx,
      src/contexts/CustomDomainContext.tsx, src/lib/tracking.ts).
    - Self-registration (src/lib/auth/simpleAuth.ts registerUser) inserts the new
      user's own profile row immediately after supabase.auth.signUp, while already
      authenticated as that new user.
    - The admin panel performs direct client-side reads/updates against arbitrary
      user rows using the logged-in admin's session (e.g.
      src/pages/admin/UsersManagementPage.tsx, src/pages/admin/UserDetailPage.tsx:
      toggling is_blocked, updating max_images_per_product, listing all users).
    - User-facing settings pages update the caller's own row
      (src/components/dashboard/ProfileSettings.tsx and others), always `.eq('id', user.id)`.
    - Row creation/deletion for other users is otherwise handled by Edge Functions
      running with the service role key (create-user, clone-user), which bypass RLS.

  3. Policy design
    - A SECURITY DEFINER helper `public.is_admin()` avoids self-referential RLS
      recursion when checking the caller's own role.
    - Public/anon + authenticated: SELECT only rows where role = 'corretor' AND
      is_blocked = false (matches the existing storefront query filter).
    - Authenticated: SELECT/UPDATE/INSERT own row (auth.uid() = id).
    - Admins: SELECT/UPDATE all rows.
    - No public DELETE or INSERT-for-others policy; those remain service-role only.

  4. Follow-up (not covered here)
    - `ProductDetailsPage.tsx` currently does `select('*')` against `users` on a
      public route, which will still return sensitive columns (email, referral_code,
      subscription_end_date, custom_domain, phone) for that one corretor's own row
      once RLS allows the row through. This migration stops the *mass* data leak
      (all 571 users, arbitrary writes) but does not by itself hide those specific
      columns on that one legitimate public profile — trimming that SELECT to only
      the columns the storefront UI actually needs is a separate, non-RLS follow-up.
*/

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin'
  );
$$;

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can view active corretor storefronts" ON public.users;
CREATE POLICY "Public can view active corretor storefronts"
  ON public.users FOR SELECT
  TO anon, authenticated
  USING (role = 'corretor' AND is_blocked = false);

DROP POLICY IF EXISTS "Users can view own profile" ON public.users;
CREATE POLICY "Users can view own profile"
  ON public.users FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update own profile" ON public.users;
CREATE POLICY "Users can update own profile"
  ON public.users FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Users can insert own profile" ON public.users;
CREATE POLICY "Users can insert own profile"
  ON public.users FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Admins can view all users" ON public.users;
CREATE POLICY "Admins can view all users"
  ON public.users FOR SELECT
  TO authenticated
  USING (public.is_admin());

DROP POLICY IF EXISTS "Admins can update all users" ON public.users;
CREATE POLICY "Admins can update all users"
  ON public.users FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());
