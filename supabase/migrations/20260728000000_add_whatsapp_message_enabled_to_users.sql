/*
  # WhatsApp button: control the pre-filled message, not visibility

  1. Problem
    - `whatsapp_button_enabled` used to hide the entire "Falar no WhatsApp"
      button on the product page. Some sellers don't want the button gone —
      they still want customers to reach them on WhatsApp, they just don't
      want the pre-filled message that mentions the product.
    - The button should always be visible when the seller has a WhatsApp
      number/link configured; only the message content should be toggleable.

  2. Changes
    - `users.whatsapp_message_enabled`: boolean, defaults to true so every
      existing and newly-created account keeps today's behavior (product
      page WhatsApp button includes the pre-filled product message).
    - When false, the product page WhatsApp button opens a direct chat with
      no pre-filled text. Has no effect when `whatsapp_mode = 'link'`, since
      link mode never appends a message.
    - `whatsapp_button_enabled` is no longer read by the app; left in place,
      unused, to avoid a destructive column drop.
*/

ALTER TABLE public.users ADD COLUMN IF NOT EXISTS whatsapp_message_enabled boolean NOT NULL DEFAULT true;
