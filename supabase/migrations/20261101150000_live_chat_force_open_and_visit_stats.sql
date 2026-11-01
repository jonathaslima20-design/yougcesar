/*
  # Live chat: abrir conversa à força + resumo diário de visitas da landing

  Aplicar DEPOIS de 20261101140000_live_chat_operator_greeting.sql.

  1. Conversa iniciada pelo admin pode pedir para abrir a janela do chat na
     tela do visitante (pending_force_open, entregue junto no heartbeat).
     Para conversas já abertas a abertura forçada vai por Broadcast, sem banco.

  2. landing_visit_daily: números agregados por dia (sem dados pessoais), para
     o painel de visitas manter histórico depois que as sessões são apagadas
     pela retenção (7 dias por padrão). O resumo dos dias dentro da retenção é
     recalculado na limpeza diária e sempre que o painel é aberto; dias mais
     antigos ficam congelados.
*/

-- ─── Abrir à força ──────────────────────────────────────────────────────────

ALTER TABLE public.chat_conversations
  ADD COLUMN IF NOT EXISTS pending_force_open boolean NOT NULL DEFAULT false;

DROP FUNCTION IF EXISTS public.admin_start_conversation(uuid, text);

CREATE OR REPLACE FUNCTION public.admin_start_conversation(p_session_id uuid, p_message text, p_force_open boolean DEFAULT false)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sess public.visitor_sessions;
  v_existing uuid;
  v_operator uuid;
  v_token text;
  v_conv uuid;
  v_body text := btrim(p_message);
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  IF v_body IS NULL OR v_body = '' THEN
    RAISE EXCEPTION 'empty_message';
  END IF;

  SELECT * INTO v_sess FROM public.visitor_sessions WHERE id = p_session_id AND ended_at IS NULL;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'session_not_found';
  END IF;
  IF public.live_chat_is_blocked(v_sess.visitor_id) THEN
    RAISE EXCEPTION 'blocked';
  END IF;

  SELECT id INTO v_existing FROM public.chat_conversations
  WHERE session_id = p_session_id AND status <> 'closed'
  ORDER BY created_at DESC LIMIT 1;
  IF v_existing IS NOT NULL THEN
    RETURN jsonb_build_object('conversation_id', v_existing, 'existing', true);
  END IF;

  v_operator := public.live_chat_ensure_session_operator(v_sess.id);
  v_token := public.live_chat_new_token();

  INSERT INTO public.chat_conversations (
    session_id, visitor_id, operator_id, channel_key, token_hash, pending_token, pending_force_open,
    started_by, source, utm_campaign
  ) VALUES (
    v_sess.id, v_sess.visitor_id, v_operator, public.live_chat_new_token(), public.live_chat_hash(v_token), v_token,
    coalesce(p_force_open, false),
    'operator', coalesce(v_sess.utm_source, v_sess.referrer_host, 'Direto'), v_sess.utm_campaign
  ) RETURNING id INTO v_conv;

  INSERT INTO public.chat_messages (conversation_id, sender, admin_user_id, body, kind)
  VALUES (v_conv, 'operator', auth.uid(), left(v_body, 2000), 'text');

  RETURN jsonb_build_object('conversation_id', v_conv, 'existing', false);
END;
$$;

REVOKE ALL ON FUNCTION public.admin_start_conversation(uuid, text, boolean) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.admin_start_conversation(uuid, text, boolean) TO authenticated;

