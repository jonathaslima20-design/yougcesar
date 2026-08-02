/*
  # Create affiliates and affiliate_commission_rules

  1. Problem
    - VitrineTurbo needs a per-store affiliate program: a merchant (store
      owner, `public.users`) can register affiliate accounts that get their
      own login and a personal catalog link (`?aff=CODE`). Affiliates are not
      merchants (no slug/products/plan) and not buyers (no purchase history
      profile) — they are a third, distinct identity, closest in shape to
      `customers` (see 20260722060000_create_customers_table.sql): a
      dedicated table, `id = auth.users.id`, sharing the same Auth project
      without conflicting with `users` or `customers`.
    - Unlike `customers` (a single platform-wide buyer identity), an affiliate
      is scoped to exactly one store for v1 (`store_owner_id NOT NULL`) — a
      confirmed product decision. Someone who wants to affiliate with two
      different stores needs two accounts (different emails), rather than a
      global identity + junction table. This keeps RLS and the login/session
      model simple, matching the smallest requirement actually asked for.

  2. New Tables
    - `affiliates`
      - `id` (uuid, PK, references auth.users) - separate identity, same Auth
        project as merchants/customers, no conflict
      - `store_owner_id` (uuid, FK -> users.id, ON DELETE CASCADE) - which
        store this affiliate belongs to; deleting the store owner deletes
        their affiliates too (their catalog/link no longer means anything)
      - `email`, `name`, `whatsapp`, `country_code`
      - `affiliate_code` (text) - short code appended to the store's catalog
        link as `?aff=CODE`, e.g. 'AF' + 6 random chars, same unambiguous
        alphabet as `generateReferralCode` (src/lib/referralUtils.ts)
      - `default_commission_percentage` (numeric 0-100) - mandatory general
        rate, used whenever no category-specific rule matches
      - `status` ('active' | 'inactive') - merchant can deactivate without
        deleting, preserving commission history
      - `created_at` / `updated_at`
      - `UNIQUE (store_owner_id, affiliate_code)`: code only needs to be
        unique within a store, not globally, since attribution is always
        resolved together with the store's slug/domain

    - `affiliate_commission_rules`
      - `id` (uuid, PK)
      - `affiliate_id` (uuid, FK -> affiliates.id, ON DELETE CASCADE)
      - `category_name` (text, NULL = the general/default rule)
      - `commission_percentage` (numeric 0-100)
      - Products in this project have no `category_id` FK — `Product.category`
        is a `text[]` of category names (see `user_product_categories`,
        `category_display_settings`, and the coupon `coupon_categories`
        junction, which all match by name for the same reason). Category
        overrides here follow the same name-matching convention rather than
        inventing a new FK-based model.
      - `UNIQUE (affiliate_id, category_name)` covers named categories; a
        separate partial unique index (below) additionally guarantees at most
        one general (NULL category) rule per affiliate, since Postgres
        treats each NULL as distinct under a plain UNIQUE constraint.

  3. Security
    - `public.is_affiliate()`: SECURITY DEFINER STABLE helper mirroring
      `is_admin()`/`is_partner()` (20260716180000, 20260723010000) — avoids
      RLS self-recursion for any future policy that needs to know "is the
      caller a logged-in affiliate".
    - `affiliates`: affiliate can SELECT/UPDATE own row (auth.uid() = id);
      store owner can SELECT/INSERT/UPDATE/DELETE affiliates where
      store_owner_id = auth.uid(); admins can do everything. No anon/public
      SELECT policy — affiliate rows are never exposed to storefront visitors
      (the public-facing catalog link only carries the opaque code, resolved
      server-side).
    - `affiliate_commission_rules`: scoped the same way, via a join back to
      `affiliates.store_owner_id` / `affiliates.id = auth.uid()`.

  4. Notes
    - Actual account creation (setting the Auth password) happens through a
      new `create-affiliate` edge function using the service role key,
      mirroring `create-user` — this migration only creates the schema and
      RLS a store owner would need for direct reads/updates from the
      dashboard (e.g. editing a commission rate, deactivating an affiliate).
*/

CREATE TABLE IF NOT EXISTS public.affiliates (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  store_owner_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  name text NOT NULL,
  whatsapp text,
  country_code text NOT NULL DEFAULT '55',
  affiliate_code text NOT NULL,
  default_commission_percentage numeric NOT NULL CHECK (default_commission_percentage >= 0 AND default_commission_percentage <= 100),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (store_owner_id, affiliate_code)
);

CREATE INDEX IF NOT EXISTS idx_affiliates_store_owner_id ON public.affiliates (store_owner_id);
CREATE INDEX IF NOT EXISTS idx_affiliates_status ON public.affiliates (status);

