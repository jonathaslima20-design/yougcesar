import { lazy, memo, Suspense, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowRight, Plus, Package, MessageCircle, CreditCard, QrCode, Image as ImageIcon, Link2, Copy, Instagram, Megaphone, Globe as Globe2, ChartBar as BarChart3, LogIn, Radio, Box, ClipboardList, Tag, Palette, Shield, TriangleAlert as AlertTriangle, Percent, RefreshCw } from 'lucide-react';
import HeroPhoneCarousel from '@/components/landing/HeroPhoneCarousel';
import PricingCard from '@/components/pricing/PricingCard';
import { PAID_PLANS, type PricingPlan } from '@/lib/pricingPlans';
import { PAID_BENEFIT_KEYS, translateBenefit } from '@/lib/pricingBenefitKeys';
import { useDetectedCountry } from '@/lib/billing/useDetectedCountry';
import { PUBLIC_PRICING_BY_CURRENCY, formatPublicPrice, annualMonthlyEquivalent, annualSavingsPercent, type PublicCurrency } from '@/lib/billing/publicPricing';
import { useReveal } from '@/hooks/useReveal';
import { supabase } from '@/lib/supabase';

const LandingSocialProof = lazy(() => import('@/components/landing/LandingSocialProof'));
const LandingTestimonials = lazy(() => import('@/components/landing/LandingTestimonials'));

function useLandingTracking() {
  useEffect(() => {
    let metaScript: HTMLScriptElement | null = null;
    let metaNoScript: HTMLElement | null = null;
    let gtmScript: HTMLScriptElement | null = null;
    let gtmNoScript: HTMLElement | null = null;
    let gtmDataLayer: HTMLScriptElement | null = null;
    let domainVerificationMeta: HTMLMetaElement | null = null;

    const loadTracking = async () => {
      const { data } = await supabase
        .from('landing_tracking_config')
        .select('meta_pixel_id, google_tag_id, meta_domain_verification')
        .maybeSingle();

      if (!data) return;

      const domainVerification = data.meta_domain_verification?.trim();
      if (domainVerification) {
        domainVerificationMeta = document.createElement('meta');
        domainVerificationMeta.name = 'facebook-domain-verification';
        domainVerificationMeta.content = domainVerification;
        document.head.appendChild(domainVerificationMeta);
      }

      const pixelId = data.meta_pixel_id?.trim();
      if (pixelId) {
        metaScript = document.createElement('script');
        metaScript.id = 'meta-pixel-script';
        metaScript.innerHTML = `
          !function(f,b,e,v,n,t,s){
            if(f.fbq)return;n=f.fbq=function(){n.callMethod?
            n.callMethod.apply(n,arguments):n.queue.push(arguments)};
            if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
            n.queue=[];t=b.createElement(e);t.async=!0;
            t.src=v;s=b.getElementsByTagName(e)[0];
            s.parentNode.insertBefore(t,s)}(window,document,'script',
            'https://connect.facebook.net/en_US/fbevents.js');
          fbq('init','${pixelId}');fbq('track','PageView');
        `;
        document.head.appendChild(metaScript);

        metaNoScript = document.createElement('noscript');
        metaNoScript.id = 'meta-pixel-noscript';
        metaNoScript.innerHTML = `<img height="1" width="1" style="display:none" src="https://www.facebook.com/tr?id=${pixelId}&ev=PageView&noscript=1"/>`;
        document.body.insertBefore(metaNoScript, document.body.firstChild);
      }

      const tagId = data.google_tag_id?.trim();
      if (tagId) {
        if (tagId.startsWith('GTM-')) {
          gtmDataLayer = document.createElement('script');
          gtmDataLayer.id = 'gtm-datalayer';
          gtmDataLayer.innerHTML = `window.dataLayer=window.dataLayer||[];window.dataLayer.push({'gtm.start':new Date().getTime(),event:'gtm.js'});`;
          document.head.appendChild(gtmDataLayer);

          gtmScript = document.createElement('script');
          gtmScript.id = 'gtm-script';
          gtmScript.async = true;
          gtmScript.src = `https://www.googletagmanager.com/gtm.js?id=${tagId}`;
          document.head.appendChild(gtmScript);

          gtmNoScript = document.createElement('noscript');
          gtmNoScript.id = 'gtm-noscript';
          gtmNoScript.innerHTML = `<iframe src="https://www.googletagmanager.com/ns.html?id=${tagId}" height="0" width="0" style="display:none;visibility:hidden"></iframe>`;
          document.body.insertBefore(gtmNoScript, document.body.firstChild);
        } else {
          gtmScript = document.createElement('script');
          gtmScript.id = 'ga4-script';
          gtmScript.async = true;
          gtmScript.src = `https://www.googletagmanager.com/gtag/js?id=${tagId}`;
          document.head.appendChild(gtmScript);

          gtmDataLayer = document.createElement('script');
          gtmDataLayer.id = 'ga4-config';
          gtmDataLayer.innerHTML = `window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${tagId}');`;
          document.head.appendChild(gtmDataLayer);
        }
      }
    };

    const timer = window.setTimeout(loadTracking, 2000);

    return () => {
      window.clearTimeout(timer);
      [metaScript, metaNoScript, gtmScript, gtmNoScript, gtmDataLayer, domainVerificationMeta].forEach((el) => el?.remove());
    };
  }, []);
}

