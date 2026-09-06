/*
  # Default new signups to 'inactive' instead of 'free'

  ## Summary
  Free self-service signup is being discontinued. New registrations (email/password
  and Google) now explicitly write plan_status = 'inactive' at the application level
  (see src/lib/auth/simpleAuth.ts), which the existing subscription-gating logic
  already treats the same as 'expired'/'suspended' — not a subscriber, not exempt as
  free, so the user is locked behind the plan-selection modal until they subscribe.

  This migration only updates the column DEFAULT so any insert path that doesn't
  explicitly set plan_status also locks by default, instead of silently granting the
  old free-tier default. 'inactive' was already an allowed value in the
  users_plan_status_check constraint (added back in 20260417161928) — this migration
  does not touch that constraint.

  ## Changes
  - ALTER COLUMN plan_status SET DEFAULT 'inactive' on public.users

  ## Important Notes
  1. No backfill: existing rows (including everyone currently on plan_status = 'free')
     are left untouched. This is deliberate — the business decided not to retroactively
     lock out existing free-tier users.
  2. The admin/partner manual "create user" tool (supabase/functions/create-user)
     explicitly sets plan_status = 'free' in its own insert, so it is unaffected by
     this default change and keeps creating Free accounts as before.
*/

ALTER TABLE users
  ALTER COLUMN plan_status SET DEFAULT 'inactive';
