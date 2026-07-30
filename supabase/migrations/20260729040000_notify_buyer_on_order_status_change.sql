/*
  # Notify buyers when their order status changes

  1. Problem
    - The `notifications` table already exists and is generic: it only has
      `user_id uuid` with RLS `auth.uid() = user_id`, no FK to `users`.
      Buyers (`customers` table) share the same `auth.users` identity as
      merchants, so a notification row with `user_id = orders.buyer_id` is
      already readable only by that buyer through their own Supabase Auth
      session — no new table needed.
    - Nothing currently tells a buyer their order moved forward (confirmed,
      shipped, delivered, etc.) — they'd have to keep checking manually.

  2. Change
    - New trigger on `orders`: whenever `status` actually changes on an
      order that has a `buyer_id`, call the existing `create_notification()`
      function with type `order_status_change`, pointing at the order.
*/

CREATE OR REPLACE FUNCTION notify_buyer_on_order_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_status_label text;
BEGIN
  IF NEW.buyer_id IS NULL OR NEW.status IS NOT DISTINCT FROM OLD.status THEN
    RETURN NEW;
  END IF;

  v_status_label := CASE NEW.status
    WHEN 'pending' THEN 'recebido'
    WHEN 'confirmed' THEN 'confirmado'
    WHEN 'preparing' THEN 'em preparação'
    WHEN 'shipped' THEN 'enviado'
    WHEN 'delivered' THEN 'entregue'
    WHEN 'cancelled' THEN 'cancelado'
    ELSE NEW.status
  END;

  PERFORM create_notification(
    NEW.buyer_id,
    'order_status_change',
    'Atualização do seu pedido',
    format('Seu pedido #%s foi atualizado: %s.', left(NEW.id::text, 8), v_status_label),
    NEW.id,
    'order'
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_notify_buyer_on_order_status_change ON orders;
CREATE TRIGGER trigger_notify_buyer_on_order_status_change
  AFTER UPDATE OF status ON orders
  FOR EACH ROW
  EXECUTE FUNCTION notify_buyer_on_order_status_change();
