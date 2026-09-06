export type BuyerTier = 'bronze' | 'prata' | 'ouro';

export interface BuyerTierInfo {
  tier: BuyerTier;
  label: string;
  nextLabel: string | null;
  amountToNext: number | null;
  progressPercent: number;
}

// Kept simple and hardcoded on purpose: this is a display-only gamification
// layer over the buyer's existing order history, not a merchant-configurable
// program (no admin UI, no per-store tiers).
const TIERS: { tier: BuyerTier; label: string; threshold: number }[] = [
  { tier: 'bronze', label: 'Bronze', threshold: 0 },
  { tier: 'prata', label: 'Prata', threshold: 300 },
  { tier: 'ouro', label: 'Ouro', threshold: 1000 },
];

export function getBuyerTier(totalSpent: number): BuyerTierInfo {
  let currentIndex = 0;
  for (let i = 0; i < TIERS.length; i++) {
    if (totalSpent >= TIERS[i].threshold) currentIndex = i;
  }

  const current = TIERS[currentIndex];
  const next = TIERS[currentIndex + 1] ?? null;

  return {
    tier: current.tier,
    label: current.label,
    nextLabel: next?.label ?? null,
    amountToNext: next ? Math.max(0, next.threshold - totalSpent) : null,
    progressPercent: next
      ? Math.min(100, Math.round(((totalSpent - current.threshold) / (next.threshold - current.threshold)) * 100))
      : 100,
  };
}
