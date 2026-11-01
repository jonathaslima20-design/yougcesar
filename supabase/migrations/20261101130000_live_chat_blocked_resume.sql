/*
  # Live chat: visitante bloqueado não retoma a sessão

  Antes, um visitante bloqueado que já tinha conversa guardada no navegador
  continuava vendo o widget (só não conseguia enviar). Agora
  visitor_session_resume devolve NULL para ele; o navegador tenta criar outra
  sessão, visitor_session_start também recusa, e o widget não aparece.
*/

CREATE OR REPLACE FUNCTION public.visitor_session_resume(p_session_id uuid, p_token text)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_visitor uuid;
  v_operator uuid;
BEGIN
  SELECT visitor_id INTO v_visitor FROM public.visitor_sessions
  WHERE id = p_session_id AND token_hash = public.live_chat_hash(p_token);
  IF NOT FOUND OR public.live_chat_is_blocked(v_visitor) THEN
    RETURN NULL;
  END IF;

  v_operator := public.live_chat_ensure_session_operator(p_session_id);
  RETURN jsonb_build_object('operator', public.live_chat_operator_json(v_operator));
END;
$$;
