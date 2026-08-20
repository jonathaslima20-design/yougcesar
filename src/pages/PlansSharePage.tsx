import PricingCard from '@/components/pricing/PricingCard';
import { PAID_PLANS } from '@/lib/pricingPlans';
import { useReveal } from '@/hooks/useReveal';

export default function PlansSharePage() {
  useReveal();

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
            <div className="font-mono-label uppercase text-[11px] text-ink-500">/ planos vitrineturbo</div>
            <h1 className="font-display font-semibold text-[32px] sm:text-[44px] lg:text-[52px] leading-[1.08] tracking-[-0.03em] text-ink-900 mt-4">
              Escolha o plano ideal para o seu negócio
            </h1>
            <p className="text-ink-500 text-[15px] sm:text-[17px] mt-4 leading-[1.5]">
              Produtos ilimitados, estoque, pedidos, cupons e domínio próprio. Sem taxa sobre vendas.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-5 mt-10 sm:mt-14">
            {PAID_PLANS.map((plan) => (
              <PricingCard key={plan.id} plan={plan} />
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
