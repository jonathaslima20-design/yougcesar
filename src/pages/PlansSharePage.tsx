import { useTranslation } from 'react-i18next';
import PricingCard from '@/components/pricing/PricingCard';
import { PAID_PLANS, type PricingPlan } from '@/lib/pricingPlans';
import { PAID_BENEFIT_KEYS, translateBenefit } from '@/lib/pricingBenefitKeys';
import { useReveal } from '@/hooks/useReveal';
import { useDetectedCountry } from '@/lib/billing/useDetectedCountry';
import { PUBLIC_PRICING_BY_CURRENCY, formatPublicPrice, annualMonthlyEquivalent, annualSavingsPercent, type PublicCurrency } from '@/lib/billing/publicPricing';

export default function PlansSharePage() {
  useReveal();
  const { t } = useTranslation('pricing');
  const { currency } = useDetectedCountry();

  const anualBenefits = PAID_PLANS.find((p) => p.id === 'anual')!.benefits;

  const translatedPlans: PricingPlan[] = currency === 'BRL'
    ? PAID_PLANS.map((plan) => ({
        ...plan,
        tag: t(`plans.${plan.id}.tag`, { defaultValue: plan.tag }),
        name: t(`plans.${plan.id}.name`, { defaultValue: plan.name }),
        savingsBadge: plan.savingsBadge
          ? t(`plans.${plan.id}.savingsBadge`, { defaultValue: plan.savingsBadge })
          : plan.savingsBadge,
        benefits: plan.benefits.map((b) => translateBenefit(t, PAID_BENEFIT_KEYS, b)),
      }))
    : [
        {
          id: 'monthly',
          tag: t('plans.mensal.tag'),
          name: t('plans.mensal.name'),
          priceSuffix: '',
          billedNote: t('plans.mensal.billedNote'),
          benefits: anualBenefits.map((b) => translateBenefit(t, PAID_BENEFIT_KEYS, b)),
        },
        {
          id: 'annual',
          tag: t('plans.anual.tag'),
          name: t('plans.anual.name'),
          priceSuffix: '',
          billedNote: t('international.annualBilledNoteTemplate', {
            amount: formatPublicPrice(PUBLIC_PRICING_BY_CURRENCY[currency as PublicCurrency].annual, currency as PublicCurrency),
          }),
          savingsBadge: t('international.savingsBadgeTemplate', { percent: annualSavingsPercent(currency as PublicCurrency) }),
          featured: true,
          benefits: anualBenefits.map((b) => translateBenefit(t, PAID_BENEFIT_KEYS, b)),
        },
      ];

  const priceDisplays: Record<string, string> = currency === 'BRL'
    ? {}
    : {
        monthly: formatPublicPrice(PUBLIC_PRICING_BY_CURRENCY[currency as PublicCurrency].monthly, currency as PublicCurrency),
        annual: formatPublicPrice(annualMonthlyEquivalent(currency as PublicCurrency), currency as PublicCurrency),
      };

  const gridClass = currency === 'BRL'
    ? 'grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-5 mt-10 sm:mt-14'
    : 'grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5 mt-10 sm:mt-14 max-w-2xl';

  return (
    <div className="vt-root bg-white text-ink-900">
      <header className="border-b hairline">
        <div className="max-w-5xl mx-auto px-6 lg:px-10 h-16 flex items-center">
          <div className="flex items-center">
            <img
              src="/logos/vitrinelogo-black.png"
              alt="VitrineTurbo"
              width={160}
              height={48}
              className="h-12 w-auto"
              fetchpriority="high"
              loading="eager"
              decoding="async"
              onError={(e) => {
                e.currentTarget.src = 'https://ikvwygqmlqhsyqmpgaoz.supabase.co/storage/v1/object/public/public/logos/vitrinelogo-black.png.png';
              }}
            />
          </div>
        </div>
      </header>

      <main className="py-14 sm:py-20 lg:py-24">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-10">
          <div className="max-w-2xl reveal">
            <div className="font-mono-label uppercase text-[11px] text-ink-500">{t('plansPage.eyebrow')}</div>
            <h1 className="font-display font-semibold text-[32px] sm:text-[44px] lg:text-[52px] leading-[1.08] tracking-[-0.03em] text-ink-900 mt-4">
              {t('plansPage.title')}
            </h1>
            <p className="text-ink-500 text-[15px] sm:text-[17px] mt-4 leading-[1.5]">
              {t('plansPage.subtitle')}
            </p>
          </div>

          <div className={gridClass}>
            {translatedPlans.map((plan) => (
              <PricingCard key={plan.id} plan={plan} priceDisplay={priceDisplays[plan.id]} />
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