CREATE TABLE IF NOT EXISTS public.affiliate_commission_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  affiliate_id uuid NOT NULL REFERENCES public.affiliates(id) ON DELETE CASCADE,
  category_name text,
  commission_percentage numeric NOT NULL CHECK (commission_percentage >= 0 AND commission_percentage <= 100),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (affiliate_id, category_name)
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_affiliate_commission_rules_general
  ON public.affiliate_commission_rules (affiliate_id) WHERE category_name IS NULL;

CREATE INDEX IF NOT EXISTS idx_affiliate_commission_rules_affiliate_id
  ON public.affiliate_commission_rules (affiliate_id);

ALTER TABLE public.affiliates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.affiliate_commission_rules ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_affiliate()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.affiliates WHERE id = auth.uid() AND status = 'active'
  );
$$;

-- affiliates policies

DROP POLICY IF EXISTS "Affiliates can view own profile" ON public.affiliates;
CREATE POLICY "Affiliates can view own profile"
  ON public.affiliates FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

-- Row-level only: RLS cannot restrict which columns an affiliate changes on
-- their own row (same caveat as the Partners policies in
-- 20260723010000_create_partners_role.sql). The affiliate dashboard UI must
-- only ever send safe self-service fields (name, whatsapp) — never
-- store_owner_id, affiliate_code, default_commission_percentage or status,
-- which are store-owner-only concerns.
DROP POLICY IF EXISTS "Affiliates can update own profile" ON public.affiliates;
CREATE POLICY "Affiliates can update own profile"
  ON public.affiliates FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Store owners can view own affiliates" ON public.affiliates;
CREATE POLICY "Store owners can view own affiliates"
  ON public.affiliates FOR SELECT
  TO authenticated
  USING (store_owner_id = auth.uid());

DROP POLICY IF EXISTS "Store owners can insert own affiliates" ON public.affiliates;
CREATE POLICY "Store owners can insert own affiliates"
  ON public.affiliates FOR INSERT
  TO authenticated
  WITH CHECK (store_owner_id = auth.uid());

DROP POLICY IF EXISTS "Store owners can update own affiliates" ON public.affiliates;
CREATE POLICY "Store owners can update own affiliates"
  ON public.affiliates FOR UPDATE
  TO authenticated
  USING (store_owner_id = auth.uid())
  WITH CHECK (store_owner_id = auth.uid());

DROP POLICY IF EXISTS "Store owners can delete own affiliates" ON public.affiliates;
CREATE POLICY "Store owners can delete own affiliates"
  ON public.affiliates FOR DELETE
  TO authenticated
  USING (store_owner_id = auth.uid());

DROP POLICY IF EXISTS "Admins can manage all affiliates" ON public.affiliates;
CREATE POLICY "Admins can manage all affiliates"
  ON public.affiliates FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- affiliate_commission_rules policies

DROP POLICY IF EXISTS "Affiliates can view own commission rules" ON public.affiliate_commission_rules;
CREATE POLICY "Affiliates can view own commission rules"
  ON public.affiliate_commission_rules FOR SELECT
  TO authenticated
  USING (affiliate_id = auth.uid());

DROP POLICY IF EXISTS "Store owners can manage own affiliates commission rules" ON public.affiliate_commission_rules;
CREATE POLICY "Store owners can manage own affiliates commission rules"
  ON public.affiliate_commission_rules FOR ALL
  TO authenticated
  USING (EXISTS (SELECT 1 FROM public.affiliates a WHERE a.id = affiliate_commission_rules.affiliate_id AND a.store_owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.affiliates a WHERE a.id = affiliate_commission_rules.affiliate_id AND a.store_owner_id = auth.uid()));

DROP POLICY IF EXISTS "Admins can manage all affiliate commission rules" ON public.affiliate_commission_rules;
CREATE POLICY "Admins can manage all affiliate commission rules"
  ON public.affiliate_commission_rules FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- updated_at triggers

CREATE OR REPLACE FUNCTION public.update_affiliates_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_affiliates_updated_at ON public.affiliates;
CREATE TRIGGER trigger_affiliates_updated_at
  BEFORE UPDATE ON public.affiliates
  FOR EACH ROW
  EXECUTE FUNCTION public.update_affiliates_updated_at();

DROP TRIGGER IF EXISTS trigger_affiliate_commission_rules_updated_at ON public.affiliate_commission_rules;
CREATE TRIGGER trigger_affiliate_commission_rules_updated_at
  BEFORE UPDATE ON public.affiliate_commission_rules
  FOR EACH ROW
  EXECUTE FUNCTION public.update_affiliates_updated_at();
