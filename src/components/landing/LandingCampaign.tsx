import { useEffect, useState } from 'react';
import { ArrowRight, Flame, PartyPopper, ShoppingBag, Sparkles, TreePine, type LucideIcon } from 'lucide-react';
import {
  fetchLiveLandingCampaign,
  applyCampaignDiscount,
  campaignAppliesToPlan,
  formatBRL,
  formatCampaignDiscount,
  parseBRL,
  type CampaignTheme,
  type LandingCampaign,
} from '@/lib/landingCampaigns';
import type { PricingPlan } from '@/lib/pricingPlans';
import type { PricingCardCampaign } from '@/components/pricing/PricingCard';

/**
 * The campaign live right now (Admin > Campanhas da Landing), shared by the landing
 * pricing section and the /planos page so both always show the same offer — or
 * none. Display only, BRL visitors only (its prices/copy are Brazilian). `clear`
 * drops it client-side when the countdown hits zero so the strikethrough prices
 * never outlive the campaign.
 */
export function useLiveLandingCampaign(enabled: boolean) {
  const [campaign, setCampaign] = useState<LandingCampaign | null>(null);
  useEffect(() => {
    if (!enabled) {
      setCampaign(null);
      return;
    }
    let cancelled = false;
    fetchLiveLandingCampaign().then((c) => {
      if (!cancelled) setCampaign(c);
    });
    return () => {
      cancelled = true;
    };
  }, [enabled]);
  return { campaign, clear: () => setCampaign(null) };
}

/**
 * Extra PricingCard props for a BRL plan while a campaign is live: discounted
 * headline price + strikethrough original + themed pill. Empty object when the
 * campaign doesn't cover this plan, so the card renders at full price.
 */
export function campaignCardProps(
  plan: PricingPlan,
  campaign: LandingCampaign | null
): { priceDisplay?: string; campaign?: PricingCardCampaign } {
  if (!campaign || !campaignAppliesToPlan(campaign, plan.id)) return {};
  const original = parseBRL(plan.priceSuffix);
  if (original <= 0) return {};
  const discounted = applyCampaignDiscount(original, campaign);
  return {
    priceDisplay: `R$ ${formatBRL(discounted)}`,
    campaign: {
      originalPrice: `R$ ${formatBRL(original)}`,
      badge: campaign.badge_text
        ? `${formatCampaignDiscount(campaign)} · ${campaign.badge_text}`
        : formatCampaignDiscount(campaign),
      accentColor: campaign.accent_color,
      accentTextColor: readableOn(campaign.accent_color),
    },
  };
}

const THEME_ICONS: Record<CampaignTheme, LucideIcon> = {
  black_friday: Flame,
  natal: TreePine,
  ano_novo: PartyPopper,
  consumidor: ShoppingBag,
  personalizada: Sparkles,
};

export function CampaignThemeIcon({ theme, size = 18, className }: { theme: CampaignTheme; size?: number; className?: string }) {
  const Icon = THEME_ICONS[theme] ?? Sparkles;
  return <Icon size={size} className={className} strokeWidth={2.2} />;
}

/** Black or white, whichever reads better on the given hex background. */
export function readableOn(hex: string): string {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  const r = parseInt(full.slice(0, 2), 16) || 0;
  const g = parseInt(full.slice(2, 4), 16) || 0;
  const b = parseInt(full.slice(4, 6), 16) || 0;
  return (r * 299 + g * 587 + b * 114) / 1000 > 150 ? '#0A0A0A' : '#FFFFFF';
}

function splitRemaining(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000));
  return {
    days: Math.floor(total / 86400),
    hours: Math.floor((total % 86400) / 3600),
    minutes: Math.floor((total % 3600) / 60),
    seconds: total % 60,
    done: total === 0,
  };
}

