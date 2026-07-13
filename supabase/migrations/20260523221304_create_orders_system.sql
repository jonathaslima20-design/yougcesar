/*
  # Create Orders System

  1. New Tables
    - `orders`
      - `id` (uuid, primary key) - Unique order identifier
      - `store_owner_id` (uuid) - The store owner (seller) who receives the order
      - `customer_name` (text) - Name of the customer placing the order
      - `customer_whatsapp` (text) - Customer's WhatsApp number
      - `customer_country_code` (text, default '55') - Country code for the phone number
      - `status` (text) - Order status: pending, confirmed, preparing, shipped, delivered, cancelled
      - `order_type` (text) - Order type: 'whatsapp' now, 'ecommerce' in the future
      - `subtotal` (numeric) - Sum of all items before any adjustments
      - `total` (numeric) - Final order total
      - `notes` (text) - General order notes
      - `whatsapp_message` (text) - Full WhatsApp message sent for reference
      - `source` (text) - Where the order was created: 'cart' or 'product_page'
      - `created_at` (timestamptz) - When the order was placed
      - `updated_at` (timestamptz) - Last update timestamp

    - `order_items`
      - `id` (uuid, primary key) - Unique item identifier
      - `order_id` (uuid, FK to orders) - Parent order
      - `product_id` (uuid) - Reference to the product
      - `product_title` (text) - Snapshot of product title at time of order
      - `product_image_url` (text) - Snapshot of product image
      - `quantity` (integer) - Number of units
      - `unit_price` (numeric) - Price per unit at time of order
      - `selected_color` (text) - Selected color variant
      - `selected_size` (text) - Selected size variant
      - `selected_flavor` (text) - Selected flavor variant
      - `selected_variant_label` (text) - Weight variant label
      - `item_notes` (text) - Notes specific to this item
      - `subtotal` (numeric) - quantity * unit_price

  2. Security
    - Enable RLS on both tables
    - Store owners can read, update, and delete their own orders
    - Anonymous/public users can insert orders (visitors placing orders via WhatsApp)
    - Order items follow parent order access via store_owner_id join

  3. Indexes
    - Composite index on (store_owner_id, status, created_at DESC) for filtered queries
    - Index on (store_owner_id, created_at DESC) for paginated listing
    - Index on (order_id) for order_items lookups

  4. Triggers
    - Notify store owner when a new order is placed via create_notification function
*/

-- Create orders table
CREATE TABLE IF NOT EXISTS orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_owner_id uuid NOT NULL,
  customer_name text NOT NULL,
  customer_whatsapp text NOT NULL,
  customer_country_code text NOT NULL DEFAULT '55',
  status text NOT NULL DEFAULT 'pending',
  order_type text NOT NULL DEFAULT 'whatsapp',
  subtotal numeric NOT NULL DEFAULT 0,
  total numeric NOT NULL DEFAULT 0,
  notes text DEFAULT '',
  whatsapp_message text DEFAULT '',
  source text NOT NULL DEFAULT 'cart',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT valid_order_status CHECK (status IN ('pending', 'confirmed', 'preparing', 'shipped', 'delivered', 'cancelled')),
  CONSTRAINT valid_order_type CHECK (order_type IN ('whatsapp', 'ecommerce')),
  CONSTRAINT valid_order_source CHECK (source IN ('cart', 'product_page'))
);

-- Create order_items table
CREATE TABLE IF NOT EXISTS order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id uuid NOT NULL,
  product_title text NOT NULL,
  product_image_url text DEFAULT '',
  quantity integer NOT NULL DEFAULT 1,
  unit_price numeric NOT NULL DEFAULT 0,
  selected_color text,
  selected_size text,
  selected_flavor text,
  selected_variant_label text,
  item_notes text DEFAULT '',
  subtotal numeric NOT NULL DEFAULT 0
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_orders_store_status_created
  ON orders (store_owner_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_orders_store_created
  ON orders (store_owner_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_order_items_order_id
  ON order_items (order_id);

-- Enable Row Level Security
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;

-- RLS Policies for orders table

-- Store owners can view their own orders
CREATE POLICY "Store owners can view own orders"
  ON orders FOR SELECT
  TO authenticated
  USING (auth.uid() = store_owner_id);

-- Store owners can update their own orders (status changes)
CREATE POLICY "Store owners can update own orders"
  ON orders FOR UPDATE
  TO authenticated
  USING (auth.uid() = store_owner_id)
  WITH CHECK (auth.uid() = store_owner_id);

-- Store owners can delete their own orders
CREATE POLICY "Store owners can delete own orders"
  ON orders FOR DELETE
  TO authenticated
  USING (auth.uid() = store_owner_id);

-- Anyone can create orders (visitors placing orders via storefront)
CREATE POLICY "Anyone can create orders"
  ON orders FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- RLS Policies for order_items table

-- Store owners can view items of their own orders
CREATE POLICY "Store owners can view own order items"
  ON order_items FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM orders
      WHERE orders.id = order_items.order_id
      AND orders.store_owner_id = auth.uid()
    )
  );

-- Anyone can insert order items (along with the order)
CREATE POLICY "Anyone can create order items"
  ON order_items FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- Store owners can delete items of their own orders
CREATE POLICY "Store owners can delete own order items"
  ON order_items FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM orders
      WHERE orders.id = order_items.order_id
      AND orders.store_owner_id = auth.uid()
    )
  );

-- Trigger function: notify store owner when a new order is placed
CREATE OR REPLACE FUNCTION notify_on_new_order()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_item_count integer;
  v_formatted_total text;
BEGIN
  -- Count items in this order
  SELECT COUNT(*) INTO v_item_count
  FROM order_items
  WHERE order_id = NEW.id;

  -- Format total as currency
  v_formatted_total := 'R$ ' || to_char(NEW.total, 'FM999G999D00');

  -- Create notification for the store owner
  PERFORM create_notification(
    NEW.store_owner_id,
    'new_order',
    'Novo pedido recebido',
    NEW.customer_name || ' fez um pedido de ' || v_formatted_total || ' com ' || v_item_count || ' item(ns)',
    NEW.id,
    'order'
  );

  RETURN NEW;
END;
$$;

-- Create trigger on orders table
DROP TRIGGER IF EXISTS trigger_notify_on_new_order ON orders;
CREATE TRIGGER trigger_notify_on_new_order
  AFTER INSERT ON orders
  FOR EACH ROW
  EXECUTE FUNCTION notify_on_new_order();

-- Function to auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_orders_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Create trigger for auto-updating updated_at
DROP TRIGGER IF EXISTS trigger_orders_updated_at ON orders;
CREATE TRIGGER trigger_orders_updated_at
  BEFORE UPDATE ON orders
  FOR EACH ROW
  EXECUTE FUNCTION update_orders_updated_at();