function useReferralTracking() {
  const [searchParams] = useSearchParams();
  const [refCode, setRefCode] = useState<string | null>(null);

  useEffect(() => {
    const ref = searchParams.get('ref') || localStorage.getItem('vitrineturbo_ref_code');
    if (!ref) return;

    setRefCode(ref);
    // Only persist referral code if user is not already authenticated
    const session = supabase.auth.getSession();
    session.then(({ data }) => {
      if (!data.session) {
        localStorage.setItem('vitrineturbo_ref_code', ref);
      }
    });

    // Track click (fire-and-forget)
    (async () => {
      try {
        const { data: user } = await supabase
          .from('users')
          .select('id')
          .eq('referral_code', ref)
          .maybeSingle();

        if (user) {
          await supabase.from('referral_clicks').insert({
            referral_code: ref,
            referrer_id: user.id,
            visitor_id: getVisitorId(),
          });
        }
      } catch { /* silent */ }
    })();
  }, [searchParams]);

  return refCode;
}

function getVisitorId(): string {
  const key = 'vt_visitor_id';
  let id = sessionStorage.getItem(key);
  if (!id) {
    id = crypto.randomUUID();
    sessionStorage.setItem(key, id);
  }
  return id;
}

function getRegisterHref(refCode: string | null): string {
  return refCode ? `/register?ref=${refCode}` : '/register';
}

function Header({ refCode }: { refCode: string | null }) {
  const { t } = useTranslation('landing');
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => {
      const isScrolled = window.scrollY > 8;
      setScrolled((prev) => prev === isScrolled ? prev : isScrolled);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);
  return (
    <header
      className={`fixed top-0 inset-x-0 z-50 transition-all duration-300 ${
        scrolled ? 'glass-light' : 'bg-transparent'
      }`}
    >
      <div className="max-w-7xl mx-auto px-6 lg:px-10 h-16 flex items-center justify-between">
        <a href="#top" className="flex items-center">
          <img
            src="/logos/vitrinelogo-black.png"
            alt="VitrineTurbo"
            width={180}
            height={56}
            className="h-14 w-auto"
            fetchpriority="high"
            loading="eager"
            decoding="async"
            onError={(e) => {
              e.currentTarget.src = 'https://ikvwygqmlqhsyqmpgaoz.supabase.co/storage/v1/object/public/public/logos/vitrinelogo-black.png.png';
            }}
          />
        </a>
        <nav className="hidden md:flex items-center gap-8">
          <a href="#recursos" className="font-mono-label uppercase text-[12px] text-ink-500 hover:text-ink-900 transition-colors">{t('nav.features')}</a>
          <a href="#usuarios" className="font-mono-label uppercase text-[12px] text-ink-500 hover:text-ink-900 transition-colors">{t('nav.users')}</a>
          <a href="#precos" className="font-mono-label uppercase text-[12px] text-ink-500 hover:text-ink-900 transition-colors">{t('nav.plans')}</a>
          <a href="#faq" className="font-mono-label uppercase text-[12px] text-ink-500 hover:text-ink-900 transition-colors">{t('nav.faq')}</a>
          <Link to="/blog" className="font-mono-label uppercase text-[12px] text-ink-500 hover:text-ink-900 transition-colors">{t('nav.blog')}</Link>
        </nav>
        <div className="flex items-center gap-2">
          <a
            href="https://www.instagram.com/vitrineturbo_/"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex w-9 h-9 rounded-full border border-ink-200 items-center justify-center text-ink-500 hover:text-ink-900 hover:border-ink-400 transition-colors shrink-0"
            aria-label="Instagram"
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/></svg>
          </a>
          <Link to="/login" className="inline-flex btn-ghost rounded-full px-4 py-2 text-[13px] font-display font-medium items-center gap-1.5 whitespace-nowrap">
            <LogIn size={14} />
            <span>{t('nav.login')}</span>
          </Link>
          <a href={getRegisterHref(refCode)} className="hidden md:inline-flex btn-primary rounded-full px-4 py-2 text-[13px] font-display font-medium items-center gap-1.5">
            {t('nav.createStore')}
          </a>
        </div>
      </div>
    </header>
  );
}

function Hero({ refCode }: { refCode: string | null }) {
  const { t } = useTranslation('landing');
  return (
    <section id="top" className="relative pt-36 pb-24 lg:pt-44 lg:pb-32 overflow-hidden bg-white">
      <div className="grid-bg" />
      <div className="relative max-w-7xl mx-auto px-6 lg:px-10">
        <div className="stagger max-w-4xl">
          <div className="inline-flex items-center gap-2 border hairline bg-white rounded-full px-3 py-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            <span className="font-mono-label uppercase text-[11px] text-ink-700">{t('hero.badge')}</span>
          </div>
          <h1 className="font-display font-semibold text-[44px] sm:text-[64px] lg:text-[84px] leading-[1.02] tracking-[-0.035em] text-ink-900 mt-6">
            {t('hero.title')}
          </h1>
          <p className="text-ink-500 text-[18px] lg:text-[20px] max-w-2xl mt-6 leading-[1.5]">
            {t('hero.subtitle')}
          </p>
          <div className="flex flex-wrap items-center gap-3 mt-8">
            <a href={getRegisterHref(refCode)} className="btn-primary rounded-full px-7 py-4 font-display font-medium text-[15px] inline-flex items-center gap-2">
              {t('hero.ctaStart')}
              <ArrowRight size={16} />
            </a>
            <a href="#precos" onClick={(e) => { e.preventDefault(); document.getElementById('precos')?.scrollIntoView({ behavior: 'smooth' }); }} className="btn-ghost rounded-full px-7 py-4 font-display font-medium text-[15px] inline-flex items-center gap-2">
              {t('hero.ctaPlans')}
              <ArrowRight size={16} />
            </a>
          </div>
          <p className="font-mono-label uppercase text-[11px] text-ink-400 mt-4">
            {t('hero.footnote')}
          </p>
        </div>
        <div className="reveal mt-8 lg:mt-10">
          <HeroPhoneCarousel />
        </div>
      </div>
    </section>
  );
}

