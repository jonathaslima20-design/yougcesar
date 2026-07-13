/*
  # Add Admin RLS Policies to Orders Tables

  ## Problem
  The `orders` and `order_items` tables only have RLS policies that allow
  a store owner to view their own orders (auth.uid() = store_owner_id).
  
  When an admin views the details of a specific user in the admin panel,
  the admin's auth.uid() does not match the store_owner_id, so the database
  silently returns empty results — causing the "Pedidos" tab to show
  "Nenhum pedido recebido" even when the user has orders.

  ## Changes

  1. `orders` table
     - New SELECT policy: admins (users with role = 'admin') can view all orders
  
  2. `order_items` table
     - New SELECT policy: admins can view all order items

  ## Security Notes
  - Existing store owner policies are NOT removed — sellers still only see their own orders
  - Only users with role = 'admin' in the users table can access all orders
  - Admin policies are additive (OR logic with existing policies)
*/

-- Admins can view all orders
CREATE POLICY "Admins can view all orders"
  ON orders FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

-- Admins can view all order items
CREATE POLICY "Admins can view all order items"
  ON order_items FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );
