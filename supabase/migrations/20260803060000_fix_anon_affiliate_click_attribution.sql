/*
  # Fix: anonymous storefront visitors could not resolve affiliate attribution

  1. Problem (real bug, found while building the WhatsApp-override feature)
    - `affiliates` intentionally has NO anon/public SELECT policy (by design,
      see 20260802020000 — email, pix_key, and commission rates must never
      be exposed to storefront visitors).
    - But `src/lib/affiliateUtils.ts`'s `captureAffiliateClick()` and
      `resolveAttributedAffiliateId()` both run direct
      `.from('affiliates').select(...)` queries from the storefront, using
      whatever client the visitor currently has (almost always `anon` — a
      real visitor clicking an affiliate link is essentially never already
      logged into any of the three Supabase clients this project has).
    - Verified live against the anon key: `select id,status from affiliates`
      returns `[]` — zero rows, not an error, just RLS silently filtering
      everything out. Net effect: for a genuinely anonymous visitor (the
      overwhelming majority of real traffic), affiliate click capture never
      wrote a row, attribution was never stored, and commission was
      therefore never generated — the whole feature only appeared to work
      in prior testing because it was exercised from an already-authenticated
      browser session (the affiliate's own dashboard, or a merchant session).

  2. Fix — narrow SECURITY DEFINER RPCs instead of a broad SELECT policy
    - A permissive anon SELECT policy would fix the symptom but leak the
      entire row (email, pix_key, default_commission_percentage) to anyone
      querying the REST API directly with their own `select=` list,
      regardless of what the app's JS code asks for — RLS is row-level, not
      column-level. Two narrow functions instead, each returning only what's
      needed:
      - `resolve_affiliate_by_code(p_store_owner_id, p_code)` — returns the
        affiliate id for an active affiliate matching that store+code, or
        NULL. Replaces the lookup inside `captureAffiliateClick`.
      - `get_affiliate_attribution_status(p_affiliate_id)` — returns
        `status, attribution_window_days` for any affiliate id (both
        harmless to expose: knowing an affiliate's status/window in
        isolation, without their identity, reveals nothing sensitive).
        Replaces the lookup inside `resolveAttributedAffiliateId`.
    - Both `STABLE`, granted to `anon, authenticated`, mirroring
      `get_affiliate_contact` (20260803050000) which already uses this exact
      pattern for the same reason.
*/

CREATE OR REPLACE FUNCTION public.resolve_affiliate_by_code(p_store_owner_id uuid, p_code text)
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT a.id
  FROM public.affiliates a
  WHERE a.store_owner_id = p_store_owner_id
    AND a.affiliate_code = p_code
    AND a.status = 'active'
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.resolve_affiliate_by_code(uuid, text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_affiliate_attribution_status(p_affiliate_id uuid)
RETURNS TABLE (status text, attribution_window_days integer)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT a.status, a.attribution_window_days
  FROM public.affiliates a
  WHERE a.id = p_affiliate_id;
$$;

GRANT EXECUTE ON FUNCTION public.get_affiliate_attribution_status(uuid) TO anon, authenticated;
