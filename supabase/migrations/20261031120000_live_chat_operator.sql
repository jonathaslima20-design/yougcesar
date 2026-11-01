/*
  # Live chat com operador comercial + monitoramento de visitantes da landing

  Ver docs/PLANO_CHAT_OPERADOR.md (seções 3–5 e 14).

  1. Tabelas (RLS ON, policies só para is_admin(); nenhuma policy para anon)
    - live_chat_settings   linha única: toggles, horário de funcionamento, delay, retenção
    - live_chat_operators  personas exibidas no widget
    - visitor_sessions     uma por aba/visita; atualizada por heartbeat HTTP (30 s)
    - chat_conversations   criada na 1ª resposta do visitante
    - chat_messages

  2. Visitante anônimo só fala com o banco via RPCs SECURITY DEFINER que
     validam um token secreto (guardamos apenas o sha256).

  3. Tempo real: trigger em chat_messages chama realtime.send()
    - 'chat:<channel_key>'  público, nome impossível de adivinhar → visitante
    - 'admin:live-chat'     privado, autorizado por policy em realtime.messages

  4. pg_cron diário apaga sessões/conversas além da retenção configurada.
*/

-- ─── Configurações ──────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.live_chat_settings (
  id smallint PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  chat_enabled boolean NOT NULL DEFAULT false,
  tracking_enabled boolean NOT NULL DEFAULT false,
  typing_indicator_enabled boolean NOT NULL DEFAULT true,
  business_hours_enabled boolean NOT NULL DEFAULT true,
  -- chaves '0'..'6' = domingo..sábado (mesma convenção de extract(dow) e Date.getDay)
  business_hours jsonb NOT NULL DEFAULT '{
    "0": {"enabled": false, "start": "09:00", "end": "18:00"},
    "1": {"enabled": true,  "start": "09:00", "end": "18:00"},
    "2": {"enabled": true,  "start": "09:00", "end": "18:00"},
    "3": {"enabled": true,  "start": "09:00", "end": "18:00"},
    "4": {"enabled": true,  "start": "09:00", "end": "18:00"},
    "5": {"enabled": true,  "start": "09:00", "end": "18:00"},
    "6": {"enabled": false, "start": "09:00", "end": "13:00"}
  }'::jsonb,
  timezone text NOT NULL DEFAULT 'America/Sao_Paulo',
  open_delay_seconds integer NOT NULL DEFAULT 25 CHECK (open_delay_seconds BETWEEN 0 AND 600),
  show_on_mobile boolean NOT NULL DEFAULT true,
  greeting_cta text NOT NULL DEFAULT 'Posso te ajudar a montar sua loja online? Fique à vontade para tirar qualquer dúvida.',
  quick_replies jsonb NOT NULL DEFAULT '["Quanto custa?", "Funciona para o meu segmento?", "Como recebo pagamentos?"]'::jsonb,
  retention_session_days integer NOT NULL DEFAULT 7 CHECK (retention_session_days BETWEEN 1 AND 365),
  retention_conversation_days integer NOT NULL DEFAULT 90 CHECK (retention_conversation_days BETWEEN 1 AND 730),
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.live_chat_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

-- ─── Operadores ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.live_chat_operators (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  display_name text NOT NULL CHECK (length(display_name) BETWEEN 1 AND 60),
  role_title text NOT NULL DEFAULT 'Consultora comercial',
  avatar_url text,
  is_active boolean NOT NULL DEFAULT true,
  weight integer NOT NULL DEFAULT 1 CHECK (weight BETWEEN 1 AND 100),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ─── Sessões de visitantes ──────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.visitor_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  visitor_id uuid NOT NULL,
  token_hash bytea NOT NULL,
  operator_id uuid REFERENCES public.live_chat_operators(id) ON DELETE SET NULL,
  started_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  last_interaction_at timestamptz NOT NULL DEFAULT now(),
  current_path text,
  current_section text,
  sections_seen text[] NOT NULL DEFAULT '{}',
  referrer_host text,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  device text CHECK (device IN ('mobile', 'desktop')),
  visit_number integer NOT NULL DEFAULT 1,
  ended_at timestamptz
);

CREATE INDEX IF NOT EXISTS visitor_sessions_live_idx
  ON public.visitor_sessions (last_seen_at DESC) WHERE ended_at IS NULL;
