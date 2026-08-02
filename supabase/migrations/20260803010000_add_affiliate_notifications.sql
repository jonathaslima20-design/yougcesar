/*
  # Affiliate notifications (reuse the generic notifications table)

  1. Problem
    - Affiliates need to be notified when they earn a commission, when it's
      marked as paid, and when the store owner activates/deactivates their
      account — mirroring the existing merchant/buyer notification UX.

  2. Approach
    - No new table. `public.notifications` is already generic (`user_id`
      with no FK, RLS `auth.uid() = user_id`), and is already the mechanism
      buyers use despite living in a separate `customers` table — see
      20260729040000_notify_buyer_on_order_status_change.sql's own rationale.
      Affiliates are `id = auth.users.id` exactly like customers, so the same
      approach applies with zero schema changes: a notification row with
      `user_id = affiliate_id` is only readable by that affiliate's own
      Supabase Auth session (via `supabaseAffiliate`, a separate client but
      the same underlying Auth project). Realtime is already enabled on
      `notifications` (20260714120000_add_notifications_to_realtime.sql).

  3. Triggers (both call the existing `create_notification()` helper)
    - `notify_affiliate_on_commission_change()`: AFTER INSERT OR UPDATE OF
      status ON affiliate_commissions. On INSERT, notifies "Nova comissão".
      On UPDATE where status transitions to 'paid', notifies "Comissão paga".
      No-ops (and skips entirely) when `affiliate_id IS NULL` — a commission
      whose affiliate was later removed (ON DELETE SET NULL) has no one left
      to notify.
    - `notify_affiliate_on_status_change()`: AFTER UPDATE OF status ON
      affiliates, only when `NEW.status IS DISTINCT FROM OLD.status`.
*/

CREATE OR REPLACE FUNCTION public.notify_affiliate_on_commission_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.affiliate_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    PERFORM create_notification(
      NEW.affiliate_id,
      'affiliate_commission',
      'Nova comissão gerada',
      format('Você ganhou R$ %s de comissão em %s', to_char(NEW.commission_amount, 'FM999G999D00'), COALESCE(NEW.product_name_snapshot, 'um produto')),
      NEW.order_id,
      'order'
    );
  ELSIF TG_OP = 'UPDATE' AND NEW.status = 'paid' AND OLD.status IS DISTINCT FROM 'paid' THEN
    PERFORM create_notification(
      NEW.affiliate_id,
      'affiliate_commission',
      'Comissão paga',
      format('Sua comissão de R$ %s foi marcada como paga', to_char(NEW.commission_amount, 'FM999G999D00')),
      NEW.order_id,
      'order'
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_notify_affiliate_on_commission_change ON public.affiliate_commissions;
CREATE TRIGGER trigger_notify_affiliate_on_commission_change
  AFTER INSERT OR UPDATE OF status ON public.affiliate_commissions
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_affiliate_on_commission_change();

CREATE OR REPLACE FUNCTION public.notify_affiliate_on_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    PERFORM create_notification(
      NEW.id,
      'affiliate_status_change',
      CASE WHEN NEW.status = 'active' THEN 'Conta reativada' ELSE 'Conta desativada' END,
      CASE WHEN NEW.status = 'active'
        THEN 'Sua conta de afiliado foi reativada pelo lojista.'
        ELSE 'Sua conta de afiliado foi desativada pelo lojista. Novos cliques no seu link não geram comissão até ela ser reativada.'
      END
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_notify_affiliate_on_status_change ON public.affiliates;
CREATE TRIGGER trigger_notify_affiliate_on_status_change
  AFTER UPDATE OF status ON public.affiliates
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_affiliate_on_status_change();