export function useCountdown(endsAt: string, onEnd?: () => void) {
  const end = new Date(endsAt).getTime();
  const [remaining, setRemaining] = useState(() => splitRemaining(end - Date.now()));

  useEffect(() => {
    setRemaining(splitRemaining(end - Date.now()));
    const id = window.setInterval(() => {
      const next = splitRemaining(end - Date.now());
      setRemaining(next);
      if (next.done) {
        window.clearInterval(id);
        onEnd?.();
      }
    }, 1000);
    return () => window.clearInterval(id);
    // onEnd is intentionally not a dependency: callers pass inline callbacks.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [end]);

  return remaining;
}

const pad = (n: number) => String(n).padStart(2, '0');

function CountdownBoxes({ campaign, onEnd }: { campaign: LandingCampaign; onEnd?: () => void }) {
  const { days, hours, minutes, seconds } = useCountdown(campaign.ends_at, onEnd);
  const units = [
    { value: days, label: days === 1 ? 'dia' : 'dias' },
    { value: hours, label: 'horas' },
    { value: minutes, label: 'min' },
    { value: seconds, label: 'seg' },
  ];
  return (
    <div className="flex items-center gap-2 sm:gap-2.5" aria-label="Tempo restante da oferta">
      {units.map((u, i) => (
        <div key={u.label} className="flex items-center gap-2 sm:gap-2.5">
          <div
            className="w-[58px] sm:w-[68px] rounded-xl py-2.5 text-center border"
            style={{ backgroundColor: 'rgba(255,255,255,0.08)', borderColor: 'rgba(255,255,255,0.14)' }}
          >
            <div className="font-display font-semibold text-[24px] sm:text-[28px] leading-none tabular-nums tracking-[-0.02em]">
              {pad(u.value)}
            </div>
            <div className="font-mono-label uppercase text-[9px] mt-1.5 opacity-60">{u.label}</div>
          </div>
          {i < units.length - 1 && <span className="font-display text-[20px] opacity-40 -mx-0.5">:</span>}
        </div>
      ))}
    </div>
  );
}

/** Themed banner shown above the plan cards (optional per campaign). */
export function CampaignRibbon({ campaign, onEnd }: { campaign: LandingCampaign; onEnd?: () => void }) {
  const accentText = readableOn(campaign.accent_color);
  return (
    <div
      className="relative overflow-hidden rounded-3xl px-6 py-7 sm:px-9 sm:py-8"
      style={{ backgroundColor: campaign.primary_color, color: campaign.text_color }}
    >
      {/* soft glow + dotted texture in the accent color */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-24 -right-16 w-80 h-80 rounded-full blur-3xl opacity-40"
        style={{ backgroundColor: campaign.accent_color }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.07]"
        style={{ backgroundImage: `radial-gradient(${campaign.text_color} 1px, transparent 1px)`, backgroundSize: '16px 16px' }}
      />

      <div className="relative flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
        <div className="max-w-xl">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 font-mono-label uppercase text-[10px] font-semibold"
              style={{ backgroundColor: campaign.accent_color, color: accentText }}
            >
              <CampaignThemeIcon theme={campaign.theme} size={12} />
              {campaign.badge_text || 'Oferta'}
            </span>
            <span
              className="rounded-full px-3 py-1 font-mono-label uppercase text-[10px] border"
              style={{ borderColor: 'rgba(255,255,255,0.25)' }}
            >
              {formatCampaignDiscount(campaign)}
            </span>
          </div>
          <h3 className="font-display font-semibold text-[26px] sm:text-[34px] leading-[1.08] tracking-[-0.03em] mt-4">
            {campaign.title}
          </h3>
          {campaign.subtitle && <p className="text-[15px] mt-2 opacity-75">{campaign.subtitle}</p>}
        </div>

        {campaign.show_countdown && (
          <div className="shrink-0">
            <div className="font-mono-label uppercase text-[10px] opacity-60 mb-2">A oferta termina em</div>
            <CountdownBoxes campaign={campaign} onEnd={onEnd} />
          </div>
        )}
      </div>
    </div>
  );
}

function InlineCountdown({ campaign, onEnd }: { campaign: LandingCampaign; onEnd?: () => void }) {
  const { days, hours, minutes, seconds } = useCountdown(campaign.ends_at, onEnd);
  return (
    <span className="tabular-nums">
      {days > 0 ? `${days}d ` : ''}
      {pad(hours)}:{pad(minutes)}:{pad(seconds)}
    </span>
  );
}

/** Thin announcement strip on top of the landing header (optional per campaign). */
export function CampaignTopBar({ campaign, href = '#precos', onEnd }: { campaign: LandingCampaign; href?: string; onEnd?: () => void }) {
  const accentText = readableOn(campaign.accent_color);
  return (
    <a
      href={href}
      className="group flex items-center justify-center gap-2 sm:gap-3 h-9 px-4 text-[12px] sm:text-[13px] whitespace-nowrap overflow-hidden"
      style={{ backgroundColor: campaign.primary_color, color: campaign.text_color }}
    >
      <span
        className="hidden sm:inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-mono-label uppercase text-[10px] font-semibold"
        style={{ backgroundColor: campaign.accent_color, color: accentText }}
      >
        <CampaignThemeIcon theme={campaign.theme} size={11} />
        {campaign.badge_text || 'Oferta'}
      </span>
      <span className="font-medium truncate">
        {formatCampaignDiscount(campaign)} nos planos
      </span>
      {campaign.show_countdown && (
        <span className="opacity-75">
          · termina em <InlineCountdown campaign={campaign} onEnd={onEnd} />
        </span>
      )}
      <span className="hidden sm:inline-flex items-center gap-1 font-medium underline-offset-2 group-hover:underline" style={{ color: campaign.accent_color }}>
        Ver planos <ArrowRight size={12} />
      </span>
    </a>
  );
}
