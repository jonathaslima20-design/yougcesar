import type { PlanStatus } from '@/types';

export interface SubscriberAccess {
  /** Paying subscriber, regardless of billing provider (Mercado Pago or Stripe). */
  isSubscriber: boolean;
  isFreePlan: boolean;
  isExpired: boolean;
  isSuspended: boolean;
  /** Allowed to use the dashboard at all — paying or on the free tier. */
  hasAccess: boolean;
}

/**
 * Single source of truth for "does this user have paid access?", read off
 * users.plan_status — the column both the Mercado Pago and Stripe webhooks
 * write to, so this function is provider-agnostic by construction. Before
 * this existed, useSubscriptionCheck.ts, SubscriptionBlocker.tsx and
 * SubscriptionModal.tsx each re-derived the same four booleans independently
 * from plan_status, which only stayed consistent because nobody had touched
 * one without the others yet.
 */
export function getSubscriberAccess(planStatus: PlanStatus | undefined): SubscriberAccess {
  const isSubscriber = planStatus === 'active';
  const isFreePlan = planStatus === 'free';
  const isExpired = planStatus === 'expired';
  const isSuspended = planStatus === 'suspended';

  return {
    isSubscriber,
    isFreePlan,
    isExpired,
    isSuspended,
    hasAccess: isSubscriber || isFreePlan,
  };
}
