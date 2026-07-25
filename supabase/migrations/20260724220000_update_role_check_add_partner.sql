/*
  # Update role check constraint to include 'partner'

  1. Problem
    - `users_role_check` is a legacy constraint (created outside tracked
      migrations, before this repo's migration history began) that only
      allows `role IN ('admin', 'corretor')`.
    - The VitrineTurbo Partners panel (20260723010000_create_partners_role.sql)
      introduced the 'partner' role but never touched this constraint, since
      it wasn't visible in any tracked migration file. Creating a user with
      role = 'partner' fails with: new row for relation "users" violates
      check constraint "users_role_check" (Postgres error 23514).

  2. Changes
    - Drops the existing `users_role_check` constraint
    - Recreates it with the additional 'partner' value
*/

ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;

ALTER TABLE users ADD CONSTRAINT users_role_check
  CHECK (role = ANY (ARRAY['admin'::text, 'corretor'::text, 'partner'::text]));