CREATE INDEX IF NOT EXISTS visitor_sessions_visitor_idx
  ON public.visitor_sessions (visitor_id, started_at DESC);

-- ─── Conversas e mensagens ──────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.chat_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid REFERENCES public.visitor_sessions(id) ON DELETE SET NULL,
  visitor_id uuid NOT NULL,
  operator_id uuid REFERENCES public.live_chat_operators(id) ON DELETE SET NULL,
  channel_key text NOT NULL UNIQUE,
  token_hash bytea NOT NULL,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'pending', 'closed')),
  whatsapp_e164 text,
  whatsapp_consent_at timestamptz,
  unread_for_admin integer NOT NULL DEFAULT 0,
  last_message_at timestamptz NOT NULL DEFAULT now(),
  last_message_preview text,
  last_message_sender text,
  created_at timestamptz NOT NULL DEFAULT now(),
  closed_at timestamptz
);

CREATE INDEX IF NOT EXISTS chat_conversations_queue_idx
  ON public.chat_conversations (status, last_message_at DESC);
CREATE INDEX IF NOT EXISTS chat_conversations_session_idx
  ON public.chat_conversations (session_id);

CREATE TABLE IF NOT EXISTS public.chat_messages (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  conversation_id uuid NOT NULL REFERENCES public.chat_conversations(id) ON DELETE CASCADE,
  sender text NOT NULL CHECK (sender IN ('visitor', 'operator', 'system')),
  admin_user_id uuid,
  body text NOT NULL CHECK (length(body) BETWEEN 1 AND 2000),
  kind text NOT NULL DEFAULT 'text' CHECK (kind IN ('text', 'quick_reply', 'whatsapp')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS chat_messages_conversation_idx
  ON public.chat_messages (conversation_id, id);

-- ─── RLS: só admin ──────────────────────────────────────────────────────────

ALTER TABLE public.live_chat_settings  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.live_chat_operators ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.visitor_sessions    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_conversations  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages       ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.live_chat_settings, public.live_chat_operators, public.visitor_sessions,
  public.chat_conversations, public.chat_messages FROM anon;

DROP POLICY IF EXISTS "Admins manage live chat settings" ON public.live_chat_settings;
CREATE POLICY "Admins manage live chat settings" ON public.live_chat_settings
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Admins manage live chat operators" ON public.live_chat_operators;
CREATE POLICY "Admins manage live chat operators" ON public.live_chat_operators
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Admins manage visitor sessions" ON public.visitor_sessions;
CREATE POLICY "Admins manage visitor sessions" ON public.visitor_sessions
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Admins manage chat conversations" ON public.chat_conversations;
CREATE POLICY "Admins manage chat conversations" ON public.chat_conversations
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Admins manage chat messages" ON public.chat_messages;
CREATE POLICY "Admins manage chat messages" ON public.chat_messages
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- ─── Realtime: canal privado do admin ───────────────────────────────────────

DROP POLICY IF EXISTS "Admins receive live chat broadcasts" ON realtime.messages;
CREATE POLICY "Admins receive live chat broadcasts" ON realtime.messages
  FOR SELECT TO authenticated
  USING (realtime.topic() = 'admin:live-chat' AND public.is_admin());

-- ─── Storage: avatares dos operadores ───────────────────────────────────────

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('live-chat-avatars', 'live-chat-avatars', true, 204800,
        ARRAY['image/webp', 'image/png', 'image/jpeg'])
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Admins upload live chat avatars" ON storage.objects;
CREATE POLICY "Admins upload live chat avatars" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'live-chat-avatars' AND public.is_admin());

DROP POLICY IF EXISTS "Admins update live chat avatars" ON storage.objects;
CREATE POLICY "Admins update live chat avatars" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'live-chat-avatars' AND public.is_admin());

DROP POLICY IF EXISTS "Admins delete live chat avatars" ON storage.objects;
CREATE POLICY "Admins delete live chat avatars" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'live-chat-avatars' AND public.is_admin());

-- ─── Helpers internos ───────────────────────────────────────────────────────

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
  IF NOT s.business_hours_enabled THEN
    RETURN true;
  END IF;
  local_ts := now() AT TIME ZONE s.timezone;
  day := s.business_hours -> (extract(dow FROM local_ts)::int)::text;
  IF day IS NULL OR NOT coalesce((day ->> 'enabled')::boolean, false) THEN
    RETURN false;
  END IF;
  RETURN local_ts::time >= (day ->> 'start')::time
     AND local_ts::time <  (day ->> 'end')::time;
