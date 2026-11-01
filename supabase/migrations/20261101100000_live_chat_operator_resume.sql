/*
  # Live chat: persona atribuída também depois que a sessão começou

  1. Problema
    - A persona era sorteada só em visitor_session_start. Uma sessão criada
      enquanto não havia operador ativo ficava com operator_id NULL, e o
      navegador reaproveita essa sessão (sessionStorage) até fechar a aba.
      Resultado: o chat aparecia como "VitrineTurbo" mesmo depois de um
      operador ser cadastrado, e a conversa nascia com operator_id NULL.
    - Mesmo efeito quando o operador da sessão era desativado/excluído.

  2. Mudança
    - live_chat_pick_operator(): regra única de escolha (persona fixa por
      visitante recorrente, senão sorteio ponderado entre os ativos).
    - visitor_session_resume(): chamada a cada carregamento de página que
      reaproveita a sessão; completa/troca o operador se estiver vazio ou
      inativo e devolve os dados atuais (nome/foto atualizados).
    - chat_open_conversation(): garante operador antes de criar a conversa e
      devolve o operador.
    - chat_conversation_operator(): mesma correção para uma conversa já
      existente que o visitante retoma.
*/

CREATE OR REPLACE FUNCTION public.live_chat_pick_operator(p_visitor_id uuid)
RETURNS uuid
LANGUAGE plpgsql
VOLATILE
SET search_path = public
AS $$
DECLARE
  v_operator uuid;
BEGIN
  -- persona fixa por visitante recorrente (D11)
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

  RETURN v_operator;
END;
$$;

REVOKE ALL ON FUNCTION public.live_chat_pick_operator(uuid) FROM public, anon, authenticated;

-- operador da sessão vazio ou inativo → escolhe de novo
CREATE OR REPLACE FUNCTION public.live_chat_ensure_session_operator(p_session_id uuid)
RETURNS uuid
LANGUAGE plpgsql
VOLATILE
SET search_path = public
AS $$
DECLARE
  v_sess public.visitor_sessions;
  v_operator uuid;
BEGIN
  SELECT * INTO v_sess FROM public.visitor_sessions WHERE id = p_session_id;
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  IF v_sess.operator_id IS NOT NULL
     AND EXISTS (SELECT 1 FROM public.live_chat_operators WHERE id = v_sess.operator_id AND is_active) THEN
    RETURN v_sess.operator_id;
  END IF;

  v_operator := public.live_chat_pick_operator(v_sess.visitor_id);
  IF v_operator IS DISTINCT FROM v_sess.operator_id THEN
    UPDATE public.visitor_sessions SET operator_id = v_operator WHERE id = p_session_id;
  END IF;
  RETURN v_operator;
END;
$$;

REVOKE ALL ON FUNCTION public.live_chat_ensure_session_operator(uuid) FROM public, anon, authenticated;

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

CREATE OR REPLACE FUNCTION public.visitor_session_resume(p_session_id uuid, p_token text)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_operator uuid;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.visitor_sessions
                 WHERE id = p_session_id AND token_hash = public.live_chat_hash(p_token)) THEN
    RETURN NULL; -- sessão expirada/apagada: o cliente cria outra
  END IF;

  v_operator := public.live_chat_ensure_session_operator(p_session_id);
  RETURN jsonb_build_object('operator', public.live_chat_operator_json(v_operator));
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

  v_operator := public.live_chat_ensure_session_operator(v_sess.id);
  v_conv_token := public.live_chat_new_token();
  v_channel := public.live_chat_new_token();

  INSERT INTO public.chat_conversations (session_id, visitor_id, operator_id, channel_key, token_hash)
  VALUES (v_sess.id, v_sess.visitor_id, v_operator, v_channel, public.live_chat_hash(v_conv_token))
  RETURNING id INTO v_conv;

  RETURN jsonb_build_object(
    'conversation_id', v_conv,
    'channel_key', v_channel,
    'token', v_conv_token,
    'operator', public.live_chat_operator_json(v_operator)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.chat_conversation_operator(p_conversation_id uuid, p_token text)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_conv public.chat_conversations;
  v_operator uuid;
BEGIN
  SELECT * INTO v_conv FROM public.chat_conversations
  WHERE id = p_conversation_id AND token_hash = public.live_chat_hash(p_token);
  IF NOT FOUND THEN
    RAISE EXCEPTION 'invalid_conversation';
  END IF;

  v_operator := v_conv.operator_id;
  IF v_operator IS NULL
     OR NOT EXISTS (SELECT 1 FROM public.live_chat_operators WHERE id = v_operator AND is_active) THEN
    IF v_conv.session_id IS NOT NULL THEN
      v_operator := public.live_chat_ensure_session_operator(v_conv.session_id);
    ELSE
      v_operator := public.live_chat_pick_operator(v_conv.visitor_id);
    END IF;
    UPDATE public.chat_conversations SET operator_id = v_operator WHERE id = p_conversation_id;
  END IF;

  RETURN jsonb_build_object('operator', public.live_chat_operator_json(v_operator));
END;
$$;

REVOKE ALL ON FUNCTION public.visitor_session_resume(uuid, text) FROM public;
REVOKE ALL ON FUNCTION public.chat_conversation_operator(uuid, text) FROM public;
GRANT EXECUTE ON FUNCTION public.visitor_session_resume(uuid, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.chat_conversation_operator(uuid, text) TO anon, authenticated;
