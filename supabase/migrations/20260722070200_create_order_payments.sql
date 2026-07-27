/*
  # Create order_payments table (analogous to mp_payments, but linked to orders instead of plans)

  1. New Tables
    - `order_payments`
      - `id` (uuid, primary key) - also used as the Mercado Pago external_reference
        and X-Idempotency-Key for the payment attempt
      - `order_id` (uuid, FK to orders)
      - `store_owner_id` (uuid, FK to users) - denormalized for RLS/index
      - `amount_cents`, `currency`, `payment_method`, `mp_payment_id`, `status`,
        `status_detail`, `payer_email`, `payer_doc`, pix_*, installments,
        card_last4, card_brand, `environment`, `raw_response` - same shape as
        `mp_payments`

  2. Security
    - Enable RLS
    - Store owners can SELECT their own order payments
    - No anon/authenticated INSERT/UPDATE policy: the customer is often an
      anonymous... actually now always a logged-in buyer, but writes still
      only happen via the merchant-payments edge function (service role),
      since the transaction_amount must never be client-supplied.

  3. Indexes
    - Unique index on mp_payment_id (where not null)
    - Index on order_id
    - Index on (store_owner_id, status)
*/

CREATE TABLE IF NOT EXISTS order_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  store_owner_id uuid NOT NULL REFERENCES users(id),
  amount_cents integer NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'BRL',
  payment_method text NOT NULL DEFAULT 'pix',
  mp_payment_id text,
  status text NOT NULL DEFAULT 'pending',
  status_detail text DEFAULT '',
  payer_email text DEFAULT '',
  payer_doc text DEFAULT '',
  pix_qr_code text DEFAULT '',
  pix_qr_code_base64 text DEFAULT '',
  pix_ticket_url text DEFAULT '',
  pix_expires_at timestamptz,
  installments integer DEFAULT 1,
  card_last4 text DEFAULT '',
  card_brand text DEFAULT '',
  environment text NOT NULL DEFAULT 'production',
  raw_response jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE order_payments ENABLE ROW LEVEL SECURITY;

CREATE UNIQUE INDEX IF NOT EXISTS order_payments_mp_payment_id_uniq
  ON order_payments (mp_payment_id) WHERE mp_payment_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS order_payments_order_id_idx ON order_payments (order_id);
CREATE INDEX IF NOT EXISTS order_payments_store_owner_idx ON order_payments (store_owner_id, status);

DROP POLICY IF EXISTS "Store owners can view own order payments" ON order_payments;
CREATE POLICY "Store owners can view own order payments"
  ON order_payments FOR SELECT
  TO authenticated
  USING (auth.uid() = store_owner_id);