CREATE OR REPLACE FUNCTION public.visitor_heartbeat(
  p_session_id uuid,
  p_token text,
  p_path text DEFAULT NULL,
  p_section text DEFAULT NULL,
  p_idle_seconds integer DEFAULT 0,
  p_ended boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  s public.live_chat_settings;
  v_section text := left(p_section, 40);
  v_valid boolean;
  v_conv public.chat_conversations;
  v_proactive jsonb;
BEGIN
  SELECT * INTO s FROM public.live_chat_settings WHERE id = 1;
  v_valid := EXISTS (SELECT 1 FROM public.visitor_sessions
                     WHERE id = p_session_id AND token_hash = public.live_chat_hash(p_token));

  IF v_valid AND s.tracking_enabled THEN
    UPDATE public.visitor_sessions SET
      last_seen_at = now(),
      last_interaction_at = greatest(last_interaction_at, now() - make_interval(secs => greatest(coalesce(p_idle_seconds, 0), 0))),
      current_path = coalesce(left(p_path, 200), current_path),
      current_section = coalesce(v_section, current_section),
      sections_seen = CASE
        WHEN v_section IS NULL OR v_section = ANY (sections_seen) OR cardinality(sections_seen) >= 20 THEN sections_seen
        ELSE sections_seen || v_section END,
      ended_at = CASE WHEN p_ended THEN now() ELSE NULL END
    WHERE id = p_session_id;
  END IF;

  -- conversa iniciada pelo admin: entrega as credenciais uma única vez
  IF v_valid AND NOT p_ended THEN
    SELECT * INTO v_conv FROM public.chat_conversations
    WHERE session_id = p_session_id AND pending_token IS NOT NULL
    ORDER BY created_at DESC
    LIMIT 1
    FOR UPDATE SKIP LOCKED;
    IF FOUND THEN
      UPDATE public.chat_conversations SET pending_token = NULL, pending_force_open = false WHERE id = v_conv.id;
      v_proactive := jsonb_build_object(
        'conversation_id', v_conv.id,
        'channel_key', v_conv.channel_key,
        'token', v_conv.pending_token,
        'operator', public.live_chat_operator_json(v_conv.operator_id),
        'force_open', v_conv.pending_force_open
      );
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'tracking_enabled', coalesce(s.tracking_enabled, false),
    'chat_enabled', coalesce(s.chat_enabled, false),
    'chat_available', coalesce(public.live_chat_accepting_new(s), false),
    'operator_online', coalesce(public.live_chat_operator_online(s), false),
    'proactive', v_proactive
  );
END;
$$;

