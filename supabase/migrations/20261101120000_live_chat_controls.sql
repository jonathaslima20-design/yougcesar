/*
  # Live chat: controles do atendimento

  Aplicar DEPOIS de 20261101100000_live_chat_operator_resume.sql.

  1. Configurações novas (live_chat_settings)
    - Persona padrão quando não há operador ativo (nome + foto).
    - Disponibilidade do atendente: chave manual + "visto por último" do painel
      admin (ping a cada 60 s). Ausente = chave desligada ou sem ping há 3 min.
      Comportamento quando ausente: pedir WhatsApp ou esconder o chat.
    - Esconder para clientes com plano ativo (avaliado no navegador).
    - Gatilhos de abertura: tempo, seção, % de rolagem, intenção de saída;
      abertura automática on/off; intervalo para reabrir depois de fechado.
    - Pausa temporária e feriados.
    - Encerramento automático de conversas paradas e alerta de sem resposta.

  2. Tabelas novas: live_chat_canned_replies, live_chat_blocked_visitors.

  3. chat_conversations: first_response_at, contacted_at, started_by,
     pending_token (entrega de conversa iniciada pelo admin via heartbeat),
     source/utm_campaign (métricas sobrevivem à limpeza das sessões).

  4. RPCs admin: ping, status (com motivo e próxima abertura), iniciar
     conversa, métricas. Cron de hora em hora para encerrar conversas paradas.
*/

-- ─── Configurações ──────────────────────────────────────────────────────────

ALTER TABLE public.live_chat_settings
  ADD COLUMN IF NOT EXISTS fallback_operator_name text NOT NULL DEFAULT 'Equipe VitrineTurbo',
  ADD COLUMN IF NOT EXISTS fallback_avatar_url text,
  ADD COLUMN IF NOT EXISTS admin_available boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS admin_last_seen_at timestamptz,
  ADD COLUMN IF NOT EXISTS away_behavior text NOT NULL DEFAULT 'ask_whatsapp',
  ADD COLUMN IF NOT EXISTS away_message text NOT NULL DEFAULT 'No momento nossa equipe não está online. Deixe seu WhatsApp que te chamamos assim que possível!',
  ADD COLUMN IF NOT EXISTS hide_for_active_customers boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS auto_open boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS delay_trigger_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS trigger_section text,
  ADD COLUMN IF NOT EXISTS trigger_scroll_percent integer,
  ADD COLUMN IF NOT EXISTS trigger_exit_intent boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS reopen_cooldown_days integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS paused_until timestamptz,
  ADD COLUMN IF NOT EXISTS holidays jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS auto_close_idle_hours integer NOT NULL DEFAULT 24,
  ADD COLUMN IF NOT EXISTS unanswered_alert_minutes integer NOT NULL DEFAULT 5;

ALTER TABLE public.live_chat_settings DROP CONSTRAINT IF EXISTS live_chat_settings_away_behavior_check;
ALTER TABLE public.live_chat_settings ADD CONSTRAINT live_chat_settings_away_behavior_check
  CHECK (away_behavior IN ('ask_whatsapp', 'hide'));
ALTER TABLE public.live_chat_settings DROP CONSTRAINT IF EXISTS live_chat_settings_trigger_scroll_check;
ALTER TABLE public.live_chat_settings ADD CONSTRAINT live_chat_settings_trigger_scroll_check
  CHECK (trigger_scroll_percent IS NULL OR trigger_scroll_percent BETWEEN 10 AND 100);
ALTER TABLE public.live_chat_settings DROP CONSTRAINT IF EXISTS live_chat_settings_cooldown_check;
ALTER TABLE public.live_chat_settings ADD CONSTRAINT live_chat_settings_cooldown_check
  CHECK (reopen_cooldown_days BETWEEN 0 AND 90);
ALTER TABLE public.live_chat_settings DROP CONSTRAINT IF EXISTS live_chat_settings_auto_close_check;
ALTER TABLE public.live_chat_settings ADD CONSTRAINT live_chat_settings_auto_close_check
  CHECK (auto_close_idle_hours BETWEEN 1 AND 720);
