/*
  # Move commission trigger + attribution window to per-affiliate settings

  1. Problem
    - Originally `commissionTrigger` (WhatsApp order commission trigger:
      'confirmed'|'delivered') and `attributionWindowDays` (7|15|30) were
      store-wide settings, stored in `user_storefront_settings.settings
      .affiliate` and edited from a "Configurações do módulo" card on the
      merchant's Afiliados page (see 20260802050000_create_affiliate_commissions
      _and_trigger.sql and the client-side card in AffiliatesPage.tsx).
    - Confirmed product decision: these become per-affiliate settings instead
      — each affiliate can have its own trigger and attribution window,
      configured directly on that affiliate's create/edit form.

  2. Changes
    - `affiliates.commission_trigger` (text, 'confirmed'|'delivered', default
      'delivered') and `affiliates.attribution_window_days` (integer, one of
      7/15/30, default 30) — same constraints/defaults as the old store-wide
      settings, just relocated.
    - `handle_affiliate_commission_on_order_change()`: the WhatsApp-order
      branch now reads `commission_trigger` from the `affiliates` row
      identified by `NEW.affiliate_id` instead of querying
      `user_storefront_settings` by `store_owner_id`. Ecommerce-order logic
      (payment_status-based) is unchanged — it was never configurable.
    - `user_storefront_settings.settings.affiliate` is left untouched (no
      destructive cleanup) — it simply stops being read. Any old value there
      is now inert.

  3. Notes
    - The attribution window itself is enforced client-side at checkout time
      (see resolveAttributedAffiliateId in src/lib/affiliateUtils.ts) — this
      migration only relocates where the *configured* value comes from. The
      client now looks up the specific affiliate's own
      attribution_window_days (by the affiliate id already resolved at click
      time) instead of the store's setting.
*/

ALTER TABLE public.affiliates
  ADD COLUMN IF NOT EXISTS commission_trigger text NOT NULL DEFAULT 'delivered'
    CHECK (commission_trigger IN ('confirmed', 'delivered'));

ALTER TABLE public.affiliates
  ADD COLUMN IF NOT EXISTS attribution_window_days integer NOT NULL DEFAULT 30
    CHECK (attribution_window_days IN (7, 15, 30));

CREATE OR REPLACE FUNCTION public.handle_affiliate_commission_on_order_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_should_generate boolean := false;
  v_should_reverse boolean := false;
  v_commission_trigger text;
  v_item record;
  v_best_rate numeric;
  v_default_rate numeric;
BEGIN
  IF NEW.affiliate_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Self-purchase guard: never generate or keep a commission when the buyer
  -- and the affiliate are the same identity (bought through their own link).
  IF NEW.buyer_id IS NOT NULL AND NEW.buyer_id = NEW.affiliate_id THEN
    RETURN NEW;
  END IF;

  IF NEW.order_type = 'ecommerce' THEN
    IF NEW.payment_status = 'paid' AND (OLD.payment_status IS DISTINCT FROM 'paid') THEN
      v_should_generate := true;
    END IF;
    IF NEW.payment_status = 'refunded' AND (OLD.payment_status IS DISTINCT FROM 'refunded') THEN
      v_should_reverse := true;
    END IF;
  ELSE
    SELECT a.commission_trigger INTO v_commission_trigger
    FROM public.affiliates a WHERE a.id = NEW.affiliate_id;

    v_commission_trigger := COALESCE(v_commission_trigger, 'delivered');

    IF NEW.status = v_commission_trigger AND (OLD.status IS DISTINCT FROM v_commission_trigger) THEN
      v_should_generate := true;
    END IF;
    IF NEW.status = 'cancelled' AND (OLD.status IS DISTINCT FROM 'cancelled') THEN
      v_should_reverse := true;
    END IF;
  END IF;

  IF v_should_generate THEN
    SELECT default_commission_percentage INTO v_default_rate
    FROM public.affiliates WHERE id = NEW.affiliate_id;

    IF v_default_rate IS NOT NULL THEN
      FOR v_item IN
        SELECT oi.id, oi.product_title, oi.subtotal, p.category
        FROM public.order_items oi
        LEFT JOIN public.products p ON p.id = oi.product_id
        WHERE oi.order_id = NEW.id
      LOOP
        v_best_rate := NULL;

        IF v_item.category IS NOT NULL THEN
          SELECT MAX(acr.commission_percentage) INTO v_best_rate
          FROM public.affiliate_commission_rules acr
          WHERE acr.affiliate_id = NEW.affiliate_id
            AND acr.category_name = ANY(v_item.category);
        END IF;

        INSERT INTO public.affiliate_commissions (
          affiliate_id, store_owner_id, order_id, order_item_id,
          product_name_snapshot, category_matched, item_subtotal,
          commission_percentage, commission_amount
        ) VALUES (
          NEW.affiliate_id, NEW.store_owner_id, NEW.id, v_item.id,
          v_item.product_title,
          CASE WHEN v_best_rate IS NOT NULL THEN
            (SELECT acr.category_name FROM public.affiliate_commission_rules acr
             WHERE acr.affiliate_id = NEW.affiliate_id
               AND acr.category_name = ANY(v_item.category)
               AND acr.commission_percentage = v_best_rate
             LIMIT 1)
          ELSE NULL END,
          v_item.subtotal,
          COALESCE(v_best_rate, v_default_rate),
          ROUND(v_item.subtotal * (COALESCE(v_best_rate, v_default_rate) / 100), 2)
        )
        ON CONFLICT (order_item_id) DO NOTHING;
      END LOOP;
    END IF;
  END IF;

  IF v_should_reverse THEN
    UPDATE public.affiliate_commissions
    SET status = 'reversed', reversed_at = now()
    WHERE order_id = NEW.id AND status = 'pending';
  END IF;

  RETURN NEW;
END;
$$;
