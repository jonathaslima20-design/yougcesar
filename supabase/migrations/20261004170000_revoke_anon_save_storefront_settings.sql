-- save_storefront_settings_for_user was created with REVOKE ... FROM PUBLIC, but Supabase's
-- default privileges grant EXECUTE to anon directly, and that grant survives it.
-- Anonymous callers are already rejected inside the function, this removes the grant too.

REVOKE EXECUTE ON FUNCTION public.save_storefront_settings_for_user(uuid, jsonb) FROM anon;
