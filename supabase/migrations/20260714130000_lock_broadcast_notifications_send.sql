/*
  # Prevent double-sending a notification broadcast

  send_broadcast_notifications() previously checked `status = 'sent'` and
  then updated it to `'sending'` in a separate statement, with no row lock
  in between. Two concurrent calls (an admin double-clicking "Enviar agora",
  or a retried request after a network blip) could both pass the check
  before either one flipped the status, and both would loop through and
  insert a full duplicate set of notifications for every recipient.

  Fix: lock the broadcast row with `FOR UPDATE` before checking its status.
  A second concurrent call now blocks on that lock until the first call's
  transaction commits, at which point it sees status = 'sent' and returns
  immediately instead of sending again. Behavior for a normal, single call
  is unchanged.
*/

CREATE OR REPLACE FUNCTION send_broadcast_notifications(p_broadcast_id uuid)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_broadcast record;
  v_user record;
  v_count int := 0;
BEGIN
  SELECT * INTO v_broadcast FROM notification_broadcasts WHERE id = p_broadcast_id FOR UPDATE;

  IF v_broadcast IS NULL THEN
    RAISE EXCEPTION 'Broadcast not found';
  END IF;

  IF v_broadcast.status IN ('sent', 'sending') THEN
    RETURN 0;
  END IF;

  UPDATE notification_broadcasts SET status = 'sending', updated_at = now() WHERE id = p_broadcast_id;

  FOR v_user IN
    SELECT u.id FROM users u
    WHERE u.role NOT IN ('admin', 'parceiro')
    AND (
      v_broadcast.target_audience = 'all'
      OR (v_broadcast.target_audience = 'active' AND u.plan_status = 'active')
      OR (v_broadcast.target_audience = 'expired' AND u.plan_status = 'expired')
      OR (v_broadcast.target_audience = 'free' AND u.plan_status = 'free')
      OR (v_broadcast.target_audience = 'specific' AND u.id = ANY(v_broadcast.target_user_ids))
    )
  LOOP
    INSERT INTO notifications (user_id, type, title, message, cta_label, cta_url)
    VALUES (v_user.id, v_broadcast.notification_type, v_broadcast.title, v_broadcast.message, v_broadcast.cta_label, v_broadcast.cta_url);
    v_count := v_count + 1;
  END LOOP;

  UPDATE notification_broadcasts
  SET status = 'sent', sent_at = now(), recipients_count = v_count, updated_at = now()
  WHERE id = p_broadcast_id;

  RETURN v_count;
END;
$$;
