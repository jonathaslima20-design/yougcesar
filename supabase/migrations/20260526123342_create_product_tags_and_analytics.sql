/*
  # Create Product Tags System and Analytics Summary Function

  1. New Tables
    - `product_tags`
      - `id` (uuid, primary key)
      - `user_id` (uuid, FK to auth.users)
      - `name` (text, tag name)
      - `color` (text, hex color code)
      - `created_at` (timestamptz)
    - `product_tag_assignments`
      - `id` (uuid, primary key)
      - `product_id` (uuid, FK to products)
      - `tag_id` (uuid, FK to product_tags)
      - `created_at` (timestamptz)

  2. New Functions
    - `get_product_analytics_summary` - Returns views, leads, and order counts per product for a given user and time period

  3. Security
    - Enable RLS on both tables
    - Users can only manage their own tags
    - Tag assignments restricted to products owned by the user

  4. Indexes
    - Composite index on product_tag_assignments (product_id, tag_id)
    - Index on product_tags (user_id)
*/

-- Create product_tags table
CREATE TABLE IF NOT EXISTS product_tags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  color text NOT NULL DEFAULT '#3b82f6',
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, name)
);

ALTER TABLE product_tags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own tags"
  ON product_tags FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own tags"
  ON product_tags FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own tags"
  ON product_tags FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own tags"
  ON product_tags FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Create product_tag_assignments table
CREATE TABLE IF NOT EXISTS product_tag_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  tag_id uuid NOT NULL REFERENCES product_tags(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(product_id, tag_id)
);

ALTER TABLE product_tag_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view tag assignments for own products"
  ON product_tag_assignments FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM products
      WHERE products.id = product_tag_assignments.product_id
      AND products.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can assign tags to own products"
  ON product_tag_assignments FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM products
      WHERE products.id = product_tag_assignments.product_id
      AND products.user_id = auth.uid()
    )
    AND
    EXISTS (
      SELECT 1 FROM product_tags
      WHERE product_tags.id = product_tag_assignments.tag_id
      AND product_tags.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can remove tag assignments from own products"
  ON product_tag_assignments FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM products
      WHERE products.id = product_tag_assignments.product_id
      AND products.user_id = auth.uid()
    )
  );

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_product_tags_user_id ON product_tags(user_id);
CREATE INDEX IF NOT EXISTS idx_product_tag_assignments_product_id ON product_tag_assignments(product_id);
CREATE INDEX IF NOT EXISTS idx_product_tag_assignments_tag_id ON product_tag_assignments(tag_id);
CREATE INDEX IF NOT EXISTS idx_product_tag_assignments_composite ON product_tag_assignments(product_id, tag_id);

-- Create analytics summary function
CREATE OR REPLACE FUNCTION get_product_analytics_summary(
  p_user_id uuid,
  p_period_days integer DEFAULT 30
)
RETURNS TABLE(
  product_id uuid,
  views_count bigint,
  leads_count bigint,
  orders_count bigint,
  weekly_views jsonb
) AS $$
DECLARE
  start_date timestamptz;
BEGIN
  start_date := now() - (p_period_days || ' days')::interval;

  RETURN QUERY
  WITH product_ids AS (
    SELECT p.id FROM products p WHERE p.user_id = p_user_id
  ),
  views_agg AS (
    SELECT
      pv.property_id AS pid,
      COUNT(*) AS cnt
    FROM property_views pv
    INNER JOIN product_ids pi ON pi.id = pv.property_id
    WHERE pv.viewed_at >= start_date
    GROUP BY pv.property_id
  ),
  leads_agg AS (
    SELECT
      l.property_id AS pid,
      COUNT(*) AS cnt
    FROM leads l
    INNER JOIN product_ids pi ON pi.id = l.property_id
    WHERE l.created_at >= start_date
    GROUP BY l.property_id
  ),
  orders_agg AS (
    SELECT
      oi.product_id AS pid,
      COUNT(DISTINCT oi.order_id) AS cnt
    FROM order_items oi
    INNER JOIN orders o ON o.id = oi.order_id
    INNER JOIN product_ids pi ON pi.id = oi.product_id
    WHERE o.created_at >= start_date
      AND o.store_owner_id = p_user_id
    GROUP BY oi.product_id
  ),
  weekly_views_agg AS (
    SELECT
      pv.property_id AS pid,
      jsonb_agg(
        jsonb_build_object('day', d.day::date, 'count', COALESCE(dv.cnt, 0))
        ORDER BY d.day
      ) AS weekly
    FROM product_ids pi
    CROSS JOIN generate_series(
      (now() - interval '6 days')::date,
      now()::date,
      interval '1 day'
    ) AS d(day)
    LEFT JOIN LATERAL (
      SELECT COUNT(*) AS cnt
      FROM property_views pv2
      WHERE pv2.property_id = pi.id
        AND pv2.viewed_at::date = d.day::date
    ) dv ON true
    LEFT JOIN property_views pv ON pv.property_id = pi.id AND pv.viewed_at::date = d.day::date
    GROUP BY pv.property_id
  )
  SELECT
    pi.id AS product_id,
    COALESCE(va.cnt, 0) AS views_count,
    COALESCE(la.cnt, 0) AS leads_count,
    COALESCE(oa.cnt, 0) AS orders_count,
    COALESCE(wva.weekly, '[]'::jsonb) AS weekly_views
  FROM product_ids pi
  LEFT JOIN views_agg va ON va.pid = pi.id
  LEFT JOIN leads_agg la ON la.pid = pi.id
  LEFT JOIN orders_agg oa ON oa.pid = pi.id
  LEFT JOIN weekly_views_agg wva ON wva.pid = pi.id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