END;
$$;

CREATE OR REPLACE FUNCTION public.live_chat_hash(p_token text)
RETURNS bytea
LANGUAGE sql
IMMUTABLE
SET search_path = public, extensions
AS $$ SELECT extensions.digest(p_token, 'sha256') $$;

CREATE OR REPLACE FUNCTION public.live_chat_new_token()
RETURNS text
LANGUAGE sql
VOLATILE
SET search_path = public, extensions
AS $$ SELECT encode(extensions.gen_random_bytes(24), 'hex') $$;

CREATE OR REPLACE FUNCTION public.live_chat_operator_json(p_operator_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT jsonb_build_object('id', o.id, 'name', o.display_name, 'role', o.role_title, 'avatar_url', o.avatar_url)
  FROM public.live_chat_operators o WHERE o.id = p_operator_id
$$;

REVOKE ALL ON FUNCTION public.live_chat_is_open(public.live_chat_settings) FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.live_chat_hash(text) FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.live_chat_new_token() FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.live_chat_operator_json(uuid) FROM public, anon, authenticated;

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
    RETURN jsonb_build_object('tracking_enabled', false, 'chat_available', false);
  END IF;
  RETURN jsonb_build_object(
    'tracking_enabled', s.tracking_enabled,
    'chat_available', public.live_chat_is_open(s),
    'typing_indicator_enabled', s.typing_indicator_enabled,
    'open_delay_seconds', s.open_delay_seconds,
    'show_on_mobile', s.show_on_mobile,
    'greeting_cta', s.greeting_cta,
    'quick_replies', s.quick_replies,
    'timezone', s.timezone
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
  IF NOT FOUND OR NOT (s.tracking_enabled OR public.live_chat_is_open(s)) THEN
    RETURN NULL;
  END IF;
  IF p_visitor_id IS NULL THEN
    RAISE EXCEPTION 'visitor_id required';
  END IF;

  -- anti-abuso simples: no máximo 30 sessões/hora por visitor_id
  IF (SELECT count(*) FROM public.visitor_sessions
      WHERE visitor_id = p_visitor_id AND started_at > now() - interval '1 hour') >= 30 THEN
    RAISE EXCEPTION 'rate_limited';
  END IF;

  -- persona fixa por visitante recorrente (D11); senão sorteio ponderado
  SELECT vs.operator_id INTO v_operator
  FROM public.visitor_sessions vs
  JOIN public.live_chat_operators o ON o.id = vs.operator_id AND o.is_active
  WHERE vs.visitor_id = p_visitor_id
  ORDER BY vs.started_at DESC
  LIMIT 1;

  IF v_operator IS NULL THEN
    SELECT o.id INTO v_operator
    FROM public.live_chat_operators o
    WHERE o.is_active
    ORDER BY -ln(1.0 - random()) / o.weight
    LIMIT 1;
  END IF;

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
BEGIN
  SELECT * INTO s FROM public.live_chat_settings WHERE id = 1;

  IF s.tracking_enabled THEN
    UPDATE public.visitor_sessions SET
      last_seen_at = now(),
      last_interaction_at = greatest(last_interaction_at, now() - make_interval(secs => greatest(coalesce(p_idle_seconds, 0), 0))),
      current_path = coalesce(left(p_path, 200), current_path),
      current_section = coalesce(v_section, current_section),
      sections_seen = CASE
        WHEN v_section IS NULL OR v_section = ANY (sections_seen) OR cardinality(sections_seen) >= 20 THEN sections_seen
        ELSE sections_seen || v_section END,
      ended_at = CASE WHEN p_ended THEN now() ELSE NULL END
    WHERE id = p_session_id AND token_hash = public.live_chat_hash(p_token);
  END IF;

  RETURN jsonb_build_object(
    'tracking_enabled', coalesce(s.tracking_enabled, false),
    'chat_available', coalesce(public.live_chat_is_open(s), false)
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
  v_conv_token text;
  v_channel text;
  v_conv uuid;
BEGIN
  SELECT * INTO s FROM public.live_chat_settings WHERE id = 1;
  IF NOT FOUND OR NOT public.live_chat_is_open(s) THEN
    RAISE EXCEPTION 'chat_unavailable';
  END IF;

  SELECT * INTO v_sess FROM public.visitor_sessions
  WHERE id = p_session_id AND token_hash = public.live_chat_hash(p_token);
  IF NOT FOUND THEN
    RAISE EXCEPTION 'invalid_session';
  END IF;

  IF (SELECT count(*) FROM public.chat_conversations
      WHERE visitor_id = v_sess.visitor_id AND created_at > now() - interval '1 hour') >= 5 THEN
    RAISE EXCEPTION 'rate_limited';
  END IF;

  v_conv_token := public.live_chat_new_token();
  v_channel := public.live_chat_new_token();

  INSERT INTO public.chat_conversations (session_id, visitor_id, operator_id, channel_key, token_hash)
  VALUES (v_sess.id, v_sess.visitor_id, v_sess.operator_id, v_channel, public.live_chat_hash(v_conv_token))
  RETURNING id INTO v_conv;

  RETURN jsonb_build_object('conversation_id', v_conv, 'channel_key', v_channel, 'token', v_conv_token);
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
  v_msg public.chat_messages;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.live_chat_settings WHERE id = 1 AND chat_enabled) THEN
    RAISE EXCEPTION 'chat_unavailable';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.chat_conversations
                 WHERE id = p_conversation_id AND token_hash = public.live_chat_hash(p_token)) THEN
    RAISE EXCEPTION 'invalid_conversation';
  END IF;
  IF v_body IS NULL OR v_body = '' THEN
    RAISE EXCEPTION 'empty_message';
  END IF;
  IF (SELECT count(*) FROM public.chat_messages
      WHERE conversation_id = p_conversation_id AND sender = 'visitor'
        AND created_at > now() - interval '1 minute') >= 20 THEN
    RAISE EXCEPTION 'rate_limited';
  END IF;

  -- a saudação automática (gerada no cliente) entra no histórico na 1ª mensagem,
  -- para o admin ver exatamente o que o visitante viu
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
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.chat_conversations
                 WHERE id = p_conversation_id AND token_hash = public.live_chat_hash(p_token)) THEN
    RAISE EXCEPTION 'invalid_conversation';
  END IF;

  IF v_digits ~ '^55\d{10,11}$' THEN
    v_e164 := '+' || v_digits;
  ELSIF v_digits ~ '^\d{10,11}$' THEN
    v_e164 := '+55' || v_digits;
  ELSE
    RAISE EXCEPTION 'invalid_phone';
  END IF;

  UPDATE public.chat_conversations
  SET whatsapp_e164 = v_e164, whatsapp_consent_at = now(), status = 'pending'
  WHERE id = p_conversation_id;

  INSERT INTO public.chat_messages (conversation_id, sender, body, kind)
  VALUES (p_conversation_id, 'visitor', v_e164, 'whatsapp');

  RETURN jsonb_build_object('whatsapp', v_e164);
