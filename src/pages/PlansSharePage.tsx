import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import PricingCard from '@/components/pricing/PricingCard';
import { PAID_PLANS, type PricingPlan } from '@/lib/pricingPlans';
import { PAID_BENEFIT_KEYS, translateBenefit } from '@/lib/pricingBenefitKeys';
import { useReveal } from '@/hooks/useReveal';
import { useDetectedCountry } from '@/lib/billing/useDetectedCountry';
import { PUBLIC_PRICING_BY_CURRENCY, formatPublicPrice, annualMonthlyEquivalent, annualSavingsPercent, type PublicCurrency } from '@/lib/billing/publicPricing';

type PaymentTab = 'avista' | 'parcelado';

/** Pix parcelado is a BRL-only payment option, only available for the plans with a billing
 * cycle long enough to split (semestral = 6 months, anual = 12 months). */
const PIX_INSTALLMENTS: Record<string, { count: number; amount: string }> = {
  semestral: { count: 6, amount: '39,00' },
  anual: { count: 12, amount: '28,00' },
};

function parseBRLAmount(amount: string): number {
  return Number(amount.replace(/\./g, '').replace(',', '.'));
}

function formatBRLAmount(value: number): string {
  return value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function PlansSharePage() {
  useReveal();
  const { t } = useTranslation('pricing');
  const { currency } = useDetectedCountry();
  const [paymentTab, setPaymentTab] = useState<PaymentTab>('avista');

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

  // Only the plans long enough to split (semestral, anual) get a Pix parcelado card;
  // "mensal" is dropped from this tab entirely.
  const parceladoPlans: PricingPlan[] = currency === 'BRL'
    ? translatedPlans
        .filter((plan) => PIX_INSTALLMENTS[plan.id])
        .map((plan) => {
          const installment = PIX_INSTALLMENTS[plan.id];
          const total = installment.count * parseBRLAmount(installment.amount);
          return {
            ...plan,
            priceUnit: t('installments.unit'),
            savingsBadge: t('installments.badge'),
            billedNote: t('installments.totalNote', {
              total: `R$ ${formatBRLAmount(total)}`,
              count: installment.count,
            }),
          };
        })
    : [];

  const parceladoPriceDisplays: Record<string, string> = Object.fromEntries(
    Object.entries(PIX_INSTALLMENTS).map(([id, { count, amount }]) => [id, `${count}x R$ ${amount}`])
  );

  const activePlans = paymentTab === 'parcelado' ? parceladoPlans : translatedPlans;
  const activePriceDisplays = paymentTab === 'parcelado' ? parceladoPriceDisplays : priceDisplays;

  const gridClass = currency === 'BRL' && paymentTab === 'avista'
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

          {currency === 'BRL' && (
            <div className="inline-flex items-center gap-1 p-1 rounded-full border hairline mt-8 reveal">
              <button
                type="button"
                onClick={() => setPaymentTab('avista')}
                className={`font-mono-label uppercase text-[11px] px-4 py-2 rounded-full transition-colors ${
                  paymentTab === 'avista' ? 'bg-ink-900 text-white' : 'text-ink-500 hover:text-ink-900'
                }`}
              >
                {t('installments.toggleAvista')}
              </button>
              <button
                type="button"
                onClick={() => setPaymentTab('parcelado')}
                className={`font-mono-label uppercase text-[11px] px-4 py-2 rounded-full transition-colors ${
                  paymentTab === 'parcelado' ? 'bg-ink-900 text-white' : 'text-ink-500 hover:text-ink-900'
                }`}
              >
                {t('installments.toggleParcelado')}
              </button>
            </div>
          )}

          <div className={gridClass}>
            {activePlans.map((plan) => (
              <PricingCard key={plan.id} plan={plan} priceDisplay={activePriceDisplays[plan.id]} />
            ))}
          </div>

          {currency === 'BRL' && paymentTab === 'parcelado' && (
            <p className="text-ink-400 text-[12px] mt-6 reveal max-w-2xl">
              {t('installments.disclaimer')}
            </p>
          )}
        </div>
      </main>
    </div>
  );
}
