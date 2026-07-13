/*
  # Create In-App Notifications System

  1. New Tables
    - `notifications`
      - `id` (uuid, primary key) - Unique notification identifier
      - `user_id` (uuid, references users) - The user who receives the notification
      - `type` (text) - Notification type: 'new_lead', 'whatsapp_click', 'view_milestone', 'subscription_expiring', 'subscription_expired', 'product_sold', 'system'
      - `title` (text) - Short notification title
      - `message` (text) - Notification message body
      - `related_entity_id` (uuid, nullable) - Reference to related product/lead/subscription
      - `related_entity_type` (text, nullable) - Type of related entity: 'product', 'lead', 'subscription'
      - `is_read` (boolean, default false) - Whether the notification has been read
      - `created_at` (timestamptz, default now()) - When the notification was created

  2. Security
    - Enable RLS on `notifications` table
    - Users can only read their own notifications
    - Users can update (mark as read) their own notifications
    - Users can delete their own notifications
    - System (service role) can insert notifications for any user

  3. Indexes
    - Composite index on (user_id, is_read, created_at) for fast unread queries
    - Index on (user_id, created_at) for paginated listing

  4. Functions
    - `create_notification` - Helper function to create a notification for a user
    - `notify_on_new_lead` - Trigger function that fires when a new lead is inserted
    - `notify_on_view_milestone` - Function to check and notify on view milestones (50, 100, 500, 1000)

  5. Triggers
    - `trigger_notify_on_new_lead` - Fires after INSERT on leads table
*/

-- Create notifications table
CREATE TABLE IF NOT EXISTS notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  type text NOT NULL DEFAULT 'system',
  title text NOT NULL,
  message text NOT NULL DEFAULT '',
  related_entity_id uuid,
  related_entity_type text,
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread
  ON notifications (user_id, is_read, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_notifications_user_created
  ON notifications (user_id, created_at DESC);

-- Enable Row Level Security
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Users can only access their own notifications
CREATE POLICY "Users can view own notifications"
  ON notifications FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can mark own notifications as read"
  ON notifications FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own notifications"
  ON notifications FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Service role can insert notifications"
  ON notifications FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Helper function to create a notification
CREATE OR REPLACE FUNCTION create_notification(
  p_user_id uuid,
  p_type text,
  p_title text,
  p_message text DEFAULT '',
  p_related_entity_id uuid DEFAULT NULL,
  p_related_entity_type text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_notification_id uuid;
BEGIN
  INSERT INTO notifications (user_id, type, title, message, related_entity_id, related_entity_type)
  VALUES (p_user_id, p_type, p_title, p_message, p_related_entity_id, p_related_entity_type)
  RETURNING id INTO v_notification_id;

  RETURN v_notification_id;
END;
$$;

-- Trigger function: notify product owner when a new lead is created
CREATE OR REPLACE FUNCTION notify_on_new_lead()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_product_title text;
  v_product_owner uuid;
  v_lead_name text;
BEGIN
  -- Get product info to find the owner
  SELECT p.title, p.user_id
  INTO v_product_title, v_product_owner
  FROM products p
  WHERE p.id = NEW.property_id;

  -- Only create notification if we found the product owner
  IF v_product_owner IS NOT NULL THEN
    v_lead_name := COALESCE(NEW.name, 'Alguém');

    PERFORM create_notification(
      v_product_owner,
      CASE WHEN NEW.source = 'whatsapp' THEN 'whatsapp_click' ELSE 'new_lead' END,
      CASE
        WHEN NEW.source = 'whatsapp' THEN 'Clique no WhatsApp'
        ELSE 'Novo contato recebido'
      END,
      CASE
        WHEN NEW.source = 'whatsapp' THEN v_lead_name || ' clicou no WhatsApp para o produto "' || COALESCE(v_product_title, 'Sem título') || '"'
        ELSE v_lead_name || ' enviou uma mensagem sobre o produto "' || COALESCE(v_product_title, 'Sem título') || '"'
      END,
      NEW.property_id,
      'product'
    );
  END IF;

  RETURN NEW;
END;
$$;

-- Create trigger on leads table (only if leads table exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'leads' AND table_schema = 'public') THEN
    DROP TRIGGER IF EXISTS trigger_notify_on_new_lead ON leads;
    CREATE TRIGGER trigger_notify_on_new_lead
      AFTER INSERT ON leads
      FOR EACH ROW
      EXECUTE FUNCTION notify_on_new_lead();
  END IF;
END $$;

-- Function to check and create view milestone notifications
CREATE OR REPLACE FUNCTION check_view_milestones(
  p_product_id uuid,
  p_product_owner uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_view_count bigint;
  v_product_title text;
  v_milestone int;
  v_milestones int[] := ARRAY[50, 100, 500, 1000, 5000];
  v_already_notified boolean;
BEGIN
  -- Get total views for this product
  SELECT COUNT(*) INTO v_view_count
  FROM property_views
  WHERE property_id = p_product_id;

  -- Get product title
  SELECT title INTO v_product_title
  FROM products
  WHERE id = p_product_id;

  -- Check each milestone
  FOREACH v_milestone IN ARRAY v_milestones
  LOOP
    IF v_view_count >= v_milestone THEN
      -- Check if we already sent this milestone notification
      SELECT EXISTS(
        SELECT 1 FROM notifications
        WHERE user_id = p_product_owner
          AND type = 'view_milestone'
          AND related_entity_id = p_product_id
          AND message LIKE '%' || v_milestone || ' visualizações%'
      ) INTO v_already_notified;

      IF NOT v_already_notified THEN
        PERFORM create_notification(
          p_product_owner,
          'view_milestone',
          'Marco de visualizações atingido!',
          'Seu produto "' || COALESCE(v_product_title, 'Sem título') || '" alcançou ' || v_milestone || ' visualizações!',
          p_product_id,
          'product'
        );
      END IF;
    END IF;
  END LOOP;
END;
$$;
