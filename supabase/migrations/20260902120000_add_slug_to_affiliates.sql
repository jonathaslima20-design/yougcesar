/*
  # Add custom slug to affiliates (replaces random code in the storefront link)

  1. Problem
    - Today an affiliate's storefront link is `https://vitrineturbo.com/{storeSlug}?aff={CODE}`,
      where CODE is a random 8-char string ('AF' + 6 random chars) the merchant
      never sees chosen — it's generated server-side in create-affiliate.
    - Product decision: the store owner (the one creating the affiliate's
      login, in AffiliateFormDialog) should be able to pick a human-readable
      slug instead, so the link reads
      `https://vitrineturbo.com/{storeSlug}/{affiliateSlug}`
      (e.g. /sneakerhouse/taina, /sneakerhouse/lucas).

  2. Approach
    - Add `affiliates.slug`, unique per store (same scoping as affiliate_code:
      UNIQUE (store_owner_id, slug) — the slug only needs to be unique within
      one store, since the URL always carries the store's own slug first).
    - `affiliate_code` is kept as-is and NOT removed: it still backs the
      existing `?aff=CODE` deep-link functions used for per-product/category
      share links (generateAffiliateProductLink/generateAffiliateCategoryLink
      in src/lib/affiliateUtils.ts) and any link an affiliate already shared
      before this migration keeps working unchanged.
    - Backfill existing rows from `name` (ASCII-folded, lowercased, hyphenated),
      de-duplicated per store by appending a short suffix from the row's own
      affiliate_code when a collision would occur — cheap and always unique
      since affiliate_code already is.
    - `resolve_affiliate_by_slug` mirrors `resolve_affiliate_by_code`
      (20260803060000): affiliates has no anon SELECT policy by design (email/
      pix_key/rates must never leak to storefront visitors), so path-based
      attribution needs the same narrow SECURITY DEFINER RPC pattern.
*/

ALTER TABLE public.affiliates ADD COLUMN IF NOT EXISTS slug text;

-- Backfill: slugify name, then de-duplicate within each store using a suffix
-- derived from the row's own (already-unique) affiliate_code.
WITH slugified AS (
  SELECT
    id,
    store_owner_id,
    lower(regexp_replace(regexp_replace(trim(name), '[^a-zA-Z0-9]+', '-', 'g'), '(^-|-$)', '', 'g')) AS base_slug,
    lower(right(affiliate_code, 4)) AS suffix
  FROM public.affiliates
  WHERE slug IS NULL
),
deduped AS (
  SELECT
    id,
    store_owner_id,
    CASE
      WHEN base_slug = '' THEN lower(suffix)
      WHEN count(*) OVER (PARTITION BY store_owner_id, base_slug) > 1
        THEN base_slug || '-' || suffix
      ELSE base_slug
    END AS final_slug
  FROM slugified
)
UPDATE public.affiliates a
SET slug = d.final_slug
FROM deduped d
WHERE a.id = d.id;

ALTER TABLE public.affiliates ALTER COLUMN slug SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS ux_affiliates_store_owner_slug
  ON public.affiliates (store_owner_id, slug);

CREATE OR REPLACE FUNCTION public.resolve_affiliate_by_slug(p_store_owner_id uuid, p_slug text)
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT a.id
  FROM public.affiliates a
  WHERE a.store_owner_id = p_store_owner_id
    AND a.slug = p_slug
    AND a.status = 'active'
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.resolve_affiliate_by_slug(uuid, text) TO anon, authenticated;
