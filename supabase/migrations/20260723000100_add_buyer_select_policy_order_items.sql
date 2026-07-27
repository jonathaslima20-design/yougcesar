/*
  # Allow buyers to view items of their own orders

  1. Security
    - New SELECT policy on `order_items`: a logged-in customer can view the
      items of an order they placed (orders.buyer_id = auth.uid()), mirroring
      the existing "Store owners can view own order items" policy.

  2. Notes
    - `order_items` previously had no buyer-facing SELECT policy at all — only
      store owners could read it. This is needed for the buyer order detail
      page (/conta/pedidos/:orderId) to show line items.
*/

DROP POLICY IF EXISTS "Buyers can view own order items" ON order_items;
CREATE POLICY "Buyers can view own order items"
  ON order_items FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM orders
      WHERE orders.id = order_items.order_id
      AND orders.buyer_id = auth.uid()
    )
  );
