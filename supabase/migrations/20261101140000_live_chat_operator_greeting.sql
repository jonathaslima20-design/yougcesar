/*
  # Live chat: saudação editável por operador

  - live_chat_operators.greeting_template: texto livre com variáveis
    {saudacao} (Bom dia/Boa tarde/Boa noite), {nome}, {cargo} e {chamada}
    (a chamada geral das configurações). Vazio = saudação padrão.
  - live_chat_operator_json passa a devolver 'greeting' para o widget.
*/

ALTER TABLE public.live_chat_operators
  ADD COLUMN IF NOT EXISTS greeting_template text;

ALTER TABLE public.live_chat_operators DROP CONSTRAINT IF EXISTS live_chat_operators_greeting_length_check;
ALTER TABLE public.live_chat_operators ADD CONSTRAINT live_chat_operators_greeting_length_check
  CHECK (greeting_template IS NULL OR length(greeting_template) <= 500);

CREATE OR REPLACE FUNCTION public.live_chat_operator_json(p_operator_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'id', o.id,
    'name', o.display_name,
    'role', o.role_title,
    'avatar_url', o.avatar_url,
    'greeting', nullif(btrim(o.greeting_template), '')
  )
  FROM public.live_chat_operators o WHERE o.id = p_operator_id
$$;

REVOKE ALL ON FUNCTION public.live_chat_operator_json(uuid) FROM public, anon, authenticated;
