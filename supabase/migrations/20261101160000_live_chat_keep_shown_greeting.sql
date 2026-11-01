/*
  # Live chat: conversa iniciada pelo admin continua a saudação já exibida

  Problema: a saudação automática só existia na tela do visitante (a conversa
  nasce quando ele responde). Se ele lia, fechava e depois o admin iniciava a
  conversa, a mensagem do admin virava a primeira e a saudação sumia.

  Mudança:
    - visitor_sessions guarda o texto e o horário da saudação exibida
      (visitor_greeting_shown, chamada pelo widget uma vez por sessão).
    - admin_start_conversation insere essa saudação como mensagem 'system',
      com o horário original, antes da mensagem do admin.
*/

ALTER TABLE public.visitor_sessions
  ADD COLUMN IF NOT EXISTS greeting_text text,
  ADD COLUMN IF NOT EXISTS greeting_shown_at timestamptz;

CREATE OR REPLACE FUNCTION public.visitor_greeting_shown(p_session_id uuid, p_token text, p_text text)
RETURNS void
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_text IS NULL OR btrim(p_text) = '' THEN
    RETURN;
  END IF;
  -- só a primeira saudação da sessão
  UPDATE public.visitor_sessions
  SET greeting_text = left(btrim(p_text), 2000), greeting_shown_at = now()
  WHERE id = p_session_id
    AND token_hash = public.live_chat_hash(p_token)
    AND greeting_shown_at IS NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.visitor_greeting_shown(uuid, text, text) FROM public;
GRANT EXECUTE ON FUNCTION public.visitor_greeting_shown(uuid, text, text) TO anon, authenticated;

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

  -- a saudação que o visitante já viu vira o início da conversa
  IF v_sess.greeting_text IS NOT NULL THEN
    INSERT INTO public.chat_messages (conversation_id, sender, body, kind, created_at)
    VALUES (v_conv, 'system', v_sess.greeting_text, 'text', coalesce(v_sess.greeting_shown_at, now()));
  END IF;

  INSERT INTO public.chat_messages (conversation_id, sender, admin_user_id, body, kind)
  VALUES (v_conv, 'operator', auth.uid(), left(v_body, 2000), 'text');

  RETURN jsonb_build_object('conversation_id', v_conv, 'existing', false);
END;
$$;
