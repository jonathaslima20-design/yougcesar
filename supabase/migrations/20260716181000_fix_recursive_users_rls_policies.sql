/*
  # Fix infinite recursion in public.users RLS policies

  1. Problem
    - The previous migration (20260716180000_enable_rls_on_users_table.sql) enabled
      RLS on public.users. Doing so also activated pre-existing legacy policies that
      were never part of this repo's migration history (created outside of tracked
      migrations, presumably when the table was first scaffolded, and dormant while
      RLS was off): "Admins can create users", "Admins can delete users",
      "Admins can read all users", "Admins can update users".
    - Those policies checked admin status with a raw self-referencing subquery
      (`EXISTS (SELECT 1 FROM users users_1 WHERE users_1.id = auth.uid() AND
      users_1.role = ANY(...))`) with no RLS-bypass mechanism. Evaluating that
      subquery re-triggers RLS on `users`, which re-evaluates the same policy,
      producing "infinite recursion detected in policy for relation users" and
      breaking every query against the table (login, storefronts, admin panel).
    - Two more legacy policies ("Users can read own data", "Users can update own
      data") were exact duplicates of policies already created in the prior
      migration and are just removed for clarity; they were not recursive.

  2. Fix
    - Drop the four recursive legacy policies and the two duplicates.
    - Recreate "Admins can create users" (INSERT) and "Admins can delete users"
      (DELETE) using the public.is_admin() SECURITY DEFINER helper introduced in
      the prior migration, which safely avoids the recursion.
    - Net policy set on public.users after this migration:
        SELECT: "Public can view active corretor storefronts", "Public profiles
                 are visible" (legacy, non-recursive, kept as-is), "Users can view
                 own profile", "Admins can view all users"
        INSERT: "Users can insert own profile", "Admins can create users"
        UPDATE: "Users can update own profile", "Admins can update all users"
        DELETE: "Admins can delete users"
*/

BEGIN;

ALTER TABLE public.users DISABLE ROW LEVEL SECURITY;

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

DROP POLICY IF EXISTS "Admins can create users" ON public.users;
DROP POLICY IF EXISTS "Admins can delete users" ON public.users;
DROP POLICY IF EXISTS "Admins can read all users" ON public.users;
DROP POLICY IF EXISTS "Admins can update users" ON public.users;
DROP POLICY IF EXISTS "Users can read own data" ON public.users;
DROP POLICY IF EXISTS "Users can update own data" ON public.users;

CREATE POLICY "Admins can create users"
  ON public.users FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin());

CREATE POLICY "Admins can delete users"
  ON public.users FOR DELETE
  TO authenticated
  USING (public.is_admin());

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

COMMIT;