ALTER TABLE public.live_chat_settings DROP CONSTRAINT IF EXISTS live_chat_settings_unanswered_check;
ALTER TABLE public.live_chat_settings ADD CONSTRAINT live_chat_settings_unanswered_check
  CHECK (unanswered_alert_minutes BETWEEN 1 AND 240);
ALTER TABLE public.live_chat_settings DROP CONSTRAINT IF EXISTS live_chat_settings_holidays_check;
ALTER TABLE public.live_chat_settings ADD CONSTRAINT live_chat_settings_holidays_check
  CHECK (jsonb_typeof(holidays) = 'array');

-- ─── Conversas ──────────────────────────────────────────────────────────────

ALTER TABLE public.chat_conversations
  ADD COLUMN IF NOT EXISTS first_response_at timestamptz,
  ADD COLUMN IF NOT EXISTS contacted_at timestamptz,
  ADD COLUMN IF NOT EXISTS started_by text NOT NULL DEFAULT 'visitor',
  ADD COLUMN IF NOT EXISTS pending_token text,
  ADD COLUMN IF NOT EXISTS source text,
  ADD COLUMN IF NOT EXISTS utm_campaign text;

ALTER TABLE public.chat_conversations DROP CONSTRAINT IF EXISTS chat_conversations_started_by_check;
ALTER TABLE public.chat_conversations ADD CONSTRAINT chat_conversations_started_by_check
  CHECK (started_by IN ('visitor', 'operator'));

CREATE INDEX IF NOT EXISTS chat_conversations_created_idx ON public.chat_conversations (created_at DESC);
CREATE INDEX IF NOT EXISTS chat_conversations_pending_idx
  ON public.chat_conversations (session_id) WHERE pending_token IS NOT NULL;

-- origem das conversas já existentes
UPDATE public.chat_conversations c
SET source = coalesce(vs.utm_source, vs.referrer_host, 'Direto'),
    utm_campaign = vs.utm_campaign
FROM public.visitor_sessions vs
WHERE vs.id = c.session_id AND c.source IS NULL;

