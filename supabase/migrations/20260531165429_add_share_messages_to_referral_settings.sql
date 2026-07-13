/*
  # Add share message fields to referral_settings

  1. Modified Tables
    - `referral_settings`
      - `share_message_whatsapp` (text) - Custom message template for WhatsApp sharing. Uses {link} as placeholder.
      - `share_message_telegram` (text) - Custom message template for Telegram sharing. Uses {link} as placeholder.

  2. Notes
    - Both columns have a default message that includes the {link} placeholder
    - The placeholder {link} will be replaced by the user's actual referral link at share time
    - If the message is empty/null, the frontend will use a hardcoded fallback
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'referral_settings' AND column_name = 'share_message_whatsapp'
  ) THEN
    ALTER TABLE referral_settings ADD COLUMN share_message_whatsapp text DEFAULT 'Crie sua vitrine online no VitrineTurbo! Cadastre-se aqui: {link}';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'referral_settings' AND column_name = 'share_message_telegram'
  ) THEN
    ALTER TABLE referral_settings ADD COLUMN share_message_telegram text DEFAULT 'Crie sua vitrine online no VitrineTurbo! Cadastre-se aqui: {link}';
  END IF;
END $$;
