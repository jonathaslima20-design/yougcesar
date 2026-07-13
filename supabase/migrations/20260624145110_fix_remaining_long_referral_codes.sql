/*
  # Fix Remaining Long Referral Codes

  76 users still have UUID-format referral codes that were not converted by
  the original migration (20260531162127_shorten_referral_codes).

  This migration re-runs the shortening logic for any codes longer than 10 characters,
  converting them to the standard 7-character format (VT + 5 alphanumeric).
*/

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
