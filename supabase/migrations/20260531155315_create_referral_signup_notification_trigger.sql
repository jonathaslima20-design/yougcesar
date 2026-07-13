/*
  # Create Signup Notification Trigger for Referrals

  1. New Function
    - `notify_referrer_on_signup()` - fires when a new user is inserted with referred_by set
    - Creates a notification of type 'referral_signup' for the referrer

  2. New Trigger
    - `on_referral_signup` on users table (AFTER INSERT)
    - Only fires when referred_by is not null
*/

CREATE OR REPLACE FUNCTION public.notify_referrer_on_signup()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  referred_name text;
BEGIN
  IF NEW.referred_by IS NOT NULL THEN
    referred_name := COALESCE(NEW.name, NEW.email, 'Um novo usuário');
    
    INSERT INTO public.notifications (
      user_id,
      type,
      title,
      message,
      related_entity_id,
      related_entity_type
    )
    VALUES (
      NEW.referred_by,
      'referral_signup',
      'Nova indicação!',
      referred_name || ' se cadastrou através do seu link de indicação.',
      NEW.id,
      'referral'
    );
  END IF;
  
  RETURN NEW;
END;
$function$;

-- Create the trigger
DROP TRIGGER IF EXISTS on_referral_signup ON public.users;
CREATE TRIGGER on_referral_signup
  AFTER INSERT ON public.users
  FOR EACH ROW
  WHEN (NEW.referred_by IS NOT NULL)
  EXECUTE FUNCTION notify_referrer_on_signup();
