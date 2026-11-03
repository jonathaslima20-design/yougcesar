-- VitrineTurbo Partners v2: as 5 migrações em ordem, numa única transação.
-- Cole tudo no SQL Editor do Supabase e clique em Run. Se qualquer parte
-- falhar, nada é aplicado (ROLLBACK automático).

BEGIN;


-- =====================================================================
-- 20261103100000_protect_users_sensitive_columns.sql
-- =====================================================================

/*
  # Protect sensitive columns on public.users from non-admin writes

  1. Problem
    - RLS is row-level only. Three policies let a non-admin write a users row:
        * "Users can insert own profile"   (INSERT, auth.uid() = id)
        * "Users can update own profile"   (UPDATE, auth.uid() = id)
        * "Partners can update managed users" (UPDATE, managed_by_partner_id = auth.uid())
      None of them restrict WHICH columns change, so through the REST API:
        * a partner could set a managed client's plan_status = 'active' (free
          paid plan), change its role, or move it to another partner;
        * any user could do the same to their own row (role = 'admin',
          plan_status = 'active', payments_test_override = true, ...);
        * a signup could INSERT its own row already as admin / active.
      20260723010000_create_partners_role.sql explicitly left this to the UI.

  2. Changes
    - BEFORE INSERT OR UPDATE trigger `a_protect_users_sensitive_columns`
      (the "a_" prefix makes it fire before trigger_set_plan_status_changed_at,
      so it sees the caller's own values, not the derived timestamp).
    - Bypassed entirely for service_role, SECURITY DEFINER functions and
      migrations (current_user is not 'authenticated'/'anon') and for admins.
      The trigger function itself is SECURITY INVOKER on purpose: as DEFINER,
      current_user would always be its owner and the check would never fire.
    - For everyone else:
        * INSERT (self-signup): role must be 'corretor'; plan_status only
          'free'/'inactive', or 'trial' with a referrer and <= 16-day trial;
          not blocked; admin-gated flags off; managed_by_partner_id only when
          it equals referred_by and that referrer is a partner.
        * UPDATE: admin/billing columns are immutable. Allowed exceptions,
          all matching existing client flows in src/lib/auth/simpleAuth.ts and
          src/pages/dashboard/CheckoutPage.tsx:
            - self may downgrade plan_status to 'expired'/'trial_expired';
            - self may sync subscription_end_date to their real active
              subscription's next_payment_date;
            - self may set referred_by once (was NULL), never to themselves;
            - a managing partner may block a client and lift only blocks
              they placed (tracked in the new users.blocked_by); self may not.
*/

-- Who placed the current block: NULL = admin/system, a partner id = that
-- partner (who is then the only non-admin allowed to lift it).
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS blocked_by uuid REFERENCES public.users(id) ON DELETE SET NULL;

-- The partner account whose clients the caller manages. Just auth.uid() for
-- now; the Partners v2 migration makes it team-aware (agency staff act on
-- behalf of the owning partner).
CREATE OR REPLACE FUNCTION public.partner_scope_id()
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.protect_users_sensitive_columns()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  caller uuid := auth.uid();
  is_self boolean;
  referrer_role text;
  active_sub_end date;
  new_j jsonb;
  old_j jsonb;
  col text;
BEGIN
  -- Inside SECURITY DEFINER functions, service_role requests and migrations
  -- the effective role is not one of the PostgREST client roles.
  IF current_user NOT IN ('authenticated', 'anon') THEN
    RETURN NEW;
  END IF;

  IF public.is_admin() THEN
    IF TG_OP = 'UPDATE' AND NEW.is_blocked IS DISTINCT FROM OLD.is_blocked THEN
      NEW.blocked_by := NULL;
    END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF COALESCE(NEW.role, 'corretor') <> 'corretor' THEN
      RAISE EXCEPTION 'Not allowed to set role on signup' USING ERRCODE = '42501';
    END IF;

    new_j := to_jsonb(NEW);
    IF COALESCE(NEW.is_blocked, false)
       OR COALESCE((new_j ->> 'payments_test_override')::boolean, false)
       OR COALESCE((new_j ->> 'shipping_test_override')::boolean, false)
       OR COALESCE((new_j ->> 'insurance_enabled')::boolean, false)
       OR COALESCE((new_j ->> 'affiliate_program_enabled')::boolean, false)
       OR COALESCE((new_j ->> 'cashback_enabled')::boolean, false)
       OR COALESCE((new_j ->> 'max_images_per_product')::integer, 10) > 10 THEN
      RAISE EXCEPTION 'Not allowed to set admin-managed fields on signup' USING ERRCODE = '42501';
    END IF;

    IF NEW.referred_by IS NOT NULL AND NEW.referred_by = NEW.id THEN
      RAISE EXCEPTION 'Self-referral is not allowed' USING ERRCODE = '42501';
    END IF;

    IF NEW.referred_by IS NOT NULL THEN
      SELECT role INTO referrer_role FROM public.users WHERE id = NEW.referred_by;
    END IF;

    IF NEW.managed_by_partner_id IS NOT NULL
       AND (NEW.managed_by_partner_id IS DISTINCT FROM NEW.referred_by OR referrer_role IS DISTINCT FROM 'partner') THEN
      RAISE EXCEPTION 'Invalid managing partner on signup' USING ERRCODE = '42501';
    END IF;

    IF NEW.plan_status = 'trial' THEN
      IF NEW.referred_by IS NULL OR referrer_role IS NULL
         OR NEW.trial_ends_at IS NULL OR NEW.trial_ends_at > now() + interval '16 days' THEN
        RAISE EXCEPTION 'Trial is only granted through a valid referral link' USING ERRCODE = '42501';
      END IF;
    ELSIF COALESCE(NEW.plan_status, 'free') NOT IN ('free', 'inactive') THEN
      RAISE EXCEPTION 'Not allowed to set plan_status on signup' USING ERRCODE = '42501';
    END IF;

    RETURN NEW;
  END IF;

  -- UPDATE
  is_self := caller IS NOT NULL AND caller = OLD.id;

  -- Compared through jsonb so a column that only exists in some environments
  -- (several came from the pre-migrations Bolt schema) reads as NULL on both
  -- sides instead of breaking every UPDATE on users.
  new_j := to_jsonb(NEW);
  old_j := to_jsonb(OLD);
  FOREACH col IN ARRAY ARRAY[
    'role', 'managed_by_partner_id', 'created_by', 'trial_ends_at', 'next_payment_date',
    'billing_cycle', 'subscription_plan_name', 'plan_status_changed_at',
    'payments_test_override', 'shipping_test_override', 'insurance_enabled',
    'affiliate_program_enabled', 'cashback_enabled', 'max_images_per_product', 'listing_limit'
  ] LOOP
    IF new_j -> col IS DISTINCT FROM old_j -> col THEN
      RAISE EXCEPTION 'Not allowed to change admin-managed fields (%)', col USING ERRCODE = '42501';
    END IF;
  END LOOP;

  IF NEW.plan_status IS DISTINCT FROM OLD.plan_status
     AND NOT (is_self AND NEW.plan_status IN ('expired', 'trial_expired')) THEN
    RAISE EXCEPTION 'Not allowed to change plan_status' USING ERRCODE = '42501';
  END IF;

  IF NEW.subscription_end_date IS DISTINCT FROM OLD.subscription_end_date THEN
    IF NOT is_self THEN
      RAISE EXCEPTION 'Not allowed to change subscription_end_date' USING ERRCODE = '42501';
    END IF;
    SELECT next_payment_date::date INTO active_sub_end
    FROM public.subscriptions
    WHERE user_id = OLD.id AND status = 'active'
    ORDER BY next_payment_date DESC
    LIMIT 1;
    IF active_sub_end IS NULL OR NEW.subscription_end_date::date IS DISTINCT FROM active_sub_end THEN
      RAISE EXCEPTION 'subscription_end_date must match the active subscription' USING ERRCODE = '42501';
    END IF;
  END IF;

  IF NEW.referred_by IS DISTINCT FROM OLD.referred_by THEN
    IF NOT is_self OR OLD.referred_by IS NOT NULL OR NEW.referred_by IS NULL OR NEW.referred_by = OLD.id THEN
      RAISE EXCEPTION 'Not allowed to change referred_by' USING ERRCODE = '42501';
    END IF;
  END IF;

  IF NEW.referral_code IS DISTINCT FROM OLD.referral_code AND NOT is_self THEN
    RAISE EXCEPTION 'Not allowed to change referral_code' USING ERRCODE = '42501';
  END IF;

  IF NEW.blocked_by IS DISTINCT FROM OLD.blocked_by AND NEW.is_blocked IS NOT DISTINCT FROM OLD.is_blocked THEN
    RAISE EXCEPTION 'Not allowed to change blocked_by' USING ERRCODE = '42501';
  END IF;

  IF NEW.is_blocked IS DISTINCT FROM OLD.is_blocked THEN
    IF is_self OR NOT public.is_partner() OR OLD.managed_by_partner_id IS DISTINCT FROM public.partner_scope_id() THEN
      RAISE EXCEPTION 'Not allowed to change is_blocked' USING ERRCODE = '42501';
    END IF;
    -- A partner can only lift a block they placed themselves, never one set
    -- by an admin (e.g. "pendência financeira").
    IF NOT NEW.is_blocked AND OLD.blocked_by IS DISTINCT FROM public.partner_scope_id() THEN
      RAISE EXCEPTION 'This account was blocked by VitrineTurbo support' USING ERRCODE = '42501';
    END IF;
    NEW.blocked_by := CASE WHEN NEW.is_blocked THEN public.partner_scope_id() ELSE NULL END;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS a_protect_users_sensitive_columns ON public.users;
CREATE TRIGGER a_protect_users_sensitive_columns
  BEFORE INSERT OR UPDATE ON public.users
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_users_sensitive_columns();


-- =====================================================================
-- 20261103110000_partners_v2_core.sql
-- =====================================================================

/*
  # VitrineTurbo Partners v2 — core schema and commission engine

  Implements Fase 0–3 of docs/PLANO_PARCEIROS.md on the data side.

  1. Problems fixed
    - Commissions were withdrawable the instant they were created ('pending'
      counted as available) and nothing ever reversed them on refund or
      chargeback. Now: 'holding' for partner_settings.holding_days, then
      'available'; mp_payments refunds/chargebacks reverse or claw back.
    - Annual plans paid 30–50% of the whole year at once. Now split into
      monthly installments (partner_settings.annual_installments).
    - Users who signed up through a partner link generated BOTH a
      partner_commissions row and a referral_commissions row (the corretor
      "indique e ganhe" trigger also reads users.referred_by).
    - Withdrawals were not tied to the commissions they paid, so the same
      balance could be requested repeatedly. Now partner_request_withdrawal()
      locks the available rows ('requested') and admin payment marks them paid.
    - Tiers counted users, not revenue. Replaced by partner_levels (MRR or
      active clients) with downgrade grace, founders floor and overrides.

  2. New tables
    partner_profiles, partner_levels, partner_applications, partner_links,
    partner_clicks, partner_attributions, partner_leads, partner_campaigns,
    partner_team_members, partner_store_access, partner_invites,
    partner_audit_log, partner_fraud_flags.

  3. Notes
    - users.managed_by_partner_id stays the authoritative "who manages this
      client" pointer (RLS and the commission trigger key off it);
      partner_attributions records how/when it was set.
    - Agency staff are users with role 'partner' listed in
      partner_team_members; partner_scope_id() resolves them to the owning
      partner, so every partner-facing RLS policy uses it instead of auth.uid().
    - All write paths that need to bypass RLS are SECURITY DEFINER functions
      with explicit caller checks; anon/authenticated EXECUTE is granted only
      where noted.
*/

-- ---------------------------------------------------------------------------
-- Settings
-- ---------------------------------------------------------------------------
ALTER TABLE public.partner_settings
  ADD COLUMN IF NOT EXISTS holding_days integer NOT NULL DEFAULT 30,
  ADD COLUMN IF NOT EXISTS annual_installments boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS first_sale_bonus_amount numeric NOT NULL DEFAULT 50,
  ADD COLUMN IF NOT EXISTS first_sale_bonus_days integer NOT NULL DEFAULT 30,
  ADD COLUMN IF NOT EXISTS recruit_override_percentage numeric NOT NULL DEFAULT 5,
  ADD COLUMN IF NOT EXISTS recruit_override_months integer NOT NULL DEFAULT 12,
  ADD COLUMN IF NOT EXISTS inactivity_months integer NOT NULL DEFAULT 12,
  ADD COLUMN IF NOT EXISTS level_downgrade_grace_months integer NOT NULL DEFAULT 2,
  ADD COLUMN IF NOT EXISTS attribution_window_days integer NOT NULL DEFAULT 90,
  ADD COLUMN IF NOT EXISTS lead_protection_days integer NOT NULL DEFAULT 60,
  ADD COLUMN IF NOT EXISTS store_trial_days integer NOT NULL DEFAULT 15,
  ADD COLUMN IF NOT EXISTS terms_version text NOT NULL DEFAULT '2026-11-03',
  ADD COLUMN IF NOT EXISTS founder_slots integer NOT NULL DEFAULT 100,
  ADD COLUMN IF NOT EXISTS founder_bonus_pp numeric NOT NULL DEFAULT 5,
  ADD COLUMN IF NOT EXISTS founder_min_percentage numeric NOT NULL DEFAULT 30,
  ADD COLUMN IF NOT EXISTS auto_approve_applications boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS payout_day integer NOT NULL DEFAULT 10,
  ADD COLUMN IF NOT EXISTS max_pf_monthly_payout numeric NOT NULL DEFAULT 2000,
  ADD COLUMN IF NOT EXISTS reversal_freeze_ratio numeric NOT NULL DEFAULT 0.3,
  ADD COLUMN IF NOT EXISTS demo_store_url text,
  ADD COLUMN IF NOT EXISTS community_url text,
  ADD COLUMN IF NOT EXISTS support_whatsapp text,
  ADD COLUMN IF NOT EXISTS webinar_url text,
  ADD COLUMN IF NOT EXISTS webinar_at timestamptz;

-- ---------------------------------------------------------------------------
-- Levels (replaces partner_commission_tiers, which is kept but no longer read)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.partner_levels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  sort_order integer NOT NULL,
  min_mrr numeric NOT NULL DEFAULT 0,
  min_active_clients integer NOT NULL DEFAULT 0,
  commission_percentage numeric NOT NULL CHECK (commission_percentage >= 0 AND commission_percentage <= 100),
  benefits text[] NOT NULL DEFAULT '{}',
  color text,
  requires_certification boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.partner_levels (slug, name, sort_order, min_mrr, min_active_clients, commission_percentage, benefits, color, requires_certification)
VALUES
  ('parceiro', 'Parceiro', 1, 0, 0, 25,
    ARRAY['Painel completo de parceiro', 'Links e campanhas rastreáveis', 'Materiais de divulgação', 'Academia VitrineTurbo', 'Loja demo para apresentar'], '#64748b', false),
  ('prata', 'Prata', 2, 500, 5, 30,
    ARRAY['Tudo do nível Parceiro', 'Selo Parceiro Prata', 'Listagem no diretório de especialistas', 'Suporte prioritário'], '#94a3b8', false),
  ('ouro', 'Ouro', 3, 2000, 15, 35,
    ARRAY['Tudo do nível Prata', 'Gerente de conta', 'Leads indicados pelo VitrineTurbo', 'Acesso antecipado a recursos'], '#d4a017', true),
  ('diamante', 'Diamante', 4, 6000, 40, 40,
    ARRAY['Tudo do nível Ouro', 'Co-marketing e case publicado', 'Condições especiais de revenda', 'Canal direto com o time de produto'], '#38bdf8', true)
ON CONFLICT (slug) DO NOTHING;

ALTER TABLE public.partner_levels ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can view active levels" ON public.partner_levels;
CREATE POLICY "Anyone can view active levels" ON public.partner_levels FOR SELECT TO anon, authenticated USING (is_active OR public.is_admin());
DROP POLICY IF EXISTS "Admins manage levels" ON public.partner_levels;
CREATE POLICY "Admins manage levels" ON public.partner_levels FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- ---------------------------------------------------------------------------
-- Profiles
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.partner_profiles (
  user_id uuid PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  partner_type text NOT NULL DEFAULT 'freelancer' CHECK (partner_type IN ('freelancer', 'agency', 'consultant', 'creator')),
  status text NOT NULL DEFAULT 'approved' CHECK (status IN ('approved', 'suspended', 'terminated')),
  company_name text,
  document text,
  document_type text CHECK (document_type IN ('cpf', 'cnpj')),
  website text,
  instagram text,
  city text,
  state text,
  niches text[] NOT NULL DEFAULT '{}',
  services text[] NOT NULL DEFAULT '{}',
  bio text,
  logo_url text,
  public_slug text UNIQUE,
  is_public boolean NOT NULL DEFAULT false,
  level_id uuid REFERENCES public.partner_levels(id),
  level_below_since timestamptz,
  is_founder boolean NOT NULL DEFAULT false,
  founder_bonus_pp numeric NOT NULL DEFAULT 0,
  min_commission_percentage numeric,
  commission_override numeric CHECK (commission_override IS NULL OR (commission_override >= 0 AND commission_override <= 100)),
  recruited_by_partner_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  payouts_frozen boolean NOT NULL DEFAULT false,
  terms_version text,
  terms_accepted_at timestamptz,
  onboarding jsonb NOT NULL DEFAULT '{}'::jsonb,
  certified_at timestamptz,
  approved_at timestamptz NOT NULL DEFAULT now(),
  last_sale_at timestamptz,
  admin_notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_partner_profiles_level ON public.partner_profiles(level_id);
CREATE INDEX IF NOT EXISTS idx_partner_profiles_recruited_by ON public.partner_profiles(recruited_by_partner_id);

-- ---------------------------------------------------------------------------
-- Agency team + scope
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.partner_team_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  user_id uuid NOT NULL UNIQUE REFERENCES public.users(id) ON DELETE CASCADE,
  team_role text NOT NULL DEFAULT 'operator' CHECK (team_role IN ('manager', 'operator')),
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (partner_id <> user_id)
);
CREATE INDEX IF NOT EXISTS idx_partner_team_members_partner ON public.partner_team_members(partner_id);

