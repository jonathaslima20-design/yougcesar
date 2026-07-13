import { lazy, memo, Suspense, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowRight, Plus, Package, MessageCircle, Gift, Globe as Globe2, ChartBar as BarChart3, Check, X, Zap, TrendingUp, Users, LogIn, ShoppingCart, Radio, Box, ClipboardList, Tag, Code as Code2, Palette, Globe, Shield, TriangleAlert as AlertTriangle, Percent, Timer } from 'lucide-react';
import HeroPhoneCarousel from '@/components/landing/HeroPhoneCarousel';
import { supabase } from '@/lib/supabase';

const LandingSocialProof = lazy(() => import('@/components/landing/LandingSocialProof'));

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

function useReveal() {
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12 }
    );
    const observed = new WeakSet<Element>();
    const observeAll = () => {
      document.querySelectorAll('.reveal').forEach((el) => {
        if (!observed.has(el)) {
          observed.add(el);
          observer.observe(el);
        }
      });
    };
    observeAll();
    let debounceId: number | undefined;
    const mutation = new MutationObserver(() => {
      if (debounceId !== undefined) return;
      debounceId = window.setTimeout(() => {
        debounceId = undefined;
        observeAll();
      }, 150);
    });
    mutation.observe(document.body, { childList: true, subtree: true });
    return () => {
      observer.disconnect();
      mutation.disconnect();
      if (debounceId !== undefined) window.clearTimeout(debounceId);
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
            fetchPriority="high"
            loading="eager"
            decoding="async"
            onError={(e) => {
              e.currentTarget.src = 'https://ikvwygqmlqhsyqmpgaoz.supabase.co/storage/v1/object/public/public/logos/vitrinelogo-black.png.png';
            }}
          />
        </a>
        <nav className="hidden md:flex items-center gap-8">
          <a href="#recursos" className="font-mono-label uppercase text-[12px] text-ink-500 hover:text-ink-900 transition-colors">Funcionalidades</a>
          <a href="#analytics" className="font-mono-label uppercase text-[12px] text-ink-500 hover:text-ink-900 transition-colors">Analytics</a>
          <a href="#integracoes" className="font-mono-label uppercase text-[12px] text-ink-500 hover:text-ink-900 transition-colors">Integrações</a>
          <a href="#precos" className="font-mono-label uppercase text-[12px] text-ink-500 hover:text-ink-900 transition-colors">Planos</a>
          <a href="#faq" className="font-mono-label uppercase text-[12px] text-ink-500 hover:text-ink-900 transition-colors">FAQ</a>
        </nav>
        <div className="flex items-center gap-2">
          <a href="#precos" className="hidden sm:inline-flex btn-ghost rounded-full px-4 py-2 text-[13px] font-display font-medium">
            Ver Planos
          </a>
          <Link to="/login" className="btn-primary rounded-full px-4 py-2 text-[13px] font-display font-medium inline-flex items-center gap-1.5">
            <LogIn size={14} />
            Entrar
          </Link>
        </div>
      </div>
    </header>
  );
}