-- ─── Respostas prontas e bloqueios ──────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.live_chat_canned_replies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL CHECK (length(title) BETWEEN 1 AND 60),
  body text NOT NULL CHECK (length(body) BETWEEN 1 AND 2000),
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.live_chat_blocked_visitors (
  visitor_id uuid PRIMARY KEY,
  reason text,
  blocked_by uuid,
  blocked_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.live_chat_canned_replies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.live_chat_blocked_visitors ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.live_chat_canned_replies, public.live_chat_blocked_visitors FROM anon;

DROP POLICY IF EXISTS "Admins manage canned replies" ON public.live_chat_canned_replies;
CREATE POLICY "Admins manage canned replies" ON public.live_chat_canned_replies
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Admins manage blocked visitors" ON public.live_chat_blocked_visitors;
CREATE POLICY "Admins manage blocked visitors" ON public.live_chat_blocked_visitors
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

INSERT INTO public.live_chat_canned_replies (title, body, sort_order)
SELECT * FROM (VALUES
  ('Preços', 'Nossos planos começam a partir de um valor bem acessível por mês. Posso te mostrar qual se encaixa melhor no seu negócio?', 1),
  ('Segmento', 'Atendemos lojas de vários segmentos: moda, calçados, eletrônicos, cosméticos e muito mais. Qual é o seu?', 2),
  ('Pagamentos', 'Você pode vender pelo WhatsApp ou receber online por Pix e cartão, direto na sua loja.', 3),
  ('Pedir WhatsApp', 'Posso continuar te atendendo pelo WhatsApp? É só me passar seu número com DDD.', 4)
) AS v(title, body, sort_order)
WHERE NOT EXISTS (SELECT 1 FROM public.live_chat_canned_replies);

-- ─── Regras de disponibilidade ──────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.live_chat_is_open(s public.live_chat_settings)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
DECLARE
  local_ts timestamp;
  day jsonb;
BEGIN
  IF NOT s.chat_enabled THEN
    RETURN false;
  END IF;
  IF s.paused_until IS NOT NULL AND s.paused_until > now() THEN
    RETURN false;
  END IF;
  IF NOT s.business_hours_enabled THEN
    RETURN true;
  END IF;
  local_ts := now() AT TIME ZONE s.timezone;
  IF s.holidays ? to_char(local_ts::date, 'YYYY-MM-DD') THEN
    RETURN false;
  END IF;
  day := s.business_hours -> (extract(dow FROM local_ts)::int)::text;
  IF day IS NULL OR NOT coalesce((day ->> 'enabled')::boolean, false) THEN
    RETURN false;
  END IF;
  RETURN local_ts::time >= (day ->> 'start')::time
     AND local_ts::time <  (day ->> 'end')::time;
END;
$$;

CREATE OR REPLACE FUNCTION public.live_chat_operator_online(s public.live_chat_settings)
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT s.admin_available AND s.admin_last_seen_at IS NOT NULL AND s.admin_last_seen_at > now() - interval '3 minutes'
$$;

-- aceita conversas NOVAS? (conversas em andamento só dependem de chat_enabled)
CREATE OR REPLACE FUNCTION public.live_chat_accepting_new(s public.live_chat_settings)
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT public.live_chat_is_open(s) AND (public.live_chat_operator_online(s) OR s.away_behavior = 'ask_whatsapp')
$$;

CREATE OR REPLACE FUNCTION public.live_chat_next_open(s public.live_chat_settings)
RETURNS timestamptz
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
DECLARE
  local_now timestamp := now() AT TIME ZONE s.timezone;
  d int;
  dt date;
  day jsonb;
  st timestamp;
  en timestamp;
  cand timestamptz;
BEGIN
  IF NOT s.business_hours_enabled THEN
    RETURN CASE WHEN s.paused_until > now() THEN s.paused_until ELSE now() END;
  END IF;
  FOR d IN 0..14 LOOP
    dt := local_now::date + d;
    CONTINUE WHEN s.holidays ? to_char(dt, 'YYYY-MM-DD');
    day := s.business_hours -> (extract(dow FROM dt)::int)::text;
    CONTINUE WHEN day IS NULL OR NOT coalesce((day ->> 'enabled')::boolean, false);
    st := dt + (day ->> 'start')::time;
    en := dt + (day ->> 'end')::time;
    CONTINUE WHEN en <= local_now;
    cand := greatest(st, local_now) AT TIME ZONE s.timezone;
    IF s.paused_until IS NOT NULL AND s.paused_until > cand THEN
      IF s.paused_until < (en AT TIME ZONE s.timezone) THEN
        RETURN s.paused_until;
      END IF;
      CONTINUE;
    END IF;
    RETURN cand;
  END LOOP;
  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.live_chat_is_blocked(p_visitor_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path = public
AS $$ SELECT EXISTS (SELECT 1 FROM public.live_chat_blocked_visitors WHERE visitor_id = p_visitor_id) $$;

REVOKE ALL ON FUNCTION public.live_chat_operator_online(public.live_chat_settings) FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.live_chat_accepting_new(public.live_chat_settings) FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.live_chat_next_open(public.live_chat_settings) FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.live_chat_is_blocked(uuid) FROM public, anon, authenticated;

-- ─── RPCs públicas (visitante) ──────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.get_live_chat_public_config()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  s public.live_chat_settings;
BEGIN
  SELECT * INTO s FROM public.live_chat_settings WHERE id = 1;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('tracking_enabled', false, 'chat_available', false, 'chat_enabled', false);
  END IF;
  RETURN jsonb_build_object(
    'tracking_enabled', s.tracking_enabled,
    'chat_enabled', s.chat_enabled,
    'chat_available', public.live_chat_accepting_new(s),
    'operator_online', public.live_chat_operator_online(s),
    'away_message', s.away_message,
    'fallback_operator', jsonb_build_object('name', s.fallback_operator_name, 'avatar_url', s.fallback_avatar_url),
    'typing_indicator_enabled', s.typing_indicator_enabled,
    'open_delay_seconds', s.open_delay_seconds,
    'show_on_mobile', s.show_on_mobile,
    'greeting_cta', s.greeting_cta,
    'quick_replies', s.quick_replies,
    'timezone', s.timezone,
    'hide_for_active_customers', s.hide_for_active_customers,
    'auto_open', s.auto_open,
    'delay_trigger_enabled', s.delay_trigger_enabled,
    'trigger_section', s.trigger_section,
    'trigger_scroll_percent', s.trigger_scroll_percent,
    'trigger_exit_intent', s.trigger_exit_intent,
    'reopen_cooldown_days', s.reopen_cooldown_days
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.visitor_session_start(
  p_visitor_id uuid,
  p_path text DEFAULT NULL,
  p_referrer_host text DEFAULT NULL,
  p_utm_source text DEFAULT NULL,
  p_utm_medium text DEFAULT NULL,
  p_utm_campaign text DEFAULT NULL,
  p_device text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  s public.live_chat_settings;
  v_token text;
  v_operator uuid;
  v_visit int;
  v_session uuid;
BEGIN
  SELECT * INTO s FROM public.live_chat_settings WHERE id = 1;
  IF NOT FOUND OR NOT (s.tracking_enabled OR s.chat_enabled) THEN
    RETURN NULL;
  END IF;
  IF p_visitor_id IS NULL THEN
    RAISE EXCEPTION 'visitor_id required';
  END IF;
  IF public.live_chat_is_blocked(p_visitor_id) THEN
    RETURN NULL;
  END IF;

  IF (SELECT count(*) FROM public.visitor_sessions
      WHERE visitor_id = p_visitor_id AND started_at > now() - interval '1 hour') >= 30 THEN
    RAISE EXCEPTION 'rate_limited';
  END IF;

  v_operator := public.live_chat_pick_operator(p_visitor_id);

  SELECT count(*) + 1 INTO v_visit FROM public.visitor_sessions WHERE visitor_id = p_visitor_id;

  v_token := public.live_chat_new_token();
  INSERT INTO public.visitor_sessions (
    visitor_id, token_hash, operator_id, current_path, referrer_host,
    utm_source, utm_medium, utm_campaign, device, visit_number
  ) VALUES (
    p_visitor_id, public.live_chat_hash(v_token), v_operator, left(p_path, 200), left(p_referrer_host, 120),
    left(p_utm_source, 100), left(p_utm_medium, 100), left(p_utm_campaign, 100),
    CASE WHEN p_device IN ('mobile', 'desktop') THEN p_device END, v_visit
  ) RETURNING id INTO v_session;

  RETURN jsonb_build_object(
    'session_id', v_session,
    'token', v_token,
    'operator', public.live_chat_operator_json(v_operator)
  );
END;
$$;

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
      UPDATE public.chat_conversations SET pending_token = NULL WHERE id = v_conv.id;
      v_proactive := jsonb_build_object(
        'conversation_id', v_conv.id,
        'channel_key', v_conv.channel_key,
        'token', v_conv.pending_token,
        'operator', public.live_chat_operator_json(v_conv.operator_id)
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

CREATE OR REPLACE FUNCTION public.chat_open_conversation(p_session_id uuid, p_token text)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  s public.live_chat_settings;
  v_sess public.visitor_sessions;
  v_operator uuid;
  v_conv_token text;
  v_channel text;
  v_conv uuid;
BEGIN
  SELECT * INTO s FROM public.live_chat_settings WHERE id = 1;
  IF NOT FOUND OR NOT public.live_chat_accepting_new(s) THEN
    RAISE EXCEPTION 'chat_unavailable';
  END IF;

  SELECT * INTO v_sess FROM public.visitor_sessions
  WHERE id = p_session_id AND token_hash = public.live_chat_hash(p_token);
  IF NOT FOUND THEN
    RAISE EXCEPTION 'invalid_session';
  END IF;
  IF public.live_chat_is_blocked(v_sess.visitor_id) THEN
    RAISE EXCEPTION 'blocked';
  END IF;

  IF (SELECT count(*) FROM public.chat_conversations
      WHERE visitor_id = v_sess.visitor_id AND created_at > now() - interval '1 hour') >= 5 THEN
    RAISE EXCEPTION 'rate_limited';
  END IF;

  v_operator := public.live_chat_ensure_session_operator(v_sess.id);
  v_conv_token := public.live_chat_new_token();
  v_channel := public.live_chat_new_token();

  INSERT INTO public.chat_conversations (
    session_id, visitor_id, operator_id, channel_key, token_hash, source, utm_campaign
  ) VALUES (
    v_sess.id, v_sess.visitor_id, v_operator, v_channel, public.live_chat_hash(v_conv_token),
    coalesce(v_sess.utm_source, v_sess.referrer_host, 'Direto'), v_sess.utm_campaign
  ) RETURNING id INTO v_conv;

  RETURN jsonb_build_object(
    'conversation_id', v_conv,
    'channel_key', v_channel,
    'token', v_conv_token,
    'operator', public.live_chat_operator_json(v_operator)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.chat_send_visitor_message(
  p_conversation_id uuid,
  p_token text,
  p_body text,
  p_kind text DEFAULT 'text',
  p_greeting text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_body text := btrim(p_body);
  v_conv public.chat_conversations;
  v_msg public.chat_messages;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.live_chat_settings WHERE id = 1 AND chat_enabled) THEN
    RAISE EXCEPTION 'chat_unavailable';
  END IF;
  SELECT * INTO v_conv FROM public.chat_conversations
  WHERE id = p_conversation_id AND token_hash = public.live_chat_hash(p_token);
  IF NOT FOUND THEN
    RAISE EXCEPTION 'invalid_conversation';
  END IF;
  IF public.live_chat_is_blocked(v_conv.visitor_id) THEN
    RAISE EXCEPTION 'blocked';
  END IF;
  IF v_body IS NULL OR v_body = '' THEN
    RAISE EXCEPTION 'empty_message';
  END IF;
  IF (SELECT count(*) FROM public.chat_messages
      WHERE conversation_id = p_conversation_id AND sender = 'visitor'
        AND created_at > now() - interval '1 minute') >= 20 THEN
    RAISE EXCEPTION 'rate_limited';
  END IF;

  IF p_greeting IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.chat_messages WHERE conversation_id = p_conversation_id
  ) THEN
    INSERT INTO public.chat_messages (conversation_id, sender, body, kind)
    VALUES (p_conversation_id, 'system', left(btrim(p_greeting), 2000), 'text');
  END IF;

  INSERT INTO public.chat_messages (conversation_id, sender, body, kind)
  VALUES (p_conversation_id, 'visitor', left(v_body, 2000),
          CASE WHEN p_kind = 'quick_reply' THEN 'quick_reply' ELSE 'text' END)
  RETURNING * INTO v_msg;

  RETURN jsonb_build_object('id', v_msg.id, 'created_at', v_msg.created_at);
END;
$$;

CREATE OR REPLACE FUNCTION public.chat_submit_whatsapp(p_conversation_id uuid, p_token text, p_phone text)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_digits text := regexp_replace(coalesce(p_phone, ''), '\D', '', 'g');
  v_e164 text;
  v_conv public.chat_conversations;
BEGIN
  SELECT * INTO v_conv FROM public.chat_conversations
  WHERE id = p_conversation_id AND token_hash = public.live_chat_hash(p_token);
  IF NOT FOUND THEN
    RAISE EXCEPTION 'invalid_conversation';
  END IF;
  IF public.live_chat_is_blocked(v_conv.visitor_id) THEN
    RAISE EXCEPTION 'blocked';
  END IF;

  IF v_digits ~ '^55\d{10,11}$' THEN
    v_e164 := '+' || v_digits;
  ELSIF v_digits ~ '^\d{10,11}$' THEN
    v_e164 := '+55' || v_digits;
  ELSE
    RAISE EXCEPTION 'invalid_phone';
  END IF;

  UPDATE public.chat_conversations
  SET whatsapp_e164 = v_e164, whatsapp_consent_at = now(), status = 'pending', closed_at = NULL
  WHERE id = p_conversation_id;

  INSERT INTO public.chat_messages (conversation_id, sender, body, kind)
  VALUES (p_conversation_id, 'visitor', v_e164, 'whatsapp');

  RETURN jsonb_build_object('whatsapp', v_e164);
END;
$$;

-- ─── Trigger de mensagens: primeira resposta ────────────────────────────────

CREATE OR REPLACE FUNCTION public.chat_messages_after_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_conv public.chat_conversations;
  v_public jsonb;
BEGIN
  UPDATE public.chat_conversations SET
    last_message_at = NEW.created_at,
    last_message_preview = left(NEW.body, 120),
    last_message_sender = NEW.sender,
    unread_for_admin = CASE WHEN NEW.sender = 'visitor' THEN unread_for_admin + 1 ELSE unread_for_admin END,
    first_response_at = CASE
      WHEN NEW.sender = 'operator' AND first_response_at IS NULL THEN NEW.created_at
      ELSE first_response_at END,
    status = CASE
      WHEN NEW.sender = 'visitor' AND status = 'closed' THEN 'open'
      ELSE status END,
    closed_at = CASE WHEN NEW.sender = 'visitor' AND status = 'closed' THEN NULL ELSE closed_at END
  WHERE id = NEW.conversation_id
  RETURNING * INTO v_conv;

  v_public := jsonb_build_object(
    'id', NEW.id, 'sender', NEW.sender, 'body', NEW.body, 'kind', NEW.kind, 'created_at', NEW.created_at
  );

  BEGIN
    PERFORM realtime.send(v_public, 'message', 'chat:' || v_conv.channel_key, false);
    PERFORM realtime.send(
      jsonb_build_object('conversation_id', NEW.conversation_id, 'message', v_public),
      'message', 'admin:live-chat', true
    );
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'live chat broadcast failed: %', SQLERRM;
  END;

  RETURN NEW;
END;
$$;

-- ─── RPCs admin ─────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.admin_live_chat_ping()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  UPDATE public.live_chat_settings SET admin_last_seen_at = now() WHERE id = 1;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_live_chat_status()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  s public.live_chat_settings;
  v_state text;
  v_local date;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  SELECT * INTO s FROM public.live_chat_settings WHERE id = 1;
  v_local := (now() AT TIME ZONE s.timezone)::date;

  v_state := CASE
    WHEN NOT s.chat_enabled THEN 'off'
    WHEN s.paused_until IS NOT NULL AND s.paused_until > now() THEN 'paused'
    WHEN s.business_hours_enabled AND s.holidays ? to_char(v_local, 'YYYY-MM-DD') THEN 'holiday'
    WHEN NOT public.live_chat_is_open(s) THEN 'closed_hours'
    WHEN NOT public.live_chat_operator_online(s) THEN 'away'
    ELSE 'online'
  END;

  RETURN jsonb_build_object(
    'state', v_state,
    'chat_available', public.live_chat_accepting_new(s),
    'operator_online', public.live_chat_operator_online(s),
    'admin_available', s.admin_available,
    'admin_last_seen_at', s.admin_last_seen_at,
    'away_behavior', s.away_behavior,
    'paused_until', CASE WHEN s.paused_until > now() THEN s.paused_until END,
    'next_open_at', CASE WHEN v_state IN ('paused', 'holiday', 'closed_hours') THEN public.live_chat_next_open(s) END,
    'active_operators', (SELECT count(*) FROM public.live_chat_operators WHERE is_active)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_start_conversation(p_session_id uuid, p_message text)
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
    session_id, visitor_id, operator_id, channel_key, token_hash, pending_token,
    started_by, source, utm_campaign
  ) VALUES (
    v_sess.id, v_sess.visitor_id, v_operator, public.live_chat_new_token(), public.live_chat_hash(v_token), v_token,
    'operator', coalesce(v_sess.utm_source, v_sess.referrer_host, 'Direto'), v_sess.utm_campaign
  ) RETURNING id INTO v_conv;

  INSERT INTO public.chat_messages (conversation_id, sender, admin_user_id, body, kind)
  VALUES (v_conv, 'operator', auth.uid(), left(v_body, 2000), 'text');

  RETURN jsonb_build_object('conversation_id', v_conv, 'existing', false);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_live_chat_metrics(p_days integer DEFAULT 7)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  s public.live_chat_settings;
  v_since timestamptz;
  v_days int := least(greatest(coalesce(p_days, 7), 1), 90);
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  SELECT * INTO s FROM public.live_chat_settings WHERE id = 1;
  v_since := ((now() AT TIME ZONE s.timezone)::date - (v_days - 1)) AT TIME ZONE s.timezone;

  RETURN jsonb_build_object(
    'days', v_days,
    'session_retention_days', s.retention_session_days,
    'sessions', (SELECT count(*) FROM public.visitor_sessions WHERE started_at >= v_since),
    'conversations', (SELECT count(*) FROM public.chat_conversations WHERE created_at >= v_since),
    'visitor_started', (SELECT count(*) FROM public.chat_conversations WHERE created_at >= v_since AND started_by = 'visitor'),
    'operator_started', (SELECT count(*) FROM public.chat_conversations WHERE created_at >= v_since AND started_by = 'operator'),
    'whatsapp_leads', (SELECT count(*) FROM public.chat_conversations WHERE created_at >= v_since AND whatsapp_e164 IS NOT NULL),
    'contacted', (SELECT count(*) FROM public.chat_conversations WHERE created_at >= v_since AND contacted_at IS NOT NULL),
    'unanswered', (SELECT count(*) FROM public.chat_conversations
                   WHERE created_at >= v_since AND started_by = 'visitor' AND first_response_at IS NULL),
    'avg_first_response_seconds', (
      SELECT round(avg(extract(epoch FROM first_response_at - created_at)))
      FROM public.chat_conversations
      WHERE created_at >= v_since AND started_by = 'visitor' AND first_response_at IS NOT NULL
    ),
    'by_operator', coalesce((
      SELECT jsonb_agg(row_to_json(x) ORDER BY x.conversations DESC)
      FROM (
        SELECT coalesce(o.display_name, s.fallback_operator_name) AS name,
               count(*) AS conversations,
               count(*) FILTER (WHERE c.whatsapp_e164 IS NOT NULL) AS whatsapp
        FROM public.chat_conversations c
        LEFT JOIN public.live_chat_operators o ON o.id = c.operator_id
        WHERE c.created_at >= v_since
        GROUP BY 1
      ) x
    ), '[]'::jsonb),
    'by_source', coalesce((
      SELECT jsonb_agg(row_to_json(x) ORDER BY x.conversations DESC)
      FROM (
        SELECT coalesce(c.source, 'Desconhecido') AS source,
               count(*) AS conversations,
               count(*) FILTER (WHERE c.whatsapp_e164 IS NOT NULL) AS whatsapp
        FROM public.chat_conversations c
        WHERE c.created_at >= v_since
        GROUP BY 1
      ) x
    ), '[]'::jsonb),
    'by_day', coalesce((
      SELECT jsonb_agg(row_to_json(x) ORDER BY x.day)
      FROM (
        SELECT to_char(d, 'YYYY-MM-DD') AS day,
               (SELECT count(*) FROM public.visitor_sessions vs
                WHERE (vs.started_at AT TIME ZONE s.timezone)::date = d) AS sessions,
               (SELECT count(*) FROM public.chat_conversations c
                WHERE (c.created_at AT TIME ZONE s.timezone)::date = d) AS conversations,
               (SELECT count(*) FROM public.chat_conversations c
                WHERE (c.created_at AT TIME ZONE s.timezone)::date = d AND c.whatsapp_e164 IS NOT NULL) AS whatsapp
        FROM generate_series((now() AT TIME ZONE s.timezone)::date - (v_days - 1),
                             (now() AT TIME ZONE s.timezone)::date, interval '1 day') AS g(d)
      ) x
    ), '[]'::jsonb)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_live_chat_ping() FROM public, anon;
REVOKE ALL ON FUNCTION public.admin_live_chat_status() FROM public, anon;
REVOKE ALL ON FUNCTION public.admin_start_conversation(uuid, text) FROM public, anon;
REVOKE ALL ON FUNCTION public.admin_live_chat_metrics(integer) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.admin_live_chat_ping() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_live_chat_status() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_start_conversation(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_live_chat_metrics(integer) TO authenticated;

-- ─── Encerramento automático (de hora em hora) ──────────────────────────────

CREATE OR REPLACE FUNCTION public.live_chat_auto_close()
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
  -- só 'open': conversas 'pending' (WhatsApp informado) esperam o contato
  UPDATE public.chat_conversations
  SET status = 'closed', closed_at = now()
  WHERE status = 'open'
    AND last_message_at < now() - make_interval(hours => s.auto_close_idle_hours);
END;
$$;

REVOKE ALL ON FUNCTION public.live_chat_auto_close() FROM public, anon, authenticated;

DO $$
BEGIN
  PERFORM cron.unschedule('live-chat-auto-close')
  WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'live-chat-auto-close');
  PERFORM cron.schedule('live-chat-auto-close', '7 * * * *', 'SELECT public.live_chat_auto_close()');
END;
$$;
