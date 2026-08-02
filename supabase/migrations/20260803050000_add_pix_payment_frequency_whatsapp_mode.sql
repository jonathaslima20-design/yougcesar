/*
  # Affiliate Pix key, payment frequency, and storefront WhatsApp mode

  1. Problem
    - Store owner needs to see where to pay each affiliate (Pix key) and
      define how often affiliates are expected to be paid (weekly/biweekly/
      monthly — informational, this project has no automated payout
      scheduling; it's a declared policy, not a cron).
    - Store owner also wants the option, per affiliate, to have the
      storefront's "Falar no WhatsApp" buttons contact the AFFILIATE's own
      number instead of the store's default, whenever the visitor arrived
      through that affiliate's tracking link.

  2. Changes to `affiliates`
    - `pix_key`, `pix_key_type` (CHECK 'cpf'|'cnpj'|'email'|'phone'|'random'),
      `pix_holder_name` — set by the AFFILIATE themselves (self-service,
      updateAffiliateProfile), read-only for the store owner (existing SELECT
      RLS on `affiliates` already covers this — no new policy needed for the
      store-owner side).
    - `payment_frequency` (CHECK 'weekly'|'biweekly'|'monthly', default
      'monthly') — set by the store owner at create/edit time.
    - `whatsapp_contact_mode` (CHECK 'store_default'|'own_whatsapp', default
      'store_default') — set by the store owner at create/edit time. Reuses
      the affiliate's existing `whatsapp`/`country_code` columns as the
      "own" contact — no new phone fields needed.

  3. New RPC: `get_affiliate_contact`
    - Problem: `affiliates` has no anon/public SELECT policy at all (by
      design — see 20260802020000, "affiliate rows are never exposed to
      storefront visitors"), and a broad policy would leak email, pix_key,
      and commission rates to anyone who guesses/enumerates an affiliate id.
      An anonymous storefront visitor still needs to resolve the effective
      WhatsApp contact when `own_whatsapp` is configured, so a narrow
      SECURITY DEFINER function is the safe way to expose exactly three
      columns and nothing else.
    - Returns `whatsapp, country_code, whatsapp_contact_mode` for a given
      affiliate id, only when `status = 'active'` — inactive affiliates
      resolve to an empty result set, so callers naturally fall back to the
      store's own contact info.
    - `STABLE`, granted to `anon, authenticated`.
*/

ALTER TABLE public.affiliates
  ADD COLUMN IF NOT EXISTS pix_key text,
  ADD COLUMN IF NOT EXISTS pix_key_type text CHECK (pix_key_type IN ('cpf', 'cnpj', 'email', 'phone', 'random')),
  ADD COLUMN IF NOT EXISTS pix_holder_name text;

ALTER TABLE public.affiliates
  ADD COLUMN IF NOT EXISTS payment_frequency text NOT NULL DEFAULT 'monthly'
    CHECK (payment_frequency IN ('weekly', 'biweekly', 'monthly'));

ALTER TABLE public.affiliates
  ADD COLUMN IF NOT EXISTS whatsapp_contact_mode text NOT NULL DEFAULT 'store_default'
    CHECK (whatsapp_contact_mode IN ('store_default', 'own_whatsapp'));

CREATE OR REPLACE FUNCTION public.get_affiliate_contact(p_affiliate_id uuid)
RETURNS TABLE (whatsapp text, country_code text, whatsapp_contact_mode text)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT a.whatsapp, a.country_code, a.whatsapp_contact_mode
  FROM public.affiliates a
  WHERE a.id = p_affiliate_id AND a.status = 'active';
$$;

GRANT EXECUTE ON FUNCTION public.get_affiliate_contact(uuid) TO anon, authenticated;
