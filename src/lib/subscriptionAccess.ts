import type { PlanStatus } from '@/types';

export interface SubscriberAccess {
  /** Paying subscriber, regardless of billing provider (Mercado Pago or Stripe). */
  isSubscriber: boolean;
  isFreePlan: boolean;
  isExpired: boolean;
  isSuspended: boolean;
  /** On an active 15-day trial (referral-trial signup or admin-created trial user). */
  isTrial: boolean;
  /** Trial ended without converting to a paid plan — blocked, distinct message from isExpired. */
  isTrialExpired: boolean;
  /** Allowed to use the dashboard at all — paying, free tier, or in an active trial. */
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
  const isTrial = planStatus === 'trial';
  const isTrialExpired = planStatus === 'trial_expired';

  return {
    isSubscriber,
    isFreePlan,
    isExpired,
    isSuspended,
    isTrial,
    isTrialExpired,
    hasAccess: isSubscriber || isFreePlan || isTrial,
  };
}
