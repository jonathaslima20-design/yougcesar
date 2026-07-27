/*
  # Create order_payment_webhook_events table

  1. New Tables
    - `order_payment_webhook_events` - idempotency + audit log for Mercado Pago
      webhook notifications tied to merchant/order payments (kept separate
      from `payment_webhook_events`, which is the platform's own subscription
      billing webhook log, so the two domains don't share retention/ownership)
      - `id` (uuid, primary key)
      - `mp_event_id` (text, unique) - dedupe key, e.g. "{data.id}_{action}"
      - `event_type` (text)
      - `mp_payment_id` (text)
      - `payload` (jsonb)
      - `processed` (boolean)
      - `received_at` (timestamptz)

  2. Security
    - Enable RLS, no client policies (service role only, same as payment_webhook_events)
*/

CREATE TABLE IF NOT EXISTS order_payment_webhook_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mp_event_id text UNIQUE NOT NULL,
  event_type text DEFAULT '',
  mp_payment_id text DEFAULT '',
  payload jsonb DEFAULT '{}'::jsonb,
  processed boolean DEFAULT false,
  received_at timestamptz DEFAULT now()
);

ALTER TABLE order_payment_webhook_events ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS order_payment_webhook_events_payment_id_idx
  ON order_payment_webhook_events (mp_payment_id);
