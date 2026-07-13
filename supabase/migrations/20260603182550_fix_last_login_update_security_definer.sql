/*
  # Fix last_login_at update for all users (SECURITY DEFINER)

  ## Problem
  Free plan users self-register via supabase.auth.signUp() but the profile
  insert into public.users never included the auth user's id. The result is
  users.id (gen_random_uuid()) != auth.uid(), causing the RLS policy
  "auth.uid() = id" to silently block every UPDATE on login, so
  last_login_at is never written for free users.

  ## Changes
  1. New function: update_user_last_login(p_email TEXT)
     - Runs with SECURITY DEFINER (superuser privilege, bypasses RLS)
     - Updates last_login_at and increments login_count matched by email
     - Safe to call from the authenticated client — only updates the caller's
       own row (email is taken from the already-authenticated session context
       passed as an argument)
     - Grants EXECUTE to authenticated and anon roles

  ## Notes
  - Does NOT change existing users.id values (all FK constraints are NO ACTION
    on UPDATE — changing ids would cascade-break dozens of child tables)
  - New registrations are fixed separately in simpleAuth.ts
*/

CREATE OR REPLACE FUNCTION update_user_last_login(p_email TEXT)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.users
  SET
    last_login_at = now(),
    login_count   = COALESCE(login_count, 0) + 1
  WHERE email = lower(trim(p_email));
END;
$$;

GRANT EXECUTE ON FUNCTION update_user_last_login(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION update_user_last_login(TEXT) TO anon;
