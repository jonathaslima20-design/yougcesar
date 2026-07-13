/*
  # Backfill last_login_at for users who self-registered

  ## Problem
  Users who self-registered never had their last_login_at recorded because
  the registerUser() function did not call update_user_last_login, and
  autoLogin() via localStorage also skipped it. These users appear as
  "never accessed" in the admin panel despite being active.

  ## Changes
  1. Sets last_login_at to the most recent known activity timestamp for users
     with NULL last_login_at:
     - Uses the latest user_activity_logs entry, OR
     - Uses the latest product created_at, OR
     - Falls back to the user's own created_at
  2. Sets login_count to 1 for backfilled users (conservative estimate)

  ## Notes
  - Only affects users with last_login_at IS NULL
  - Does not overwrite any existing last_login_at values
  - Safe to run multiple times (idempotent due to WHERE condition)
*/

UPDATE public.users u
SET
  last_login_at = COALESCE(
    (SELECT MAX(ual.created_at) FROM user_activity_logs ual WHERE ual.user_id = u.id),
    (SELECT MAX(p.created_at) FROM products p WHERE p.user_id = u.id),
    u.created_at
  ),
  login_count = GREATEST(COALESCE(login_count, 0), 1)
WHERE u.last_login_at IS NULL;
