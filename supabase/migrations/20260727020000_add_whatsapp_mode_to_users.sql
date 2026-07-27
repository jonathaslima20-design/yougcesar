/*
  # WhatsApp contact mode: phone number vs. direct link

  1. Problem
    - Some sellers want their storefront WhatsApp button to open a specific
      link (e.g. a `wa.me/message/...` click-to-chat link) instead of the
      usual `wa.me/<number>?text=...` built from `whatsapp` + `country_code`,
      with no pre-filled message at all.
    - Signup/creation flows must keep asking only for a phone number — this
      is strictly an account-settings option for existing sellers.

  2. Changes
    - `users.whatsapp_mode`: text, defaults to 'phone' so every existing and
      newly-created account keeps today's behavior untouched.
    - `users.whatsapp_link`: text, nullable — the raw URL used when
      whatsapp_mode = 'link'.
*/

ALTER TABLE public.users ADD COLUMN IF NOT EXISTS whatsapp_mode text NOT NULL DEFAULT 'phone';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'users_whatsapp_mode_check'
  ) THEN
    ALTER TABLE public.users ADD CONSTRAINT users_whatsapp_mode_check CHECK (whatsapp_mode IN ('phone', 'link'));
  END IF;
END $$;

ALTER TABLE public.users ADD COLUMN IF NOT EXISTS whatsapp_link text;
