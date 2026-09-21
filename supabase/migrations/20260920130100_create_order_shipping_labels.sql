/*
  # Create order_shipping_labels table

  1. New Tables
    - `order_shipping_labels`
      - `id` (uuid, primary key)
      - `order_id` (uuid, FK to orders) - which order this label belongs to
      - `superfrete_order_id` (text) - the freight order id returned by
        SuperFrete's `/api/v0/cart`, reused on `/api/v0/checkout` and
        `/api/v0/order/cancel`
      - `service_id` (text) - SuperFrete service id used (1=PAC, 2=SEDEX, etc.)
      - `status` (text) - `pending` (added to cart, not yet paid),
        `released` (paid, ready to ship), `posted`, `delivered`,
        `cancelled`, `error` (checkout failed, e.g. insufficient balance —
        `superfrete_order_id` is kept so a retry doesn't duplicate the
        cart entry)
      - `price` (numeric) - price charged for the label
      - `tracking_code` (text) - carrier tracking code returned on checkout
      - `label_pdf_url` (text) - URL of the generated label PDF
      - `error_message` (text) - last error, when `status = 'error'`
      - `purchased_at` / `cancelled_at` (timestamptz)
      - `created_at` / `updated_at` (timestamptz)

  2. Security
    - Enable RLS
    - No client-side policies: mirrors `merchant_shipping_credentials` and
      `merchant_payment_credentials` — the merchant never talks to this
      table directly, only through the `merchant-shipping-label` edge
      function (service role), which checks order ownership itself.

  3. Notes
    - A given order can have more than one row over time (e.g. an error
      followed by a retry, or a cancelled label followed by a fresh
      purchase) — the UI always reads the most recent row by
      `created_at`, so no unique constraint on `order_id`.
*/

CREATE TABLE IF NOT EXISTS order_shipping_labels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  superfrete_order_id text,
  service_id text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'released', 'posted', 'delivered', 'cancelled', 'error')),
  price numeric,
  tracking_code text,
  label_pdf_url text,
  error_message text,
  purchased_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_order_shipping_labels_order_id ON order_shipping_labels(order_id);

ALTER TABLE order_shipping_labels ENABLE ROW LEVEL SECURITY;
-- No policies: only the service role (via the merchant-shipping-label
-- edge function) can read or write this table.

CREATE OR REPLACE FUNCTION update_order_shipping_labels_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_order_shipping_labels_updated_at ON order_shipping_labels;
CREATE TRIGGER trigger_order_shipping_labels_updated_at
  BEFORE UPDATE ON order_shipping_labels
  FOR EACH ROW
  EXECUTE FUNCTION update_order_shipping_labels_updated_at();
