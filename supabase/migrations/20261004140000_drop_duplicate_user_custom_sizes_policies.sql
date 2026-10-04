-- Remove duplicate RLS policies on user_custom_sizes.
-- The live database has two copies of each policy: the ones from migration
-- 20251108140248 and "... own ..." copies created outside the repo. They have
-- identical USING / WITH CHECK clauses (auth.uid() = user_id), and Postgres ORs
-- permissive policies, so dropping the "own" copies does not change access.
-- Kept: the migration-defined policies plus "Users can update own custom sizes"
-- (the only UPDATE policy).

DROP POLICY IF EXISTS "Users can delete own custom sizes" ON user_custom_sizes;
DROP POLICY IF EXISTS "Users can insert own custom sizes" ON user_custom_sizes;
DROP POLICY IF EXISTS "Users can read own custom sizes" ON user_custom_sizes;
