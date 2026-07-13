/*
  # Add foreign key constraints from offer tables to users

  ## Problem
  The `offer_user_assignments` and `offer_impressions` tables have a `user_id`
  column that was created without a foreign key reference to `users(id)`.
  Supabase PostgREST requires FK constraints to resolve relation syntax like
  `user:users(name, email, avatar_url)` in select queries. Without the FK,
  the join silently fails and returns an error, causing the recipients list
  to appear empty even though data exists in the table.

  ## Changes
  1. Add FK `offer_user_assignments.user_id → users(id) ON DELETE CASCADE`
  2. Add FK `offer_impressions.user_id → users(id) ON DELETE CASCADE`
  3. Add FK `offer_user_assignments.assigned_by → users(id) ON DELETE SET NULL`

  ## Impact
  - PostgREST can now resolve the `user:users(...)` relation correctly
  - Deleting a user will cascade-delete their assignments and impressions
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'fk_offer_assignments_user_id'
      AND table_name = 'offer_user_assignments'
  ) THEN
    ALTER TABLE public.offer_user_assignments
      ADD CONSTRAINT fk_offer_assignments_user_id
      FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'fk_offer_assignments_assigned_by'
      AND table_name = 'offer_user_assignments'
  ) THEN
    ALTER TABLE public.offer_user_assignments
      ADD CONSTRAINT fk_offer_assignments_assigned_by
      FOREIGN KEY (assigned_by) REFERENCES public.users(id) ON DELETE SET NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'fk_offer_impressions_user_id'
      AND table_name = 'offer_impressions'
  ) THEN
    ALTER TABLE public.offer_impressions
      ADD CONSTRAINT fk_offer_impressions_user_id
      FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;
  END IF;
END $$;
