/*
  # Landing campaigns (Black Friday, Natal, Ano Novo...)

  Purely a DISPLAY layer for the landing page pricing section: strikethrough
  prices, a themed badge, an optional ribbon with countdown and an optional top
  bar. It never touches payments — the discount a new user actually receives
  after signup is still the "Desconto de Boas-vindas" (promotional_offers row with
  gatilho 'bloqueio_planos'), so there is no path for a renewal to get a
  campaign discount.

  - `plan_ids` holds landing plan ids ('mensal', 'semestral', 'anual'); empty = all.
  - Active campaigns can't overlap in time (exclusion constraint), so the landing
    never has to pick between two live campaigns.
  - Visitors (anon) can read only the campaign that is live right now.
*/

CREATE TABLE IF NOT EXISTS public.landing_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  theme text NOT NULL DEFAULT 'personalizada'
    CHECK (theme IN ('black_friday', 'natal', 'ano_novo', 'consumidor', 'personalizada')),
  title text NOT NULL DEFAULT '',
  subtitle text NOT NULL DEFAULT '',
  badge_text text NOT NULL DEFAULT '',
  discount_type text NOT NULL DEFAULT 'percent' CHECK (discount_type IN ('percent', 'fixed')),
  discount_value numeric(10,2) NOT NULL CHECK (discount_value > 0),
  plan_ids text[] NOT NULL DEFAULT '{}',
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  show_ribbon boolean NOT NULL DEFAULT true,
  show_countdown boolean NOT NULL DEFAULT true,
  show_top_bar boolean NOT NULL DEFAULT false,
  primary_color text NOT NULL DEFAULT '#0A0A0A',
  accent_color text NOT NULL DEFAULT '#F5B301',
  text_color text NOT NULL DEFAULT '#FFFFFF',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT landing_campaigns_period_check CHECK (ends_at > starts_at),
  CONSTRAINT landing_campaigns_no_overlap
    EXCLUDE USING gist (tstzrange(starts_at, ends_at) WITH &&) WHERE (is_active)
);

CREATE INDEX IF NOT EXISTS landing_campaigns_window_idx
  ON public.landing_campaigns (starts_at, ends_at) WHERE is_active;

CREATE OR REPLACE FUNCTION public.landing_campaigns_touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS landing_campaigns_touch_updated_at ON public.landing_campaigns;
CREATE TRIGGER landing_campaigns_touch_updated_at
  BEFORE UPDATE ON public.landing_campaigns
  FOR EACH ROW EXECUTE FUNCTION public.landing_campaigns_touch_updated_at();

ALTER TABLE public.landing_campaigns ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can read the live landing campaign" ON public.landing_campaigns;
CREATE POLICY "Public can read the live landing campaign"
  ON public.landing_campaigns FOR SELECT TO anon, authenticated
  USING (is_active AND starts_at <= now() AND ends_at > now());

DROP POLICY IF EXISTS "Admins manage landing campaigns" ON public.landing_campaigns;
CREATE POLICY "Admins manage landing campaigns"
  ON public.landing_campaigns FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

REVOKE ALL ON public.landing_campaigns FROM anon;
GRANT SELECT ON public.landing_campaigns TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.landing_campaigns TO authenticated;
