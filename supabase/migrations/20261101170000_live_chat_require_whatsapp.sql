/*
  # Live chat: pedir o WhatsApp antes de continuar o atendimento

  Aplicar DEPOIS de 20261101160000_live_chat_keep_shown_greeting.sql.

  Quando ligado, assim que o visitante responde a saudação o chat pede o
  WhatsApp e só libera o campo de mensagem depois que o número é enviado.
  A regra roda no navegador; aqui ficam só a chave e o texto do pedido,
  expostos na config pública.
*/

ALTER TABLE public.live_chat_settings
  ADD COLUMN IF NOT EXISTS require_whatsapp boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS whatsapp_request_message text NOT NULL
    DEFAULT 'Para prosseguir com o seu atendimento, por favor, informe o seu WhatsApp.';

ALTER TABLE public.live_chat_settings DROP CONSTRAINT IF EXISTS live_chat_settings_whatsapp_request_check;
ALTER TABLE public.live_chat_settings ADD CONSTRAINT live_chat_settings_whatsapp_request_check
  CHECK (length(whatsapp_request_message) BETWEEN 1 AND 300);

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
    'reopen_cooldown_days', s.reopen_cooldown_days,
    'require_whatsapp', s.require_whatsapp,
    'whatsapp_request_message', s.whatsapp_request_message
  );
END;
$$;