function SectionHeading({ id, kicker, title }: { id?: string; kicker: string; title: string }) {
  return (
    <div className="max-w-3xl reveal">
      <div className="font-mono-label uppercase text-[11px] text-ink-500">{kicker}</div>
      <h2
        id={id}
        className="font-display font-semibold text-[36px] sm:text-[48px] lg:text-[64px] leading-[1.05] tracking-[-0.035em] text-ink-900 mt-4"
      >
        {title}
      </h2>
    </div>
  );
}

function HowItWorksSection() {
  const { t } = useTranslation('landing');
  const steps = [
    { n: 1, title: t('howItWorks.steps.1.title'), desc: t('howItWorks.steps.1.desc'), meta: t('howItWorks.steps.1.meta') },
    { n: 2, title: t('howItWorks.steps.2.title'), desc: t('howItWorks.steps.2.desc'), meta: t('howItWorks.steps.2.meta') },
    { n: 3, title: t('howItWorks.steps.3.title'), desc: t('howItWorks.steps.3.desc'), meta: t('howItWorks.steps.3.meta') },
  ];

  const mocks = [
    // Etapa 1: cadastro
    <div key="m1" className="space-y-2">
      <div className="rounded-lg border hairline bg-white px-3 py-2 text-[12px] text-ink-900">{t('howItWorks.mock.storeName')}</div>
      <div className="rounded-lg border hairline bg-white px-3 py-2 text-[12px] text-ink-400">ana@email.com</div>
      <div className="rounded-lg bg-ink-900 text-white px-3 py-2 text-center text-[12px] font-semibold mt-1">{t('howItWorks.mock.createBtn')}</div>
    </div>,
    // Etapa 2: produto
    <div key="m2" className="space-y-2">
      <div className="flex gap-2">
        <div className="w-11 h-11 rounded-lg border border-dashed border-ink-300 bg-white flex items-center justify-center flex-shrink-0 text-ink-400">
          <ImageIcon size={16} />
        </div>
        <div className="flex-1 min-w-0 space-y-1.5">
          <div className="rounded-lg border hairline bg-white px-3 py-1.5 text-[12px] text-ink-900 truncate">Chuteira Mercurial</div>
          <div className="rounded-lg border hairline bg-white px-3 py-1.5 text-[12px] text-ink-900">R$ 389,00</div>
        </div>
      </div>
      <div className="flex gap-1.5">
        {['39', '40', '41', '42'].map((size, i) => (
          <span
            key={size}
            className={`text-[11px] px-2.5 py-1 rounded-md ${i === 0 ? 'bg-ink-900 text-white' : 'border hairline bg-white text-ink-700'}`}
          >
            {size}
          </span>
        ))}
      </div>
    </div>,
    // Etapa 3: link + canais
    <div key="m3" className="space-y-2">
      <div className="flex items-center gap-2 rounded-lg border hairline bg-white px-3 py-2 text-[12px] font-mono-label text-ink-900">
        <Link2 size={13} className="text-ink-400 flex-shrink-0" />
        <span className="flex-1 truncate">vitrineturbo.com/lojadaana</span>
        <Copy size={13} className="text-ink-400 flex-shrink-0" />
      </div>
      <div className="grid grid-cols-3 gap-1.5">
        {[
          { Icon: MessageCircle, label: t('howItWorks.mock.status') },
          { Icon: Instagram, label: t('howItWorks.mock.bio') },
          { Icon: Megaphone, label: t('howItWorks.mock.ads') },
        ].map(({ Icon, label }) => (
          <div key={label} className="flex items-center justify-center gap-1.5 rounded-lg border hairline bg-white px-2 py-1.5 text-[11px] text-ink-700">
            <Icon size={13} className="text-ink-500" />
            {label}
          </div>
        ))}
      </div>
    </div>,
  ];

  return (
    <section className="py-24 lg:py-32 bg-white border-t hairline" style={{ contentVisibility: 'auto', containIntrinsicSize: 'auto 600px' }}>
      <div className="max-w-7xl mx-auto px-6 lg:px-10">
        <SectionHeading kicker={t('howItWorks.kicker')} title={t('howItWorks.title')} />
        <div className="relative grid grid-cols-1 md:grid-cols-3 gap-10 md:gap-6 lg:gap-10 mt-14">
          {/* linha de progressão entre os círculos (só no desktop) */}
          <div aria-hidden="true" className="hidden md:block absolute top-[18px] left-[16.66%] right-[16.66%] h-px bg-ink-200" />
          {steps.map((step, i) => (
            <div key={step.n} className="reveal relative flex flex-col">
              <div className="flex items-center gap-3">
                <div className="relative z-10 w-9 h-9 rounded-full border border-ink-300 bg-white flex items-center justify-center font-display font-semibold text-[14px] text-ink-900">
                  {step.n}
                </div>
                <span className="font-mono-label uppercase text-[10px] text-ink-400">{step.meta}</span>
              </div>
              <h3 className="font-display font-semibold text-[20px] lg:text-[22px] text-ink-900 tracking-[-0.02em] mt-5">
                {step.title}
              </h3>
              <p className="text-[14px] text-ink-500 leading-[1.5] mt-2 max-w-xs">{step.desc}</p>
              <div className="mt-5 flex-1 rounded-2xl border hairline bg-surface p-4">{mocks[i]}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}


function BentoCard({
  idx,
  title,
  desc,
  Icon,
  className = '',
  badge,
  children,
}: {
  idx: string;
  title: string;
  desc?: string;
  Icon: React.ComponentType<{ size?: number; className?: string; strokeWidth?: number }>;
  className?: string;
  badge?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className={`reveal card-hover rounded-2xl border hairline bg-surface p-6 lg:p-7 flex flex-col ${className}`}>
      <div className="flex items-center justify-between">
        <div className="w-9 h-9 rounded-lg border hairline bg-white flex items-center justify-center">
          <Icon size={18} className="text-ink-900" strokeWidth={2} />
        </div>
        <div className="flex items-center gap-2">
          {badge && (
            <span className="font-mono-label text-[9px] uppercase px-2 py-0.5 rounded-full bg-ink-900 text-white">
              {badge}
            </span>
          )}
          <span className="font-mono-label text-[10px] text-ink-400">{idx}</span>
        </div>
      </div>
      <h3 className="font-display font-semibold text-[20px] lg:text-[22px] text-ink-900 tracking-[-0.02em] mt-6">
        {title}
      </h3>
      {desc && (
        <p className="text-[14px] text-ink-500 leading-[1.5] mt-2 max-w-md">{desc}</p>
      )}
      <div className="mt-5 flex-1">{children}</div>
    </div>
  );
}

function BentoGrid() {
  const { t, i18n } = useTranslation('landing');
  const showLanguagesCard = i18n.language !== 'pt-BR';
  return (
    <section id="recursos" className="py-24 lg:py-32 bg-white border-t hairline" style={{ contentVisibility: 'auto', containIntrinsicSize: 'auto 1200px' }}>
      <div className="max-w-7xl mx-auto px-6 lg:px-10">
        <SectionHeading kicker={t('bento.kicker')} title={t('bento.title')} />
        <div className="grid grid-cols-1 lg:grid-cols-3 auto-rows-[minmax(200px,auto)] gap-4 mt-14">
          {/* Card 01 - Gestão de Produtos */}
          <BentoCard
            idx="01"
            title={t('bento.card01Title')}
            desc={t('bento.card01Desc')}
            Icon={Package}
            className="lg:col-span-2 lg:row-span-2"
          >
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 lg:h-full lg:auto-rows-fr">
              {[
                { name: 'Camiseta Mith', price: 'R$ 149', tag: 'Novo', img: 'https://ikvwygqmlqhsyqmpgaoz.supabase.co/storage/v1/object/public/landing/Camiseta_Oversized_Treino_Preta_Mith.png' },
                { name: 'Chuteira Mercurial', price: 'R$ 389', tag: '-20%', img: 'https://ikvwygqmlqhsyqmpgaoz.supabase.co/storage/v1/object/public/landing/Chuteira_Nike_Campo_Mercurial.png' },
                { name: 'Bola Nike Pitch', price: 'R$ 219', img: 'https://ikvwygqmlqhsyqmpgaoz.supabase.co/storage/v1/object/public/landing/Bola_de_Futebol_Campo_Nike_Pitch_Tea.png' },
                { name: 'Creatine 300g', price: 'R$ 129', img: 'https://ikvwygqmlqhsyqmpgaoz.supabase.co/storage/v1/object/public/landing/Creatine_Pura_Black_Skull_300g.png' },
                { name: 'Mouse Redragon', price: 'R$ 279', tag: 'Top', img: 'https://ikvwygqmlqhsyqmpgaoz.supabase.co/storage/v1/object/public/landing/Mouse_Gamer_Redragon_Nix_RGB.png' },
                { name: 'Raquete Shark Elite', price: 'R$ 649', img: 'https://ikvwygqmlqhsyqmpgaoz.supabase.co/storage/v1/object/public/landing/Raquete_Beach_Tennis_Shark_Elite.png' },
              ].map(({ name, price, tag, img }) => (
                <div
                  key={name}
                  className="group relative aspect-[3/4] sm:aspect-square lg:aspect-auto lg:min-h-[200px] rounded-xl border hairline bg-white p-3 sm:p-2.5 flex flex-col justify-between overflow-hidden transition-all duration-300 hover:shadow-md hover:-translate-y-0.5"
                >
                  {tag && (
                    <span className="absolute top-2 right-2 z-10 font-mono-label uppercase text-[9px] sm:text-[8px] tracking-wider px-2 py-0.5 rounded-full bg-ink-900 text-white shadow-sm">
                      {tag}
                    </span>
                  )}
                  <div className="flex-1 rounded-lg bg-gradient-to-br from-white via-white to-surface overflow-hidden flex items-center justify-center">
                    <img
                      src={img}
                      alt={name}
                      width={200}
                      height={200}
                      loading="lazy"
                      decoding="async"
                      className="w-[88%] h-[88%] object-contain transition-transform duration-500 group-hover:scale-110"
                    />
                  </div>
                  <div className="mt-2.5 px-0.5 space-y-0.5">
                    <div className="text-[12px] sm:text-[10px] text-ink-500 truncate leading-tight">{name}</div>
                    <div className="font-display font-semibold text-[14px] sm:text-[11px] text-ink-900 leading-tight">{price}</div>
                  </div>
                </div>
              ))}
            </div>
          </BentoCard>

          {/* Card 02 - Controle de Estoque */}
          <BentoCard idx="02" title={t('bento.card02Title')} desc={t('bento.card02Desc')} Icon={Box}>
            <div className="space-y-2">
              <div className="flex items-center gap-3 rounded-xl border hairline bg-white px-4 py-3">
                <div className="w-2.5 h-2.5 rounded-full bg-amber-500 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] font-medium text-ink-900 truncate">Chuteira Mercurial</div>
                  <div className="text-[11px] text-amber-600 flex items-center gap-1 mt-0.5">
                    <AlertTriangle size={11} />
                    {t('bento.card02LowStock')}
                  </div>
                </div>
                <div className="font-display font-semibold text-[22px] text-ink-900 tracking-[-0.02em] leading-none">
                  3 <span className="text-[12px] text-ink-400 font-normal tracking-normal">un</span>
                </div>
              </div>
              <div className="rounded-xl border hairline bg-ink-50 px-3 py-2 flex items-center gap-2">
                <RefreshCw size={11} className="text-ink-400 flex-shrink-0" />
                <span className="text-[11px] text-ink-500">{t('bento.card02Note')}</span>
              </div>
            </div>
          </BentoCard>

          {/* Card 03 - Painel de Pedidos e Resultados */}
          <BentoCard idx="03" title={t('bento.card03Title')} desc={t('bento.card03Desc')} Icon={ClipboardList}>
            <div className="space-y-2">
              <div className="rounded-xl border hairline bg-white px-3 pt-2.5 pb-2">
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-1.5">
                    <BarChart3 size={11} className="text-ink-900" />
                    <span className="text-[11px] font-medium text-ink-900">{t('bento.card03Overview')}</span>
                  </div>
                  <span className="font-mono-label uppercase text-[9px] text-ink-400">{t('bento.card03Last30d')}</span>
                </div>
                <svg viewBox="0 0 400 90" className="w-full h-auto" aria-hidden="true">
                  <defs>
                    <linearGradient id="vt-bento-area" x1="0" x2="0" y1="0" y2="1">
                      <stop offset="0%" stopColor="#0A0A0A" stopOpacity="0.14" />
                      <stop offset="100%" stopColor="#0A0A0A" stopOpacity="0" />
                    </linearGradient>
                  </defs>
                  <path d="M0,70 C40,58 60,34 100,40 C140,46 160,22 200,28 C240,34 260,52 300,40 C340,28 360,16 400,22 L400,90 L0,90 Z" fill="url(#vt-bento-area)" />
                  <path d="M0,70 C40,58 60,34 100,40 C140,46 160,22 200,28 C240,34 260,52 300,40 C340,28 360,16 400,22" fill="none" stroke="#0A0A0A" strokeWidth="2" strokeLinecap="round" />
                </svg>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-lg border hairline bg-white px-2.5 py-2 text-center">
                  <div className="font-display font-semibold text-[20px] text-ink-900">156</div>
                  <div className="font-mono-label uppercase text-[9px] text-ink-400 mt-0.5">{t('bento.card03Orders')}</div>
                </div>
                <div className="rounded-lg border hairline bg-white px-2.5 py-2 text-center">
                  <div className="font-display font-semibold text-[20px] text-emerald-600">R$ 24k</div>
                  <div className="font-mono-label uppercase text-[9px] text-ink-400 mt-0.5">{t('bento.card03Revenue')}</div>
                </div>
              </div>
            </div>
          </BentoCard>

          {/* Card 05 - Carrinho e Checkout Online */}
          <BentoCard idx="05" title={t('bento.card05Title')} desc={t('bento.card05Desc')} Icon={CreditCard} className="lg:col-span-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                {[
                  { name: 'Camiseta Oversized Preta', qty: 2, price: 'R$ 179,80' },
                  { name: 'Chuteira Nike Mercurial', qty: 1, price: 'R$ 349,00' },
                ].map((item, i) => (
                  <div key={i} className="flex items-center gap-3 rounded-xl border hairline bg-white px-3 py-2.5">
                    <div className="w-8 h-8 rounded-lg bg-ink-50 flex items-center justify-center flex-shrink-0">
                      <Package size={14} className="text-ink-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[12px] font-medium text-ink-900 truncate">{item.name}</div>
                      <div className="text-[11px] text-ink-400">Qtd: {item.qty}</div>
                    </div>
                    <div className="text-[12px] font-semibold text-ink-900 flex-shrink-0">{item.price}</div>
                  </div>
                ))}
                <div className="flex items-center justify-between pt-1 px-1">
                  <div className="font-mono-label uppercase text-[10px] text-ink-400">{t('bento.card05Total')}</div>
                  <div className="font-display font-semibold text-[16px] text-ink-900">R$ 528,80</div>
                </div>
              </div>
              <div className="flex flex-col gap-2">
                {[
                  { Icon: QrCode, label: t('bento.card05Pay1'), selected: true },
                  { Icon: CreditCard, label: t('bento.card05Pay2'), selected: false },
                  { Icon: MessageCircle, label: t('bento.card05Pay3'), selected: false },
                ].map(({ Icon, label, selected }) => (
                  <div
                    key={label}
                    className={`flex items-center gap-2.5 rounded-xl border px-3 py-2.5 ${
                      selected ? 'border-ink-900 bg-white' : 'hairline bg-white'
                    }`}
                  >
                    <div className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center flex-shrink-0 ${
                      selected ? 'border-ink-900' : 'border-ink-300'
                    }`}>
                      {selected && <div className="w-1.5 h-1.5 rounded-full bg-ink-900" />}
                    </div>
                    <Icon size={14} className="text-ink-500 flex-shrink-0" />
                    <span className="text-[12px] font-medium text-ink-900">{label}</span>
                  </div>
                ))}
                <div className="rounded-xl bg-ink-900 text-white px-3 py-2.5 text-center text-[12px] font-semibold mt-1">
                  {t('bento.card05Cta')}
                </div>
              </div>
            </div>
          </BentoCard>

          {/* Card 04 - Cupons */}
          <BentoCard idx="04" title={t('bento.card04Title')} desc={t('bento.card04Desc')} Icon={Tag}>
            <div className="rounded-xl border-2 border-dashed border-ink-200 bg-white px-4 py-3 flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-ink-50 flex items-center justify-center flex-shrink-0">
                <Percent size={15} className="text-ink-500" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-mono-label font-medium text-[13px] text-ink-900 truncate">PRIMEIRACOMPRA</div>
                <div className="text-[11px] text-ink-400 mt-0.5">{t('bento.card04Uses')}</div>
              </div>
              <span className="font-display font-semibold text-[22px] text-emerald-600 tracking-[-0.02em] flex-shrink-0">-15%</span>
            </div>
          </BentoCard>

          {/* Card 06 - Pixel Meta & Google Tag */}
          <BentoCard idx="06" title={t('bento.card06Title')} desc={t('bento.card06Desc')} Icon={Radio}>
            <div className="space-y-2">
              {[
                { platform: 'Meta Pixel', dot: 'bg-blue-500' },
                { platform: 'Google Tag', dot: 'bg-red-500' },
              ].map((item) => (
                <div key={item.platform} className="rounded-xl border hairline bg-white px-3 py-3 flex items-center gap-3">
                  <div className={`w-2 h-2 rounded-full flex-shrink-0 ${item.dot}`} />
                  <div className="flex-1 text-[13px] font-semibold text-ink-900">{item.platform}</div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="font-mono-label uppercase text-[9px] text-emerald-600">{t('bento.card06Active')}</span>
                  </div>
                </div>
              ))}
            </div>
          </BentoCard>

          {/* Card 07 - Sua Marca, Seu Domínio */}
          <BentoCard
            idx="07"
            title={t('bento.card07Title')}
            desc={t('bento.card07Desc')}
            Icon={Palette}
            badge={t('bento.card07Badge')}
            className={showLanguagesCard ? '' : 'lg:col-span-2'}
          >
            <div className={`grid grid-cols-1 gap-2 ${showLanguagesCard ? '' : 'sm:grid-cols-2'}`}>
              <div className="rounded-xl border hairline bg-white px-4 py-3 flex items-center gap-3">
                <div className="flex -space-x-1.5">
                  {['bg-ink-900', 'bg-sky-500', 'bg-emerald-500', 'bg-amber-500', 'bg-rose-500'].map((color) => (
                    <div key={color} className={`w-6 h-6 rounded-full border-2 border-white ${color}`} />
                  ))}
                </div>
                <span className="text-[12px] text-ink-700">{t('bento.card07Colors')}</span>
              </div>
              <div className="rounded-xl border hairline bg-white px-4 py-3 flex items-center gap-3">
                <div className="w-2 h-2 rounded-full bg-emerald-500 flex-shrink-0" />
                <span className="text-[12px] font-mono-label text-ink-900 flex-1 truncate">www.sualoja.com.br</span>
                <span className="inline-flex items-center gap-1 text-[11px] text-emerald-600 flex-shrink-0">
                  <Shield size={12} />
                  SSL
                </span>
              </div>
            </div>
          </BentoCard>

          {/* Card 08 - Multi Idiomas: só faz sentido para quem chega de fora do Brasil */}
          {showLanguagesCard && (
            <BentoCard idx="08" title={t('bento.card08Title')} desc={t('bento.card08Desc')} Icon={Globe2}>
              <div className="flex flex-wrap gap-2">
                {['PT-BR', 'EN-US', 'ES-ES', 'BRL', 'USD', 'EUR'].map((p) => (
                  <span key={p} className="font-mono-label text-[10px] uppercase px-2.5 py-1 rounded-full border hairline bg-white text-ink-700">
                    {p}
                  </span>
                ))}
              </div>
            </BentoCard>
          )}
        </div>
      </div>
    </section>
  );
}

function SocialProofSection() {
  const { t } = useTranslation('landing');
  return (
    <section id="usuarios" className="py-24 lg:py-32 bg-white border-t hairline" style={{ contentVisibility: 'auto', containIntrinsicSize: 'auto 400px' }}>
      <div className="max-w-7xl mx-auto px-6 lg:px-10">
        <SectionHeading kicker={t('socialProof.kicker')} title={t('socialProof.title')} />
        <Suspense fallback={<div className="mt-14 min-h-[140px] rounded-2xl border hairline bg-surface animate-pulse" />}>
          <LandingSocialProof />
        </Suspense>
      </div>
    </section>
  );
}

function PricingSection({ refCode }: { refCode: string | null }) {
  const { currency } = useDetectedCountry();

  if (currency !== 'BRL') {
    return <InternationalPricingSection currency={currency as PublicCurrency} refCode={refCode} />;
  }

  return <BRLPricingSection refCode={refCode} />;
}

function InternationalPricingSection({ currency, refCode }: { currency: PublicCurrency; refCode: string | null }) {
  const { t } = useTranslation('landing');
  const { t: tp } = useTranslation('pricing');

  const monthlyAmount = PUBLIC_PRICING_BY_CURRENCY[currency].monthly;
  const annualAmount = PUBLIC_PRICING_BY_CURRENCY[currency].annual;
  const annualMonthly = annualMonthlyEquivalent(currency);
  const savings = annualSavingsPercent(currency);

  const anualBenefits = PAID_PLANS.find((p) => p.id === 'anual')!.benefits;

  const monthlyPlan: PricingPlan = {
    id: 'monthly',
    tag: tp('plans.mensal.tag'),
    name: tp('plans.mensal.name'),
    priceSuffix: '',
    billedNote: tp('plans.mensal.billedNote'),
    benefits: anualBenefits.map((b) => translateBenefit(tp, PAID_BENEFIT_KEYS, b)),
  };

  const annualPlan: PricingPlan = {
    id: 'annual',
    tag: tp('plans.anual.tag'),
    name: tp('plans.anual.name'),
    priceSuffix: '',
    billedNote: tp('international.annualBilledNoteTemplate', { amount: formatPublicPrice(annualAmount, currency) }),
    savingsBadge: tp('international.savingsBadgeTemplate', { percent: savings }),
    featured: true,
    benefits: anualBenefits.map((b) => translateBenefit(tp, PAID_BENEFIT_KEYS, b)),
  };

  return (
    <section id="precos" className="py-24 lg:py-32 bg-white border-t hairline" style={{ contentVisibility: 'auto', containIntrinsicSize: 'auto 700px' }}>
      <div className="max-w-5xl mx-auto px-6 lg:px-10">
        <SectionHeading kicker={t('pricing.kicker')} title={t('pricing.title')} />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mt-14 max-w-2xl mx-auto">
          <PricingCard plan={monthlyPlan} ctaHref={getRegisterHref(refCode)} priceDisplay={formatPublicPrice(monthlyAmount, currency)} />
          <PricingCard plan={annualPlan} ctaHref={getRegisterHref(refCode)} priceDisplay={formatPublicPrice(annualMonthly, currency)} />
        </div>
      </div>
    </section>
  );
}

function BRLPricingSection({ refCode }: { refCode: string | null }) {
  const { t } = useTranslation('landing');
  const { t: tp } = useTranslation('pricing');

  const translatedPlans = PAID_PLANS.map((plan) => ({
    ...plan,
    tag: tp(`plans.${plan.id}.tag`, { defaultValue: plan.tag }),
    name: tp(`plans.${plan.id}.name`, { defaultValue: plan.name }),
    savingsBadge: plan.savingsBadge
      ? tp(`plans.${plan.id}.savingsBadge`, { defaultValue: plan.savingsBadge })
      : plan.savingsBadge,
    benefits: plan.benefits.map((b) => translateBenefit(tp, PAID_BENEFIT_KEYS, b)),
  }));

  return (
    <section id="precos" className="py-24 lg:py-32 bg-white border-t hairline" style={{ contentVisibility: 'auto', containIntrinsicSize: 'auto 700px' }}>
      <div className="max-w-5xl mx-auto px-6 lg:px-10">
        <SectionHeading kicker={t('pricing.kicker')} title={t('pricing.title')} />

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mt-14">
          {translatedPlans.map((plan) => (
            <PricingCard key={plan.id} plan={plan} ctaHref={getRegisterHref(refCode)} />
          ))}
        </div>
      </div>
    </section>
  );
}

function FaqSection() {
  const { t } = useTranslation('landing');
  const items = [2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => ({
    q: t(`faq.items.${n}.q`),
    a: t(`faq.items.${n}.a`),
  }));
  return (
    <section id="faq" className="py-24 lg:py-32 bg-surface border-t hairline" style={{ contentVisibility: 'auto', containIntrinsicSize: 'auto 800px' }}>
      <div className="max-w-4xl mx-auto px-6 lg:px-10">
        <SectionHeading kicker={t('faq.kicker')} title={t('faq.title')} />
        <div className="mt-12 divide-y hairline border-t border-b hairline">
          {items.map((it) => (
            <details key={it.q} className="reveal group py-6">
              <summary className="flex items-center justify-between cursor-pointer gap-6">
                <span className="font-display font-medium text-[17px] lg:text-[19px] text-ink-900 tracking-[-0.01em]">
                  {it.q}
                </span>
                <span className="w-9 h-9 rounded-full border hairline bg-white flex items-center justify-center shrink-0">
                  <Plus size={16} className="faq-icon text-ink-900" strokeWidth={2} />
                </span>
              </summary>
              <p className="mt-4 text-ink-500 text-[15px] leading-[1.5] max-w-2xl">{it.a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

function FinalCTA({ refCode }: { refCode: string | null }) {
  const { t } = useTranslation('landing');
  return (
    <section id="cta" className="py-24 lg:py-32 bg-white border-t hairline">
      <div className="max-w-5xl mx-auto px-6 lg:px-10 text-center">
        <h2 className="reveal font-display font-semibold text-[40px] sm:text-[56px] lg:text-[80px] leading-[1.04] tracking-[-0.035em] text-ink-900">
          {t('finalCta.title')}
        </h2>
        <p className="reveal text-ink-500 text-[16px] lg:text-[18px] mt-6 max-w-2xl mx-auto leading-[1.5]">
          {t('finalCta.subtitle')}
        </p>
        <div className="reveal mt-10">
          <a href={getRegisterHref(refCode)} className="btn-primary rounded-full px-8 py-4 text-[15px] font-display font-medium inline-flex items-center gap-2">
            {t('finalCta.cta')}
            <ArrowRight size={16} />
          </a>
        </div>
      </div>
    </section>
  );
}

function FooterLanding() {
  const { t, i18n } = useTranslation('landing');
  // pb-28 no mobile reserva espaço para o MobileStickyCTA (fixed, md:hidden) não cobrir a última linha do rodapé
  return (
    <footer className="border-t hairline bg-white pt-14 pb-28 md:pb-8">
      <div className="max-w-7xl mx-auto px-6 lg:px-10">
        {/* Top grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-8 mb-12">
          {/* Brand */}
          <div className="col-span-2 sm:col-span-1 flex flex-col gap-3">
            <img
              src="/logos/vitrinelogo-black.png"
              alt="VitrineTurbo"
              width={160}
              height={40}
              className="h-10 w-auto max-w-[160px] object-contain object-left"
              loading="lazy"
              decoding="async"
              onError={(e) => {
                e.currentTarget.src = 'https://ikvwygqmlqhsyqmpgaoz.supabase.co/storage/v1/object/public/public/logos/vitrinelogo-black.png.png';
              }}
            />
            <p className="text-[13px] text-ink-400 leading-relaxed max-w-[200px]">
              {t('footer.tagline')}
            </p>
          </div>

          {/* Links rápidos */}
          <div className="flex flex-col gap-3">
            <p className="font-mono-label uppercase text-[10px] tracking-wider text-ink-400 mb-1">{t('footer.platformHeading')}</p>
            <Link to="/login" className="text-[13px] text-ink-600 hover:text-ink-900 transition-colors">{t('footer.login')}</Link>
            <Link to="/cadastro" className="text-[13px] text-ink-600 hover:text-ink-900 transition-colors">{t('footer.createAccount')}</Link>
            <a href="#pricing" className="text-[13px] text-ink-600 hover:text-ink-900 transition-colors">{t('footer.plansAndPricing')}</a>
          </div>

          {/* Suporte */}
          <div className="flex flex-col gap-3">
            <p className="font-mono-label uppercase text-[10px] tracking-wider text-ink-400 mb-1">{t('footer.supportHeading')}</p>
            <Link to="/ajuda" className="text-[13px] text-ink-600 hover:text-ink-900 transition-colors">{t('footer.helpCenter')}</Link>
            {i18n.language === 'pt-BR' && (
              <a
                href="https://wa.me/5591982465495?text=Olá!%20Preciso%20de%20ajuda%20com%20o%20VitrineTurbo."
                target="_blank"
                rel="noopener noreferrer"
                className="text-[13px] text-ink-600 hover:text-ink-900 transition-colors"
              >
                WhatsApp
              </a>
            )}
            <a href="mailto:contato@vitrineturbo.com" className="text-[13px] text-ink-600 hover:text-ink-900 transition-colors">contato@vitrineturbo.com</a>
          </div>

          {/* Legal */}
          <div className="flex flex-col gap-3">
            <p className="font-mono-label uppercase text-[10px] tracking-wider text-ink-400 mb-1">{t('footer.legalHeading')}</p>
            <Link to="/termos-de-uso" className="text-[13px] text-ink-600 hover:text-ink-900 transition-colors">{t('footer.termsOfUse')}</Link>
            <Link to="/politica-de-privacidade" className="text-[13px] text-ink-600 hover:text-ink-900 transition-colors">{t('footer.privacyPolicy')}</Link>
            <Link to="/politica-de-cookies" className="text-[13px] text-ink-600 hover:text-ink-900 transition-colors">{t('footer.cookiesPolicy')}</Link>
            <Link to="/excluir-minha-conta" className="text-[13px] text-ink-600 hover:text-ink-900 transition-colors">{t('footer.myData')}</Link>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="border-t hairline pt-6 flex flex-col sm:flex-row items-center justify-between gap-3">
          <span className="font-mono-label uppercase text-[11px] text-ink-400">
            &copy; {new Date().getFullYear()} VitrineTurbo — {t('footer.copyright')}
          </span>
          <div className="flex items-center gap-4">
            {i18n.language === 'pt-BR' && (
              <a
                href="https://wa.me/5591982465495"
                target="_blank"
                rel="noopener noreferrer"
                className="w-8 h-8 rounded-full border border-ink-200 flex items-center justify-center text-ink-400 hover:text-ink-600 hover:border-ink-400 transition-colors"
                aria-label="WhatsApp"
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
              </a>
            )}
            <a
              href="https://www.instagram.com/vitrineturbo_/"
              target="_blank"
              rel="noopener noreferrer"
              className="w-8 h-8 rounded-full border border-ink-200 flex items-center justify-center text-ink-400 hover:text-ink-600 hover:border-ink-400 transition-colors"
              aria-label="Instagram"
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/></svg>
            </a>
            <span className="text-ink-200 text-[11px]">·</span>
            <Link to="/politica-de-privacidade" className="text-[11px] text-ink-400 hover:text-ink-600 transition-colors">{t('footer.privacyShort')}</Link>
            <span className="text-ink-200 text-[11px]">·</span>
            <Link to="/termos-de-uso" className="text-[11px] text-ink-400 hover:text-ink-600 transition-colors">{t('footer.termsShort')}</Link>
            <span className="text-ink-200 text-[11px]">·</span>
            <Link to="/politica-de-cookies" className="text-[11px] text-ink-400 hover:text-ink-600 transition-colors">{t('footer.cookiesShort')}</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}

const MemoizedBentoGrid = memo(BentoGrid);
const MemoizedSocialProofSection = memo(SocialProofSection);
const MemoizedFaqSection = memo(FaqSection);
const MemoizedFooterLanding = memo(FooterLanding);

function MobileStickyCTA({ refCode }: { refCode: string | null }) {
  const { t } = useTranslation('landing');
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const onScroll = () => {
      const isVisible = window.scrollY > 600;
      setVisible((prev) => prev === isVisible ? prev : isVisible);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <div
      className={`md:hidden fixed bottom-0 inset-x-0 z-50 p-3 glass-light border-t hairline transition-transform duration-300 ${
        visible ? 'translate-y-0' : 'translate-y-full'
      }`}
    >
      <a
        href={getRegisterHref(refCode)}
        className="btn-primary rounded-full w-full py-3.5 font-display font-medium text-[14px] inline-flex items-center justify-center gap-2"
      >
        {t('nav.createStore')}
        <ArrowRight size={14} />
      </a>
    </div>
  );
}

export default function LandingPage() {
  useReveal();
  useLandingTracking();
  const refCode = useReferralTracking();
  return (
    <div className="vt-root min-h-screen bg-white text-ink-900">
      <Header refCode={refCode} />
      <Hero refCode={refCode} />
      <HowItWorksSection />
      <MemoizedBentoGrid />
      <MemoizedSocialProofSection />
      <Suspense fallback={null}>
        <LandingTestimonials />
      </Suspense>
      <PricingSection refCode={refCode} />
      <MemoizedFaqSection />
      <FinalCTA refCode={refCode} />
      <MemoizedFooterLanding />
      <MobileStickyCTA refCode={refCode} />
    </div>
  );
}
