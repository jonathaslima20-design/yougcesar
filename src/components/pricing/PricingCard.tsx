import { ArrowRight, Check } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { PricingPlan } from '@/lib/pricingPlans';

export default function PricingCard({
  plan,
  ctaHref,
  ctaLabel,
  ctaExternal,
  priceDisplay,
}: {
  plan: PricingPlan;
  ctaHref?: string;
  ctaLabel?: string;
  /** Opens ctaHref in a new tab (target="_blank") — for links that leave the site, e.g. WhatsApp. */
  ctaExternal?: boolean;
  /** Fully-formatted headline price (e.g. "$199.00", "12,99 €"). Defaults to "R$ {priceSuffix}". */
  priceDisplay?: string;
}) {
  const { t } = useTranslation('pricing');
  const { tag, name, priceSuffix, priceUnit, billedNote, savingsBadge, featured = false, benefits } = plan;

  return (
    <div
      className={`reveal card-hover rounded-2xl p-7 lg:p-8 border hairline flex flex-col ${
        featured ? 'bg-ink-900 text-white' : 'bg-surface text-ink-900'
      }`}
    >
      <div className="flex items-center justify-between">
        <span className={`font-display font-semibold text-[16px] ${featured ? 'text-white' : 'text-ink-900'}`}>
          {name}
        </span>
        <span
          className={`font-mono-label uppercase text-[10px] px-2.5 py-1 rounded-full border ${
            featured ? 'border-white/30 text-white' : 'hairline text-ink-500'
          }`}
        >
          {tag}
        </span>
      </div>
      <div className="mt-8">
        <span className="font-display font-semibold text-[44px] lg:text-[52px] tracking-[-0.03em] leading-none">{priceDisplay ?? `R$ ${priceSuffix}`}</span>
        <span className={`text-[14px] ml-1 ${featured ? 'text-white/60' : 'text-ink-500'}`}>{priceUnit ?? t('card.perMonth')}</span>
      </div>
      <div className="flex items-center gap-2 mt-2">
        <p className={`text-[12px] ${featured ? 'text-white/60' : 'text-ink-400'}`}>{billedNote}</p>
        {savingsBadge && (
          <span className="font-mono-label uppercase text-[9px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">
            {savingsBadge}
          </span>
        )}
      </div>
      <ul className="mt-8 space-y-3 flex-1">
        {benefits.map((b) => (
          <li key={b} className="flex items-center gap-3">
            <span
              className={`w-5 h-5 rounded-full flex items-center justify-center ${
                featured ? 'bg-white/15' : 'bg-white border hairline'
              }`}
            >
              <Check size={12} strokeWidth={3} className={featured ? 'text-white' : 'text-ink-900'} />
            </span>
            <span className={`text-[14px] ${featured ? 'text-white/90' : 'text-ink-700'}`}>{b}</span>
          </li>
        ))}
      </ul>
      {ctaHref && (
        <a
          href={ctaHref}
          {...(ctaExternal ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
          className={`mt-8 rounded-full px-6 py-3.5 font-display font-medium text-[14px] inline-flex items-center justify-center gap-2 transition-colors ${
            featured
              ? 'bg-white text-ink-900 hover:bg-white/90'
              : 'btn-primary'
          }`}
        >
          {ctaLabel ?? t('card.ctaLabel')}
          <ArrowRight size={14} />
        </a>
      )}
    </div>
  );
}
