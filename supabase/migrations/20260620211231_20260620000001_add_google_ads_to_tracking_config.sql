DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'landing_tracking_config' AND column_name = 'google_ads_tag_id'
  ) THEN
    ALTER TABLE landing_tracking_config ADD COLUMN google_ads_tag_id text NOT NULL DEFAULT '';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'landing_tracking_config' AND column_name = 'google_ads_enabled'
  ) THEN
    ALTER TABLE landing_tracking_config ADD COLUMN google_ads_enabled boolean NOT NULL DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'landing_tracking_config' AND column_name = 'google_ads_cadastro_id'
  ) THEN
    ALTER TABLE landing_tracking_config ADD COLUMN google_ads_cadastro_id text NOT NULL DEFAULT '';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'landing_tracking_config' AND column_name = 'google_ads_checkout_id'
  ) THEN
    ALTER TABLE landing_tracking_config ADD COLUMN google_ads_checkout_id text NOT NULL DEFAULT '';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'landing_tracking_config' AND column_name = 'google_ads_purchase_id'
  ) THEN
    ALTER TABLE landing_tracking_config ADD COLUMN google_ads_purchase_id text NOT NULL DEFAULT '';
  END IF;
END $$;