CREATE OR REPLACE FUNCTION public.partner_scope_id()
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT COALESCE(
    (SELECT partner_id FROM public.partner_team_members WHERE user_id = auth.uid()),
    auth.uid()
  );
$$;

-- 'owner' | 'manager' | 'operator' | NULL (not a partner)
CREATE OR REPLACE FUNCTION public.partner_team_role()
RETURNS text
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT CASE
    WHEN NOT public.is_partner() THEN NULL
    ELSE COALESCE((SELECT team_role FROM public.partner_team_members WHERE user_id = auth.uid()), 'owner')
  END;
$$;

ALTER TABLE public.partner_team_members ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Team visible to its partner" ON public.partner_team_members;
CREATE POLICY "Team visible to its partner" ON public.partner_team_members FOR SELECT TO authenticated
  USING (partner_id = public.partner_scope_id() OR public.is_admin());
DROP POLICY IF EXISTS "Owner removes team members" ON public.partner_team_members;
CREATE POLICY "Owner removes team members" ON public.partner_team_members FOR DELETE TO authenticated
  USING ((partner_id = auth.uid() AND public.partner_team_role() = 'owner') OR public.is_admin());
DROP POLICY IF EXISTS "Owner updates team roles" ON public.partner_team_members;
CREATE POLICY "Owner updates team roles" ON public.partner_team_members FOR UPDATE TO authenticated
  USING ((partner_id = auth.uid() AND public.partner_team_role() = 'owner') OR public.is_admin())
  WITH CHECK ((partner_id = auth.uid() AND public.partner_team_role() = 'owner') OR public.is_admin());

-- Partner-facing users policies become team-aware.
DROP POLICY IF EXISTS "Partners can view managed users" ON public.users;
CREATE POLICY "Partners can view managed users"
  ON public.users FOR SELECT TO authenticated
  USING (public.is_partner() AND managed_by_partner_id = public.partner_scope_id());

DROP POLICY IF EXISTS "Partners can update managed users" ON public.users;
CREATE POLICY "Partners can update managed users"
  ON public.users FOR UPDATE TO authenticated
  USING (public.is_partner() AND managed_by_partner_id = public.partner_scope_id())
  WITH CHECK (public.is_partner() AND managed_by_partner_id = public.partner_scope_id());

-- Team members can see their own partner's (and teammates') basic user row.
DROP POLICY IF EXISTS "Partner team can view each other" ON public.users;
CREATE POLICY "Partner team can view each other"
  ON public.users FOR SELECT TO authenticated
  USING (
    public.is_partner() AND (
      id = public.partner_scope_id()
      OR id IN (SELECT user_id FROM public.partner_team_members WHERE partner_id = public.partner_scope_id())
    )
  );

DROP POLICY IF EXISTS "Partners can view managed users subscriptions" ON public.subscriptions;
CREATE POLICY "Partners can view managed users subscriptions"
  ON public.subscriptions FOR SELECT TO authenticated
  USING (
    public.is_partner()
    AND user_id IN (SELECT id FROM public.users WHERE managed_by_partner_id = public.partner_scope_id())
  );

-- Profiles RLS: own profile (owner can edit the public/presentation fields
-- only — commercial fields are guarded by the trigger below).
ALTER TABLE public.partner_profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Partner views own profile" ON public.partner_profiles;
CREATE POLICY "Partner views own profile" ON public.partner_profiles FOR SELECT TO authenticated
  USING (user_id = public.partner_scope_id() OR public.is_admin());
DROP POLICY IF EXISTS "Partner owner updates own profile" ON public.partner_profiles;
CREATE POLICY "Partner owner updates own profile" ON public.partner_profiles FOR UPDATE TO authenticated
  USING ((user_id = auth.uid() AND public.partner_team_role() = 'owner') OR public.is_admin())
  WITH CHECK ((user_id = auth.uid() AND public.partner_team_role() = 'owner') OR public.is_admin());
DROP POLICY IF EXISTS "Admins insert profiles" ON public.partner_profiles;
CREATE POLICY "Admins insert profiles" ON public.partner_profiles FOR INSERT TO authenticated WITH CHECK (public.is_admin());

CREATE OR REPLACE FUNCTION public.protect_partner_profile_columns()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  -- The document type always follows the document itself (CPF = 11 digits,
  -- CNPJ = 14), so the monthly cap for individuals can't be dodged.
  NEW.document := NULLIF(regexp_replace(COALESCE(NEW.document, ''), '\D', '', 'g'), '');
  NEW.document_type := CASE length(NEW.document) WHEN 11 THEN 'cpf' WHEN 14 THEN 'cnpj' END;
  IF NEW.document IS NOT NULL AND NEW.document_type IS NULL THEN
    RAISE EXCEPTION 'CPF ou CNPJ inválido' USING ERRCODE = '22023';
  END IF;

  IF current_user NOT IN ('authenticated', 'anon') OR public.is_admin() THEN
    NEW.updated_at := now();
    RETURN NEW;
  END IF;
  IF NEW.status IS DISTINCT FROM OLD.status
     OR NEW.level_id IS DISTINCT FROM OLD.level_id
     OR NEW.level_below_since IS DISTINCT FROM OLD.level_below_since
     OR NEW.is_founder IS DISTINCT FROM OLD.is_founder
     OR NEW.founder_bonus_pp IS DISTINCT FROM OLD.founder_bonus_pp
     OR NEW.min_commission_percentage IS DISTINCT FROM OLD.min_commission_percentage
     OR NEW.commission_override IS DISTINCT FROM OLD.commission_override
     OR NEW.recruited_by_partner_id IS DISTINCT FROM OLD.recruited_by_partner_id
     OR NEW.payouts_frozen IS DISTINCT FROM OLD.payouts_frozen
     OR NEW.certified_at IS DISTINCT FROM OLD.certified_at
     OR NEW.approved_at IS DISTINCT FROM OLD.approved_at
     OR NEW.last_sale_at IS DISTINCT FROM OLD.last_sale_at
     OR NEW.admin_notes IS DISTINCT FROM OLD.admin_notes
     OR NEW.document IS DISTINCT FROM OLD.document AND OLD.document IS NOT NULL THEN
    RAISE EXCEPTION 'Not allowed to change program-managed partner fields' USING ERRCODE = '42501';
  END IF;
  IF NEW.public_slug IS DISTINCT FROM OLD.public_slug
     AND (NEW.public_slug IS NULL OR NEW.public_slug !~ '^[a-z0-9](?:[a-z0-9-]{1,38}[a-z0-9])$') THEN
    RAISE EXCEPTION 'Invalid public link name' USING ERRCODE = '22023';
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS a_protect_partner_profile_columns ON public.partner_profiles;
CREATE TRIGGER a_protect_partner_profile_columns
  BEFORE INSERT OR UPDATE ON public.partner_profiles
  FOR EACH ROW EXECUTE FUNCTION public.protect_partner_profile_columns();

-- Backfill: every existing partner becomes an approved founder with the
-- current 30% as a floor (docs/PLANO_PARCEIROS.md §5.1-5).
INSERT INTO public.partner_profiles (user_id, status, public_slug, is_founder, founder_bonus_pp, min_commission_percentage, approved_at, level_id)
SELECT
  u.id,
  CASE WHEN u.is_blocked THEN 'suspended' ELSE 'approved' END,
  lower(COALESCE(u.referral_code, substr(replace(u.id::text, '-', ''), 1, 10))),
  true,
  (SELECT founder_bonus_pp FROM public.partner_settings LIMIT 1),
  (SELECT founder_min_percentage FROM public.partner_settings LIMIT 1),
  COALESCE(u.created_at, now()),
  (SELECT id FROM public.partner_levels WHERE slug = 'parceiro')
FROM public.users u
WHERE u.role = 'partner'
  AND NOT EXISTS (SELECT 1 FROM public.partner_profiles p WHERE p.user_id = u.id)
  AND NOT EXISTS (SELECT 1 FROM public.partner_team_members t WHERE t.user_id = u.id);

