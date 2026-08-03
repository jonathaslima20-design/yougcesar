/*
  # Create affiliate_teaser_events

  1. Problem
    - The "Afiliados" pulsing menu teaser (DashboardSidebar.tsx, added in the
      previous migration batch alongside affiliate_teaser_hidden) shows a
      promo modal with a WhatsApp CTA to merchants without
      affiliate_program_enabled, but nothing records who saw it or clicked
      the CTA. The admin panel needs a "Monitoramento" page listing this.

  2. New Tables
    - `affiliate_teaser_events`
      - `id` (uuid, PK)
      - `user_id` (uuid, FK -> users.id, ON DELETE CASCADE) - the merchant
        who triggered the event.
      - `event_type` (text, 'view' | 'whatsapp_click')
      - `created_at` (timestamptz)

  3. New Functions
    - `list_affiliate_teaser_monitoring()` - aggregates events per user
      (views_count, clicks_count, first/last viewed, last clicked) joined
      with the merchant's name/email, for the admin monitoring page. Plain
      SQL, SECURITY INVOKER (no DEFINER needed): RLS on both
      affiliate_teaser_events and users already restricts results to admins,
      so a non-admin caller simply sees an empty aggregate.

  4. Security
    - INSERT restricted to the authenticated user recording their own event
      (`user_id = auth.uid()`), same shape as affiliate_clicks but scoped to
      the merchant themselves rather than open to anon.
    - SELECT restricted to admins via public.is_admin(), same helper used by
      affiliate_clicks and the users table RLS.
*/

CREATE TABLE IF NOT EXISTS public.affiliate_teaser_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  event_type text NOT NULL CHECK (event_type IN ('view', 'whatsapp_click')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_affiliate_teaser_events_user_id_created_at
  ON public.affiliate_teaser_events (user_id, created_at DESC);

ALTER TABLE public.affiliate_teaser_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can record own teaser events" ON public.affiliate_teaser_events;
CREATE POLICY "Users can record own teaser events"
  ON public.affiliate_teaser_events FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Admins can view all teaser events" ON public.affiliate_teaser_events;
CREATE POLICY "Admins can view all teaser events"
  ON public.affiliate_teaser_events FOR SELECT
  TO authenticated
  USING (public.is_admin());

CREATE OR REPLACE FUNCTION public.list_affiliate_teaser_monitoring()
RETURNS TABLE (
  user_id uuid,
  user_name text,
  user_email text,
  views_count bigint,
  clicks_count bigint,
  first_viewed_at timestamptz,
  last_viewed_at timestamptz,
  last_clicked_at timestamptz
)
LANGUAGE sql
STABLE
AS $$
  SELECT
    u.id,
    u.name,
    u.email,
    COUNT(*) FILTER (WHERE e.event_type = 'view'),
    COUNT(*) FILTER (WHERE e.event_type = 'whatsapp_click'),
    MIN(e.created_at) FILTER (WHERE e.event_type = 'view'),
    MAX(e.created_at) FILTER (WHERE e.event_type = 'view'),
    MAX(e.created_at) FILTER (WHERE e.event_type = 'whatsapp_click')
  FROM public.affiliate_teaser_events e
  JOIN public.users u ON u.id = e.user_id
  GROUP BY u.id, u.name, u.email
  ORDER BY MAX(e.created_at) DESC;
$$;

GRANT EXECUTE ON FUNCTION public.list_affiliate_teaser_monitoring() TO authenticated;
