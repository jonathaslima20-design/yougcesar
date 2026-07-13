ALTER TABLE landing_tracking_config
  ADD COLUMN IF NOT EXISTS gtm_container_id text;