-- ─── Resumo diário de visitas ───────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.landing_visit_daily (
  day date PRIMARY KEY,
  sessions integer NOT NULL DEFAULT 0,
  unique_visitors integer NOT NULL DEFAULT 0,
  new_visitors integer NOT NULL DEFAULT 0,
  mobile integer NOT NULL DEFAULT 0,
  desktop integer NOT NULL DEFAULT 0,
  total_duration_seconds bigint NOT NULL DEFAULT 0,
  bounces integer NOT NULL DEFAULT 0,
  conversations integer NOT NULL DEFAULT 0,
  whatsapp_leads integer NOT NULL DEFAULT 0,
  section_reach jsonb NOT NULL DEFAULT '{}'::jsonb,
  sources jsonb NOT NULL DEFAULT '{}'::jsonb,
  hours jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.landing_visit_daily ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.landing_visit_daily FROM anon;

DROP POLICY IF EXISTS "Admins read landing visit stats" ON public.landing_visit_daily;
CREATE POLICY "Admins read landing visit stats" ON public.landing_visit_daily
  FOR SELECT TO authenticated USING (public.is_admin());

-- números de cada dia local [p_from, p_to], calculados das sessões que existem
CREATE OR REPLACE FUNCTION public.live_chat_visit_day_stats(p_from date, p_to date)
RETURNS TABLE (
  day date,
  sessions integer,
  unique_visitors integer,
  new_visitors integer,
  mobile integer,
  desktop integer,
  total_duration_seconds bigint,
  bounces integer,
  conversations integer,
  whatsapp_leads integer,
  section_reach jsonb,
  sources jsonb,
  hours jsonb
)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  WITH cfg AS (
    SELECT coalesce((SELECT timezone FROM public.live_chat_settings WHERE id = 1), 'America/Sao_Paulo') AS tz
  ),
  s AS (
    SELECT vs.*,
           (vs.started_at AT TIME ZONE cfg.tz)::date AS d,
           extract(hour FROM vs.started_at AT TIME ZONE cfg.tz)::int AS h,
           least(extract(epoch FROM vs.last_seen_at - vs.started_at), 7200)::bigint AS dur
    FROM public.visitor_sessions vs, cfg
    WHERE (vs.started_at AT TIME ZONE cfg.tz)::date BETWEEN p_from AND p_to
  ),
  c AS (
    SELECT (cc.created_at AT TIME ZONE cfg.tz)::date AS d,
           count(*)::int AS conversations,
           count(*) FILTER (WHERE cc.whatsapp_e164 IS NOT NULL)::int AS whatsapp
    FROM public.chat_conversations cc, cfg
    WHERE (cc.created_at AT TIME ZONE cfg.tz)::date BETWEEN p_from AND p_to
    GROUP BY 1
  )
  SELECT
    s.d,
    count(*)::int,
    count(DISTINCT s.visitor_id)::int,
    count(*) FILTER (WHERE s.visit_number = 1)::int,
    count(*) FILTER (WHERE s.device = 'mobile')::int,
    count(*) FILTER (WHERE s.device = 'desktop')::int,
    coalesce(sum(s.dur), 0)::bigint,
    count(*) FILTER (WHERE s.dur < 15 AND cardinality(s.sections_seen) <= 1)::int,
    coalesce(max(c.conversations), 0),
    coalesce(max(c.whatsapp), 0),
    coalesce((
      SELECT jsonb_object_agg(x.sec, x.n)
      FROM (SELECT unnest(s2.sections_seen) AS sec, count(*) AS n FROM s s2 WHERE s2.d = s.d GROUP BY 1) x
    ), '{}'::jsonb),
    coalesce((
      SELECT jsonb_object_agg(x.src, x.n)
      FROM (
        SELECT coalesce(s2.utm_source, s2.referrer_host, 'Direto') AS src, count(*) AS n
        FROM s s2 WHERE s2.d = s.d GROUP BY 1
      ) x
    ), '{}'::jsonb),
    coalesce((
      SELECT jsonb_object_agg(x.h::text, x.n)
      FROM (SELECT s2.h, count(*) AS n FROM s s2 WHERE s2.d = s.d GROUP BY 1) x
    ), '{}'::jsonb)
  FROM s
  LEFT JOIN c ON c.d = s.d
  GROUP BY s.d
$$;

REVOKE ALL ON FUNCTION public.live_chat_visit_day_stats(date, date) FROM public, anon, authenticated;

-- recalcula os dias ainda completos (dentro da retenção) e congela os antigos
CREATE OR REPLACE FUNCTION public.live_chat_rollup_visits()
RETURNS void
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  s public.live_chat_settings;
  v_today date;
BEGIN
  SELECT * INTO s FROM public.live_chat_settings WHERE id = 1;
  IF NOT FOUND THEN RETURN; END IF;
  v_today := (now() AT TIME ZONE s.timezone)::date;

  INSERT INTO public.landing_visit_daily AS t (
    day, sessions, unique_visitors, new_visitors, mobile, desktop, total_duration_seconds,
    bounces, conversations, whatsapp_leads, section_reach, sources, hours, updated_at
  )
  SELECT st.*, now()
  FROM public.live_chat_visit_day_stats(v_today - (s.retention_session_days - 1), v_today - 1) st
  ON CONFLICT (day) DO UPDATE SET
    sessions = EXCLUDED.sessions,
    unique_visitors = EXCLUDED.unique_visitors,
    new_visitors = EXCLUDED.new_visitors,
    mobile = EXCLUDED.mobile,
    desktop = EXCLUDED.desktop,
    total_duration_seconds = EXCLUDED.total_duration_seconds,
    bounces = EXCLUDED.bounces,
    conversations = EXCLUDED.conversations,
    whatsapp_leads = EXCLUDED.whatsapp_leads,
    section_reach = EXCLUDED.section_reach,
    sources = EXCLUDED.sources,
    hours = EXCLUDED.hours,
    updated_at = now();
END;
$$;

REVOKE ALL ON FUNCTION public.live_chat_rollup_visits() FROM public, anon, authenticated;

-- limpeza diária passa a guardar o resumo antes de apagar as sessões
CREATE OR REPLACE FUNCTION public.live_chat_cleanup()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  s public.live_chat_settings;
BEGIN
  SELECT * INTO s FROM public.live_chat_settings WHERE id = 1;
  IF NOT FOUND THEN RETURN; END IF;

  PERFORM public.live_chat_rollup_visits();

  DELETE FROM public.chat_conversations
  WHERE last_message_at < now() - make_interval(days => s.retention_conversation_days);

  DELETE FROM public.visitor_sessions vs
  WHERE vs.last_seen_at < now() - make_interval(days => s.retention_session_days)
    AND NOT EXISTS (SELECT 1 FROM public.chat_conversations c WHERE c.session_id = vs.id);
END;
$$;

REVOKE ALL ON FUNCTION public.live_chat_cleanup() FROM public, anon, authenticated;

CREATE OR REPLACE FUNCTION public.admin_landing_visit_metrics(p_days integer DEFAULT 7)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  s public.live_chat_settings;
  v_days int := least(greatest(coalesce(p_days, 7), 1), 365);
  v_today date;
  v_from date;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  SELECT * INTO s FROM public.live_chat_settings WHERE id = 1;
  v_today := (now() AT TIME ZONE s.timezone)::date;
  v_from := v_today - (v_days - 1);

  PERFORM public.live_chat_rollup_visits();

  RETURN (
    WITH days AS (
      SELECT day, sessions, unique_visitors, new_visitors, mobile, desktop, total_duration_seconds,
             bounces, conversations, whatsapp_leads, section_reach, sources, hours
      FROM public.landing_visit_daily
      WHERE day BETWEEN v_from AND v_today - 1
      UNION ALL
      SELECT * FROM public.live_chat_visit_day_stats(v_today, v_today)
    ),
    tot AS (
      SELECT coalesce(sum(sessions), 0)::int AS sessions,
             coalesce(sum(new_visitors), 0)::int AS new_visitors,
             coalesce(sum(mobile), 0)::int AS mobile,
             coalesce(sum(desktop), 0)::int AS desktop,
             coalesce(sum(total_duration_seconds), 0)::bigint AS duration,
             coalesce(sum(bounces), 0)::int AS bounces,
             coalesce(sum(conversations), 0)::int AS conversations,
             coalesce(sum(whatsapp_leads), 0)::int AS whatsapp
      FROM days
    )
    SELECT jsonb_build_object(
      'days', v_days,
      'timezone', s.timezone,
      'tracking_enabled', s.tracking_enabled,
      'session_retention_days', s.retention_session_days,
      'first_day', (SELECT min(day) FROM days WHERE sessions > 0),
      'live_now', (SELECT count(*) FROM public.visitor_sessions
                   WHERE ended_at IS NULL AND last_seen_at > now() - interval '90 seconds'),
      'sessions', tot.sessions,
      -- únicos exatos só existem enquanto as sessões não foram apagadas
      'unique_visitors', (SELECT count(DISTINCT visitor_id) FROM public.visitor_sessions
                          WHERE (started_at AT TIME ZONE s.timezone)::date >= v_from),
      'unique_is_partial', v_days > s.retention_session_days,
      'new_visitors', tot.new_visitors,
      'mobile', tot.mobile,
      'desktop', tot.desktop,
      'avg_duration_seconds', CASE WHEN tot.sessions > 0 THEN round(tot.duration::numeric / tot.sessions) END,
      'bounces', tot.bounces,
      'conversations', tot.conversations,
      'whatsapp_leads', tot.whatsapp,
      'section_reach', coalesce((
        SELECT jsonb_object_agg(k, n) FROM (
          SELECT e.key AS k, sum(e.value::int) AS n FROM days, jsonb_each_text(days.section_reach) e GROUP BY 1
        ) x
      ), '{}'::jsonb),
      'sources', coalesce((
        SELECT jsonb_agg(jsonb_build_object('source', k, 'sessions', n) ORDER BY n DESC) FROM (
          SELECT e.key AS k, sum(e.value::int) AS n FROM days, jsonb_each_text(days.sources) e GROUP BY 1 ORDER BY 2 DESC LIMIT 15
        ) x
      ), '[]'::jsonb),
      'hours', coalesce((
        SELECT jsonb_agg(jsonb_build_object('hour', g.h, 'sessions', coalesce(x.n, 0)) ORDER BY g.h)
        FROM generate_series(0, 23) AS g(h)
        LEFT JOIN (
          SELECT e.key::int AS h, sum(e.value::int) AS n FROM days, jsonb_each_text(days.hours) e GROUP BY 1
        ) x ON x.h = g.h
      ), '[]'::jsonb),
      'by_day', coalesce((
        SELECT jsonb_agg(jsonb_build_object(
          'day', to_char(g.d, 'YYYY-MM-DD'),
          'sessions', coalesce(dd.sessions, 0),
          'unique_visitors', coalesce(dd.unique_visitors, 0),
          'conversations', coalesce(dd.conversations, 0),
          'whatsapp', coalesce(dd.whatsapp_leads, 0)
        ) ORDER BY g.d)
        FROM generate_series(v_from, v_today, interval '1 day') AS g(d)
        LEFT JOIN days dd ON dd.day = g.d::date
      ), '[]'::jsonb)
    )
    FROM tot
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_landing_visit_metrics(integer) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.admin_landing_visit_metrics(integer) TO authenticated;
