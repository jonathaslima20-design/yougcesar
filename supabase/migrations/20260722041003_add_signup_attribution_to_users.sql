DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'utm_source'
  ) THEN
    ALTER TABLE users ADD COLUMN utm_source text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'utm_medium'
  ) THEN
    ALTER TABLE users ADD COLUMN utm_medium text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'utm_campaign'
  ) THEN
    ALTER TABLE users ADD COLUMN utm_campaign text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'utm_term'
  ) THEN
    ALTER TABLE users ADD COLUMN utm_term text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'utm_content'
  ) THEN
    ALTER TABLE users ADD COLUMN utm_content text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'gclid'
  ) THEN
    ALTER TABLE users ADD COLUMN gclid text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'fbclid'
  ) THEN
    ALTER TABLE users ADD COLUMN fbclid text;
  END IF;
END $$;