function Hero({ refCode }: { refCode: string | null }) {
  return (
    <section id="top" className="relative pt-36 pb-24 lg:pt-44 lg:pb-32 overflow-hidden bg-white">
      <div className="grid-bg" />
      <div className="relative max-w-7xl mx-auto px-6 lg:px-10">
        <div className="stagger max-w-4xl">
          <div className="inline-flex items-center gap-2 border hairline bg-white rounded-full px-3 py-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            <span className="font-mono-label uppercase text-[11px] text-ink-700">VitrineTurbo — v3.0</span>
          </div>
          <h1 className="font-display font-semibold text-[44px] sm:text-[64px] lg:text-[84px] leading-[1.02] tracking-[-0.035em] text-ink-900 mt-6">
            A Plataforma Completa para Vender Online.
          </h1>
          <p className="text-ink-500 text-[18px] lg:text-[20px] max-w-2xl mt-6 leading-[1.5]">
            Catálogo, estoque, pedidos, cupons, domínio próprio e API de integração. Tudo que você precisa em um único lugar, sem taxa sobre vendas.
          </p>
          <div className="flex flex-wrap items-center gap-3 mt-8">
            <a href={getRegisterHref(refCode)} className="btn-primary rounded-full px-7 py-4 font-display font-medium text-[15px] inline-flex items-center gap-2">
              Começar Grátis
              <ArrowRight size={16} />
            </a>
            <a href="#precos" onClick={(e) => { e.preventDefault(); document.getElementById('precos')?.scrollIntoView({ behavior: 'smooth' }); }} className="btn-ghost rounded-full px-7 py-4 font-display font-medium text-[15px] inline-flex items-center gap-2">
              Ver Planos
              <ArrowRight size={16} />
            </a>
          </div>
          <div className="grid grid-cols-2 sm:flex sm:flex-wrap items-center gap-2 mt-10">
            {[
              { label: '+3.000 lojas ativas', icon: Users },
              { label: '0% taxas em vendas', icon: Percent },
              { label: 'Suporte Humanizado', icon: MessageCircle },
              { label: 'Plano free inicial', icon: Gift },
            ].map(({ label, icon: Icon }) => (
              <div key={label} className="inline-flex items-center gap-1.5 border hairline bg-white rounded-full px-3 py-1.5">
                <Icon size={11} className="text-ink-400" strokeWidth={2} />
                <span className="font-mono-label uppercase text-[11px] text-ink-700">{label}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="reveal mt-16 lg:mt-20">
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

function BentoCard({
  idx,
  title,
  Icon,
  className = '',
  badge,
  children,
}: {
  idx: string;
  title: string;
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
      <div className="mt-5 flex-1">{children}</div>
    </div>
  );
}

function BentoGrid() {
  return (
    <section id="recursos" className="py-24 lg:py-32 bg-white border-t hairline" style={{ contentVisibility: 'auto', containIntrinsicSize: 'auto 1200px' }}>
      <div className="max-w-7xl mx-auto px-6 lg:px-10">
        <SectionHeading kicker="/ funcionalidades" title="Tudo que você precisa para vender como profissional" />
        <div className="grid grid-cols-1 lg:grid-cols-3 auto-rows-[minmax(200px,auto)] gap-4 mt-14">
          {/* Card 01 - Gestão de Produtos */}
          <BentoCard
            idx="01"
            title="Gestão Completa de Produtos"
            Icon={Package}
            className="lg:col-span-2 lg:row-span-2"
          >
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
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
                  className="group relative aspect-[3/4] sm:aspect-square rounded-xl border hairline bg-white p-3 sm:p-2.5 flex flex-col justify-between overflow-hidden transition-all duration-300 hover:shadow-md hover:-translate-y-0.5"
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
          <BentoCard idx="02" title="Controle de Estoque" Icon={Box}>
            <div className="space-y-2">
              {[
                { name: 'Camiseta Oversized', stock: 47, status: 'ok' },
                { name: 'Chuteira Mercurial', stock: 3, status: 'low' },
                { name: 'Bola Nike Pitch', stock: 0, status: 'out' },
              ].map((item) => (
                <div key={item.name} className="flex items-center gap-2.5 rounded-xl border hairline bg-white px-3 py-2">
                  <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                    item.status === 'ok' ? 'bg-emerald-500' : item.status === 'low' ? 'bg-amber-500' : 'bg-red-500'
                  }`} />
                  <div className="flex-1 min-w-0">
                    <div className="text-[11px] font-medium text-ink-900 truncate">{item.name}</div>
                  </div>
                  <div className="flex items-center gap-1">
                    {item.status === 'low' && <AlertTriangle size={10} className="text-amber-500" />}
                    <span className={`text-[11px] font-semibold ${
                      item.status === 'ok' ? 'text-ink-900' : item.status === 'low' ? 'text-amber-600' : 'text-red-600'
                    }`}>{item.stock} un</span>
                  </div>
                </div>
              ))}
              <div className="rounded-xl border hairline bg-ink-50 px-3 py-2 flex items-center gap-2">
                <Timer size={11} className="text-ink-400 flex-shrink-0" />
                <span className="text-[10px] text-ink-500">Reserva automática por 15min no carrinho</span>
              </div>
            </div>
          </BentoCard>

          {/* Card 03 - Gestão de Pedidos */}
          <BentoCard idx="03" title="Gestão de Pedidos" Icon={ClipboardList}>
            <div className="space-y-3">
              <div className="flex items-center gap-1.5">
                {['Pendente', 'Confirmado', 'Preparando', 'Enviado', 'Entregue'].map((step, i) => (
                  <div key={step} className="flex items-center gap-1.5">
                    <div className={`w-2 h-2 rounded-full ${i < 3 ? 'bg-ink-900' : 'bg-ink-200'}`} />
                    {i < 4 && <div className={`w-3 h-px ${i < 2 ? 'bg-ink-900' : 'bg-ink-200'}`} />}
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-lg border hairline bg-white px-2.5 py-2 text-center">
                  <div className="font-display font-semibold text-[18px] text-ink-900">156</div>
                  <div className="font-mono-label uppercase text-[8px] text-ink-400 mt-0.5">Pedidos/mês</div>
                </div>
                <div className="rounded-lg border hairline bg-white px-2.5 py-2 text-center">
                  <div className="font-display font-semibold text-[18px] text-emerald-600">R$ 24k</div>
                  <div className="font-mono-label uppercase text-[8px] text-ink-400 mt-0.5">Receita</div>
                </div>
              </div>
            </div>
          </BentoCard>

          {/* Card 04 - Sistema de Cupons */}
          <BentoCard idx="04" title="Cupons de Desconto" Icon={Tag}>
            <div className="space-y-2">
              {[
                { code: 'PRIMEIRACOMPRA', discount: '-15%', uses: '234 usos' },
                { code: 'PROMO20', discount: '-R$ 25', uses: '89 usos' },
                { code: 'BLACKFRIDAY', discount: '-30%', uses: '567 usos' },
              ].map((coupon) => (
                <div key={coupon.code} className="flex items-center gap-2.5 rounded-xl border hairline bg-white px-3 py-2">
                  <div className="w-7 h-7 rounded-lg bg-ink-50 flex items-center justify-center flex-shrink-0">
                    <Percent size={12} className="text-ink-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[10px] font-mono-label font-medium text-ink-900 truncate">{coupon.code}</div>
                    <div className="text-[9px] text-ink-400">{coupon.uses}</div>
                  </div>
                  <span className="font-display font-semibold text-[12px] text-emerald-600 flex-shrink-0">{coupon.discount}</span>
                </div>
              ))}
            </div>
          </BentoCard>

          {/* Card 05 - WhatsApp Integrado */}
          <BentoCard idx="05" title="WhatsApp Integrado" Icon={MessageCircle}>
            <div className="space-y-2">
              <div className="max-w-[85%] bg-surface rounded-2xl rounded-bl-sm px-3 py-2 text-[12px] text-ink-900 leading-snug">
                Olá, gostaria de mais informações sobre o produto Camiseta Reserva Orleans Masculina.
              </div>
              <div className="max-w-[85%] ml-auto bg-ink-900 text-white rounded-2xl rounded-br-sm px-3 py-2 text-[12px] leading-snug">
                Perfeito, me chamo Letícia e vou prosseguir com o seu atendimento!
              </div>
            </div>
          </BentoCard>

          {/* Card 06 - Carrinho de Compras */}
          <BentoCard idx="06" title="Carrinho de Compras" Icon={ShoppingCart}>
            <div className="space-y-2">
              {[
                { name: 'Camiseta Oversized Preta', qty: 2, price: 'R$ 89,90' },
                { name: 'Chuteira Nike Mercurial', qty: 1, price: 'R$ 349,00' },
                { name: 'Bola Nike Pitch Team', qty: 3, price: 'R$ 129,90' },
              ].map((item, i) => (
                <div key={i} className="flex items-center gap-2.5 rounded-xl border hairline bg-white px-3 py-2">
                  <div className="w-7 h-7 rounded-lg bg-ink-50 flex items-center justify-center flex-shrink-0">
                    <Package size={13} className="text-ink-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[11px] font-medium text-ink-900 truncate">{item.name}</div>
                    <div className="text-[10px] text-ink-400">Qtd: {item.qty}</div>
                  </div>
                  <div className="text-[11px] font-semibold text-ink-900 flex-shrink-0">{item.price}</div>
                </div>
              ))}
              <div className="flex items-center justify-between pt-1 px-1">
                <div className="font-mono-label uppercase text-[10px] text-ink-400">Total</div>
                <div className="text-[13px] font-semibold text-ink-900">R$ 918,60</div>
              </div>
            </div>
          </BentoCard>

          {/* Card 07 - Pixel Meta & Google Tag */}
          <BentoCard idx="07" title="Pixel Meta & Google Tag" Icon={Radio}>
            <div className="space-y-3">
              {[
                { platform: 'Meta Pixel', label: 'Facebook & Instagram Ads', dot: 'bg-blue-500' },
                { platform: 'Google Tag', label: 'Google Ads & Analytics', dot: 'bg-red-500' },
              ].map((item) => (
                <div key={item.platform} className="rounded-xl border hairline bg-white px-3 py-3 flex items-center gap-3">
                  <div className={`w-2 h-2 rounded-full flex-shrink-0 ${item.dot}`} />
                  <div className="flex-1 min-w-0">
                    <div className="text-[12px] font-semibold text-ink-900">{item.platform}</div>
                    <div className="text-[10px] text-ink-400">{item.label}</div>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="font-mono-label uppercase text-[9px] text-emerald-600">Ativo</span>
                  </div>
                </div>
              ))}
            </div>
          </BentoCard>

          {/* Card 08 - Indique e Ganhe */}
          <BentoCard idx="08" title="Indique e Ganhe" Icon={Gift}>
            <div className="flex items-end justify-between">
              <div>
                <div className="font-mono-label uppercase text-[10px] text-ink-400 mb-1">Ganhe até</div>
                <div className="font-display font-semibold text-[32px] leading-none tracking-[-0.03em] text-ink-900">R$ <span className="text-[38px]">100</span><span className="text-[22px]">,00</span></div>
                <div className="font-mono-label uppercase text-[10px] text-ink-400 mt-2">por usuário indicado</div>
              </div>
              <div className="flex -space-x-2">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="w-8 h-8 rounded-full border-2 border-white bg-surface flex items-center justify-center">
                    <Users size={14} className="text-ink-500" />
                  </div>
                ))}
              </div>
            </div>
          </BentoCard>

          {/* Card 09 - Multi Idiomas */}
          <BentoCard idx="09" title="Multi Idiomas e Moedas" Icon={Globe2}>
            <div className="flex flex-wrap gap-2">
              {['PT-BR', 'EN-US', 'ES-ES', 'BRL', 'USD', 'EUR'].map((p) => (
                <span key={p} className="font-mono-label text-[10px] uppercase px-2.5 py-1 rounded-full border hairline bg-white text-ink-700">
                  {p}
                </span>
              ))}
            </div>
          </BentoCard>
        </div>
      </div>
    </section>
  );
}

function ProFeaturesSection({ refCode }: { refCode: string | null }) {
  return (
    <section id="integracoes" className="py-24 lg:py-32 bg-surface border-t hairline" style={{ contentVisibility: 'auto', containIntrinsicSize: 'auto 700px' }}>
      <div className="max-w-7xl mx-auto px-6 lg:px-10">
        <SectionHeading kicker="/ profissional" title="Recursos avançados para quem leva vendas a sério" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mt-14">
          {/* Personalização Visual */}
          <div className="reveal card-hover rounded-2xl border hairline bg-white p-6 lg:p-7 flex flex-col">
            <div className="flex items-center justify-between">
              <div className="w-9 h-9 rounded-lg border hairline bg-surface flex items-center justify-center">
                <Palette size={18} className="text-ink-900" strokeWidth={2} />
              </div>
              <span className="font-mono-label text-[10px] text-ink-400">Aparência</span>
            </div>
            <h3 className="font-display font-semibold text-[20px] lg:text-[22px] text-ink-900 tracking-[-0.02em] mt-6">
              Personalize Sua Vitrine
            </h3>
            <div className="mt-5 flex-1">
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className="flex -space-x-1.5">
                    {['bg-ink-900', 'bg-sky-500', 'bg-emerald-500', 'bg-amber-500', 'bg-rose-500'].map((color) => (
                      <div key={color} className={`w-6 h-6 rounded-full border-2 border-white ${color}`} />
                    ))}
                  </div>
                  <span className="text-[11px] text-ink-500">Cores personalizadas</span>
                </div>
                <div className="rounded-xl border hairline bg-surface p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-3 h-3 rounded bg-sky-500" />
                    <span className="text-[10px] font-medium text-ink-700">Fundo, Texto, Botões, Bordas</span>
                  </div>
                  <div className="h-8 rounded-lg bg-gradient-to-r from-sky-50 via-sky-100 to-sky-200 border border-sky-200" />
                </div>
                <div className="rounded-xl border hairline bg-surface px-3 py-2 flex items-center gap-2">
                  <span className="text-[12px] font-medium text-ink-700" style={{ fontFamily: 'serif' }}>Aa</span>
                  <span className="text-[10px] text-ink-500">Fontes personalizadas via Google Fonts</span>
                </div>
              </div>
            </div>
          </div>

          {/* Domínio Próprio */}
          <div className="reveal card-hover rounded-2xl border hairline bg-white p-6 lg:p-7 flex flex-col">
            <div className="flex items-center justify-between">
              <div className="w-9 h-9 rounded-lg border hairline bg-surface flex items-center justify-center">
                <Globe size={18} className="text-ink-900" strokeWidth={2} />
              </div>
              <span className="font-mono-label text-[9px] uppercase px-2 py-0.5 rounded-full bg-ink-900 text-white">Planos Pagos</span>
            </div>
            <h3 className="font-display font-semibold text-[20px] lg:text-[22px] text-ink-900 tracking-[-0.02em] mt-6">
              Domínio Próprio
            </h3>
            <div className="mt-5 flex-1">
              <div className="space-y-3">
                <div className="rounded-xl border hairline bg-surface px-3 py-2.5">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-emerald-500" />
                    <span className="text-[11px] font-mono-label text-ink-900">www.sualoja.com.br</span>
                  </div>
                </div>
                <div className="flex items-center gap-2 px-1">
                  <Shield size={12} className="text-emerald-600" />
                  <span className="text-[11px] text-ink-500">SSL gratuito incluso</span>
                </div>
                <div className="flex items-center gap-2 px-1">
                  <Check size={12} strokeWidth={3} className="text-emerald-600" />
                  <span className="text-[11px] text-ink-500">DNS verificado automaticamente</span>
                </div>
                <div className="flex items-center gap-2 px-1">
                  <Zap size={12} className="text-emerald-600" />
                  <span className="text-[11px] text-ink-500">Configuração simples via CNAME</span>
                </div>
              </div>
            </div>
          </div>

          {/* API de Integração */}
          <div className="reveal card-hover rounded-2xl border hairline bg-white p-6 lg:p-7 flex flex-col">
            <div className="flex items-center justify-between">
              <div className="w-9 h-9 rounded-lg border hairline bg-surface flex items-center justify-center">
                <Code2 size={18} className="text-ink-900" strokeWidth={2} />
              </div>
              <span className="font-mono-label text-[9px] uppercase px-2 py-0.5 rounded-full bg-ink-900 text-white">Plano Anual</span>
            </div>
            <h3 className="font-display font-semibold text-[20px] lg:text-[22px] text-ink-900 tracking-[-0.02em] mt-6">
              API REST Completa
            </h3>
            <div className="mt-5 flex-1">
              <div className="space-y-3">
                <div className="rounded-xl border hairline bg-ink-900 px-3 py-2.5 font-mono text-[10px] text-emerald-400 leading-relaxed overflow-hidden">
                  <div className="text-ink-400">GET /api-gateway/products</div>
                  <div className="text-white mt-1">{'{ "data": [...], "meta": { "total": 847 } }'}</div>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {['Produtos', 'Estoque', 'Pedidos', 'Cupons'].map((ep) => (
                    <span key={ep} className="font-mono-label text-[9px] uppercase px-2 py-0.5 rounded-full border hairline bg-surface text-ink-600">
                      {ep}
                    </span>
                  ))}
                </div>
                <div className="rounded-xl border hairline bg-surface px-3 py-2 flex items-center gap-2">
                  <Zap size={11} className="text-ink-400 flex-shrink-0" />
                  <span className="text-[10px] text-ink-500">Integre com Bling, Tiny e outros ERPs</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function DifferentiationSection({ refCode }: { refCode: string | null }) {
  const features = [
    'Sem taxa sobre vendas — pague apenas o plano',
    'Estoque automatizado com alertas de nível baixo',
    'Pedidos organizados por status em tempo real',
    'Cupons para fidelizar e atrair clientes',
    'API REST para conectar com ERPs externos',
    'Domínio próprio com SSL gratuito',
    'Personalize cores, fontes e aparência da loja',
    'Analytics completo com funil de conversão',
  ];

  return (
    <section className="py-24 lg:py-32 bg-white border-t hairline" style={{ contentVisibility: 'auto', containIntrinsicSize: 'auto 500px' }}>
      <div className="max-w-7xl mx-auto px-6 lg:px-10">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          <div className="reveal">
            <div className="font-mono-label uppercase text-[11px] text-ink-500">/ diferencial</div>
            <h2 className="font-display font-semibold text-[36px] sm:text-[48px] lg:text-[56px] leading-[1.05] tracking-[-0.035em] text-ink-900 mt-4">
              Para negócios que precisam de escala.
            </h2>
            <p className="text-ink-500 text-[16px] lg:text-[18px] mt-6 leading-[1.5] max-w-xl">
              Não é só um catálogo. É uma plataforma completa para gerenciar e escalar suas vendas online, com ferramentas e funcionalidades
              voltadas para o seu negócio.
            </p>
            <div className="mt-8">
              <a href={getRegisterHref(refCode)} className="btn-primary rounded-full px-7 py-3.5 font-display font-medium text-[14px] inline-flex items-center gap-2">
                Criar Minha Loja
                <ArrowRight size={14} />
              </a>
            </div>
          </div>
          <div className="reveal">
            <div className="rounded-2xl border hairline bg-surface p-6 lg:p-8">
              <ul className="space-y-4">
                {features.map((feature) => (
                  <li key={feature} className="flex items-start gap-3">
                    <span className="w-5 h-5 rounded-full bg-emerald-50 border border-emerald-200 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <Check size={10} strokeWidth={3} className="text-emerald-600" />
                    </span>
                    <span className="text-[14px] lg:text-[15px] text-ink-700 leading-snug">{feature}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function AnalyticsSection() {
  const metrics = [
    { Icon: Package, l: 'Total de Produtos', v: '1.847' },
    { Icon: BarChart3, l: 'Visualizações', v: '+58,3k' },
    { Icon: Users, l: 'Visitantes', v: '+12.490' },
    { Icon: TrendingUp, l: 'Conversões', v: '+3,7%' },
  ];
  return (
    <section id="analytics" className="py-24 lg:py-32 bg-surface border-t hairline" style={{ contentVisibility: 'auto', containIntrinsicSize: 'auto 700px' }}>
      <div className="max-w-7xl mx-auto px-6 lg:px-10">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          <div className="reveal">
            <div className="font-mono-label uppercase text-[11px] text-ink-500">/ analytics</div>
            <h2 className="font-display font-semibold text-[36px] sm:text-[48px] lg:text-[64px] leading-[1.05] tracking-[-0.035em] text-ink-900 mt-4">
              Decisões baseadas em dados reais.
            </h2>
            <p className="text-ink-500 text-[16px] lg:text-[18px] mt-6 leading-[1.5] max-w-xl">
              Tenha uma visão geral do seu negócio e acompanhe suas vendas de forma simples e intuitiva.
            </p>
            <div className="grid grid-cols-2 gap-4 mt-10">
              {metrics.map(({ Icon, l, v }) => (
                <div key={l} className="rounded-2xl border hairline bg-white p-5">
                  <Icon size={18} className="text-ink-900" />
                  <div className="font-mono-label uppercase text-[10px] text-ink-400 mt-4">{l}</div>
                  <div className="font-display font-semibold text-[24px] text-ink-900 tracking-[-0.02em] mt-1">{v}</div>
                </div>
              ))}
            </div>
          </div>
          <div className="reveal">
            <div
              className="rounded-3xl bg-white p-6 lg:p-8 border hairline"
              style={{ boxShadow: '0 30px 80px -40px rgba(10,10,10,0.2)' }}
            >
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-2">
                  <BarChart3 size={16} className="text-ink-900" />
                  <span className="font-display font-medium text-[14px] text-ink-900">Visão geral</span>
                </div>
                <span className="font-mono-label uppercase text-[10px] text-ink-400">últimos 30d</span>
              </div>
              <svg viewBox="0 0 400 160" className="w-full h-auto">
                <defs>
                  <linearGradient id="vt-area" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0%" stopColor="#0A0A0A" stopOpacity="0.14" />
                    <stop offset="100%" stopColor="#0A0A0A" stopOpacity="0" />
                  </linearGradient>
                </defs>
                <path
                  d="M0,120 C40,100 60,60 100,70 C140,80 160,40 200,50 C240,60 260,90 300,70 C340,50 360,30 400,40 L400,160 L0,160 Z"
                  fill="url(#vt-area)"
                />
                <path
                  d="M0,120 C40,100 60,60 100,70 C140,80 160,40 200,50 C240,60 260,90 300,70 C340,50 360,30 400,40"
                  fill="none"
                  stroke="#0A0A0A"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              </svg>
              <div className="grid grid-cols-2 gap-4 mt-6 pt-6 border-t hairline">
                {[
                  { l: 'Visualizações', v: '58.3k' },
                  { l: 'Leads', v: '2.184' },
                ].map((m) => (
                  <div key={m.l}>
                    <div className="font-mono-label uppercase text-[10px] text-ink-400">{m.l}</div>
                    <div className="font-display font-semibold text-[20px] text-ink-900 tracking-[-0.02em] mt-1">{m.v}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function PricingCard({
  tag,
  name,
  price,
  featured = false,
  benefits,
  refCode,
}: {
  tag: string;
  name: string;
  price: string;
  featured?: boolean;
  benefits: string[];
  refCode: string | null;
}) {
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
        <span className="font-display font-semibold text-[44px] lg:text-[52px] tracking-[-0.03em] leading-none">{price}</span>
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
      <a
        href={getRegisterHref(refCode)}
        className={`mt-8 rounded-full px-6 py-3.5 font-display font-medium text-[14px] inline-flex items-center justify-center gap-2 transition-colors ${
          featured
            ? 'bg-white text-ink-900 hover:bg-white/90'
            : 'btn-primary'
        }`}
      >
        Assinar Agora
        <ArrowRight size={14} />
      </a>
    </div>
  );
}

function SocialProofSection() {
  return (
    <section id="usuarios" className="py-24 lg:py-32 bg-white border-t hairline" style={{ contentVisibility: 'auto', containIntrinsicSize: 'auto 400px' }}>
      <div className="max-w-7xl mx-auto px-6 lg:px-10">
        <SectionHeading kicker="/ usuários" title="Junte-se a milhares de usuários do VitrineTurbo" />
        <Suspense fallback={<div className="mt-14 min-h-[140px] rounded-2xl border hairline bg-surface animate-pulse" />}>
          <LandingSocialProof />
        </Suspense>
      </div>
    </section>
  );
}

function PricingSection({ refCode }: { refCode: string | null }) {
  const allPaidBenefits = [
    'Produtos ilimitados',
    'Categorias e tags ilimitadas',
    'Catálogo Digital via Link',
    'Painel Administrativo completo',
    'Carrinho de compras',
    'Controle de Estoque e Inventário',
    'Gestão de Pedidos e Vendas',
    'Sistema de Cupons',
    'Personalização de cores e fontes',
    'Integração com Meta Pixel e Google Tag',
    'Programa de Indicação',
    'Domínio próprio com SSL',
  ];

  const anualBenefits = [
    ...allPaidBenefits,
    'API REST para integrações externas (Bling, Tiny, ERPs)',
    'Remoção da logomarca VitrineTurbo',
  ];

  const freeBenefitsIncluded = [
    'Até 20 produtos',
    'Catálogo Digital via Link',
    'Suporte Humanizado',
  ];

  const freeBenefitsExcluded = [
    'Domínio próprio',
    'Personalização de cores',
    'Analytics avançado',
    'Cupons de desconto',
    'Produtos ilimitados',
  ];

  return (
    <section id="precos" className="py-24 lg:py-32 bg-white border-t hairline" style={{ contentVisibility: 'auto', containIntrinsicSize: 'auto 700px' }}>
      <div className="max-w-7xl mx-auto px-6 lg:px-10">
        <SectionHeading kicker="/ planos" title="Escolha o plano ideal pra você" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5 mt-14">
          {/* Free Plan Card */}
          <div className="reveal card-hover rounded-2xl p-7 lg:p-8 border hairline flex flex-col bg-white text-ink-900">
            <div className="flex items-center justify-between">
              <span className="font-display font-semibold text-[16px] text-ink-900">Free</span>
              <span className="font-mono-label uppercase text-[10px] px-2.5 py-1 rounded-full border hairline text-ink-500">
                Grátis
              </span>
            </div>
            <div className="mt-8">
              <span className="font-display font-semibold text-[44px] lg:text-[52px] tracking-[-0.03em] leading-none">R$ 0</span>
              <span className="text-[14px] text-ink-500 ml-1">/ grátis</span>
            </div>
            <p className="text-[13px] text-ink-500 mt-3">Para quem está começando</p>
            <ul className="mt-8 space-y-3 flex-1">
              {freeBenefitsIncluded.map((b) => (
                <li key={b} className="flex items-center gap-3">
                  <span className="w-5 h-5 rounded-full flex items-center justify-center bg-white border hairline">
                    <Check size={12} strokeWidth={3} className="text-ink-900" />
                  </span>
                  <span className="text-[14px] text-ink-700">{b}</span>
                </li>
              ))}
              {freeBenefitsExcluded.map((b) => (
                <li key={b} className="flex items-center gap-3">
                  <span className="w-5 h-5 rounded-full flex items-center justify-center bg-ink-50 border hairline">
                    <X size={12} strokeWidth={3} className="text-ink-300" />
                  </span>
                  <span className="text-[14px] text-ink-400 line-through">{b}</span>
                </li>
              ))}
            </ul>
            <a
              href={getRegisterHref(refCode)}
              className="mt-8 rounded-full px-6 py-3.5 font-display font-medium text-[14px] inline-flex items-center justify-center gap-2 transition-colors border-2 border-ink-900 text-ink-900 hover:bg-ink-900 hover:text-white"
            >
              Começar grátis
              <ArrowRight size={14} />
            </a>
          </div>

          <PricingCard
            tag="Flexível"
            name="Trimestral"
            price="R$ 149,00"
            benefits={allPaidBenefits}
            refCode={refCode}
          />
          <PricingCard
            tag="Mais escolhido"
            name="Semestral"
            price="R$ 229,00"
            benefits={allPaidBenefits}
            refCode={refCode}
          />
          <PricingCard
            tag="Melhor valor"
            name="Anual"
            price="R$ 336,00"
            featured
            benefits={anualBenefits}
            refCode={refCode}
          />
        </div>
      </div>
    </section>
  );
}

function FaqSection() {
  const items = [
    {
      q: 'Existe um plano gratuito?',
      a: 'Sim! O plano Free permite cadastrar até 20 produtos sem nenhum custo, sem precisar inserir cartão de crédito. É a forma mais simples de começar sua vitrine digital. Quando sua loja crescer e você precisar de mais recursos, basta fazer o upgrade para um plano pago com um clique.',
    },
    {
      q: 'Preciso de cartão de crédito para começar?',
      a: 'Não. Você pode criar sua vitrine e explorar a plataforma sem nenhum compromisso inicial.',
    },
    {
      q: 'Existe taxa sobre as vendas?',
      a: 'Não cobramos nenhuma comissão sobre suas vendas. Você paga apenas o plano escolhido.',
    },
    {
      q: 'Funciona para qualquer nicho?',
      a: 'Sim. Moda, calçados, cosméticos, alimentos, serviços, decoração... A plataforma é flexível e se adapta ao seu negócio.',
    },
    {
      q: 'Como funciona o controle de estoque?',
      a: 'O sistema rastreia automaticamente a quantidade de cada produto. Você recebe alertas quando o estoque está baixo, pode bloquear vendas de itens esgotados e o sistema reserva produtos no carrinho por 15 minutos para evitar vendas duplicadas.',
    },
    {
      q: 'Posso usar meu próprio domínio?',
      a: 'Sim. Em qualquer plano pago, você pode conectar seu domínio personalizado (ex: www.sualoja.com.br) com SSL gratuito. Basta apontar o DNS e o sistema verifica automaticamente.',
    },
    {
      q: 'A API funciona com Bling, Tiny e outros ERPs?',
      a: 'Sim. A API REST permite integração com qualquer sistema que suporte requisições HTTP. Você pode sincronizar produtos, estoque, pedidos e cupons com ERPs como Bling, Tiny e outros.',
    },
    {
      q: 'Posso criar cupons de desconto?',
      a: 'Sim. Você pode criar cupons com desconto percentual ou valor fixo, definir limite de uso, data de expiração e valor mínimo de compra. Ideal para campanhas promocionais e fidelização.',
    },
    {
      q: 'Como funciona o Indique e Ganhe?',
      a: 'Cada usuário recebe um link de indicação exclusivo. Quem assinar pelo seu link ganha desconto na primeira assinatura, e você recebe comissões em dinheiro por cada indicação convertida. Os ganhos ficam disponíveis para saque diretamente no painel.',
    },
    {
      q: 'Posso cancelar a qualquer momento?',
      a: 'Sim. O cancelamento é imediato e sem burocracia, diretamente no painel administrativo.',
    },
  ];
  return (
    <section id="faq" className="py-24 lg:py-32 bg-surface border-t hairline" style={{ contentVisibility: 'auto', containIntrinsicSize: 'auto 800px' }}>
      <div className="max-w-4xl mx-auto px-6 lg:px-10">
        <SectionHeading kicker="/ dúvidas" title="Perguntas frequentes." />
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
  return (
    <section id="cta" className="py-24 lg:py-32 bg-white border-t hairline">
      <div className="max-w-5xl mx-auto px-6 lg:px-10 text-center">
        <h2 className="reveal font-display font-semibold text-[40px] sm:text-[56px] lg:text-[80px] leading-[1.04] tracking-[-0.035em] text-ink-900">
          Tudo que você precisa. Em um único lugar.
        </h2>
        <p className="reveal text-ink-500 text-[16px] lg:text-[18px] mt-6 max-w-2xl mx-auto leading-[1.5]">
          Estoque, pedidos, cupons, domínio próprio e API de integração. Sem taxa sobre vendas.
        </p>
        <div className="reveal mt-10">
          <a href={getRegisterHref(refCode)} className="btn-primary rounded-full px-8 py-4 text-[15px] font-display font-medium inline-flex items-center gap-2">
            Começar Agora
            <ArrowRight size={16} />
          </a>
          <p className="mt-4 text-[13px] text-ink-400">
            Ou comece pelo{' '}
            <a href="#precos" className="text-ink-600 underline underline-offset-2 hover:text-ink-900 transition-colors">
              plano gratuito
            </a>
            , sem cartão de crédito &rarr;
          </p>
        </div>
      </div>
    </section>
  );
}

function FooterLanding() {
  return (
    <footer className="border-t hairline bg-white pt-14 pb-8">
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
              Crie sua vitrine online em minutos e venda mais.
            </p>
          </div>

          {/* Links rápidos */}
          <div className="flex flex-col gap-3">
            <p className="font-mono-label uppercase text-[10px] tracking-wider text-ink-400 mb-1">Plataforma</p>
            <Link to="/login" className="text-[13px] text-ink-600 hover:text-ink-900 transition-colors">Entrar</Link>
            <Link to="/cadastro" className="text-[13px] text-ink-600 hover:text-ink-900 transition-colors">Criar conta</Link>
            <a href="#pricing" className="text-[13px] text-ink-600 hover:text-ink-900 transition-colors">Planos e preços</a>
          </div>

          {/* Suporte */}
          <div className="flex flex-col gap-3">
            <p className="font-mono-label uppercase text-[10px] tracking-wider text-ink-400 mb-1">Suporte</p>
            <Link to="/ajuda" className="text-[13px] text-ink-600 hover:text-ink-900 transition-colors">Central de ajuda</Link>
            <a
              href="https://wa.me/5591982465495?text=Olá!%20Preciso%20de%20ajuda%20com%20o%20VitrineTurbo."
              target="_blank"
              rel="noopener noreferrer"
              className="text-[13px] text-ink-600 hover:text-ink-900 transition-colors"
            >
              WhatsApp
            </a>
            <a href="mailto:contato@vitrineturbo.com" className="text-[13px] text-ink-600 hover:text-ink-900 transition-colors">contato@vitrineturbo.com</a>
          </div>

          {/* Legal */}
          <div className="flex flex-col gap-3">
            <p className="font-mono-label uppercase text-[10px] tracking-wider text-ink-400 mb-1">Legal</p>
            <Link to="/termos-de-uso" className="text-[13px] text-ink-600 hover:text-ink-900 transition-colors">Termos de Uso</Link>
            <Link to="/politica-de-privacidade" className="text-[13px] text-ink-600 hover:text-ink-900 transition-colors">Política de Privacidade</Link>
            <Link to="/politica-de-cookies" className="text-[13px] text-ink-600 hover:text-ink-900 transition-colors">Política de Cookies</Link>
            <Link to="/excluir-minha-conta" className="text-[13px] text-ink-600 hover:text-ink-900 transition-colors">Meus Dados (LGPD)</Link>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="border-t hairline pt-6 flex flex-col sm:flex-row items-center justify-between gap-3">
          <span className="font-mono-label uppercase text-[11px] text-ink-400">
            &copy; {new Date().getFullYear()} VitrineTurbo — Todos os direitos reservados.
          </span>
          <div className="flex items-center gap-4">
            <a
              href="https://wa.me/5591982465495"
              target="_blank"
              rel="noopener noreferrer"
              className="w-8 h-8 rounded-full border border-ink-200 flex items-center justify-center text-ink-400 hover:text-ink-600 hover:border-ink-400 transition-colors"
              aria-label="WhatsApp"
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
            </a>
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
            <Link to="/politica-de-privacidade" className="text-[11px] text-ink-400 hover:text-ink-600 transition-colors">Privacidade</Link>
            <span className="text-ink-200 text-[11px]">·</span>
            <Link to="/termos-de-uso" className="text-[11px] text-ink-400 hover:text-ink-600 transition-colors">Termos</Link>
            <span className="text-ink-200 text-[11px]">·</span>
            <Link to="/politica-de-cookies" className="text-[11px] text-ink-400 hover:text-ink-600 transition-colors">Cookies</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}

const MemoizedBentoGrid = memo(BentoGrid);
const MemoizedAnalyticsSection = memo(AnalyticsSection);
const MemoizedSocialProofSection = memo(SocialProofSection);
const MemoizedFaqSection = memo(FaqSection);
const MemoizedFooterLanding = memo(FooterLanding);

export default function LandingPage() {
  useReveal();
  useLandingTracking();
  const refCode = useReferralTracking();
  return (
    <div className="vt-root min-h-screen bg-white text-ink-900">
      <Header refCode={refCode} />
      <Hero refCode={refCode} />
      <MemoizedBentoGrid />
      <ProFeaturesSection refCode={refCode} />
      <DifferentiationSection refCode={refCode} />
      <MemoizedAnalyticsSection />
      <MemoizedSocialProofSection />
      <PricingSection refCode={refCode} />
      <MemoizedFaqSection />
      <FinalCTA refCode={refCode} />
      <MemoizedFooterLanding />
    </div>
  );
}
