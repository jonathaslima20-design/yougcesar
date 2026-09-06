import type { SubscriptionPlan } from '@/types';

/**
 * Trimestral was retired for new signups (its subscription_plans row is
 * is_active = false), which RLS hides from regular non-admin users even when
 * queried directly by id — so the handful of subscribers still on it need a
 * fixed, hardcoded reference to keep renewing under their original terms,
 * since the row itself is unreachable to them. Id/name/price match the row
 * created by the 2026-07-16 retirement migration and are frozen for good:
 * this plan can no longer be sold, so its terms never change.
 */
export const LEGACY_TRIMESTRAL_PLAN: SubscriptionPlan = {
  id: '8a882a0c-7400-4917-8983-c52e4443b37a',
  name: 'Plano Trimestral',
  duration: 'Trimestral',
  price: 149,
  is_active: false,
  display_order: 0,
  created_at: '2026-03-29T00:00:00.000Z',
  updated_at: '2026-07-16T00:00:00.000Z',
};
