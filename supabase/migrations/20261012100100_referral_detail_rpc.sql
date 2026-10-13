/*
  # get_my_referrals RPC

  Single-call read for the "Seus Indicados" table on ReferralPage.tsx, replacing
  two separate client-side queries (users + referral_commissions) that the UI
  then had to merge by hand. SECURITY INVOKER, scoped by auth.uid() — same
  pattern as get_store_revenue — so it only ever returns the caller's own
  referred users, same rows RLS already lets them query directly today.

  referral_type and days_left are derived from trial_ends_at, not stored: a
  trial_ends_at set at signup means a referral-trial signup; absent means the
  direct-link flow (unchanged).
*/

CREATE OR REPLACE FUNCTION public.get_my_referrals()
RETURNS TABLE (
  id uuid,
  name text,
  email text,
  created_at timestamptz,
  plan_status text,
  trial_ends_at timestamptz,
  days_left integer,
  referral_type text,
  commission_status text,
  commission_amount numeric
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT
    u.id,
    u.name,
    u.email,
    u.created_at,
    u.plan_status,
    u.trial_ends_at,
    CASE
      WHEN u.plan_status = 'trial' AND u.trial_ends_at IS NOT NULL
        THEN GREATEST(0, CEIL(EXTRACT(EPOCH FROM (u.trial_ends_at - now())) / 86400))::integer
      ELSE NULL
    END AS days_left,
    CASE WHEN u.trial_ends_at IS NOT NULL THEN 'trial' ELSE 'direct' END AS referral_type,
    c.status AS commission_status,
    c.amount AS commission_amount
  FROM public.users u
  LEFT JOIN LATERAL (
    SELECT rc.status, rc.amount
    FROM public.referral_commissions rc
    WHERE rc.referred_user_id = u.id AND rc.referrer_id = auth.uid()
    ORDER BY rc.created_at DESC
    LIMIT 1
  ) c ON true
  WHERE u.referred_by = auth.uid()
  ORDER BY u.created_at DESC;
$$;

REVOKE ALL ON FUNCTION public.get_my_referrals() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_referrals() TO authenticated;
