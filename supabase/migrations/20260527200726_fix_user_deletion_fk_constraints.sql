/*
  # Fix Foreign Key Constraints for Safe User Deletion

  1. Changes
    - `user_pix_keys.user_id`: Changed from NO ACTION to CASCADE
      - PIX keys belong to the user and have no audit value after deletion
    - `users.referred_by`: Changed from NO ACTION to SET NULL
      - Column is already nullable; preserves referral chain for other users
    - `withdrawal_requests.processed_by`: Changed from NO ACTION to SET NULL
      - Column is already nullable; preserves withdrawal audit trail
    - `mp_payments.user_id`: Made nullable, changed FK to SET NULL
      - Preserves payment records for financial audit after user deletion
    - `referral_commissions.referrer_id`: Made nullable, changed FK to SET NULL
      - Preserves commission history while unlinking deleted user
    - `referral_commissions.referred_user_id`: Made nullable, changed FK to SET NULL
      - Preserves commission history while unlinking deleted user
    - `withdrawal_requests.user_id`: Made nullable, changed FK to SET NULL
      - Preserves withdrawal audit trail after user deletion

  2. Important Notes
    - Financial records (mp_payments, referral_commissions, withdrawal_requests)
      are preserved with user_id set to NULL for audit purposes
    - User-owned data with no audit value (pix_keys) is cascade-deleted
    - Self-referential fields (referred_by, processed_by) are set to NULL
    - No data is lost by this migration
*/

-- 1. user_pix_keys: CASCADE (user-owned, no audit value)
ALTER TABLE user_pix_keys
  DROP CONSTRAINT IF EXISTS user_pix_keys_user_id_fkey;

ALTER TABLE user_pix_keys
  ADD CONSTRAINT user_pix_keys_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

-- 2. users.referred_by: SET NULL (already nullable)
ALTER TABLE users
  DROP CONSTRAINT IF EXISTS users_referred_by_fkey;

ALTER TABLE users
  ADD CONSTRAINT users_referred_by_fkey
  FOREIGN KEY (referred_by) REFERENCES users(id) ON DELETE SET NULL;

-- 3. withdrawal_requests.processed_by: SET NULL (already nullable)
ALTER TABLE withdrawal_requests
  DROP CONSTRAINT IF EXISTS withdrawal_requests_processed_by_fkey;

ALTER TABLE withdrawal_requests
  ADD CONSTRAINT withdrawal_requests_processed_by_fkey
  FOREIGN KEY (processed_by) REFERENCES users(id) ON DELETE SET NULL;

-- 4. mp_payments.user_id: Make nullable, then SET NULL
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'mp_payments' AND column_name = 'user_id' AND is_nullable = 'NO'
  ) THEN
    ALTER TABLE mp_payments ALTER COLUMN user_id DROP NOT NULL;
  END IF;
END $$;

ALTER TABLE mp_payments
  DROP CONSTRAINT IF EXISTS mp_payments_user_id_fkey;

ALTER TABLE mp_payments
  ADD CONSTRAINT mp_payments_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL;

-- 5. referral_commissions.referrer_id: Make nullable, then SET NULL
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'referral_commissions' AND column_name = 'referrer_id' AND is_nullable = 'NO'
  ) THEN
    ALTER TABLE referral_commissions ALTER COLUMN referrer_id DROP NOT NULL;
  END IF;
END $$;

ALTER TABLE referral_commissions
  DROP CONSTRAINT IF EXISTS referral_commissions_referrer_id_fkey;

ALTER TABLE referral_commissions
  ADD CONSTRAINT referral_commissions_referrer_id_fkey
  FOREIGN KEY (referrer_id) REFERENCES users(id) ON DELETE SET NULL;

-- 6. referral_commissions.referred_user_id: Make nullable, then SET NULL
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'referral_commissions' AND column_name = 'referred_user_id' AND is_nullable = 'NO'
  ) THEN
    ALTER TABLE referral_commissions ALTER COLUMN referred_user_id DROP NOT NULL;
  END IF;
END $$;

ALTER TABLE referral_commissions
  DROP CONSTRAINT IF EXISTS referral_commissions_referred_user_id_fkey;

ALTER TABLE referral_commissions
  ADD CONSTRAINT referral_commissions_referred_user_id_fkey
  FOREIGN KEY (referred_user_id) REFERENCES users(id) ON DELETE SET NULL;

-- 7. withdrawal_requests.user_id: Make nullable, then SET NULL
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'withdrawal_requests' AND column_name = 'user_id' AND is_nullable = 'NO'
  ) THEN
    ALTER TABLE withdrawal_requests ALTER COLUMN user_id DROP NOT NULL;
  END IF;
END $$;

ALTER TABLE withdrawal_requests
  DROP CONSTRAINT IF EXISTS withdrawal_requests_user_id_fkey;

ALTER TABLE withdrawal_requests
  ADD CONSTRAINT withdrawal_requests_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL;