END;
$$;

CREATE OR REPLACE FUNCTION public.chat_fetch_messages(p_conversation_id uuid, p_token text, p_after_id bigint DEFAULT 0)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.chat_conversations
                 WHERE id = p_conversation_id AND token_hash = public.live_chat_hash(p_token)) THEN
    RAISE EXCEPTION 'invalid_conversation';
  END IF;

  RETURN coalesce((
    SELECT jsonb_agg(jsonb_build_object(
      'id', m.id, 'sender', m.sender, 'body', m.body, 'kind', m.kind, 'created_at', m.created_at
    ) ORDER BY m.id)
    FROM (
      SELECT * FROM public.chat_messages
      WHERE conversation_id = p_conversation_id AND id > coalesce(p_after_id, 0)
      ORDER BY id
      LIMIT 200
    ) m
  ), '[]'::jsonb);
END;
$$;

CREATE OR REPLACE FUNCTION public.visitor_forget_conversation(p_conversation_id uuid, p_token text)
RETURNS void
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_session uuid;
BEGIN
  DELETE FROM public.chat_conversations
  WHERE id = p_conversation_id AND token_hash = public.live_chat_hash(p_token)
  RETURNING session_id INTO v_session;

  IF v_session IS NOT NULL THEN
    DELETE FROM public.visitor_sessions WHERE id = v_session;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.get_live_chat_public_config() FROM public;
