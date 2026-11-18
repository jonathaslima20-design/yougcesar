/*
  # Visitas da landing: log por visita + filtro Hoje/Ontem

  Aplicar DEPOIS de 20261101170000_live_chat_require_whatsapp.sql.

  1. visitor_sessions ganha rolagem máxima, segundos por seção e uma lista curta
     de eventos (entrada em seção, cliques). Tudo chega no heartbeat que já roda
     a cada 30 s: nenhuma requisição ou linha nova por evento.
  2. admin_landing_visit_metrics aceita p_offset_days (ex.: 1 dia, deslocado 1 =
     ontem).
  3. admin_landing_visit_log: lista as visitas do período (dentro da retenção).
*/

ALTER TABLE public.visitor_sessions
  ADD COLUMN IF NOT EXISTS max_scroll_pct smallint NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS section_seconds jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS events jsonb NOT NULL DEFAULT '[]'::jsonb;

CREATE INDEX IF NOT EXISTS visitor_sessions_started_idx
  ON public.visitor_sessions (started_at DESC);

-- ─── Heartbeat com comportamento ────────────────────────────────────────────

-- assinatura nova (com defaults) no lugar da antiga, para não haver duas
-- versões ambíguas para o PostgREST; clientes antigos continuam funcionando
DROP FUNCTION IF EXISTS public.visitor_heartbeat(uuid, text, text, text, integer, boolean);

CREATE OR REPLACE FUNCTION public.visitor_heartbeat(
  p_session_id uuid,
  p_token text,
  p_path text DEFAULT NULL,
  p_section text DEFAULT NULL,
  p_idle_seconds integer DEFAULT 0,
  p_ended boolean DEFAULT false,
  p_scroll_pct integer DEFAULT NULL,
  p_sections jsonb DEFAULT NULL,
  p_events jsonb DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  s public.live_chat_settings;
  v_section text := nullif(left(p_section, 40), '');
  v_valid boolean;
  v_conv public.chat_conversations;
  v_proactive jsonb;
  v_seen text[];
  v_secs jsonb;
  v_events jsonb;
  e jsonb;
  v_id text;
  v_t integer;
  v_kind text;
  v_ago integer;
BEGIN
  SELECT * INTO s FROM public.live_chat_settings WHERE id = 1;
  v_valid := EXISTS (SELECT 1 FROM public.visitor_sessions
                     WHERE id = p_session_id AND token_hash = public.live_chat_hash(p_token));

  IF v_valid AND s.tracking_enabled THEN
    SELECT sections_seen, section_seconds, events INTO v_seen, v_secs, v_events
    FROM public.visitor_sessions WHERE id = p_session_id FOR UPDATE;

    IF v_section IS NOT NULL AND NOT v_section = ANY (v_seen) AND cardinality(v_seen) < 20 THEN
      v_seen := v_seen || v_section;
    END IF;

    -- [{ "s": "precos", "t": 12 }, ...] em ordem de entrada; t = segundos visíveis
    IF jsonb_typeof(p_sections) = 'array' THEN
      FOR e IN SELECT value FROM jsonb_array_elements(p_sections) LIMIT 20 LOOP
        CONTINUE WHEN jsonb_typeof(e) IS DISTINCT FROM 'object' OR jsonb_typeof(e->'t') IS DISTINCT FROM 'number';
        v_id := nullif(left(e->>'s', 40), '');
        v_t := least(greatest((e->>'t')::numeric, 0), 600)::integer;
        CONTINUE WHEN v_id IS NULL OR v_t <= 0;
        IF v_secs ? v_id OR (SELECT count(*) FROM jsonb_object_keys(v_secs)) < 20 THEN
          v_secs := jsonb_set(v_secs, ARRAY[v_id], to_jsonb(coalesce((v_secs->>v_id)::integer, 0) + v_t));
        END IF;
        IF NOT v_id = ANY (v_seen) AND cardinality(v_seen) < 20 THEN
          v_seen := v_seen || v_id;
        END IF;
      END LOOP;
    END IF;

    -- [{ "k": "click" | "section", "l": "Ver planos", "ago": 12 }, ...]; ago = segundos atrás
    IF jsonb_typeof(p_events) = 'array' THEN
      FOR e IN SELECT value FROM jsonb_array_elements(p_events) LIMIT 40 LOOP
        EXIT WHEN jsonb_array_length(v_events) >= 40;
        CONTINUE WHEN jsonb_typeof(e) IS DISTINCT FROM 'object';
        v_kind := e->>'k';
        CONTINUE WHEN v_kind IS NULL OR v_kind NOT IN ('click', 'section');
        v_ago := CASE WHEN jsonb_typeof(e->'ago') = 'number'
                      THEN least(greatest((e->>'ago')::numeric, 0), 3600)::integer ELSE 0 END;
        v_events := v_events || jsonb_build_array(jsonb_build_object(
          'at', now() - make_interval(secs => v_ago),
          'k', v_kind,
          'l', left(coalesce(e->>'l', ''), 80)
        ));
      END LOOP;
    END IF;

    UPDATE public.visitor_sessions SET
      last_seen_at = now(),
      last_interaction_at = greatest(last_interaction_at, now() - make_interval(secs => greatest(coalesce(p_idle_seconds, 0), 0))),
      current_path = coalesce(left(p_path, 200), current_path),
      current_section = coalesce(v_section, current_section),
      sections_seen = v_seen,
      section_seconds = v_secs,
      events = v_events,
      max_scroll_pct = greatest(max_scroll_pct, least(greatest(coalesce(p_scroll_pct, 0), 0), 100)),
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

REVOKE ALL ON FUNCTION public.visitor_heartbeat(uuid, text, text, text, integer, boolean, integer, jsonb, jsonb) FROM public;
GRANT EXECUTE ON FUNCTION public.visitor_heartbeat(uuid, text, text, text, integer, boolean, integer, jsonb, jsonb) TO anon, authenticated;

-- ─── Métricas com deslocamento (Hoje / Ontem) ───────────────────────────────

DROP FUNCTION IF EXISTS public.admin_landing_visit_metrics(integer);

CREATE OR REPLACE FUNCTION public.admin_landing_visit_metrics(p_days integer DEFAULT 7, p_offset_days integer DEFAULT 0)
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
  v_to date;
  v_from date;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  SELECT * INTO s FROM public.live_chat_settings WHERE id = 1;
  v_today := (now() AT TIME ZONE s.timezone)::date;
  v_to := v_today - least(greatest(coalesce(p_offset_days, 0), 0), 365);
  v_from := v_to - (v_days - 1);

  PERFORM public.live_chat_rollup_visits();

  RETURN (
    WITH days AS (
      SELECT day, sessions, unique_visitors, new_visitors, mobile, desktop, total_duration_seconds,
             bounces, conversations, whatsapp_leads, section_reach, sources, hours
      FROM public.landing_visit_daily
      WHERE day BETWEEN v_from AND least(v_to, v_today - 1)
      UNION ALL
      SELECT * FROM public.live_chat_visit_day_stats(v_today, v_today) WHERE v_to = v_today
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
      'offset_days', v_today - v_to,
      'from', to_char(v_from, 'YYYY-MM-DD'),
      'to', to_char(v_to, 'YYYY-MM-DD'),
      'timezone', s.timezone,
      'tracking_enabled', s.tracking_enabled,
      'session_retention_days', s.retention_session_days,
      'first_day', (SELECT min(day) FROM days WHERE sessions > 0),
      'live_now', (SELECT count(*) FROM public.visitor_sessions
                   WHERE ended_at IS NULL AND last_seen_at > now() - interval '90 seconds'),
      'sessions', tot.sessions,
      -- únicos exatos só existem enquanto as sessões não foram apagadas
      'unique_visitors', (SELECT count(DISTINCT visitor_id) FROM public.visitor_sessions
                          WHERE (started_at AT TIME ZONE s.timezone)::date BETWEEN v_from AND v_to),
      'unique_is_partial', (v_today - v_from) >= s.retention_session_days,
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
        FROM generate_series(v_from, v_to, interval '1 day') AS g(d)
        LEFT JOIN days dd ON dd.day = g.d::date
      ), '[]'::jsonb)
    )
    FROM tot
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_landing_visit_metrics(integer, integer) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.admin_landing_visit_metrics(integer, integer) TO authenticated;

