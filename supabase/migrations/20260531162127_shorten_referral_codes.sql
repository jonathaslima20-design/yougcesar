/*
  # Shorten Referral Codes

  1. Changes
    - Change referral_code column from uuid to text
    - Replace long UUID-style referral codes with short 7-character codes (e.g., VT3K8MX)
    - Format: "VT" prefix + 5 random alphanumeric uppercase characters
    - Update all existing users' referral_code values
    - Update referral_clicks table to match the new codes

  2. Important Notes
    - The UNIQUE constraint is dropped then re-added after type change
    - Uses a retry loop to handle rare collisions
    - All existing codes are migrated in one pass
*/

-- 1. Drop unique constraint and index to allow type change
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_referral_code_key;
DROP INDEX IF EXISTS idx_users_referral_code;

-- 2. Change column type from uuid to text
ALTER TABLE users ALTER COLUMN referral_code TYPE text USING referral_code::text;

-- 3. Re-add unique constraint and index
ALTER TABLE users ADD CONSTRAINT users_referral_code_key UNIQUE (referral_code);
CREATE INDEX IF NOT EXISTS idx_users_referral_code ON users(referral_code);

-- 4. Helper function to generate a short referral code
CREATE OR REPLACE FUNCTION generate_short_referral_code()
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  chars text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  result text := 'VT';
  i int;
BEGIN
  FOR i IN 1..5 LOOP
    result := result || substr(chars, floor(random() * length(chars) + 1)::int, 1);
  END LOOP;
  RETURN result;
END;
$$;

-- 5. Migrate all existing referral codes to short format
DO $$
DECLARE
  r record;
  new_code text;
  attempts int;
  max_attempts int := 20;
BEGIN
  FOR r IN SELECT id, referral_code FROM users WHERE referral_code IS NOT NULL AND length(referral_code) > 10
  LOOP
    attempts := 0;
    LOOP
      new_code := generate_short_referral_code();
      attempts := attempts + 1;

      BEGIN
        UPDATE users SET referral_code = new_code WHERE id = r.id;
        UPDATE referral_clicks SET referral_code = new_code WHERE referral_code = r.referral_code;
        EXIT;
      EXCEPTION WHEN unique_violation THEN
        IF attempts >= max_attempts THEN
          RAISE EXCEPTION 'Could not generate unique code for user % after % attempts', r.id, max_attempts;
        END IF;
      END;
    END LOOP;
  END LOOP;
END $$;