REVOKE ALL ON FUNCTION public.visitor_session_start(uuid, text, text, text, text, text, text) FROM public;
REVOKE ALL ON FUNCTION public.visitor_heartbeat(uuid, text, text, text, integer, boolean) FROM public;
REVOKE ALL ON FUNCTION public.chat_open_conversation(uuid, text) FROM public;
REVOKE ALL ON FUNCTION public.chat_send_visitor_message(uuid, text, text, text, text) FROM public;
REVOKE ALL ON FUNCTION public.chat_submit_whatsapp(uuid, text, text) FROM public;
REVOKE ALL ON FUNCTION public.chat_fetch_messages(uuid, text, bigint) FROM public;
REVOKE ALL ON FUNCTION public.visitor_forget_conversation(uuid, text) FROM public;

GRANT EXECUTE ON FUNCTION public.get_live_chat_public_config() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.visitor_session_start(uuid, text, text, text, text, text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.visitor_heartbeat(uuid, text, text, text, integer, boolean) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.chat_open_conversation(uuid, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.chat_send_visitor_message(uuid, text, text, text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.chat_submit_whatsapp(uuid, text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.chat_fetch_messages(uuid, text, bigint) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.visitor_forget_conversation(uuid, text) TO anon, authenticated;

-- ─── Triggers: estado da conversa + broadcast ───────────────────────────────

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
    status = CASE
      WHEN NEW.sender = 'visitor' AND status = 'closed' THEN 'open'
      ELSE status END,
    closed_at = CASE WHEN NEW.sender = 'visitor' AND status = 'closed' THEN NULL ELSE closed_at END
  WHERE id = NEW.conversation_id
  RETURNING * INTO v_conv;

  v_public := jsonb_build_object(
    'id', NEW.id, 'sender', NEW.sender, 'body', NEW.body, 'kind', NEW.kind, 'created_at', NEW.created_at
  );

  -- o broadcast nunca deve derrubar o envio da mensagem
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

DROP TRIGGER IF EXISTS chat_messages_after_insert ON public.chat_messages;
CREATE TRIGGER chat_messages_after_insert
  AFTER INSERT ON public.chat_messages
  FOR EACH ROW EXECUTE FUNCTION public.chat_messages_after_insert();

CREATE OR REPLACE FUNCTION public.chat_conversations_after_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  BEGIN
    PERFORM realtime.send(
      jsonb_build_object('conversation_id', NEW.id, 'status', NEW.status, 'whatsapp_e164', NEW.whatsapp_e164),
      'conversation', 'admin:live-chat', true
    );
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'live chat broadcast failed: %', SQLERRM;
  END;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS chat_conversations_after_change ON public.chat_conversations;
CREATE TRIGGER chat_conversations_after_change
  AFTER INSERT OR UPDATE OF status, whatsapp_e164 ON public.chat_conversations
  FOR EACH ROW EXECUTE FUNCTION public.chat_conversations_after_change();

REVOKE ALL ON FUNCTION public.chat_messages_after_insert() FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.chat_conversations_after_change() FROM public, anon, authenticated;

-- ─── Limpeza diária (retenção) ──────────────────────────────────────────────

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

  DELETE FROM public.chat_conversations
  WHERE last_message_at < now() - make_interval(days => s.retention_conversation_days);

  DELETE FROM public.visitor_sessions vs
  WHERE vs.last_seen_at < now() - make_interval(days => s.retention_session_days)
    AND NOT EXISTS (SELECT 1 FROM public.chat_conversations c WHERE c.session_id = vs.id);
END;
$$;

REVOKE ALL ON FUNCTION public.live_chat_cleanup() FROM public, anon, authenticated;

CREATE OR REPLACE FUNCTION public.admin_live_chat_cleanup_now()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  PERFORM public.live_chat_cleanup();
END;
$$;

REVOKE ALL ON FUNCTION public.admin_live_chat_cleanup_now() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.admin_live_chat_cleanup_now() TO authenticated;

DO $$
BEGIN
  PERFORM cron.unschedule('live-chat-cleanup')
  WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'live-chat-cleanup');
  PERFORM cron.schedule('live-chat-cleanup', '17 6 * * *', 'SELECT public.live_chat_cleanup()');
END;
$$;