-- ─── Log de visitas ─────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.admin_landing_visit_log(
  p_days integer DEFAULT 1,
  p_offset_days integer DEFAULT 0,
  p_limit integer DEFAULT 300
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tz text;
  v_today date;
  v_to date;
  v_from date;
  v_start timestamptz;
  v_end timestamptz;
  v_limit int := least(greatest(coalesce(p_limit, 300), 1), 1000);
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  v_tz := coalesce((SELECT timezone FROM public.live_chat_settings WHERE id = 1), 'America/Sao_Paulo');
  v_today := (now() AT TIME ZONE v_tz)::date;
  v_to := v_today - least(greatest(coalesce(p_offset_days, 0), 0), 365);
  v_from := v_to - (least(greatest(coalesce(p_days, 1), 1), 365) - 1);
  v_start := v_from::timestamp AT TIME ZONE v_tz;
  v_end := (v_to + 1)::timestamp AT TIME ZONE v_tz;

  RETURN jsonb_build_object(
    'total', (SELECT count(*) FROM public.visitor_sessions WHERE started_at >= v_start AND started_at < v_end),
    'sessions', coalesce((
      SELECT jsonb_agg(to_jsonb(r) ORDER BY r.started_at DESC)
      FROM (
        SELECT vs.id, vs.visitor_id, vs.started_at, vs.last_seen_at, vs.ended_at, vs.current_path,
               vs.current_section, vs.sections_seen, vs.section_seconds, vs.max_scroll_pct, vs.events,
               vs.referrer_host, vs.utm_source, vs.utm_medium, vs.utm_campaign, vs.device, vs.visit_number,
               (SELECT jsonb_build_object('id', c.id, 'status', c.status, 'whatsapp', c.whatsapp_e164 IS NOT NULL)
                FROM public.chat_conversations c
                WHERE c.session_id = vs.id
                ORDER BY c.created_at DESC LIMIT 1) AS conversation
        FROM public.visitor_sessions vs
        WHERE vs.started_at >= v_start AND vs.started_at < v_end
        ORDER BY vs.started_at DESC
        LIMIT v_limit
      ) r
    ), '[]'::jsonb)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_landing_visit_log(integer, integer, integer) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.admin_landing_visit_log(integer, integer, integer) TO authenticated;
