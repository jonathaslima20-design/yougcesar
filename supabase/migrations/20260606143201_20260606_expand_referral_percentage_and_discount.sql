/*
# Expand Referral System: Percentage Commission & Referred Discount

1. Modified Tables
  - `referral_settings`:
    - `commission_type` (varchar, default 'percentage') - fixed or percentage mode
    - `commission_percentage` (numeric, default 30) - referrer commission %
    - `discount_percentage` (numeric, default 20) - discount for referred user
    - `allow_free_users` (boolean, default true) - allow free users in program
  - `referral_commissions`:
    - `discount_applied` (boolean, default false) - whether referral discount was used
    - `discount_percentage` (numeric, default 0) - discount % applied
    - `original_plan_value` (numeric, nullable) - plan price before discount
    - `commission_percentage` (numeric, nullable) - commission % used in calculation

2. Updated Functions
  - `generate_referral_commission()` trigger now supports percentage-based calculation:
    - Reads commission_type from referral_settings
    - If 'percentage': calculates commission as plan_price * (commission_percentage / 100)
    - Applies minimum floor of R$ 44.70
    - If 'fixed': maintains existing behavior with fixed amounts
    - Records original_plan_value and commission_percentage on each commission

3. Updated Data
  - Updates share messages in referral_settings with new templates mentioning discount and coupon code

4. Important Notes
  - Backwards-compatible: existing commissions with fixed values remain untouched
  - No columns dropped or renamed
  - No RLS changes needed (existing policies cover new columns)
*/

-- 1. Add new columns to referral_settings
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'referral_settings' AND column_name = 'commission_type') THEN
    ALTER TABLE public.referral_settings ADD COLUMN commission_type varchar NOT NULL DEFAULT 'percentage';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'referral_settings' AND column_name = 'commission_percentage') THEN
    ALTER TABLE public.referral_settings ADD COLUMN commission_percentage numeric NOT NULL DEFAULT 30;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'referral_settings' AND column_name = 'discount_percentage') THEN
    ALTER TABLE public.referral_settings ADD COLUMN discount_percentage numeric NOT NULL DEFAULT 20;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'referral_settings' AND column_name = 'allow_free_users') THEN
    ALTER TABLE public.referral_settings ADD COLUMN allow_free_users boolean NOT NULL DEFAULT true;
  END IF;
END $$;

-- 2. Add new columns to referral_commissions
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'referral_commissions' AND column_name = 'discount_applied') THEN
    ALTER TABLE public.referral_commissions ADD COLUMN discount_applied boolean NOT NULL DEFAULT false;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'referral_commissions' AND column_name = 'discount_percentage') THEN
    ALTER TABLE public.referral_commissions ADD COLUMN discount_percentage numeric NOT NULL DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'referral_commissions' AND column_name = 'original_plan_value') THEN
    ALTER TABLE public.referral_commissions ADD COLUMN original_plan_value numeric;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'referral_commissions' AND column_name = 'commission_percentage') THEN
    ALTER TABLE public.referral_commissions ADD COLUMN commission_percentage numeric;
  END IF;
END $$;

-- 3. Update the generate_referral_commission trigger function
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
  plan_price numeric;
  comm_pct numeric;
BEGIN
  IF NEW.status = 'active' AND (OLD.status IS NULL OR OLD.status != 'active') THEN
    
    SELECT referred_by INTO referrer_uuid 
    FROM public.users 
    WHERE id = NEW.user_id;
    
    IF referrer_uuid IS NOT NULL THEN
      
      -- Get all commission settings
      SELECT 
        commission_type, commission_percentage,
        commission_trimestral, commission_semestral, commission_anual
      INTO settings_row
      FROM public.referral_settings
      LIMIT 1;
      
      billing := LOWER(COALESCE(NEW.billing_cycle::text, ''));
      
      IF COALESCE(settings_row.commission_type, 'percentage') = 'percentage' THEN
        -- Percentage mode: calculate from plan price
        comm_pct := COALESCE(settings_row.commission_percentage, 30);
        
        -- Try to get plan price from subscription_plans
        SELECT price INTO plan_price
        FROM public.subscription_plans
        WHERE (LOWER(name) = LOWER(NEW.plan_name) OR id::text = COALESCE(NEW.plan_id::text, ''))
        LIMIT 1;
        
        -- Fallback: estimate price from billing cycle
        IF plan_price IS NULL THEN
          IF billing = 'quarterly' OR LOWER(NEW.plan_name) LIKE '%trimestral%' THEN
            plan_price := 149.00;
          ELSIF billing = 'semiannually' OR LOWER(NEW.plan_name) LIKE '%semestral%' THEN
            plan_price := 229.00;
          ELSIF billing = 'annually' OR LOWER(NEW.plan_name) LIKE '%anual%' THEN
            plan_price := 336.00;
          ELSE
            plan_price := 149.00;
          END IF;
        END IF;
        
        commission_amount := ROUND(plan_price * (comm_pct / 100.0), 2);
        -- Apply minimum floor of R$ 44.70
        IF commission_amount < 44.70 THEN
          commission_amount := 44.70;
        END IF;
        
      ELSE
        -- Fixed mode: use fixed amounts from settings
        comm_pct := NULL;
        plan_price := NULL;
        
        IF billing = 'quarterly' OR LOWER(NEW.plan_name) LIKE '%trimestral%' THEN
          commission_amount := COALESCE(settings_row.commission_trimestral, 50.00);
        ELSIF billing = 'semiannually' OR LOWER(NEW.plan_name) LIKE '%semestral%' THEN
          commission_amount := COALESCE(settings_row.commission_semestral, 70.00);
        ELSIF billing = 'annually' OR LOWER(NEW.plan_name) LIKE '%anual%' THEN
          commission_amount := COALESCE(settings_row.commission_anual, 100.00);
        ELSE
          commission_amount := 0.00;
        END IF;
      END IF;
      
      IF commission_amount > 0 THEN
        -- Insert commission with new metadata fields
        INSERT INTO public.referral_commissions (
          referrer_id, 
          referred_user_id, 
          subscription_id,
          plan_type, 
          amount, 
          status,
          original_plan_value,
          commission_percentage
        )
        VALUES (
          referrer_uuid, 
          NEW.user_id, 
          NEW.id,
          NEW.plan_name, 
          commission_amount, 
          'pending',
          plan_price,
          comm_pct
        );
        
        -- Get referred user name for notification
        SELECT COALESCE(name, email, 'Um usuario') INTO referred_user_name
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
          referred_user_name || ' ativou o plano ' || NEW.plan_name || ' — voce ganhou R$ ' || commission_amount::text || ' de comissao!',
          NEW.user_id,
          'referral'
        );
      END IF;
      
    END IF;
  END IF;
  
  RETURN NEW;
END;
$function$;

-- 4. Update share messages with new templates mentioning discount and coupon
UPDATE public.referral_settings SET
  share_message_whatsapp = 'Oi! Uso o VitrineTurbo para criar meu catalogo digital e vender mais pelo WhatsApp. Voce pode criar o seu com 20% de desconto usando meu link: {link} Ou use meu cupom {codigo} no checkout.',
  share_message_telegram = 'Crie seu catalogo digital com 20% de desconto! Use meu link: {link} Ou o cupom {codigo} no checkout do VitrineTurbo.'
WHERE id = (SELECT id FROM public.referral_settings LIMIT 1);
