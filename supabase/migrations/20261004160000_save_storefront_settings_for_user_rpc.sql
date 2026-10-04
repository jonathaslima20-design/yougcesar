-- Save a store's storefront settings on behalf of its owner, or of an admin.
--
-- Why: syncUserCategoriesWithStorefrontSettings (src/lib/utils.ts) writes
-- user_storefront_settings for a target user. The admin tools CloneUserDialog and
-- SimpleCopyProductsDialog call it for a user other than the one logged in. The RLS
-- policy only lets a user write their own row (auth.uid() = user_id), so those writes
-- failed with 42501 and the cloned store's category settings were never saved.
--
-- The function allows the call when the caller owns the row, or when the caller has
-- the admin/parceiro role (the same roles that the leads and property_views policies use).
-- Direct writes to the table stay blocked for everyone else.

CREATE OR REPLACE FUNCTION public.save_storefront_settings_for_user(
  p_user_id uuid,
  p_settings jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not authenticated' USING ERRCODE = '42501';
  END IF;

  IF auth.uid() <> p_user_id AND NOT EXISTS (
    SELECT 1 FROM users
    WHERE users.id = auth.uid() AND users.role IN ('admin', 'parceiro')
  ) THEN
    RAISE EXCEPTION 'not allowed to save storefront settings for this user' USING ERRCODE = '42501';
  END IF;

  INSERT INTO user_storefront_settings (user_id, settings)
  VALUES (p_user_id, p_settings)
  ON CONFLICT (user_id) DO UPDATE SET settings = EXCLUDED.settings;
END;
$$;

REVOKE ALL ON FUNCTION public.save_storefront_settings_for_user(uuid, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.save_storefront_settings_for_user(uuid, jsonb) TO authenticated;