-- ---------------------------------------------------------------------------
-- Applications
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.partner_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  email text NOT NULL,
  whatsapp text NOT NULL,
  partner_type text NOT NULL CHECK (partner_type IN ('freelancer', 'agency', 'consultant', 'creator')),
  company_name text,
  document text,
  document_type text CHECK (document_type IN ('cpf', 'cnpj')),
  website text,
  instagram text,
  city text,
  state text,
  client_count text,
  niches text[] NOT NULL DEFAULT '{}',
  how_will_sell text,
  recruited_by_partner_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  utm jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'needs_info')),
  admin_notes text,
  reviewed_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  partner_user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  accepted_terms_version text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_partner_applications_status ON public.partner_applications(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_partner_applications_email ON public.partner_applications(lower(email));

ALTER TABLE public.partner_applications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins manage applications" ON public.partner_applications;
CREATE POLICY "Admins manage applications" ON public.partner_applications FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE OR REPLACE FUNCTION public.submit_partner_application(p jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email text := lower(trim(p ->> 'email'));
  v_whatsapp text := regexp_replace(COALESCE(p ->> 'whatsapp', ''), '\D', '', 'g');
  v_doc text := NULLIF(regexp_replace(COALESCE(p ->> 'document', ''), '\D', '', 'g'), '');
  v_recruiter uuid;
  v_id uuid;
  v_terms text;
BEGIN
  IF NOT COALESCE((SELECT is_active FROM partner_settings LIMIT 1), true) THEN
    RAISE EXCEPTION 'O programa de parceiros não está aceitando inscrições no momento.';
  END IF;
  IF COALESCE(trim(p ->> 'name'), '') = '' OR v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' OR length(v_whatsapp) < 10 THEN
    RAISE EXCEPTION 'Preencha nome, e-mail e WhatsApp válidos.';
  END IF;
  IF COALESCE(p ->> 'partner_type', '') NOT IN ('freelancer', 'agency', 'consultant', 'creator') THEN
    RAISE EXCEPTION 'Tipo de parceiro inválido.';
  END IF;
  IF v_doc IS NOT NULL AND length(v_doc) NOT IN (11, 14) THEN
    RAISE EXCEPTION 'CPF ou CNPJ inválido.';
  END IF;
  IF EXISTS (SELECT 1 FROM partner_applications WHERE lower(email) = v_email AND status IN ('pending', 'needs_info')) THEN
    RAISE EXCEPTION 'Já recebemos uma inscrição com este e-mail. Vamos responder em breve.';
  END IF;
  IF EXISTS (SELECT 1 FROM users WHERE lower(email) = v_email AND role = 'partner') THEN
    RAISE EXCEPTION 'Este e-mail já é de um parceiro. Entre pelo painel Partners.';
  END IF;
  IF (SELECT count(*) FROM partner_applications WHERE created_at > now() - interval '1 hour') > 60 THEN
    RAISE EXCEPTION 'Muitas inscrições no momento. Tente novamente em alguns minutos.';
  END IF;

  IF NULLIF(p ->> 'recruited_by', '') IS NOT NULL THEN
    SELECT pp.user_id INTO v_recruiter FROM partner_profiles pp
    WHERE pp.public_slug = lower(p ->> 'recruited_by') AND pp.status = 'approved';
  END IF;

  SELECT terms_version INTO v_terms FROM partner_settings LIMIT 1;

  INSERT INTO partner_applications (
    name, email, whatsapp, partner_type, company_name, document, document_type, website, instagram,
    city, state, client_count, niches, how_will_sell, recruited_by_partner_id, utm, accepted_terms_version
  ) VALUES (
    left(trim(p ->> 'name'), 120), v_email, v_whatsapp, p ->> 'partner_type',
    left(NULLIF(trim(p ->> 'company_name'), ''), 160), v_doc,
    CASE WHEN length(v_doc) = 11 THEN 'cpf' WHEN length(v_doc) = 14 THEN 'cnpj' END,
    left(NULLIF(trim(p ->> 'website'), ''), 200), left(NULLIF(trim(p ->> 'instagram'), ''), 80),
    left(NULLIF(trim(p ->> 'city'), ''), 80), left(NULLIF(trim(p ->> 'state'), ''), 2),
    left(NULLIF(p ->> 'client_count', ''), 20),
    COALESCE(ARRAY(SELECT left(jsonb_array_elements_text(COALESCE(p -> 'niches', '[]'::jsonb)), 40) LIMIT 10), '{}'),
    left(NULLIF(trim(p ->> 'how_will_sell'), ''), 1000),
    v_recruiter, COALESCE(p -> 'utm', '{}'::jsonb), v_terms
  ) RETURNING id INTO v_id;

  RETURN jsonb_build_object('id', v_id, 'auto_approve', (SELECT auto_approve_applications FROM partner_settings LIMIT 1));
END;
$$;
GRANT EXECUTE ON FUNCTION public.submit_partner_application(jsonb) TO anon, authenticated;

-- ---------------------------------------------------------------------------
-- Links, clicks, attributions
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.partner_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  slug text NOT NULL CHECK (slug ~ '^[a-z0-9](?:[a-z0-9-]{0,38}[a-z0-9])?$'),
  name text NOT NULL,
  destination text NOT NULL DEFAULT '/' CHECK (destination ~ '^/[A-Za-z0-9/_-]*$'),
  offer text NOT NULL DEFAULT 'trial' CHECK (offer IN ('none', 'trial')),
  utm_source text,
  utm_medium text,
  utm_campaign text,
  coupon_code text UNIQUE CHECK (coupon_code IS NULL OR coupon_code ~ '^[A-Z0-9]{4,20}$'),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (partner_id, slug)
);

CREATE TABLE IF NOT EXISTS public.partner_clicks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  link_id uuid REFERENCES public.partner_links(id) ON DELETE SET NULL,
  visitor_id text,
  landing_path text,
  referrer_url text,
  utm jsonb NOT NULL DEFAULT '{}'::jsonb,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_partner_clicks_partner ON public.partner_clicks(partner_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_partner_clicks_link ON public.partner_clicks(link_id);
CREATE INDEX IF NOT EXISTS idx_partner_clicks_visitor ON public.partner_clicks(visitor_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.partner_attributions (
  user_id uuid PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  partner_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  link_id uuid REFERENCES public.partner_links(id) ON DELETE SET NULL,
  source text NOT NULL CHECK (source IN ('link', 'coupon', 'lead', 'created', 'manual', 'legacy', 'directory')),
  visitor_id text,
  attributed_at timestamptz NOT NULL DEFAULT now(),
  changed_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  change_reason text
);
CREATE INDEX IF NOT EXISTS idx_partner_attributions_partner ON public.partner_attributions(partner_id);

INSERT INTO public.partner_attributions (user_id, partner_id, source, attributed_at)
SELECT u.id, u.managed_by_partner_id,
       CASE WHEN u.referred_by = u.managed_by_partner_id THEN 'link' ELSE 'created' END,
       COALESCE(u.created_at, now())
FROM public.users u
WHERE u.managed_by_partner_id IS NOT NULL
ON CONFLICT (user_id) DO NOTHING;

-- Default link for every existing partner.
INSERT INTO public.partner_links (partner_id, slug, name, destination, offer)
SELECT pp.user_id, 'inicio', 'Link principal', '/', 'trial'
FROM public.partner_profiles pp
ON CONFLICT (partner_id, slug) DO NOTHING;

ALTER TABLE public.partner_links ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Partner manages own links" ON public.partner_links;
CREATE POLICY "Partner manages own links" ON public.partner_links FOR ALL TO authenticated
  USING ((public.is_partner() AND partner_id = public.partner_scope_id() AND public.partner_team_role() IN ('owner', 'manager')) OR public.is_admin())
  WITH CHECK ((public.is_partner() AND partner_id = public.partner_scope_id() AND public.partner_team_role() IN ('owner', 'manager')) OR public.is_admin());
DROP POLICY IF EXISTS "Partner team views links" ON public.partner_links;
CREATE POLICY "Partner team views links" ON public.partner_links FOR SELECT TO authenticated
  USING (public.is_partner() AND partner_id = public.partner_scope_id());

ALTER TABLE public.partner_clicks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Partner views own clicks" ON public.partner_clicks;
CREATE POLICY "Partner views own clicks" ON public.partner_clicks FOR SELECT TO authenticated
  USING ((public.is_partner() AND partner_id = public.partner_scope_id()) OR public.is_admin());

ALTER TABLE public.partner_attributions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Partner views own attributions" ON public.partner_attributions;
CREATE POLICY "Partner views own attributions" ON public.partner_attributions FOR SELECT TO authenticated
  USING ((public.is_partner() AND partner_id = public.partner_scope_id()) OR public.is_admin());

-- Resolves a partner link (by public slug / referral code / coupon), records
-- the click and returns what the client needs to remember for attribution.
CREATE OR REPLACE FUNCTION public.record_partner_click(
  p_code text,
  p_link_slug text DEFAULT NULL,
  p_visitor_id text DEFAULT NULL,
  p_landing text DEFAULT NULL,
  p_referrer text DEFAULT NULL,
  p_utm jsonb DEFAULT '{}'::jsonb,
  p_user_agent text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_partner uuid;
  v_link partner_links%ROWTYPE;
  v_code text := lower(trim(COALESCE(p_code, '')));
  v_settings partner_settings%ROWTYPE;
BEGIN
  IF v_code = '' THEN RETURN NULL; END IF;
  SELECT * INTO v_settings FROM partner_settings LIMIT 1;
  IF NOT COALESCE(v_settings.is_active, true) THEN RETURN NULL; END IF;

  SELECT pp.user_id INTO v_partner
  FROM partner_profiles pp JOIN users u ON u.id = pp.user_id
  WHERE pp.status = 'approved' AND u.is_blocked = false
    AND (pp.public_slug = v_code OR lower(u.referral_code) = v_code)
  LIMIT 1;

  -- Coupon codes resolve straight to a link.
  IF v_partner IS NULL THEN
    SELECT l.* INTO v_link FROM partner_links l
    JOIN partner_profiles pp ON pp.user_id = l.partner_id AND pp.status = 'approved'
    WHERE l.coupon_code = upper(v_code) AND l.is_active;
    v_partner := v_link.partner_id;
  ELSIF NULLIF(p_link_slug, '') IS NOT NULL THEN
    SELECT * INTO v_link FROM partner_links
    WHERE partner_id = v_partner AND slug = lower(p_link_slug) AND is_active;
  END IF;

  IF v_partner IS NULL THEN RETURN NULL; END IF;

  -- One click per visitor per link every 30 minutes.
  IF p_visitor_id IS NULL OR NOT EXISTS (
    SELECT 1 FROM partner_clicks
    WHERE visitor_id = p_visitor_id AND partner_id = v_partner
      AND link_id IS NOT DISTINCT FROM v_link.id
      AND created_at > now() - interval '30 minutes'
  ) THEN
    INSERT INTO partner_clicks (partner_id, link_id, visitor_id, landing_path, referrer_url, utm, user_agent)
    VALUES (v_partner, v_link.id, left(p_visitor_id, 64), left(p_landing, 300), left(p_referrer, 300),
            COALESCE(p_utm, '{}'::jsonb), left(p_user_agent, 300));
  END IF;

  RETURN jsonb_build_object(
    'partner_id', v_partner,
    'referral_code', (SELECT referral_code FROM users WHERE id = v_partner),
    'partner_name', (SELECT COALESCE(pp.company_name, u.name) FROM users u JOIN partner_profiles pp ON pp.user_id = u.id WHERE u.id = v_partner),
    'link_id', v_link.id,
    'destination', COALESCE(v_link.destination, '/'),
    'offer', COALESCE(v_link.offer, 'trial'),
    'utm_source', v_link.utm_source,
    'utm_medium', v_link.utm_medium,
    'utm_campaign', v_link.utm_campaign,
    'window_days', v_settings.attribution_window_days
  );
END;
$$;
GRANT EXECUTE ON FUNCTION public.record_partner_click(text, text, text, text, text, jsonb, text) TO anon, authenticated;

-- ---------------------------------------------------------------------------
-- Leads (light CRM) with protection
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.partner_leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  email text,
  whatsapp text,
  company text,
  niche text,
  estimated_value numeric,
  stage text NOT NULL DEFAULT 'contact' CHECK (stage IN ('contact', 'proposal', 'trial', 'won', 'lost')),
  source text NOT NULL DEFAULT 'manual' CHECK (source IN ('manual', 'directory', 'vitrineturbo')),
  notes text,
  next_action_at timestamptz,
  protected_until timestamptz,
  converted_user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (email IS NOT NULL OR whatsapp IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS idx_partner_leads_partner ON public.partner_leads(partner_id, stage);
CREATE INDEX IF NOT EXISTS idx_partner_leads_email ON public.partner_leads(lower(email));
CREATE INDEX IF NOT EXISTS idx_partner_leads_whatsapp ON public.partner_leads(whatsapp);

CREATE OR REPLACE FUNCTION public.partner_leads_before_write()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_days integer;
BEGIN
  NEW.email := NULLIF(lower(trim(NEW.email)), '');
  NEW.whatsapp := NULLIF(regexp_replace(COALESCE(NEW.whatsapp, ''), '\D', '', 'g'), '');
  NEW.updated_at := now();

  IF TG_OP = 'INSERT' THEN
    NEW.created_by := COALESCE(NEW.created_by, auth.uid());
    IF NEW.source <> 'directory' THEN
      IF NEW.email IS NOT NULL AND EXISTS (SELECT 1 FROM users WHERE lower(email) = NEW.email) THEN
        RAISE EXCEPTION 'Este contato já tem conta no VitrineTurbo.';
      END IF;
      IF EXISTS (
        SELECT 1 FROM partner_leads l
        WHERE l.partner_id <> NEW.partner_id
          AND l.protected_until > now()
          AND l.stage NOT IN ('lost', 'won')
          AND ((NEW.email IS NOT NULL AND l.email = NEW.email) OR (NEW.whatsapp IS NOT NULL AND l.whatsapp = NEW.whatsapp))
      ) THEN
        RAISE EXCEPTION 'Este contato já está protegido por outro parceiro.';
      END IF;
      SELECT lead_protection_days INTO v_days FROM partner_settings LIMIT 1;
      NEW.protected_until := now() + make_interval(days => COALESCE(v_days, 60));
    END IF;
  ELSE
    -- Protection can't be extended by editing; it is set once on creation.
    IF current_user IN ('authenticated', 'anon') AND NOT public.is_admin() THEN
      NEW.protected_until := OLD.protected_until;
      NEW.partner_id := OLD.partner_id;
      NEW.converted_user_id := OLD.converted_user_id;
      NEW.source := OLD.source;
    END IF;
    IF NEW.stage = 'lost' THEN
      NEW.protected_until := LEAST(COALESCE(NEW.protected_until, now()), now());
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS partner_leads_before_write ON public.partner_leads;
CREATE TRIGGER partner_leads_before_write
  BEFORE INSERT OR UPDATE ON public.partner_leads
  FOR EACH ROW EXECUTE FUNCTION public.partner_leads_before_write();

ALTER TABLE public.partner_leads ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Partner manages own leads" ON public.partner_leads;
CREATE POLICY "Partner manages own leads" ON public.partner_leads FOR ALL TO authenticated
  USING ((public.is_partner() AND partner_id = public.partner_scope_id() AND public.partner_team_role() IN ('owner', 'manager')) OR public.is_admin())
  WITH CHECK ((public.is_partner() AND partner_id = public.partner_scope_id() AND public.partner_team_role() IN ('owner', 'manager')) OR public.is_admin());

-- ---------------------------------------------------------------------------
-- Signup attribution: lead protection beats a link; every partner-managed
-- signup gets an attribution row.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.partner_attribute_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_lead partner_leads%ROWTYPE;
  v_partner uuid := NEW.managed_by_partner_id;
  v_source text := 'link';
  v_digits text := NULLIF(regexp_replace(COALESCE(NEW.whatsapp, ''), '\D', '', 'g'), '');
BEGIN
  IF COALESCE(NEW.role, 'corretor') <> 'corretor' THEN
    RETURN NULL;
  END IF;

  SELECT * INTO v_lead FROM partner_leads l
  WHERE l.protected_until > now() AND l.stage NOT IN ('lost', 'won')
    AND ((NEW.email IS NOT NULL AND l.email = lower(NEW.email))
      OR (v_digits IS NOT NULL AND l.whatsapp IS NOT NULL AND right(l.whatsapp, 10) = right(v_digits, 10)))
  ORDER BY l.created_at
  LIMIT 1;

  IF v_lead.id IS NOT NULL AND EXISTS (SELECT 1 FROM partner_profiles WHERE user_id = v_lead.partner_id AND status = 'approved') THEN
    v_partner := v_lead.partner_id;
    v_source := 'lead';
    UPDATE partner_leads SET stage = 'trial', converted_user_id = NEW.id WHERE id = v_lead.id;
    IF NEW.managed_by_partner_id IS DISTINCT FROM v_partner THEN
      UPDATE users
      SET managed_by_partner_id = v_partner,
          referred_by = CASE WHEN referred_by IS NULL OR referred_by = NEW.managed_by_partner_id THEN v_partner ELSE referred_by END
      WHERE id = NEW.id;
    END IF;
  END IF;

  IF v_partner IS NOT NULL THEN
    INSERT INTO partner_attributions (user_id, partner_id, source)
    VALUES (NEW.id, v_partner, v_source)
    ON CONFLICT (user_id) DO NOTHING;
  END IF;

  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS partner_attribute_new_user ON public.users;
CREATE TRIGGER partner_attribute_new_user
  AFTER INSERT ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.partner_attribute_new_user();

-- Called by the client right after signup to attach the link/visitor that
-- brought the user (cookie set by /p/... links), or to apply a partner
-- coupon typed at signup when no partner is attached yet.
CREATE OR REPLACE FUNCTION public.claim_partner_attribution(p_link_id uuid DEFAULT NULL, p_visitor_id text DEFAULT NULL, p_coupon text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_user users%ROWTYPE;
  v_link partner_links%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN RETURN NULL; END IF;
  SELECT * INTO v_user FROM users WHERE id = v_uid;
  IF v_user.id IS NULL OR v_user.role <> 'corretor' THEN RETURN NULL; END IF;

  IF v_user.managed_by_partner_id IS NULL AND NULLIF(p_coupon, '') IS NOT NULL
     AND v_user.created_at > now() - interval '2 days'
     AND v_user.plan_status IN ('free', 'inactive', 'trial') THEN
    SELECT l.* INTO v_link FROM partner_links l
    JOIN partner_profiles pp ON pp.user_id = l.partner_id AND pp.status = 'approved'
    WHERE l.coupon_code = upper(trim(p_coupon)) AND l.is_active;
    IF v_link.id IS NULL THEN
      RAISE EXCEPTION 'Código de parceiro inválido.';
    END IF;
    IF v_link.partner_id = v_uid THEN RETURN NULL; END IF;
    UPDATE users SET managed_by_partner_id = v_link.partner_id, referred_by = COALESCE(referred_by, v_link.partner_id) WHERE id = v_uid;
    INSERT INTO partner_attributions (user_id, partner_id, link_id, source, visitor_id)
    VALUES (v_uid, v_link.partner_id, v_link.id, 'coupon', left(p_visitor_id, 64))
    ON CONFLICT (user_id) DO NOTHING;
    RETURN jsonb_build_object('partner_id', v_link.partner_id, 'source', 'coupon');
  END IF;

  IF v_user.managed_by_partner_id IS NOT NULL AND p_link_id IS NOT NULL THEN
    UPDATE partner_attributions a
    SET link_id = l.id, visitor_id = COALESCE(a.visitor_id, left(p_visitor_id, 64))
    FROM partner_links l
    WHERE a.user_id = v_uid AND a.link_id IS NULL AND a.source = 'link'
      AND l.id = p_link_id AND l.partner_id = a.partner_id;
  END IF;

  RETURN jsonb_build_object('partner_id', v_user.managed_by_partner_id);
END;
$$;
GRANT EXECUTE ON FUNCTION public.claim_partner_attribution(uuid, text, text) TO authenticated;

-- ---------------------------------------------------------------------------
-- Store access (manager mode) and invites
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.partner_store_access (
  store_user_id uuid PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  partner_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  granted boolean NOT NULL DEFAULT true,
  granted_at timestamptz DEFAULT now(),
  revoked_at timestamptz,
  client_accepted_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.partner_store_access ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Store owner and partner view access" ON public.partner_store_access;
CREATE POLICY "Store owner and partner view access" ON public.partner_store_access FOR SELECT TO authenticated
  USING (store_user_id = auth.uid() OR (public.is_partner() AND partner_id = public.partner_scope_id()) OR public.is_admin());
-- Only the store owner may toggle consent; everything else goes through
-- service-role edge functions.
DROP POLICY IF EXISTS "Store owner toggles access" ON public.partner_store_access;
CREATE POLICY "Store owner toggles access" ON public.partner_store_access FOR UPDATE TO authenticated
  USING (store_user_id = auth.uid()) WITH CHECK (store_user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.partner_store_access_before_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF current_user IN ('authenticated', 'anon') AND NOT public.is_admin() THEN
    IF NEW.partner_id IS DISTINCT FROM OLD.partner_id OR NEW.store_user_id IS DISTINCT FROM OLD.store_user_id
       OR NEW.client_accepted_at IS DISTINCT FROM OLD.client_accepted_at THEN
      RAISE EXCEPTION 'Not allowed' USING ERRCODE = '42501';
    END IF;
  END IF;
  IF NEW.granted IS DISTINCT FROM OLD.granted THEN
    IF NEW.granted THEN NEW.granted_at := now(); NEW.revoked_at := NULL;
    ELSE NEW.revoked_at := now(); END IF;
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS partner_store_access_before_update ON public.partner_store_access;
CREATE TRIGGER partner_store_access_before_update
  BEFORE UPDATE ON public.partner_store_access
  FOR EACH ROW EXECUTE FUNCTION public.partner_store_access_before_update();

-- One-time invite tokens (7 days) shared over WhatsApp/e-mail: partner
-- activation, client taking over a store, agency team member.
CREATE TABLE IF NOT EXISTS public.partner_invites (
  token uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL CHECK (kind IN ('partner', 'client', 'team')),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  partner_id uuid REFERENCES public.users(id) ON DELETE CASCADE,
  created_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  expires_at timestamptz NOT NULL DEFAULT now() + interval '7 days',
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_partner_invites_user ON public.partner_invites(user_id);
ALTER TABLE public.partner_invites ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins view invites" ON public.partner_invites;
CREATE POLICY "Admins view invites" ON public.partner_invites FOR SELECT TO authenticated USING (public.is_admin());

-- ---------------------------------------------------------------------------
-- Audit log and fraud flags
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.partner_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id uuid REFERENCES public.users(id) ON DELETE CASCADE,
  actor_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  action text NOT NULL,
  target_user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_partner_audit_log_partner ON public.partner_audit_log(partner_id, created_at DESC);
ALTER TABLE public.partner_audit_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Partner owner and admins read audit" ON public.partner_audit_log;
CREATE POLICY "Partner owner and admins read audit" ON public.partner_audit_log FOR SELECT TO authenticated
  USING ((partner_id = auth.uid() AND public.partner_team_role() = 'owner') OR public.is_admin());

CREATE TABLE IF NOT EXISTS public.partner_fraud_flags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  kind text NOT NULL,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'dismissed', 'confirmed')),
  dedupe_key text UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  resolved_by uuid REFERENCES public.users(id) ON DELETE SET NULL
);
ALTER TABLE public.partner_fraud_flags ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins manage fraud flags" ON public.partner_fraud_flags;
CREATE POLICY "Admins manage fraud flags" ON public.partner_fraud_flags FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

-- ---------------------------------------------------------------------------
-- Campaigns (multipliers and goals)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.partner_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  kind text NOT NULL CHECK (kind IN ('multiplier', 'goal')),
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  multiplier numeric CHECK (multiplier IS NULL OR (multiplier >= 1 AND multiplier <= 5)),
  goal_new_clients integer CHECK (goal_new_clients IS NULL OR goal_new_clients > 0),
  goal_bonus_amount numeric CHECK (goal_bonus_amount IS NULL OR goal_bonus_amount >= 0),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (ends_at > starts_at),
  CHECK ((kind = 'multiplier' AND multiplier IS NOT NULL) OR (kind = 'goal' AND goal_new_clients IS NOT NULL AND goal_bonus_amount IS NOT NULL))
);
ALTER TABLE public.partner_campaigns ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Partners view campaigns" ON public.partner_campaigns;
CREATE POLICY "Partners view campaigns" ON public.partner_campaigns FOR SELECT TO authenticated
  USING (public.is_partner() OR public.is_admin());
DROP POLICY IF EXISTS "Admins manage campaigns" ON public.partner_campaigns;
CREATE POLICY "Admins manage campaigns" ON public.partner_campaigns FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

-- ---------------------------------------------------------------------------
-- Commission ledger changes
-- ---------------------------------------------------------------------------
ALTER TABLE public.partner_commissions
  ADD COLUMN IF NOT EXISTS available_at timestamptz,
  ADD COLUMN IF NOT EXISTS reversal_reason text,
  ADD COLUMN IF NOT EXISTS withdrawal_id uuid,
  ADD COLUMN IF NOT EXISTS currency text NOT NULL DEFAULT 'BRL',
  ADD COLUMN IF NOT EXISTS installment_number integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS installment_total integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS billing_cycle text,
  ADD COLUMN IF NOT EXISTS source_commission_id uuid REFERENCES public.partner_commissions(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS campaign_id uuid REFERENCES public.partner_campaigns(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS description text;

ALTER TABLE public.partner_commissions ALTER COLUMN managed_user_id DROP NOT NULL;
ALTER TABLE public.partner_commissions ALTER COLUMN plan_price DROP NOT NULL;
ALTER TABLE public.partner_commissions ALTER COLUMN commission_percentage DROP NOT NULL;

ALTER TABLE public.partner_commissions DROP CONSTRAINT IF EXISTS partner_commissions_type_check;
ALTER TABLE public.partner_commissions ADD CONSTRAINT partner_commissions_type_check
  CHECK (type IN ('new', 'renewal', 'bonus', 'override', 'clawback', 'adjustment'));

ALTER TABLE public.partner_commissions DROP CONSTRAINT IF EXISTS partner_commissions_status_check;
UPDATE public.partner_commissions
SET status = CASE WHEN created_at <= now() - make_interval(days => (SELECT holding_days FROM public.partner_settings LIMIT 1)) THEN 'available' ELSE 'holding' END,
    available_at = created_at + make_interval(days => (SELECT holding_days FROM public.partner_settings LIMIT 1))
WHERE status = 'pending';
UPDATE public.partner_commissions SET available_at = COALESCE(available_at, created_at);
ALTER TABLE public.partner_commissions ADD CONSTRAINT partner_commissions_status_check
  CHECK (status IN ('holding', 'available', 'requested', 'paid', 'reversed'));
ALTER TABLE public.partner_commissions ALTER COLUMN status SET DEFAULT 'holding';

-- The old UNIQUE (subscription_id, next_payment_date_at_generation) blocks
-- annual installments and override rows; replace it.
DO $$
DECLARE c record;
BEGIN
  FOR c IN
    SELECT con.conname FROM pg_constraint con
    WHERE con.conrelid = 'public.partner_commissions'::regclass AND con.contype = 'u'
  LOOP
    EXECUTE format('ALTER TABLE public.partner_commissions DROP CONSTRAINT %I', c.conname);
  END LOOP;
END $$;
CREATE UNIQUE INDEX IF NOT EXISTS uq_partner_commissions_cycle
  ON public.partner_commissions (partner_id, subscription_id, next_payment_date_at_generation, type, installment_number)
  WHERE subscription_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_partner_commissions_campaign_bonus
  ON public.partner_commissions (partner_id, campaign_id) WHERE type = 'bonus' AND campaign_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_partner_commissions_first_sale_bonus
  ON public.partner_commissions (partner_id) WHERE type = 'bonus' AND description = 'first_sale';
CREATE INDEX IF NOT EXISTS idx_partner_commissions_available_at ON public.partner_commissions (status, available_at);
CREATE INDEX IF NOT EXISTS idx_partner_commissions_withdrawal ON public.partner_commissions (withdrawal_id);

-- Team managers (not operators) can't see finance; only the owner.
DROP POLICY IF EXISTS "Partners can view own commissions" ON public.partner_commissions;
CREATE POLICY "Partners can view own commissions"
  ON public.partner_commissions FOR SELECT TO authenticated
  USING ((partner_id = auth.uid() AND public.partner_team_role() = 'owner') OR public.is_admin());

ALTER TABLE public.withdrawal_requests
  ADD COLUMN IF NOT EXISTS invoice_url text,
  ADD COLUMN IF NOT EXISTS receipt_url text,
  ADD COLUMN IF NOT EXISTS paid_at timestamptz;

-- ---------------------------------------------------------------------------
-- Portfolio metrics, levels and rate
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.partner_cycle_months(p_cycle text)
RETURNS integer
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE lower(COALESCE(p_cycle, ''))
    WHEN 'quarterly' THEN 3 WHEN 'trimestral' THEN 3
    WHEN 'semiannually' THEN 6 WHEN 'semestral' THEN 6
    WHEN 'annually' THEN 12 WHEN 'anual' THEN 12
    ELSE 1 END;
$$;

-- Active clients and monthly recurring revenue of a partner's portfolio.
CREATE OR REPLACE FUNCTION public.partner_portfolio_stats(p_partner_id uuid)
RETURNS TABLE (active_clients integer, mrr numeric)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT
    COUNT(*)::integer,
    COALESCE(ROUND(SUM(s.plan_price / public.partner_cycle_months(s.billing_cycle::text)), 2), 0)
  FROM public.users u
  LEFT JOIN LATERAL (
    SELECT sub.plan_price, sub.billing_cycle
    FROM public.subscriptions sub
    WHERE sub.user_id = u.id AND sub.status = 'active'
    ORDER BY sub.next_payment_date DESC
    LIMIT 1
  ) s ON true
  WHERE u.managed_by_partner_id = p_partner_id
    AND u.plan_status = 'active';
$$;

CREATE OR REPLACE FUNCTION public.partner_active_user_count(p_partner_id uuid)
RETURNS integer
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT active_clients FROM public.partner_portfolio_stats(p_partner_id);
$$;

-- Recomputes the partner's level: upgrades immediately, downgrades only after
-- level_downgrade_grace_months below the current level's criteria.
CREATE OR REPLACE FUNCTION public.partner_recompute_level(p_partner_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_stats record;
  v_profile partner_profiles%ROWTYPE;
  v_qualified partner_levels%ROWTYPE;
  v_current partner_levels%ROWTYPE;
  v_grace integer;
BEGIN
  SELECT * INTO v_profile FROM partner_profiles WHERE user_id = p_partner_id FOR UPDATE;
  IF v_profile.user_id IS NULL THEN RETURN NULL; END IF;

  SELECT * INTO v_stats FROM partner_portfolio_stats(p_partner_id);
  SELECT level_downgrade_grace_months INTO v_grace FROM partner_settings LIMIT 1;

  SELECT * INTO v_qualified FROM partner_levels l
  WHERE l.is_active
    AND (v_stats.mrr >= l.min_mrr OR v_stats.active_clients >= l.min_active_clients)
    AND (NOT l.requires_certification OR v_profile.certified_at IS NOT NULL)
  ORDER BY l.sort_order DESC
  LIMIT 1;

  IF v_qualified.id IS NULL THEN
    SELECT * INTO v_qualified FROM partner_levels WHERE is_active ORDER BY sort_order LIMIT 1;
  END IF;

  SELECT * INTO v_current FROM partner_levels WHERE id = v_profile.level_id;

  IF v_current.id IS NULL OR v_qualified.sort_order >= v_current.sort_order THEN
    UPDATE partner_profiles SET level_id = v_qualified.id, level_below_since = NULL WHERE user_id = p_partner_id;
    IF v_current.id IS NOT NULL AND v_qualified.sort_order > v_current.sort_order THEN
      INSERT INTO notifications (user_id, type, title, message, related_entity_type)
      VALUES (p_partner_id, 'partner_level', 'Você subiu de nível!',
              'Parabéns! Agora você é ' || v_qualified.name || ' e ganha ' || v_qualified.commission_percentage || '% de comissão recorrente em toda a carteira.',
              'partner_level');
      INSERT INTO partner_audit_log (partner_id, action, details)
      VALUES (p_partner_id, 'level_up', jsonb_build_object('from', v_current.slug, 'to', v_qualified.slug, 'mrr', v_stats.mrr, 'clients', v_stats.active_clients));
    END IF;
    RETURN v_qualified.id;
  END IF;

  -- Below the current level.
  IF v_profile.level_below_since IS NULL THEN
    UPDATE partner_profiles SET level_below_since = now() WHERE user_id = p_partner_id;
  ELSIF v_profile.level_below_since < now() - make_interval(months => COALESCE(v_grace, 2)) THEN
    UPDATE partner_profiles SET level_id = v_qualified.id, level_below_since = NULL WHERE user_id = p_partner_id;
    INSERT INTO partner_audit_log (partner_id, action, details)
    VALUES (p_partner_id, 'level_down', jsonb_build_object('from', v_current.slug, 'to', v_qualified.slug, 'mrr', v_stats.mrr, 'clients', v_stats.active_clients));
    RETURN v_qualified.id;
  END IF;
  RETURN v_current.id;
END;
$$;

-- Effective recurring rate for a partner right now.
CREATE OR REPLACE FUNCTION public.partner_effective_rate(p_partner_id uuid)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  v_profile partner_profiles%ROWTYPE;
  v_level numeric;
  v_base numeric;
  v_inactive_months integer;
  v_rate numeric;
BEGIN
  SELECT * INTO v_profile FROM partner_profiles WHERE user_id = p_partner_id;
  IF v_profile.user_id IS NULL THEN
    -- Legacy partner without a profile: keep the old 30%.
    RETURN 30;
  END IF;
  IF v_profile.commission_override IS NOT NULL THEN
    RETURN v_profile.commission_override;
  END IF;

  SELECT commission_percentage INTO v_level FROM partner_levels WHERE id = v_profile.level_id;
  SELECT commission_percentage INTO v_base FROM partner_levels WHERE is_active ORDER BY sort_order LIMIT 1;
  SELECT inactivity_months INTO v_inactive_months FROM partner_settings LIMIT 1;

  v_rate := COALESCE(v_level, v_base, 25);
  -- Inactivity rule: no new client for N months drops to the base level rate.
  IF v_profile.approved_at < now() - make_interval(months => COALESCE(v_inactive_months, 12))
     AND (v_profile.last_sale_at IS NULL OR v_profile.last_sale_at < now() - make_interval(months => COALESCE(v_inactive_months, 12))) THEN
    v_rate := COALESCE(v_base, v_rate);
  END IF;

  v_rate := v_rate + COALESCE(v_profile.founder_bonus_pp, 0);
  RETURN LEAST(GREATEST(v_rate, COALESCE(v_profile.min_commission_percentage, 0)), 100);
END;
$$;

-- ---------------------------------------------------------------------------
-- Commission engine
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.generate_partner_commission()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  partner_uuid uuid;
  managed_user_name text;
  s partner_settings%ROWTYPE;
  v_profile partner_profiles%ROWTYPE;
  active_count integer;
  comm_pct numeric;
  v_multiplier numeric := 1;
  v_campaign_id uuid;
  commission_amount numeric;
  commission_type text;
  v_months integer;
  v_installments integer := 1;
  v_holding interval;
  v_first_id uuid;
  v_new_id uuid;
  v_inserted integer := 0;
  i integer;
  c record;
  v_count integer;
BEGIN
  IF NOT (
    NEW.status = 'active'
    AND (TG_OP = 'INSERT' OR OLD.next_payment_date IS DISTINCT FROM NEW.next_payment_date)
  ) THEN
    RETURN NEW;
  END IF;

  SELECT managed_by_partner_id INTO partner_uuid FROM users WHERE id = NEW.user_id;
  IF partner_uuid IS NULL THEN RETURN NEW; END IF;

  SELECT * INTO s FROM partner_settings LIMIT 1;
  IF NOT COALESCE(s.is_active, true) OR NOT COALESCE(s.renewal_commissions_enabled, true) THEN
    RETURN NEW;
  END IF;
  IF partner_uuid = NEW.user_id AND COALESCE(s.self_referral_block, true) THEN
    RETURN NEW;
  END IF;

  SELECT * INTO v_profile FROM partner_profiles WHERE user_id = partner_uuid;
  IF v_profile.status = 'terminated' THEN RETURN NEW; END IF;

  IF NEW.plan_price IS NULL OR NEW.plan_price <= 0 THEN RETURN NEW; END IF;

  commission_type := CASE WHEN TG_OP = 'INSERT' OR OLD.status = 'pending' OR OLD.status IS DISTINCT FROM 'active' AND NOT EXISTS (
    SELECT 1 FROM partner_commissions pc WHERE pc.subscription_id = NEW.id AND pc.type IN ('new', 'renewal')
  ) THEN 'new' ELSE 'renewal' END;

  PERFORM partner_recompute_level(partner_uuid);
  active_count := partner_active_user_count(partner_uuid);
  comm_pct := partner_effective_rate(partner_uuid);

  IF commission_type = 'new' THEN
    SELECT id, multiplier INTO v_campaign_id, v_multiplier FROM partner_campaigns
    WHERE kind = 'multiplier' AND is_active AND now() BETWEEN starts_at AND ends_at
    ORDER BY multiplier DESC LIMIT 1;
    v_multiplier := COALESCE(v_multiplier, 1);
  END IF;

  commission_amount := ROUND(NEW.plan_price * (comm_pct / 100.0) * v_multiplier, 2);
  IF commission_amount <= 0 THEN RETURN NEW; END IF;

  v_months := partner_cycle_months(NEW.billing_cycle::text);
  IF v_months >= 12 AND COALESCE(s.annual_installments, true) THEN
    v_installments := 12;
  END IF;
  v_holding := make_interval(days => COALESCE(s.holding_days, 30));

  FOR i IN 1..v_installments LOOP
    INSERT INTO partner_commissions (
      partner_id, managed_user_id, subscription_id, plan_name, plan_price,
      commission_percentage, amount, type, active_users_snapshot,
      next_payment_date_at_generation, status, available_at,
      installment_number, installment_total, billing_cycle, campaign_id
    )
    VALUES (
      partner_uuid, NEW.user_id, NEW.id, NEW.plan_name, NEW.plan_price,
      comm_pct,
      CASE WHEN v_installments = 1 THEN commission_amount
           WHEN i < v_installments THEN ROUND(commission_amount / v_installments, 2)
           ELSE commission_amount - ROUND(commission_amount / v_installments, 2) * (v_installments - 1) END,
      commission_type, active_count,
      NEW.next_payment_date::date, 'holding',
      now() + v_holding + make_interval(months => i - 1),
      i, v_installments, NEW.billing_cycle::text, v_campaign_id
    )
    ON CONFLICT DO NOTHING
    RETURNING id INTO v_new_id;
    IF v_new_id IS NOT NULL THEN
      v_inserted := v_inserted + 1;
      IF i = 1 THEN v_first_id := v_new_id; END IF;
    END IF;
    v_new_id := NULL;
  END LOOP;

  IF v_inserted = 0 THEN RETURN NEW; END IF;

  -- Recruiter override (partner-refers-partner, one level only).
  IF v_profile.recruited_by_partner_id IS NOT NULL
     AND v_profile.approved_at > now() - make_interval(months => COALESCE(s.recruit_override_months, 12))
     AND COALESCE(s.recruit_override_percentage, 0) > 0
     AND EXISTS (SELECT 1 FROM partner_profiles WHERE user_id = v_profile.recruited_by_partner_id AND status = 'approved') THEN
    INSERT INTO partner_commissions (
      partner_id, managed_user_id, subscription_id, plan_name, plan_price, commission_percentage,
      amount, type, next_payment_date_at_generation, status, available_at, source_commission_id, description
    ) VALUES (
      v_profile.recruited_by_partner_id, NEW.user_id, NEW.id, NEW.plan_name, NEW.plan_price, s.recruit_override_percentage,
      ROUND(commission_amount * s.recruit_override_percentage / 100.0, 2), 'override',
      NEW.next_payment_date::date, 'holding', now() + v_holding, v_first_id,
      'Bônus de indicação de parceiro'
    ) ON CONFLICT DO NOTHING;
  END IF;

  IF commission_type = 'new' THEN
    UPDATE partner_profiles SET last_sale_at = now() WHERE user_id = partner_uuid;
    UPDATE partner_leads SET stage = 'won' WHERE converted_user_id = NEW.user_id AND partner_id = partner_uuid AND stage <> 'won';

    -- First-sale bonus within the first N days after approval.
    IF COALESCE(s.first_sale_bonus_amount, 0) > 0
       AND v_profile.approved_at > now() - make_interval(days => COALESCE(s.first_sale_bonus_days, 30)) THEN
      INSERT INTO partner_commissions (partner_id, managed_user_id, amount, type, status, available_at, description, source_commission_id)
      VALUES (partner_uuid, NEW.user_id, s.first_sale_bonus_amount, 'bonus', 'holding', now() + v_holding, 'first_sale', v_first_id)
      ON CONFLICT DO NOTHING;
    END IF;

    -- Goal campaigns reached with this sale.
    FOR c IN
      SELECT * FROM partner_campaigns
      WHERE kind = 'goal' AND is_active AND now() BETWEEN starts_at AND ends_at
    LOOP
      SELECT COUNT(DISTINCT managed_user_id) INTO v_count FROM partner_commissions
      WHERE partner_id = partner_uuid AND type = 'new' AND created_at BETWEEN c.starts_at AND c.ends_at;
      IF v_count >= c.goal_new_clients THEN
        INSERT INTO partner_commissions (partner_id, amount, type, status, available_at, description, campaign_id)
        VALUES (partner_uuid, c.goal_bonus_amount, 'bonus', 'holding', now() + v_holding, 'Meta atingida: ' || c.name, c.id)
        ON CONFLICT DO NOTHING;
      END IF;
    END LOOP;
  END IF;

  SELECT COALESCE(name, email, 'Um cliente') INTO managed_user_name FROM users WHERE id = NEW.user_id;
  INSERT INTO notifications (user_id, type, title, message, related_entity_id, related_entity_type)
  VALUES (
    partner_uuid,
    'partner_commission',
    CASE WHEN commission_type = 'new' THEN 'Nova comissão de parceiro!' ELSE 'Comissão de renovação!' END,
    managed_user_name || ' ' ||
      (CASE WHEN commission_type = 'new' THEN 'assinou' ELSE 'renovou' END) ||
      ' o plano ' || COALESCE(NEW.plan_name, '') ||
      ' — comissão de R$ ' || to_char(commission_amount, 'FM999G999G990D00') ||
      CASE WHEN v_installments > 1 THEN ' (em ' || v_installments || ' parcelas mensais)' ELSE '' END ||
      ', liberada para saque em ' || COALESCE(s.holding_days, 30) || ' dias.',
    NEW.user_id,
    'partner_commission'
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_generate_partner_commission ON public.subscriptions;
CREATE TRIGGER trigger_generate_partner_commission
  AFTER INSERT OR UPDATE ON public.subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION public.generate_partner_commission();

-- ---------------------------------------------------------------------------
-- Clawback on refund / chargeback of a subscription payment
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.partner_reverse_commissions_for_payment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_group record;
  r record;
BEGIN
  IF NOT (OLD.status = 'approved' AND NEW.status IN ('refunded', 'charged_back', 'cancelled')) THEN
    RETURN NEW;
  END IF;

  -- The commission group created by this payment: the first sale/renewal
  -- commissions for this user generated after the payment was created.
  SELECT subscription_id, next_payment_date_at_generation INTO v_group
  FROM partner_commissions
  WHERE managed_user_id = NEW.user_id AND type IN ('new', 'renewal')
    AND created_at >= NEW.created_at - interval '5 minutes'
    AND status <> 'reversed'
  ORDER BY created_at
  LIMIT 1;

  IF v_group.subscription_id IS NULL THEN RETURN NEW; END IF;

  FOR r IN
    SELECT * FROM partner_commissions pc
    WHERE pc.status <> 'reversed'
      AND (
        (pc.subscription_id = v_group.subscription_id
          AND pc.next_payment_date_at_generation = v_group.next_payment_date_at_generation
          AND pc.type IN ('new', 'renewal', 'override'))
        OR (pc.type = 'bonus' AND pc.description = 'first_sale' AND pc.managed_user_id = NEW.user_id)
      )
  LOOP
    IF r.status IN ('holding', 'available') THEN
      UPDATE partner_commissions
      SET status = 'reversed', reversed_at = now(),
          reversal_reason = CASE NEW.status WHEN 'charged_back' THEN 'chargeback' ELSE 'refund' END
      WHERE id = r.id;
    ELSE
      -- Already requested or paid: debit it from future earnings.
      INSERT INTO partner_commissions (partner_id, managed_user_id, subscription_id, amount, type, status, available_at,
                                       source_commission_id, description, next_payment_date_at_generation, installment_number)
      VALUES (r.partner_id, r.managed_user_id, r.subscription_id, -r.amount, 'clawback', 'available', now(), r.id,
              CASE NEW.status WHEN 'charged_back' THEN 'Estorno por chargeback' ELSE 'Estorno por reembolso' END,
              r.next_payment_date_at_generation, r.installment_number)
      ON CONFLICT DO NOTHING;
    END IF;
  END LOOP;

  INSERT INTO notifications (user_id, type, title, message, related_entity_id, related_entity_type)
  SELECT DISTINCT pc.partner_id, 'partner_commission', 'Comissão estornada',
         'Um pagamento de cliente foi ' || CASE NEW.status WHEN 'charged_back' THEN 'contestado (chargeback)' ELSE 'reembolsado' END ||
         ' e a comissão correspondente foi estornada.', NEW.user_id, 'partner_commission'
  FROM partner_commissions pc
  WHERE pc.subscription_id = v_group.subscription_id AND pc.next_payment_date_at_generation = v_group.next_payment_date_at_generation;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS partner_reverse_commissions_for_payment ON public.mp_payments;
CREATE TRIGGER partner_reverse_commissions_for_payment
  AFTER UPDATE OF status ON public.mp_payments
  FOR EACH ROW EXECUTE FUNCTION public.partner_reverse_commissions_for_payment();

-- ---------------------------------------------------------------------------
-- Withdrawals tied to the commissions they pay
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.partner_balance(p_partner_id uuid)
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT jsonb_build_object(
    'holding', COALESCE(SUM(amount) FILTER (WHERE status = 'holding'), 0),
    'available', COALESCE(SUM(amount) FILTER (WHERE status = 'available'), 0),
    'requested', COALESCE(SUM(amount) FILTER (WHERE status = 'requested'), 0),
    'paid', COALESCE(SUM(amount) FILTER (WHERE status = 'paid'), 0),
    'reversed', COALESCE(SUM(amount) FILTER (WHERE status = 'reversed'), 0)
  )
  FROM public.partner_commissions
  WHERE partner_id = p_partner_id
    AND (p_partner_id = auth.uid() OR public.is_admin());
$$;
GRANT EXECUTE ON FUNCTION public.partner_balance(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.partner_request_withdrawal(p_pix_key_id uuid, p_invoice_url text DEFAULT NULL)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_profile partner_profiles%ROWTYPE;
  v_key record;
  v_amount numeric;
  v_min numeric;
  v_max_pf numeric;
  v_paid_month numeric;
  v_id uuid;
BEGIN
  IF v_uid IS NULL OR NOT is_partner() OR partner_team_role() <> 'owner' THEN
    RAISE EXCEPTION 'Apenas o titular da conta de parceiro pode solicitar saques.';
  END IF;
  SELECT * INTO v_profile FROM partner_profiles WHERE user_id = v_uid FOR UPDATE;
  IF v_profile.status <> 'approved' THEN
    RAISE EXCEPTION 'Sua conta de parceiro não está ativa para saques.';
  END IF;
  IF v_profile.payouts_frozen THEN
    RAISE EXCEPTION 'Saques temporariamente em revisão. Fale com o suporte de parceiros.';
  END IF;
  IF EXISTS (SELECT 1 FROM withdrawal_requests WHERE user_id = v_uid AND source = 'partner' AND status = 'pending') THEN
    RAISE EXCEPTION 'Você já tem um saque em análise.';
  END IF;

  SELECT * INTO v_key FROM user_pix_keys WHERE id = p_pix_key_id AND user_id = v_uid;
  IF NOT FOUND THEN RAISE EXCEPTION 'Chave PIX não encontrada.'; END IF;

  SELECT COALESCE(SUM(amount), 0) INTO v_amount FROM partner_commissions WHERE partner_id = v_uid AND status = 'available';
  SELECT minimum_withdrawal_amount, max_pf_monthly_payout INTO v_min, v_max_pf FROM partner_settings LIMIT 1;
  IF v_amount < COALESCE(v_min, 50) THEN
    RAISE EXCEPTION 'Saldo disponível abaixo do mínimo para saque (R$ %).', to_char(COALESCE(v_min, 50), 'FM999G990D00');
  END IF;

  -- Individuals (CPF) have a monthly cap; above it a CNPJ (MEI) is required.
  IF COALESCE(v_profile.document_type, 'cpf') = 'cpf' THEN
    SELECT COALESCE(SUM(amount), 0) INTO v_paid_month FROM withdrawal_requests
    WHERE user_id = v_uid AND source = 'partner' AND status IN ('pending', 'approved')
      AND created_at >= date_trunc('month', now());
    IF v_paid_month + v_amount > COALESCE(v_max_pf, 2000) THEN
      RAISE EXCEPTION 'Saques acima de R$ % por mês exigem CNPJ (MEI serve). Atualize seus dados de parceiro.', to_char(COALESCE(v_max_pf, 2000), 'FM999G990D00');
    END IF;
  ELSIF NULLIF(p_invoice_url, '') IS NULL THEN
    RAISE EXCEPTION 'Anexe a nota fiscal de serviço para solicitar o saque.';
  END IF;

  INSERT INTO withdrawal_requests (user_id, amount, pix_key, pix_key_type, status, source, invoice_url)
  VALUES (v_uid, v_amount, v_key.pix_key, v_key.pix_key_type, 'pending', 'partner', NULLIF(p_invoice_url, ''))
  RETURNING id INTO v_id;

  UPDATE partner_commissions SET status = 'requested', withdrawal_id = v_id
  WHERE partner_id = v_uid AND status = 'available';

  RETURN v_id;
END;
$$;
GRANT EXECUTE ON FUNCTION public.partner_request_withdrawal(uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_partner_process_withdrawal(p_withdrawal_id uuid, p_action text, p_notes text DEFAULT NULL, p_receipt_url text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_w withdrawal_requests%ROWTYPE;
BEGIN
  IF NOT is_admin() THEN RAISE EXCEPTION 'Apenas administradores.' USING ERRCODE = '42501'; END IF;
  SELECT * INTO v_w FROM withdrawal_requests WHERE id = p_withdrawal_id AND source = 'partner' FOR UPDATE;
  IF v_w.id IS NULL OR v_w.status <> 'pending' THEN RAISE EXCEPTION 'Saque não encontrado ou já processado.'; END IF;

  IF p_action = 'pay' THEN
    UPDATE withdrawal_requests SET status = 'approved', admin_notes = p_notes, processed_at = now(), paid_at = now(),
           receipt_url = NULLIF(p_receipt_url, '')
    WHERE id = p_withdrawal_id;
    UPDATE partner_commissions SET status = 'paid', paid_at = now() WHERE withdrawal_id = p_withdrawal_id AND status = 'requested';
    INSERT INTO notifications (user_id, type, title, message, related_entity_id, related_entity_type)
    VALUES (v_w.user_id, 'partner_commission', 'Saque pago!',
            'Seu saque de R$ ' || to_char(v_w.amount, 'FM999G999G990D00') || ' foi pago via PIX.', p_withdrawal_id, 'partner_withdrawal');
  ELSIF p_action = 'reject' THEN
    UPDATE withdrawal_requests SET status = 'rejected', admin_notes = p_notes, processed_at = now() WHERE id = p_withdrawal_id;
    UPDATE partner_commissions SET status = 'available', withdrawal_id = NULL WHERE withdrawal_id = p_withdrawal_id AND status = 'requested';
    INSERT INTO notifications (user_id, type, title, message, related_entity_id, related_entity_type)
    VALUES (v_w.user_id, 'partner_commission', 'Saque não aprovado',
            COALESCE('Motivo: ' || NULLIF(p_notes, ''), 'Fale com o suporte de parceiros para detalhes.') || ' O valor voltou para o seu saldo disponível.',
            p_withdrawal_id, 'partner_withdrawal');
  ELSE
    RAISE EXCEPTION 'Ação inválida.';
  END IF;

  INSERT INTO partner_audit_log (partner_id, actor_id, action, details)
  VALUES (v_w.user_id, auth.uid(), 'withdrawal_' || p_action, jsonb_build_object('withdrawal_id', p_withdrawal_id, 'amount', v_w.amount));
END;
$$;
GRANT EXECUTE ON FUNCTION public.admin_partner_process_withdrawal(uuid, text, text, text) TO authenticated;

-- Admin: move a client to another partner (or none) with an audit trail.
CREATE OR REPLACE FUNCTION public.admin_partner_reassign_client(p_user_id uuid, p_partner_id uuid, p_reason text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_old uuid;
BEGIN
  IF NOT is_admin() THEN RAISE EXCEPTION 'Apenas administradores.' USING ERRCODE = '42501'; END IF;
  IF COALESCE(trim(p_reason), '') = '' THEN RAISE EXCEPTION 'Informe o motivo.'; END IF;
  IF p_partner_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM partner_profiles WHERE user_id = p_partner_id) THEN
    RAISE EXCEPTION 'Parceiro não encontrado.';
  END IF;
  SELECT managed_by_partner_id INTO v_old FROM users WHERE id = p_user_id;
  UPDATE users SET managed_by_partner_id = p_partner_id WHERE id = p_user_id;
  IF p_partner_id IS NULL THEN
    DELETE FROM partner_attributions WHERE user_id = p_user_id;
    DELETE FROM partner_store_access WHERE store_user_id = p_user_id;
  ELSE
    INSERT INTO partner_attributions (user_id, partner_id, source, changed_by, change_reason)
    VALUES (p_user_id, p_partner_id, 'manual', auth.uid(), p_reason)
    ON CONFLICT (user_id) DO UPDATE SET partner_id = EXCLUDED.partner_id, source = 'manual', link_id = NULL,
      changed_by = EXCLUDED.changed_by, change_reason = EXCLUDED.change_reason, attributed_at = now();
    UPDATE partner_store_access SET partner_id = p_partner_id WHERE store_user_id = p_user_id;
  END IF;
  INSERT INTO partner_audit_log (partner_id, actor_id, action, target_user_id, details)
  VALUES (COALESCE(p_partner_id, v_old), auth.uid(), 'client_reassigned', p_user_id,
          jsonb_build_object('from', v_old, 'to', p_partner_id, 'reason', p_reason));
END;
$$;
GRANT EXECUTE ON FUNCTION public.admin_partner_reassign_client(uuid, uuid, text) TO authenticated;

-- ---------------------------------------------------------------------------
-- Corretor referral program must not pay on partner-referred signups
-- (fixes the double commission; body otherwise identical to
-- 20260716020100_add_monthly_referral_commission_support.sql).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION generate_referral_commission()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  referrer_uuid uuid;
  referred_user_name text;
  commission_amount numeric;
  settings_row record;
  billing text;
  plan_price numeric;
  comm_pct numeric;
BEGIN
  IF NEW.status = 'active' AND (OLD.status IS NULL OR OLD.status != 'active') THEN

    SELECT referred_by INTO referrer_uuid
    FROM public.users
    WHERE id = NEW.user_id;

    -- Partner-referred clients are paid by generate_partner_commission().
    IF referrer_uuid IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.users WHERE id = referrer_uuid AND role = 'partner'
    ) THEN
      referrer_uuid := NULL;
    END IF;

    IF referrer_uuid IS NOT NULL THEN

      SELECT
        commission_type, commission_percentage,
        commission_mensal, commission_trimestral, commission_semestral, commission_anual
      INTO settings_row
      FROM public.referral_settings
      LIMIT 1;

      billing := LOWER(COALESCE(NEW.billing_cycle::text, ''));

      IF COALESCE(settings_row.commission_type, 'percentage') = 'percentage' THEN
        comm_pct := COALESCE(settings_row.commission_percentage, 30);

        SELECT price INTO plan_price
        FROM public.subscription_plans
        WHERE LOWER(name) = LOWER(NEW.plan_name)
        LIMIT 1;

        IF plan_price IS NULL THEN
          IF billing = 'monthly' OR LOWER(NEW.plan_name) LIKE '%mensal%' THEN
            plan_price := 57.00;
          ELSIF billing = 'quarterly' OR LOWER(NEW.plan_name) LIKE '%trimestral%' THEN
            plan_price := 149.00;
          ELSIF billing = 'semiannually' OR LOWER(NEW.plan_name) LIKE '%semestral%' THEN
            plan_price := 229.00;
          ELSIF billing = 'annually' OR LOWER(NEW.plan_name) LIKE '%anual%' THEN
            plan_price := 336.00;
          ELSE
            plan_price := 149.00;
          END IF;
        END IF;

        commission_amount := ROUND(plan_price * (comm_pct / 100.0), 2);
        IF billing != 'monthly' AND commission_amount < 44.70 THEN
          commission_amount := 44.70;
        END IF;

      ELSE
        comm_pct := NULL;
        plan_price := NULL;

        IF billing = 'monthly' OR LOWER(NEW.plan_name) LIKE '%mensal%' THEN
          commission_amount := COALESCE(settings_row.commission_mensal, 17.10);
        ELSIF billing = 'quarterly' OR LOWER(NEW.plan_name) LIKE '%trimestral%' THEN
          commission_amount := COALESCE(settings_row.commission_trimestral, 50.00);
        ELSIF billing = 'semiannually' OR LOWER(NEW.plan_name) LIKE '%semestral%' THEN
          commission_amount := COALESCE(settings_row.commission_semestral, 70.00);
        ELSIF billing = 'annually' OR LOWER(NEW.plan_name) LIKE '%anual%' THEN
          commission_amount := COALESCE(settings_row.commission_anual, 100.00);
        ELSE
          commission_amount := 0.00;
        END IF;
      END IF;

      IF commission_amount > 0 THEN
        INSERT INTO public.referral_commissions (
          referrer_id, referred_user_id, subscription_id, plan_type, amount, status,
          original_plan_value, commission_percentage
        )
        VALUES (
          referrer_uuid, NEW.user_id, NEW.id, NEW.plan_name, commission_amount, 'pending',
          plan_price, comm_pct
        );

        SELECT COALESCE(name, email, 'Um usuario') INTO referred_user_name
        FROM public.users
        WHERE id = NEW.user_id;

        INSERT INTO public.notifications (
          user_id, type, title, message, related_entity_id, related_entity_type
        )
        VALUES (
          referrer_uuid,
          'referral_upgrade',
          'Indicado fez upgrade!',
          referred_user_name || ' ativou o plano ' || NEW.plan_name || ' — voce ganhou R$ ' || commission_amount::text || ' de comissao!',
          NEW.user_id,
          'referral'
        );
      END IF;

    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- ---------------------------------------------------------------------------
-- Daily maintenance: release holding, levels, fraud signals
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.partner_daily_maintenance()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_released integer;
  v_partner record;
  v_ratio numeric;
  s partner_settings%ROWTYPE;
BEGIN
  SELECT * INTO s FROM partner_settings LIMIT 1;

  UPDATE partner_commissions SET status = 'available'
  WHERE status = 'holding' AND available_at <= now();
  GET DIAGNOSTICS v_released = ROW_COUNT;

  FOR v_partner IN SELECT user_id FROM partner_profiles WHERE status = 'approved' LOOP
    PERFORM partner_recompute_level(v_partner.user_id);
  END LOOP;

  -- Self-referral: a client sharing the partner's WhatsApp or document.
  INSERT INTO partner_fraud_flags (partner_id, kind, details, dedupe_key)
  SELECT p.id, 'self_referral', jsonb_build_object('client_id', c.id, 'client_name', c.name, 'match', 'whatsapp'),
         'self_referral:' || c.id
  FROM users p
  JOIN users c ON c.managed_by_partner_id = p.id
  WHERE p.role = 'partner'
    AND NULLIF(regexp_replace(COALESCE(p.whatsapp, ''), '\D', '', 'g'), '') IS NOT NULL
    AND right(regexp_replace(COALESCE(c.whatsapp, ''), '\D', '', 'g'), 10) = right(regexp_replace(p.whatsapp, '\D', '', 'g'), 10)
  ON CONFLICT (dedupe_key) DO NOTHING;

  -- Burst of signups attributed from the same visitor in 24h.
  INSERT INTO partner_fraud_flags (partner_id, kind, details, dedupe_key)
  SELECT a.partner_id, 'signup_burst', jsonb_build_object('visitor_id', a.visitor_id, 'signups', COUNT(*)),
         'signup_burst:' || a.partner_id || ':' || a.visitor_id || ':' || to_char(now(), 'YYYY-MM-DD')
  FROM partner_attributions a
  WHERE a.visitor_id IS NOT NULL AND a.attributed_at > now() - interval '24 hours'
  GROUP BY a.partner_id, a.visitor_id
  HAVING COUNT(*) >= 3
  ON CONFLICT (dedupe_key) DO NOTHING;

  -- High reversal ratio over 90 days freezes payouts for review.
  FOR v_partner IN
    SELECT partner_id,
           SUM(abs(amount)) FILTER (WHERE status = 'reversed' OR type = 'clawback') AS bad,
           SUM(abs(amount)) FILTER (WHERE type IN ('new', 'renewal', 'clawback')) AS total
    FROM partner_commissions
    WHERE created_at > now() - interval '90 days'
    GROUP BY partner_id
  LOOP
    IF COALESCE(v_partner.total, 0) >= 200 THEN
      v_ratio := abs(COALESCE(v_partner.bad, 0)) / v_partner.total;
      IF v_ratio >= COALESCE(s.reversal_freeze_ratio, 0.3) THEN
        UPDATE partner_profiles SET payouts_frozen = true WHERE user_id = v_partner.partner_id AND NOT payouts_frozen;
        IF FOUND THEN
          INSERT INTO partner_fraud_flags (partner_id, kind, details, dedupe_key)
          VALUES (v_partner.partner_id, 'high_reversal_ratio', jsonb_build_object('ratio', round(v_ratio, 2)),
                  'high_reversal_ratio:' || v_partner.partner_id || ':' || to_char(now(), 'YYYY-MM'))
          ON CONFLICT (dedupe_key) DO NOTHING;
        END IF;
      END IF;
    END IF;
  END LOOP;

  RETURN jsonb_build_object('released', v_released);
END;
$$;

REVOKE ALL ON FUNCTION public.partner_daily_maintenance() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.partner_recompute_level(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.partner_portfolio_stats(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.partner_effective_rate(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.admin_partner_process_withdrawal(uuid, text, text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_partner_reassign_client(uuid, uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.partner_balance(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.partner_request_withdrawal(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.claim_partner_attribution(uuid, text, text) FROM PUBLIC, anon;

-- Partner-facing summary in one call (stats are only for the caller's scope).
CREATE OR REPLACE FUNCTION public.partner_overview()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  v_scope uuid := partner_scope_id();
  v_stats record;
  v_profile partner_profiles%ROWTYPE;
  v_level partner_levels%ROWTYPE;
  v_next partner_levels%ROWTYPE;
  v_role text := partner_team_role();
BEGIN
  IF v_role IS NULL THEN RAISE EXCEPTION 'Not a partner' USING ERRCODE = '42501'; END IF;
  SELECT * INTO v_profile FROM partner_profiles WHERE user_id = v_scope;
  SELECT * INTO v_stats FROM partner_portfolio_stats(v_scope);
  SELECT * INTO v_level FROM partner_levels WHERE id = v_profile.level_id;
  SELECT * INTO v_next FROM partner_levels WHERE is_active AND sort_order > COALESCE(v_level.sort_order, 0) ORDER BY sort_order LIMIT 1;

  RETURN jsonb_build_object(
    'team_role', v_role,
    'partner_id', v_scope,
    'status', v_profile.status,
    'active_clients', v_stats.active_clients,
    'mrr', v_stats.mrr,
    'rate', partner_effective_rate(v_scope),
    'level', CASE WHEN v_level.id IS NULL THEN NULL ELSE to_jsonb(v_level) END,
    'next_level', CASE WHEN v_next.id IS NULL THEN NULL ELSE to_jsonb(v_next) END,
    'level_below_since', v_profile.level_below_since,
    'is_founder', v_profile.is_founder,
    'payouts_frozen', v_profile.payouts_frozen,
    'certified_at', v_profile.certified_at,
    'balance', CASE WHEN v_role = 'owner' THEN partner_balance(v_scope) END
  );
END;
$$;
GRANT EXECUTE ON FUNCTION public.partner_overview() TO authenticated;
REVOKE ALL ON FUNCTION public.partner_overview() FROM PUBLIC, anon;

-- Schedule the daily maintenance (03:15 UTC).
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.unschedule(jobid) FROM cron.job WHERE jobname = 'partner-daily-maintenance';
    PERFORM cron.schedule('partner-daily-maintenance', '15 3 * * *', 'SELECT public.partner_daily_maintenance();');
  END IF;
END $$;

-- Initial level assignment for migrated partners.
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT user_id FROM public.partner_profiles LOOP
    PERFORM public.partner_recompute_level(r.user_id);
  END LOOP;
END $$;

-- Public-facing numbers for the /parceiros landing (anon can't read the table).
CREATE OR REPLACE FUNCTION public.get_partner_program_public_info()
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT jsonb_build_object(
    'is_active', s.is_active,
    'holding_days', s.holding_days,
    'first_sale_bonus_amount', s.first_sale_bonus_amount,
    'first_sale_bonus_days', s.first_sale_bonus_days,
    'recruit_override_percentage', s.recruit_override_percentage,
    'store_trial_days', s.store_trial_days,
    'minimum_withdrawal_amount', s.minimum_withdrawal_amount,
    'terms_version', s.terms_version,
    'founder_bonus_pp', s.founder_bonus_pp,
    'founder_slots', s.founder_slots,
    'founder_slots_left', GREATEST(s.founder_slots - (SELECT count(*) FROM public.partner_profiles WHERE is_founder), 0),
    'levels', (
      SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'slug', l.slug, 'name', l.name, 'min_mrr', l.min_mrr,
        'min_active_clients', l.min_active_clients,
        'commission_percentage', l.commission_percentage,
        'benefits', l.benefits, 'color', l.color
      ) ORDER BY l.sort_order), '[]'::jsonb)
      FROM public.partner_levels l WHERE l.is_active
    ),
    'plans', (
      SELECT COALESCE(jsonb_agg(jsonb_build_object('name', p.name, 'price', p.price, 'duration', p.duration) ORDER BY p.price), '[]'::jsonb)
      FROM public.subscription_plans p WHERE p.is_active
    )
  )
  FROM public.partner_settings s
  LIMIT 1;
$$;
GRANT EXECUTE ON FUNCTION public.get_partner_program_public_info() TO anon, authenticated;


-- =====================================================================
-- 20261103120000_partners_v2_content.sql
-- =====================================================================

/*
  # VitrineTurbo Partners v2 — academy, materials, directory, documents

  1. Changes
    - Academy: partner_courses, partner_lessons, partner_lesson_progress,
      partner_quiz_questions, partner_certification_attempts and
      submit_partner_certification() (grades server-side, never exposes the
      answer key to partners; passing sets partner_profiles.certified_at,
      which the Ouro/Diamante levels require).
    - Materials: partner_assets (copies, FAQ, images, presentations) managed
      by admins; public bucket `partner-assets`.
    - Documents: private bucket `partner-documents` for invoices (partner
      uploads under its own folder) and payout receipts (admins).
    - Directory (/especialistas): list_public_partners(),
      get_public_partner() and submit_partner_directory_lead() for anon.
      Only approved, public, Prata+ partners are listed.
    - Seeds the initial academy and copy library in Portuguese.
*/

-- ---------------------------------------------------------------------------
-- Academy
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.partner_courses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  title text NOT NULL,
  description text,
  sort_order integer NOT NULL DEFAULT 0,
  is_published boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.partner_lessons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id uuid NOT NULL REFERENCES public.partner_courses(id) ON DELETE CASCADE,
  slug text NOT NULL,
  title text NOT NULL,
  content_md text NOT NULL DEFAULT '',
  video_url text,
  duration_minutes integer NOT NULL DEFAULT 5,
  sort_order integer NOT NULL DEFAULT 0,
  is_published boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (course_id, slug)
);

CREATE TABLE IF NOT EXISTS public.partner_lesson_progress (
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  lesson_id uuid NOT NULL REFERENCES public.partner_lessons(id) ON DELETE CASCADE,
  completed_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, lesson_id)
);

CREATE TABLE IF NOT EXISTS public.partner_quiz_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  question text NOT NULL,
  options text[] NOT NULL CHECK (array_length(options, 1) BETWEEN 2 AND 6),
  correct_index integer NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  CHECK (correct_index >= 0 AND correct_index < array_length(options, 1))
);

CREATE TABLE IF NOT EXISTS public.partner_certification_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  score numeric NOT NULL,
  passed boolean NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.partner_courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.partner_lessons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.partner_lesson_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.partner_quiz_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.partner_certification_attempts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Partners view published courses" ON public.partner_courses;
CREATE POLICY "Partners view published courses" ON public.partner_courses FOR SELECT TO authenticated
  USING ((is_published AND public.is_partner()) OR public.is_admin());
DROP POLICY IF EXISTS "Admins manage courses" ON public.partner_courses;
CREATE POLICY "Admins manage courses" ON public.partner_courses FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Partners view published lessons" ON public.partner_lessons;
CREATE POLICY "Partners view published lessons" ON public.partner_lessons FOR SELECT TO authenticated
  USING ((is_published AND public.is_partner()) OR public.is_admin());
DROP POLICY IF EXISTS "Admins manage lessons" ON public.partner_lessons;
CREATE POLICY "Admins manage lessons" ON public.partner_lessons FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Partners manage own progress" ON public.partner_lesson_progress;
CREATE POLICY "Partners manage own progress" ON public.partner_lesson_progress FOR ALL TO authenticated
  USING (user_id = auth.uid() OR public.is_admin())
  WITH CHECK (user_id = auth.uid() AND public.is_partner());

-- Questions are read through get_partner_quiz() so correct_index never leaks.
DROP POLICY IF EXISTS "Admins manage quiz" ON public.partner_quiz_questions;
CREATE POLICY "Admins manage quiz" ON public.partner_quiz_questions FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Partners view own attempts" ON public.partner_certification_attempts;
CREATE POLICY "Partners view own attempts" ON public.partner_certification_attempts FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_admin());

CREATE OR REPLACE FUNCTION public.get_partner_quiz()
RETURNS TABLE (id uuid, question text, options text[])
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT q.id, q.question, q.options
  FROM public.partner_quiz_questions q
  WHERE q.is_active AND public.is_partner()
  ORDER BY q.sort_order;
$$;
REVOKE ALL ON FUNCTION public.get_partner_quiz() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_partner_quiz() TO authenticated;

-- p_answers: {"<question id>": <chosen index>, ...}
CREATE OR REPLACE FUNCTION public.submit_partner_certification(p_answers jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_total integer;
  v_correct integer;
  v_score numeric;
  v_passed boolean;
BEGIN
  IF v_uid IS NULL OR NOT is_partner() THEN RAISE EXCEPTION 'Apenas parceiros.' USING ERRCODE = '42501'; END IF;
  IF (SELECT count(*) FROM partner_certification_attempts WHERE user_id = v_uid AND created_at > now() - interval '1 hour') >= 3 THEN
    RAISE EXCEPTION 'Você já fez 3 tentativas na última hora. Revise as aulas e tente de novo mais tarde.';
  END IF;

  SELECT count(*), count(*) FILTER (WHERE (p_answers ->> q.id::text)::integer = q.correct_index)
  INTO v_total, v_correct
  FROM partner_quiz_questions q WHERE q.is_active;

  IF v_total = 0 THEN RAISE EXCEPTION 'Prova indisponível no momento.'; END IF;
  v_score := round(100.0 * v_correct / v_total, 0);
  v_passed := v_score >= 80;

  INSERT INTO partner_certification_attempts (user_id, score, passed) VALUES (v_uid, v_score, v_passed);

  -- Certification belongs to the partner account (agency owner), not staff.
  IF v_passed AND partner_team_role() = 'owner' THEN
    UPDATE partner_profiles SET certified_at = COALESCE(certified_at, now()) WHERE user_id = v_uid;
    UPDATE partner_profiles SET onboarding = onboarding || '{"certified": true}'::jsonb WHERE user_id = v_uid;
    PERFORM partner_recompute_level(v_uid);
  END IF;

  RETURN jsonb_build_object('score', v_score, 'passed', v_passed, 'correct', v_correct, 'total', v_total);
END;
$$;
REVOKE ALL ON FUNCTION public.submit_partner_certification(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.submit_partner_certification(jsonb) TO authenticated;

-- ---------------------------------------------------------------------------
-- Materials
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.partner_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  category text NOT NULL CHECK (category IN ('copy', 'faq', 'image', 'video', 'presentation', 'document')),
  channel text CHECK (channel IN ('whatsapp', 'instagram', 'email', 'linkedin', 'geral')),
  body_text text,
  file_url text,
  thumbnail_url text,
  sort_order integer NOT NULL DEFAULT 0,
  is_published boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (body_text IS NOT NULL OR file_url IS NOT NULL)
);

ALTER TABLE public.partner_assets ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Partners view published assets" ON public.partner_assets;
CREATE POLICY "Partners view published assets" ON public.partner_assets FOR SELECT TO authenticated
  USING ((is_published AND public.is_partner()) OR public.is_admin());
DROP POLICY IF EXISTS "Admins manage assets" ON public.partner_assets;
CREATE POLICY "Admins manage assets" ON public.partner_assets FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

-- ---------------------------------------------------------------------------
-- Storage
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'storage') THEN
    INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    VALUES ('partner-assets', 'partner-assets', true, 20971520,
            ARRAY['image/webp', 'image/png', 'image/jpeg', 'image/gif', 'video/mp4', 'application/pdf'])
    ON CONFLICT (id) DO NOTHING;

    INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    VALUES ('partner-documents', 'partner-documents', false, 10485760,
            ARRAY['application/pdf', 'image/png', 'image/jpeg', 'application/xml', 'text/xml'])
    ON CONFLICT (id) DO NOTHING;

    -- Partner logos live in partner-assets/logos/<partner id>/...
    EXECUTE $p$DROP POLICY IF EXISTS "Admins write partner assets" ON storage.objects$p$;
    EXECUTE $p$CREATE POLICY "Admins write partner assets" ON storage.objects FOR ALL TO authenticated
      USING (bucket_id = 'partner-assets' AND public.is_admin())
      WITH CHECK (bucket_id = 'partner-assets' AND public.is_admin())$p$;

    EXECUTE $p$DROP POLICY IF EXISTS "Partners upload own logo" ON storage.objects$p$;
    EXECUTE $p$CREATE POLICY "Partners upload own logo" ON storage.objects FOR INSERT TO authenticated
      WITH CHECK (bucket_id = 'partner-assets' AND public.is_partner()
                  AND (storage.foldername(name))[1] = 'logos'
                  AND (storage.foldername(name))[2] = auth.uid()::text)$p$;

    EXECUTE $p$DROP POLICY IF EXISTS "Partners upload own documents" ON storage.objects$p$;
    EXECUTE $p$CREATE POLICY "Partners upload own documents" ON storage.objects FOR INSERT TO authenticated
      WITH CHECK (bucket_id = 'partner-documents' AND public.is_partner()
                  AND (storage.foldername(name))[1] = auth.uid()::text)$p$;

    EXECUTE $p$DROP POLICY IF EXISTS "Partners read own documents" ON storage.objects$p$;
    EXECUTE $p$CREATE POLICY "Partners read own documents" ON storage.objects FOR SELECT TO authenticated
      USING (bucket_id = 'partner-documents' AND ((storage.foldername(name))[1] = auth.uid()::text OR public.is_admin()))$p$;

    EXECUTE $p$DROP POLICY IF EXISTS "Admins write partner documents" ON storage.objects$p$;
    EXECUTE $p$CREATE POLICY "Admins write partner documents" ON storage.objects FOR INSERT TO authenticated
      WITH CHECK (bucket_id = 'partner-documents' AND public.is_admin())$p$;
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- Public directory (/especialistas)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.list_public_partners(p_state text DEFAULT NULL, p_niche text DEFAULT NULL)
RETURNS TABLE (
  slug text, name text, partner_type text, city text, state text, niches text[], services text[],
  bio text, logo_url text, level_slug text, level_name text, certified boolean, instagram text, website text
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT pp.public_slug, COALESCE(pp.company_name, u.name), pp.partner_type, pp.city, pp.state, pp.niches, pp.services,
         pp.bio, pp.logo_url, l.slug, l.name, pp.certified_at IS NOT NULL, pp.instagram, pp.website
  FROM partner_profiles pp
  JOIN users u ON u.id = pp.user_id AND u.is_blocked = false
  JOIN partner_levels l ON l.id = pp.level_id
  WHERE pp.status = 'approved' AND pp.is_public AND pp.public_slug IS NOT NULL
    AND l.sort_order >= 2
    AND (p_state IS NULL OR pp.state = upper(p_state))
    AND (p_niche IS NULL OR p_niche = ANY (pp.niches))
  ORDER BY l.sort_order DESC, (pp.certified_at IS NOT NULL) DESC, pp.approved_at;
$$;
GRANT EXECUTE ON FUNCTION public.list_public_partners(text, text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_public_partner(p_slug text)
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT jsonb_build_object(
    'slug', pp.public_slug, 'name', COALESCE(pp.company_name, u.name), 'partner_type', pp.partner_type,
    'city', pp.city, 'state', pp.state, 'niches', pp.niches, 'services', pp.services, 'bio', pp.bio,
    'logo_url', pp.logo_url, 'instagram', pp.instagram, 'website', pp.website,
    'level_slug', l.slug, 'level_name', l.name, 'certified', pp.certified_at IS NOT NULL,
    'listed', pp.is_public AND l.sort_order >= 2,
    'portfolio', (
      SELECT COALESCE(jsonb_agg(jsonb_build_object('name', c.name, 'slug', c.slug) ORDER BY c.created_at DESC), '[]'::jsonb)
      FROM (
        SELECT cu.name, cu.slug, cu.created_at FROM users cu
        JOIN partner_store_access sa ON sa.store_user_id = cu.id AND sa.partner_id = pp.user_id AND sa.granted
        WHERE cu.managed_by_partner_id = pp.user_id AND cu.plan_status = 'active' AND cu.slug IS NOT NULL AND cu.is_blocked = false
        LIMIT 6
      ) c
    )
  )
  FROM partner_profiles pp
  JOIN users u ON u.id = pp.user_id AND u.is_blocked = false
  LEFT JOIN partner_levels l ON l.id = pp.level_id
  WHERE pp.public_slug = lower(p_slug) AND pp.status = 'approved';
$$;
GRANT EXECUTE ON FUNCTION public.get_public_partner(text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.submit_partner_directory_lead(p_slug text, p_name text, p_email text, p_whatsapp text, p_message text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_partner uuid;
  v_email text := NULLIF(lower(trim(p_email)), '');
  v_whatsapp text := NULLIF(regexp_replace(COALESCE(p_whatsapp, ''), '\D', '', 'g'), '');
BEGIN
  SELECT pp.user_id INTO v_partner FROM partner_profiles pp
  JOIN partner_levels l ON l.id = pp.level_id
  WHERE pp.public_slug = lower(p_slug) AND pp.status = 'approved' AND pp.is_public AND l.sort_order >= 2;
  IF v_partner IS NULL THEN RAISE EXCEPTION 'Especialista não encontrado.'; END IF;
  IF COALESCE(trim(p_name), '') = '' OR (v_email IS NULL AND (v_whatsapp IS NULL OR length(v_whatsapp) < 10)) THEN
    RAISE EXCEPTION 'Informe seu nome e um e-mail ou WhatsApp.';
  END IF;
  IF v_email IS NOT NULL AND v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' THEN
    RAISE EXCEPTION 'E-mail inválido.';
  END IF;
  IF (SELECT count(*) FROM partner_leads
      WHERE source = 'directory' AND created_at > now() - interval '1 day'
        AND ((v_email IS NOT NULL AND email = v_email) OR (v_whatsapp IS NOT NULL AND whatsapp = v_whatsapp))) >= 3 THEN
    RAISE EXCEPTION 'Você já enviou contatos hoje. O especialista vai responder em breve.';
  END IF;

  INSERT INTO partner_leads (partner_id, name, email, whatsapp, source, notes, stage)
  VALUES (v_partner, left(trim(p_name), 120), v_email, v_whatsapp, 'directory', left(p_message, 1000), 'contact');

  INSERT INTO notifications (user_id, type, title, message, related_entity_type)
  VALUES (v_partner, 'partner_lead', 'Novo contato pelo diretório!',
          left(trim(p_name), 120) || ' quer ajuda para montar a loja. Veja em Oportunidades.', 'partner_lead');
END;
$$;
GRANT EXECUTE ON FUNCTION public.submit_partner_directory_lead(text, text, text, text, text) TO anon, authenticated;

-- ---------------------------------------------------------------------------
-- Seed: academy
-- ---------------------------------------------------------------------------
INSERT INTO public.partner_courses (slug, title, description, sort_order) VALUES
  ('primeiros-passos', 'Primeiros passos no Partners', 'Como o programa funciona, como você ganha e como usar o painel.', 1),
  ('produto', 'Conhecendo o VitrineTurbo', 'O que o lojista ganha com a plataforma e como apresentar cada recurso.', 2),
  ('vendas', 'Como vender para pequenos lojistas', 'Prospecção, diagnóstico, objeções e fechamento.', 3),
  ('implantacao', 'Implantação em 1 hora', 'Do cadastro à loja publicada, pronta para vender.', 4)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO public.partner_lessons (course_id, slug, title, duration_minutes, sort_order, content_md)
SELECT c.id, v.slug, v.title, v.minutes, v.ord, v.body
FROM public.partner_courses c
JOIN (VALUES
  ('primeiros-passos', 'como-voce-ganha', 'Como você ganha', 6, 1,
$md$## Comissão recorrente

Você ganha uma porcentagem de **toda mensalidade paga** pelos clientes que trouxe, enquanto eles continuarem assinando. Não é uma comissão única: cada renovação gera uma nova comissão.

## Níveis

A porcentagem depende do seu nível. Ele é calculado pela receita mensal (MRR) da sua carteira ou pelo número de clientes ativos, o que for melhor para você.

- **Subir de nível é imediato.** No momento em que você atinge o critério, a nova taxa já vale para toda a carteira.
- **Descer de nível só acontece depois de 2 meses** abaixo do critério. Um mês ruim não derruba sua taxa.

## Carência de 30 dias

Toda comissão nasce **em carência** e fica disponível para saque depois de 30 dias. Isso protege o programa contra reembolsos e contestações. Se um pagamento for reembolsado ou contestado, a comissão correspondente é estornada.

## Planos anuais

Quando o cliente assina um plano anual, a comissão é paga em **12 parcelas mensais**. Você recebe todo mês, sem risco de devolver tudo se o cliente cancelar.

## Bônus

- **Primeira venda:** um bônus fixo se o seu primeiro cliente pagar nos primeiros 30 dias de programa.
- **Campanhas:** metas e multiplicadores divulgados no painel.
- **Indique um parceiro:** uma porcentagem da comissão dos parceiros que você trouxer, por 12 meses.
$md$),
  ('primeiros-passos', 'seu-painel', 'Seu painel em 10 minutos', 8, 2,
$md$## O que tem em cada área

- **Início:** sua receita de carteira, nível, saldo e alertas do que precisa de atenção hoje.
- **Clientes:** todos os lojistas que você trouxe, com a saúde de cada loja.
- **Nova loja:** crie a loja do cliente, configure e envie o convite para ele assumir.
- **Oportunidades:** registre seus contatos. Um contato registrado fica **protegido por 60 dias**: se ele assinar nesse período, o cliente é seu.
- **Links & Campanhas:** crie um link para cada canal (Instagram, WhatsApp, anúncio) e veja qual traz mais clientes.
- **Desempenho:** o funil de cliques até clientes pagantes.
- **Financeiro:** extrato, previsão e saques via PIX.
- **Materiais:** textos prontos, imagens e o gerador de proposta.

## Dica

Comece criando um link por canal. Assim você descobre onde vale a pena investir seu tempo.
$md$),
  ('primeiros-passos', 'regras', 'Regras e boas práticas', 5, 3,
$md$## O que é proibido

- Anunciar no Google ou em redes sociais usando a marca **VitrineTurbo** nas palavras-chave.
- Enviar spam ou usar listas de contatos compradas.
- Prometer recursos que a plataforma não tem.
- Se apresentar como funcionário ou como o próprio VitrineTurbo.
- Indicar a si mesmo ou criar contas falsas.

Descumprir essas regras pode levar ao estorno de comissões e ao encerramento da parceria.

## Dados dos clientes

Você terá acesso a dados dos seus clientes e das lojas deles. Use esses dados apenas para prestar o serviço, nunca para outros fins, conforme a LGPD. O acesso à loja do cliente depende da permissão dele, e ele pode revogar a qualquer momento.
$md$),
  ('produto', 'o-que-e', 'O que é o VitrineTurbo', 5, 1,
$md$## Em uma frase

O VitrineTurbo é a loja online do pequeno lojista: **catálogo profissional, estoque, pedidos e domínio próprio**, com venda pelo WhatsApp ou pagamento online via Pix e cartão.

## Para quem é

- Quem já vende pelo WhatsApp e Instagram e perde tempo mandando foto e preço um por um.
- Quem quer um site próprio sem pagar comissão por venda.
- Quem precisa de algo simples de manter no dia a dia.

## Como explicar ao cliente

Fale do problema dele, não do recurso: "Você vai mandar um link e o cliente escolhe sozinho, com foto, preço e tamanho. O pedido chega pronto no seu WhatsApp."
$md$),
  ('produto', 'recursos-que-vendem', 'Recursos que vendem', 8, 2,
$md$## Os argumentos que mais convertem

1. **Catálogo com link próprio:** um endereço para colocar na bio do Instagram e no status do WhatsApp.
2. **Pedido pronto no WhatsApp:** o cliente monta o carrinho e o lojista recebe a mensagem organizada.
3. **Pagamento online:** Pix e cartão direto na loja, para quem quer receber antes de separar o pedido.
4. **Domínio próprio:** a loja com o nome da marca, passando mais confiança.
5. **Estoque e pedidos em um só lugar:** menos planilha e menos erro.

## Como demonstrar

Use a **loja demo** do painel. Mostre o celular do comprador: abrir o link, escolher, finalizar. Em 2 minutos o lojista entende o valor.
$md$),
  ('produto', 'planos', 'Planos e como recomendar', 4, 3,
$md$## Qual plano indicar

- **Mensal:** para quem quer testar sem compromisso.
- **Trimestral e semestral:** bom equilíbrio entre preço e compromisso.
- **Anual:** o menor custo por mês. Indique para quem já vende bem e quer economizar.

Os preços atualizados ficam na página de planos e na calculadora do programa. Nunca prometa preço diferente do oficial.

## Teste grátis

Todo cliente que entra pelo seu link ganha **teste grátis**. Use isso no fechamento: "Monta comigo hoje, você testa sem pagar nada e só assina se gostar."
$md$),
  ('vendas', 'prospeccao', 'Onde encontrar clientes', 7, 1,
$md$## Comece pela sua carteira

Seus clientes atuais de social media, tráfego ou design são os primeiros candidatos. Eles já confiam em você.

## Depois, vá onde o lojista está

- Lojas de bairro com Instagram ativo, mas sem site.
- Perfis que respondem "chama no direct" para saber o preço.
- Feiras, bazares e grupos de empreendedores da sua cidade.

## Registre tudo em Oportunidades

Cada contato registrado fica protegido por 60 dias. Se outro parceiro trouxer o mesmo lojista nesse período, o cliente continua sendo seu.
$md$),
  ('vendas', 'diagnostico', 'Abordagem e diagnóstico', 6, 2,
$md$## Três perguntas que abrem a conversa

1. "Como seus clientes escolhem os produtos hoje?"
2. "Quanto tempo por dia você gasta respondendo preço e foto?"
3. "Quantas vendas você acha que perde porque demorou a responder?"

## Mostre, não explique

Depois das respostas, abra a loja demo no celular dele. Peça para ele mesmo fazer um pedido de teste.
$md$),
  ('vendas', 'objecoes', 'Objeções comuns', 8, 3,
$md$## "Já vendo pelo Instagram"

Ótimo, a loja não substitui o Instagram, ela **fecha a venda** que o Instagram começa. O link vai na bio.

## "Não tenho tempo para cadastrar produtos"

Você cadastra para ele. A implantação é o seu serviço, e é por ela que você cobra.

## "É caro"

Compare com uma venda perdida por semana. Na maioria das lojas, uma venda a mais por mês já paga o plano.

## "Vou pensar"

Ofereça o teste grátis e marque a data de revisão. Registre em Oportunidades com a próxima ação.
$md$),
  ('vendas', 'fechamento', 'Fechando a venda', 5, 4,
$md$## O roteiro

1. Monte a loja junto com o cliente, ou crie pelo painel em **Nova loja**.
2. Envie o convite: ele define a senha e já entra com a loja pronta.
3. Durante o teste, publique o link na bio e no status do WhatsApp dele.
4. No fim do teste, ajude a escolher o plano.

## Cobre pela implantação

O VitrineTurbo paga a comissão recorrente. A implantação, a configuração e a gestão são serviços seus: cobre por eles.
$md$),
  ('implantacao', 'checklist', 'Checklist de implantação', 6, 1,
$md$## Antes de começar, peça ao cliente

- Logo e cores da marca.
- Lista de produtos com preço, variações e estoque (planilha ajuda).
- Fotos dos produtos.
- WhatsApp que vai receber os pedidos.

## Ordem recomendada

1. Dados da loja e WhatsApp.
2. Aparência (tema, logo, banner).
3. Categorias.
4. Produtos (use a importação em massa para muitos itens).
5. Pagamentos e entrega.
6. Domínio próprio, se o cliente tiver.
7. Pedido de teste.
$md$),
  ('implantacao', 'entrega', 'Entregando a loja ao cliente', 5, 2,
$md$## Convite

Em **Clientes**, abra a loja e clique em **Enviar convite**. O cliente recebe um link válido por 7 dias para definir a senha.

## Acesso de gestor

Ao aceitar, o cliente escolhe se você continua com acesso para gerenciar a loja. Ele pode mudar isso depois nas configurações. Combine com ele antes, principalmente se você vai cobrar pela gestão mensal.

## Treinamento rápido

Mostre ao cliente como cadastrar um produto, ver um pedido e mudar o estoque. Cinco minutos de treino evitam muitos chamados.
$md$)
) AS v(course_slug, slug, title, minutes, ord, body) ON v.course_slug = c.slug
ON CONFLICT (course_id, slug) DO NOTHING;

INSERT INTO public.partner_quiz_questions (question, options, correct_index, sort_order)
SELECT * FROM (VALUES
  ('Quando uma comissão fica disponível para saque?', ARRAY['Na hora em que o cliente paga', 'Depois da carência de 30 dias', 'Só no fim do ano', 'Quando o cliente renova'], 1, 1),
  ('O que acontece com a comissão se o pagamento do cliente for reembolsado?', ARRAY['Nada, a comissão é mantida', 'A comissão é estornada', 'A comissão dobra', 'O cliente paga a comissão'], 1, 2),
  ('Como é paga a comissão de um plano anual?', ARRAY['Tudo de uma vez', 'Em 12 parcelas mensais', 'Só no final do ano', 'Não gera comissão'], 1, 3),
  ('Por quanto tempo um contato registrado em Oportunidades fica protegido?', ARRAY['7 dias', '30 dias', '60 dias', 'Para sempre'], 2, 4),
  ('Qual destas práticas é proibida?', ARRAY['Criar um link por canal', 'Anunciar usando a marca VitrineTurbo como palavra-chave', 'Oferecer o teste grátis', 'Cobrar pela implantação'], 1, 5),
  ('Quando a nova taxa de um nível superior passa a valer?', ARRAY['Imediatamente, para toda a carteira', 'Só para clientes novos', 'No ano seguinte', 'Depois de 2 meses'], 0, 6),
  ('O que é preciso para gerenciar a loja de um cliente pelo painel?', ARRAY['Nada, o acesso é automático para sempre', 'A permissão do cliente, que ele pode revogar', 'A senha do cliente', 'Pagar uma taxa'], 1, 7),
  ('Qual é a melhor forma de demonstrar o VitrineTurbo?', ARRAY['Enviar um PDF longo', 'Mostrar a loja demo no celular e deixar o cliente fazer um pedido', 'Falar só do preço', 'Mandar o link do site institucional'], 1, 8),
  ('Quem define a senha do cliente em uma loja criada pelo parceiro?', ARRAY['O parceiro', 'O suporte', 'O próprio cliente, pelo convite', 'Ninguém'], 2, 9),
  ('Qual resposta é adequada para "já vendo pelo Instagram"?', ARRAY['Pare de usar o Instagram', 'A loja fecha a venda que o Instagram começa; o link vai na bio', 'O Instagram vai acabar', 'Não responda'], 1, 10)
) AS v(question, options, correct_index, sort_order)
WHERE NOT EXISTS (SELECT 1 FROM public.partner_quiz_questions);

-- ---------------------------------------------------------------------------
-- Seed: copy library
-- ---------------------------------------------------------------------------
INSERT INTO public.partner_assets (title, category, channel, sort_order, body_text)
SELECT * FROM (VALUES
  ('Primeira abordagem no WhatsApp', 'copy', 'whatsapp', 1,
   $t$Oi, {nome}! Tudo bem? Vi o perfil da {loja} e reparei que os pedidos são feitos pelo direct. Hoje eu monto lojas online para negócios como o seu: o cliente escolhe os produtos sozinho, com foto e preço, e o pedido chega pronto no seu WhatsApp. Posso te mostrar em 2 minutos como ficaria?$t$),
  ('Follow-up depois da demonstração', 'copy', 'whatsapp', 2,
   $t${nome}, como combinamos, segue o link para você testar grátis: {link}

Se quiser, eu já cadastro os produtos para você e te entrego a loja pronta. Qual dia fica bom?$t$),
  ('Legenda para Instagram (carrossel)', 'copy', 'instagram', 3,
   $t$Seu cliente pergunta "quanto custa?" e você responde 30 vezes por dia? 🙋

Com uma loja online, ele vê foto, preço e tamanho sozinho, e o pedido chega pronto no seu WhatsApp. Pix e cartão também.

Eu monto a sua. Chama no direct ou toque no link da bio. 👆$t$),
  ('Stories: pergunta para gerar conversa', 'copy', 'instagram', 4,
   $t$Enquete: "Você perde venda porque demora a responder no direct?" Sim / Às vezes. Quem votar, chame no direct com a demonstração da loja.$t$),
  ('E-mail para carteira de clientes', 'copy', 'email', 5,
   $t$Assunto: Uma loja online para a {loja}, pronta em poucos dias

Olá, {nome}!

Além do trabalho que já fazemos juntos, agora eu monto lojas online completas: catálogo com fotos e preços, pedidos pelo WhatsApp, pagamento por Pix e cartão e domínio próprio.

Você testa grátis antes de assinar, e eu cuido de toda a configuração.

Posso te mostrar como ficaria a sua? Responda este e-mail e marcamos 15 minutos.

Abraço,
{seu nome}$t$),
  ('Post para LinkedIn (agências)', 'copy', 'linkedin', 6,
   $t$Pequenos negócios vendem pelo Instagram, mas fecham no WhatsApp, e é ali que muita venda se perde.

Começamos a entregar lojas online completas para nossos clientes: catálogo, pedido pronto no WhatsApp, Pix e cartão, domínio próprio. A implantação leva poucos dias e o cliente testa grátis.

Se você tem um negócio local e quer vender mais sem depender só do direct, fale com a gente.$t$),
  ('Objeção: "é caro"', 'faq', 'geral', 7,
   $t$Compare com uma venda perdida por semana. Na maioria das lojas, uma venda a mais por mês já paga o plano. E dá para testar grátis antes de decidir.$t$),
  ('Objeção: "não tenho tempo"', 'faq', 'geral', 8,
   $t$Você não precisa fazer nada técnico: eu cadastro os produtos e entrego a loja pronta. No dia a dia, atualizar estoque e preço leva poucos minutos pelo celular.$t$),
  ('Objeção: "já vendo pelo Instagram"', 'faq', 'geral', 9,
   $t$A loja não substitui o Instagram, ela fecha a venda que o Instagram começa. O link vai na bio e no status do WhatsApp, e o cliente compra sem esperar resposta.$t$),
  ('Objeção: "e se eu não gostar?"', 'faq', 'geral', 10,
   $t$Você testa grátis antes de assinar, com a loja já montada. Só assina se fizer sentido para o seu negócio.$t$)
) AS v(title, category, channel, sort_order, body_text)
WHERE NOT EXISTS (SELECT 1 FROM public.partner_assets);


-- =====================================================================
-- 20261103130000_partners_v2_portfolio_rpcs.sql
-- =====================================================================

/*
  # Partners v2 — portfolio, funnel and store-consent RPCs

  1. Changes
    - partner_clients(): the caller's portfolio with store health signals
      (products, orders in 30 days, custom domain, last login, subscription,
      consent, origin, commissions). Partners can't read clients' products or
      orders through RLS, so these are aggregated server-side and only for
      clients managed by the caller's partner scope.
    - partner_funnel(p_days): clicks → signups → paying, per link.
    - accept_partner_store_invite(p_grant): the client records whether the
      partner keeps manager access when taking over a store built for them.
    - set_partner_store_access(p_grant): the client toggles that consent later
      from their own dashboard.
*/

CREATE OR REPLACE FUNCTION public.partner_clients()
RETURNS TABLE (
  id uuid,
  name text,
  owner_name text,
  email text,
  whatsapp text,
  slug text,
  plan_status text,
  trial_ends_at timestamptz,
  is_blocked boolean,
  created_at timestamptz,
  last_login_at timestamptz,
  plan_name text,
  plan_price numeric,
  billing_cycle text,
  next_payment_date date,
  monthly_value numeric,
  products_count integer,
  orders_30d integer,
  has_custom_domain boolean,
  access_granted boolean,
  client_accepted boolean,
  origin text,
  commission_total numeric,
  health text
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  WITH scope AS (
    SELECT public.partner_scope_id() AS pid, public.partner_team_role() AS role
  )
  SELECT
    u.id, u.name, u.owner_name, u.email, u.whatsapp, u.slug, u.plan_status, u.trial_ends_at, u.is_blocked,
    u.created_at, u.last_login_at,
    s.plan_name, s.plan_price, s.billing_cycle::text, s.next_payment_date::date,
    CASE WHEN s.plan_price IS NOT NULL THEN round(s.plan_price / public.partner_cycle_months(s.billing_cycle::text), 2) END,
    COALESCE(p.cnt, 0)::integer,
    COALESCE(o.cnt, 0)::integer,
    EXISTS (SELECT 1 FROM custom_domains d WHERE d.user_id = u.id AND d.status = 'active'),
    COALESCE(sa.granted, false),
    sa.client_accepted_at IS NOT NULL OR sa.store_user_id IS NULL,
    COALESCE(a.source, 'legacy'),
    CASE WHEN (SELECT role FROM scope) = 'owner' THEN COALESCE(c.total, 0) END,
    CASE
      WHEN u.is_blocked THEN 'blocked'
      WHEN u.plan_status IN ('expired', 'suspended', 'trial_expired') THEN 'lapsed'
      WHEN u.plan_status = 'trial' AND u.trial_ends_at < now() + interval '3 days' THEN 'at_risk'
      WHEN u.plan_status = 'active' AND s.next_payment_date IS NOT NULL AND s.next_payment_date < now() + interval '5 days' THEN 'renewing'
      WHEN COALESCE(p.cnt, 0) = 0 THEN 'setup'
      WHEN COALESCE(u.last_login_at, u.created_at) < now() - interval '21 days' AND COALESCE(o.cnt, 0) = 0 THEN 'at_risk'
      ELSE 'healthy'
    END
  FROM users u
  CROSS JOIN scope
  LEFT JOIN LATERAL (
    SELECT sub.plan_name, sub.plan_price, sub.billing_cycle, sub.next_payment_date
    FROM subscriptions sub WHERE sub.user_id = u.id
    ORDER BY (sub.status = 'active') DESC, sub.next_payment_date DESC NULLS LAST
    LIMIT 1
  ) s ON true
  LEFT JOIN LATERAL (SELECT count(*) cnt FROM products pr WHERE pr.user_id = u.id) p ON true
  LEFT JOIN LATERAL (
    SELECT count(*) cnt FROM orders ord WHERE ord.store_owner_id = u.id AND ord.created_at > now() - interval '30 days'
  ) o ON true
  LEFT JOIN partner_store_access sa ON sa.store_user_id = u.id
  LEFT JOIN partner_attributions a ON a.user_id = u.id
  LEFT JOIN LATERAL (
    SELECT sum(amount) total FROM partner_commissions pc
    WHERE pc.managed_user_id = u.id AND pc.partner_id = scope.pid AND pc.status <> 'reversed'
  ) c ON true
  WHERE scope.role IS NOT NULL
    AND u.managed_by_partner_id = scope.pid
  ORDER BY u.created_at DESC;
$$;
REVOKE ALL ON FUNCTION public.partner_clients() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.partner_clients() TO authenticated;

CREATE OR REPLACE FUNCTION public.partner_funnel(p_days integer DEFAULT 30)
RETURNS TABLE (
  link_id uuid,
  link_name text,
  link_slug text,
  clicks integer,
  signups integer,
  paying integer
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  WITH scope AS (SELECT public.partner_scope_id() AS pid, public.partner_team_role() AS role),
  since AS (SELECT now() - make_interval(days => GREATEST(LEAST(COALESCE(p_days, 30), 365), 1)) AS t)
  SELECT
    l.id, l.name, l.slug,
    (SELECT count(*) FROM partner_clicks c, since WHERE c.link_id = l.id AND c.created_at >= since.t)::integer,
    (SELECT count(*) FROM partner_attributions a, since WHERE a.link_id = l.id AND a.attributed_at >= since.t)::integer,
    (SELECT count(*) FROM partner_attributions a JOIN users u ON u.id = a.user_id, since
      WHERE a.link_id = l.id AND a.attributed_at >= since.t AND u.plan_status = 'active')::integer
  FROM partner_links l, scope
  WHERE scope.role IS NOT NULL AND l.partner_id = scope.pid
  UNION ALL
  -- Signups not tied to a specific link (direct creation, legacy ?ref, leads, coupons on the default link…)
  SELECT
    NULL, 'Sem link específico', NULL,
    (SELECT count(*) FROM partner_clicks c, since, scope WHERE c.partner_id = scope.pid AND c.link_id IS NULL AND c.created_at >= since.t)::integer,
    (SELECT count(*) FROM partner_attributions a, since, scope WHERE a.partner_id = scope.pid AND a.link_id IS NULL AND a.attributed_at >= since.t)::integer,
    (SELECT count(*) FROM partner_attributions a JOIN users u ON u.id = a.user_id, since, scope
      WHERE a.partner_id = scope.pid AND a.link_id IS NULL AND a.attributed_at >= since.t AND u.plan_status = 'active')::integer
  FROM scope WHERE scope.role IS NOT NULL;
$$;
REVOKE ALL ON FUNCTION public.partner_funnel(integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.partner_funnel(integer) TO authenticated;

CREATE OR REPLACE FUNCTION public.accept_partner_store_invite(p_grant boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE partner_store_access
  SET client_accepted_at = COALESCE(client_accepted_at, now()),
      granted = p_grant,
      granted_at = CASE WHEN p_grant THEN now() ELSE granted_at END,
      revoked_at = CASE WHEN p_grant THEN NULL ELSE now() END,
      updated_at = now()
  WHERE store_user_id = auth.uid();

  INSERT INTO partner_audit_log (partner_id, actor_id, action, target_user_id, details)
  SELECT partner_id, auth.uid(), 'client_accepted_store', auth.uid(), jsonb_build_object('manager_access', p_grant)
  FROM partner_store_access WHERE store_user_id = auth.uid();
END;
$$;
REVOKE ALL ON FUNCTION public.accept_partner_store_invite(boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.accept_partner_store_invite(boolean) TO authenticated;

CREATE OR REPLACE FUNCTION public.set_partner_store_access(p_grant boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_partner uuid;
BEGIN
  SELECT managed_by_partner_id INTO v_partner FROM users WHERE id = auth.uid();
  IF v_partner IS NULL THEN RAISE EXCEPTION 'Sua loja não é gerenciada por um parceiro.'; END IF;

  INSERT INTO partner_store_access (store_user_id, partner_id, granted, client_accepted_at)
  VALUES (auth.uid(), v_partner, p_grant, now())
  ON CONFLICT (store_user_id) DO UPDATE SET granted = EXCLUDED.granted;

  INSERT INTO partner_audit_log (partner_id, actor_id, action, target_user_id, details)
  VALUES (v_partner, auth.uid(), CASE WHEN p_grant THEN 'store_access_granted' ELSE 'store_access_revoked' END, auth.uid(), '{}'::jsonb);

  INSERT INTO notifications (user_id, type, title, message, related_entity_id, related_entity_type)
  SELECT v_partner, 'partner_store_access',
         CASE WHEN p_grant THEN 'Acesso de gestor liberado' ELSE 'Acesso de gestor revogado' END,
         COALESCE(name, 'Um cliente') || CASE WHEN p_grant THEN ' liberou' ELSE ' revogou' END || ' o seu acesso para gerenciar a loja.',
         auth.uid(), 'partner_store_access'
  FROM users WHERE id = auth.uid();
END;
$$;
REVOKE ALL ON FUNCTION public.set_partner_store_access(boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_partner_store_access(boolean) TO authenticated;

-- Store owners can see who manages them (for the consent card).
CREATE OR REPLACE FUNCTION public.my_store_partner()
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT jsonb_build_object(
    'partner_name', COALESCE(pp.company_name, p.name),
    'partner_whatsapp', p.whatsapp,
    'granted', COALESCE(sa.granted, false),
    'has_access_record', sa.store_user_id IS NOT NULL
  )
  FROM users u
  JOIN users p ON p.id = u.managed_by_partner_id
  LEFT JOIN partner_profiles pp ON pp.user_id = p.id
  LEFT JOIN partner_store_access sa ON sa.store_user_id = u.id
  WHERE u.id = auth.uid();
$$;
REVOKE ALL ON FUNCTION public.my_store_partner() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.my_store_partner() TO authenticated;


-- =====================================================================
-- 20261103140000_partners_v2_admin.sql
-- =====================================================================

/*
  # Partners v2 — admin reporting and manual adjustments

  1. Changes
    - admin_partner_program_stats(): program KPIs for the admin overview
      (partners, activation, partner-sourced MRR vs. total, commissions,
      pending applications/withdrawals, open fraud flags).
    - admin_partner_list(): every partner with level, portfolio and sales
      metrics in one call.
    - admin_partner_adjustment(): manual credit/debit on a partner's ledger
      with an audit entry (e.g. goodwill bonus, correction).
    - All are admin-only (is_admin() check inside, anon revoked).
*/

CREATE OR REPLACE FUNCTION public.admin_partner_program_stats()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  v jsonb;
BEGIN
  IF NOT is_admin() THEN RAISE EXCEPTION 'Apenas administradores.' USING ERRCODE = '42501'; END IF;

  WITH active_subs AS (
    SELECT DISTINCT ON (s.user_id) s.user_id, s.plan_price / partner_cycle_months(s.billing_cycle::text) AS monthly
    FROM subscriptions s
    JOIN users u ON u.id = s.user_id AND u.plan_status = 'active'
    WHERE s.status = 'active'
    ORDER BY s.user_id, s.next_payment_date DESC
  ),
  totals AS (
    SELECT
      COALESCE(SUM(a.monthly), 0) AS mrr_total,
      COALESCE(SUM(a.monthly) FILTER (WHERE u.managed_by_partner_id IS NOT NULL), 0) AS mrr_partners,
      COUNT(*) FILTER (WHERE u.managed_by_partner_id IS NOT NULL) AS paying_partner_clients,
      COUNT(*) AS paying_total
    FROM active_subs a JOIN users u ON u.id = a.user_id
  )
  SELECT jsonb_build_object(
    'partners_total', (SELECT count(*) FROM partner_profiles),
    'partners_approved', (SELECT count(*) FROM partner_profiles WHERE status = 'approved'),
    'partners_active_90d', (SELECT count(*) FROM partner_profiles WHERE status = 'approved' AND last_sale_at > now() - interval '90 days'),
    'partners_new_30d', (SELECT count(*) FROM partner_profiles WHERE approved_at > now() - interval '30 days'),
    'activation_rate', (
      SELECT CASE WHEN count(*) = 0 THEN 0 ELSE round(100.0 * count(*) FILTER (WHERE first_sale <= approved_at + interval '30 days') / count(*), 1) END
      FROM (
        SELECT pp.approved_at, (SELECT min(pc.created_at) FROM partner_commissions pc WHERE pc.partner_id = pp.user_id AND pc.type = 'new') AS first_sale
        FROM partner_profiles pp
        WHERE pp.approved_at < now() - interval '30 days'
      ) x
    ),
    'mrr_total', (SELECT round(mrr_total, 2) FROM totals),
    'mrr_partners', (SELECT round(mrr_partners, 2) FROM totals),
    'paying_partner_clients', (SELECT paying_partner_clients FROM totals),
    'paying_total', (SELECT paying_total FROM totals),
    'new_partner_clients_30d', (SELECT count(*) FROM partner_commissions WHERE type = 'new' AND created_at > now() - interval '30 days'),
    'commissions_month', (SELECT COALESCE(sum(amount), 0) FROM partner_commissions WHERE status <> 'reversed' AND created_at >= date_trunc('month', now())),
    'liability_holding', (SELECT COALESCE(sum(amount), 0) FROM partner_commissions WHERE status = 'holding'),
    'liability_available', (SELECT COALESCE(sum(amount), 0) FROM partner_commissions WHERE status IN ('available', 'requested')),
    'paid_total', (SELECT COALESCE(sum(amount), 0) FROM partner_commissions WHERE status = 'paid'),
    'applications_pending', (SELECT count(*) FROM partner_applications WHERE status IN ('pending', 'needs_info')),
    'withdrawals_pending', (SELECT count(*) FROM withdrawal_requests WHERE source = 'partner' AND status = 'pending'),
    'fraud_open', (SELECT count(*) FROM partner_fraud_flags WHERE status = 'open'),
    'churn_partner_clients_90d', (
      SELECT count(*) FROM users u
      WHERE u.managed_by_partner_id IS NOT NULL AND u.plan_status IN ('expired', 'suspended')
        AND u.plan_status_changed_at > now() - interval '90 days'
    ),
    'churn_organic_90d', (
      SELECT count(*) FROM users u
      WHERE u.managed_by_partner_id IS NULL AND u.role = 'corretor' AND u.plan_status IN ('expired', 'suspended')
        AND u.plan_status_changed_at > now() - interval '90 days'
    )
  ) INTO v;
  RETURN v;
END;
$$;
REVOKE ALL ON FUNCTION public.admin_partner_program_stats() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_partner_program_stats() TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_partner_list()
RETURNS TABLE (
  user_id uuid,
  name text,
  email text,
  whatsapp text,
  company_name text,
  partner_type text,
  status text,
  level_id uuid,
  level_name text,
  rate numeric,
  is_founder boolean,
  payouts_frozen boolean,
  certified boolean,
  commission_override numeric,
  min_commission_percentage numeric,
  founder_bonus_pp numeric,
  public_slug text,
  approved_at timestamptz,
  last_sale_at timestamptz,
  clients_total integer,
  clients_active integer,
  mrr numeric,
  earned_total numeric,
  balance_available numeric,
  team_size integer,
  open_flags integer,
  admin_notes text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
BEGIN
  IF NOT is_admin() THEN RAISE EXCEPTION 'Apenas administradores.' USING ERRCODE = '42501'; END IF;
  RETURN QUERY
  SELECT
    pp.user_id, u.name, u.email, u.whatsapp, pp.company_name, pp.partner_type, pp.status,
    pp.level_id, l.name, partner_effective_rate(pp.user_id), pp.is_founder, pp.payouts_frozen,
    pp.certified_at IS NOT NULL, pp.commission_override, pp.min_commission_percentage, pp.founder_bonus_pp,
    pp.public_slug, pp.approved_at, pp.last_sale_at,
    (SELECT count(*)::integer FROM users c WHERE c.managed_by_partner_id = pp.user_id),
    st.active_clients, st.mrr,
    (SELECT COALESCE(sum(amount), 0) FROM partner_commissions pc WHERE pc.partner_id = pp.user_id AND pc.status <> 'reversed'),
    (SELECT COALESCE(sum(amount), 0) FROM partner_commissions pc WHERE pc.partner_id = pp.user_id AND pc.status = 'available'),
    (SELECT count(*)::integer FROM partner_team_members t WHERE t.partner_id = pp.user_id),
    (SELECT count(*)::integer FROM partner_fraud_flags f WHERE f.partner_id = pp.user_id AND f.status = 'open'),
    pp.admin_notes
  FROM partner_profiles pp
  JOIN users u ON u.id = pp.user_id
  LEFT JOIN partner_levels l ON l.id = pp.level_id
  CROSS JOIN LATERAL partner_portfolio_stats(pp.user_id) st
  ORDER BY st.mrr DESC, pp.approved_at;
END;
$$;
REVOKE ALL ON FUNCTION public.admin_partner_list() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_partner_list() TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_partner_adjustment(p_partner_id uuid, p_amount numeric, p_description text, p_available boolean DEFAULT true)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
BEGIN
  IF NOT is_admin() THEN RAISE EXCEPTION 'Apenas administradores.' USING ERRCODE = '42501'; END IF;
  IF p_amount IS NULL OR p_amount = 0 THEN RAISE EXCEPTION 'Informe um valor diferente de zero.'; END IF;
  IF COALESCE(trim(p_description), '') = '' THEN RAISE EXCEPTION 'Informe o motivo do ajuste.'; END IF;
  IF NOT EXISTS (SELECT 1 FROM partner_profiles WHERE user_id = p_partner_id) THEN RAISE EXCEPTION 'Parceiro não encontrado.'; END IF;

  INSERT INTO partner_commissions (partner_id, amount, type, status, available_at, description)
  VALUES (
    p_partner_id, round(p_amount, 2), 'adjustment',
    CASE WHEN p_available THEN 'available' ELSE 'holding' END,
    CASE WHEN p_available THEN now() ELSE now() + make_interval(days => (SELECT holding_days FROM partner_settings LIMIT 1)) END,
    left(trim(p_description), 300)
  ) RETURNING id INTO v_id;

  INSERT INTO partner_audit_log (partner_id, actor_id, action, details)
  VALUES (p_partner_id, auth.uid(), 'manual_adjustment', jsonb_build_object('amount', p_amount, 'description', p_description, 'commission_id', v_id));

  INSERT INTO notifications (user_id, type, title, message, related_entity_type)
  VALUES (p_partner_id, 'partner_commission',
          CASE WHEN p_amount > 0 THEN 'Crédito na sua conta de parceiro' ELSE 'Ajuste na sua conta de parceiro' END,
          left(trim(p_description), 200) || ' (R$ ' || to_char(p_amount, 'FM999G999G990D00') || ')', 'partner_commission');
  RETURN v_id;
END;
$$;
REVOKE ALL ON FUNCTION public.admin_partner_adjustment(uuid, numeric, text, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_partner_adjustment(uuid, numeric, text, boolean) TO authenticated;

-- Admin reversal of a single commission (e.g. confirmed fraud).
CREATE OR REPLACE FUNCTION public.admin_partner_reverse_commission(p_commission_id uuid, p_reason text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r partner_commissions%ROWTYPE;
BEGIN
  IF NOT is_admin() THEN RAISE EXCEPTION 'Apenas administradores.' USING ERRCODE = '42501'; END IF;
  SELECT * INTO r FROM partner_commissions WHERE id = p_commission_id FOR UPDATE;
  IF r.id IS NULL OR r.status = 'reversed' THEN RAISE EXCEPTION 'Comissão não encontrada ou já estornada.'; END IF;

  IF r.status IN ('holding', 'available') THEN
    UPDATE partner_commissions SET status = 'reversed', reversed_at = now(), reversal_reason = left(p_reason, 200) WHERE id = r.id;
  ELSE
    INSERT INTO partner_commissions (partner_id, managed_user_id, subscription_id, amount, type, status, available_at,
                                     source_commission_id, description, next_payment_date_at_generation, installment_number)
    VALUES (r.partner_id, r.managed_user_id, r.subscription_id, -r.amount, 'clawback', 'available', now(), r.id,
            'Estorno: ' || left(p_reason, 180), r.next_payment_date_at_generation, r.installment_number)
    ON CONFLICT DO NOTHING;
  END IF;

  INSERT INTO partner_audit_log (partner_id, actor_id, action, target_user_id, details)
  VALUES (r.partner_id, auth.uid(), 'commission_reversed', r.managed_user_id, jsonb_build_object('commission_id', r.id, 'reason', p_reason));
END;
$$;
REVOKE ALL ON FUNCTION public.admin_partner_reverse_commission(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_partner_reverse_commission(uuid, text) TO authenticated;


-- Registra as migrações como aplicadas, para um futuro `supabase db push`
-- não tentar rodá-las de novo.
DO $$
BEGIN
  IF to_regclass('supabase_migrations.schema_migrations') IS NOT NULL THEN
    INSERT INTO supabase_migrations.schema_migrations (version, name) VALUES
      ('20261103100000', 'protect_users_sensitive_columns'),
      ('20261103110000', 'partners_v2_core'),
      ('20261103120000', 'partners_v2_content'),
      ('20261103130000', 'partners_v2_portfolio_rpcs'),
      ('20261103140000', 'partners_v2_admin')
    ON CONFLICT (version) DO NOTHING;
  END IF;
END $$;

COMMIT;
