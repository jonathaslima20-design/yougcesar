/*
  # Update Referral Commission Trigger with Notifications

  1. Changes
    - Replace generate_referral_commission() to read commission values from referral_settings
    - Add notification creation when commission is generated (type: 'referral_upgrade')
    - Commission amounts now come from the referral_settings table dynamically

  2. Important Notes
    - Trigger still fires on subscription status change to 'active'
    - Notifications are inserted directly into the notifications table
    - Uses SECURITY DEFINER to bypass RLS for notification inserts
*/

CREATE OR REPLACE FUNCTION public.generate_referral_commission()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  referrer_uuid uuid;
  referred_user_name text;
  commission_amount numeric;
  settings_row record;
  billing text;
BEGIN
  IF NEW.status = 'active' AND (OLD.status IS NULL OR OLD.status != 'active') THEN
    
    SELECT referred_by INTO referrer_uuid 
    FROM public.users 
    WHERE id = NEW.user_id;
    
    IF referrer_uuid IS NOT NULL THEN
      
      -- Get commission settings
      SELECT commission_trimestral, commission_semestral, commission_anual
      INTO settings_row
      FROM public.referral_settings
      LIMIT 1;
      
      -- Determine commission based on billing_cycle
      billing := LOWER(COALESCE(NEW.billing_cycle::text, ''));
      
      IF billing = 'quarterly' THEN
        commission_amount := COALESCE(settings_row.commission_trimestral, 50.00);
      ELSIF billing = 'semiannually' THEN
        commission_amount := COALESCE(settings_row.commission_semestral, 70.00);
      ELSIF billing = 'annually' THEN
        commission_amount := COALESCE(settings_row.commission_anual, 100.00);
      ELSE
        -- Fallback: check plan_name
        IF LOWER(NEW.plan_name) LIKE '%trimestral%' THEN
          commission_amount := COALESCE(settings_row.commission_trimestral, 50.00);
        ELSIF LOWER(NEW.plan_name) LIKE '%semestral%' THEN
          commission_amount := COALESCE(settings_row.commission_semestral, 70.00);
        ELSIF LOWER(NEW.plan_name) LIKE '%anual%' THEN
          commission_amount := COALESCE(settings_row.commission_anual, 100.00);
        ELSE
          commission_amount := 0.00;
        END IF;
      END IF;
      
      IF commission_amount > 0 THEN
        -- Insert commission
        INSERT INTO public.referral_commissions (
          referrer_id, 
          referred_user_id, 
          subscription_id,
          plan_type, 
          amount, 
          status
        )
        VALUES (
          referrer_uuid, 
          NEW.user_id, 
          NEW.id,
          NEW.plan_name, 
          commission_amount, 
          'pending'
        );
        
        -- Get referred user name for notification
        SELECT COALESCE(name, email, 'Um usuário') INTO referred_user_name
        FROM public.users
        WHERE id = NEW.user_id;
        
        -- Create notification for the referrer
        INSERT INTO public.notifications (
          user_id,
          type,
          title,
          message,
          related_entity_id,
          related_entity_type
        )
        VALUES (
          referrer_uuid,
          'referral_upgrade',
          'Indicado fez upgrade!',
          referred_user_name || ' ativou o plano ' || NEW.plan_name || ' — você ganhou R$ ' || commission_amount::text || ' de comissão!',
          NEW.user_id,
          'referral'
        );
      END IF;
      
    END IF;
  END IF;
  
  RETURN NEW;
END;
$function$;
