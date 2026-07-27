/*
  # Per-user kill switch for the storefront "Falar no WhatsApp" button

  1. Problem
    - Admins need to disable the WhatsApp contact button on a specific
      seller's product pages (ContactSidebar), without touching the phone
      button or removing the seller's WhatsApp number itself.

  2. Changes
    - `users.whatsapp_button_enabled`: boolean, defaults to true so existing
      sellers keep the current behavior.
*/

ALTER TABLE public.users ADD COLUMN IF NOT EXISTS whatsapp_button_enabled boolean NOT NULL DEFAULT true;
