-- Visitor view tracking through a SECURITY DEFINER function.
--
-- Why: the storefront used to upsert into property_views directly as anon. PostgREST
-- turns that into INSERT ... ON CONFLICT DO NOTHING RETURNING 1, and RETURNING needs
-- SELECT visibility on the inserted row. anon has no SELECT policy on property_views
-- (only admins and product owners do), so every new view failed with 42501.
--
-- The function runs as its owner, so the insert doesn't depend on anon's policies.
-- Same unique key as the old upsert, so repeat views in one day are still ignored.
-- The "Anyone can create views" INSERT policy is left in place on purpose.

CREATE OR REPLACE FUNCTION public.register_product_view(
  p_property_id uuid,
  p_viewer_id text,
  p_listing_type text,
  p_source text,
  p_view_date date,
  p_viewed_at timestamptz
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_listing_type <> 'product' THEN
    RAISE EXCEPTION 'unsupported listing_type: %', p_listing_type USING ERRCODE = '22023';
  END IF;

  INSERT INTO property_views (property_id, viewer_id, listing_type, source, view_date, viewed_at, is_unique)
  VALUES (p_property_id, p_viewer_id, p_listing_type, p_source, p_view_date, p_viewed_at, true)
  ON CONFLICT (property_id, viewer_id, view_date, listing_type) DO NOTHING;
END;
$$;

REVOKE ALL ON FUNCTION public.register_product_view(uuid, text, text, text, date, timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.register_product_view(uuid, text, text, text, date, timestamptz) TO anon, authenticated;
