import { memo, startTransition, useCallback, useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useLandingHeroScreens, type HeroConfig, type HeroScreen } from '@/hooks/useLandingHeroScreens';
import { MockupRenderer } from './mockups/MockupRenderer';

const FALLBACK_SLIDES: HeroScreen[] = [
  { id: '1', display_order: 1, is_active: true, label: 'Vitrine personalizada', screen_type: 'storefront', scroll_y: 0, config: { store_name: 'Minha Loja', bio: 'Os melhores produtos', social_buttons: ['cart', 'whatsapp', 'instagram', 'phone', 'location'], bg_color: '#ffffff', text_color: '#0a0a0a', accent_color: '#0f172a', button_bg_color: '#0f172a', button_text_color: '#f8fafc', icon_color: '#0a0a0a', border_color: '#e4e4e7', font_family: 'Inter', heading_font_family: 'Inter Tight', font_size_base: 'md', category_name: 'Destaques', products: [{ title: 'Tenis Esportivo', image_url: '', price: 299.9, discount_price: 199.9 }, { title: 'Camiseta Casual', image_url: '', price: 89.9, discount_price: null }, { title: 'Relogio Digital', image_url: '', price: 450, discount_price: 359.9 }, { title: 'Mochila Urbana', image_url: '', price: 159.9, discount_price: null }] } },
  { id: '2', display_order: 2, is_active: true, label: 'Detalhes do produto', screen_type: 'product_detail', scroll_y: 0, config: { product_title: 'Tenis Esportivo Premium', product_description: 'Conforto e estilo para o seu dia a dia', price: 299.9, discount_price: 199.9, discount_badge: '-33%', color_options: ['#000000', '#ffffff', '#1e40af', '#dc2626'], size_options: ['38', '39', '40', '41', '42'], button_text: 'Adicionar ao Carrinho', button_color: '#0f172a', seller_name: 'Loja Premium' } },
  { id: '3', display_order: 3, is_active: true, label: 'Dashboard', screen_type: 'dashboard', scroll_y: 0, config: { user_name: 'Joao', period_label: 'Ultimos 30 dias', accent_color: '#0f172a', stats: [{ label: 'Produtos', value: '48', icon_name: 'Package' }, { label: 'Visualizacoes', value: '1.2k', icon_name: 'TrendingUp' }, { label: 'Visitantes', value: '384', icon_name: 'Users' }, { label: 'Conversoes', value: '27', icon_name: 'DollarSign' }] } },
];

function getShadowStyle(shadow: HeroConfig['mockup_shadow']): string {
  switch (shadow) {
    case 'none': return 'none';
    case 'sm': return '0 20px 30px rgba(0,0,0,0.12), 0 8px 14px rgba(0,0,0,0.08)';
    case 'md': return '0 35px 50px rgba(0,0,0,0.18), 0 12px 20px rgba(0,0,0,0.10)';
    case 'lg': return '0 50px 70px rgba(0,0,0,0.25), 0 16px 28px rgba(0,0,0,0.15), 0 4px 10px rgba(0,0,0,0.10)';
    case 'xl': return '0 60px 90px rgba(0,0,0,0.30), 0 20px 35px rgba(0,0,0,0.18), 0 6px 14px rgba(0,0,0,0.12)';
    default: return '0 50px 70px rgba(0,0,0,0.25), 0 16px 28px rgba(0,0,0,0.15), 0 4px 10px rgba(0,0,0,0.10)';
  }
}

function IPhone16ProMax({ children, shadow }: { children: React.ReactNode; shadow: string }) {
  return (
    <div
      className="relative select-none"
      style={{
        width: 'clamp(170px, 46vw, 270px)',
        aspectRatio: '393 / 852',
      }}
    >
      <div
        className="absolute inset-0 overflow-hidden"
        style={{
          borderRadius: '14% / 6.4%',
          background: '#1a1a1a',
          padding: '3.2%',
          boxShadow: `${shadow}, inset 0 0 0 1px rgba(255,255,255,0.04), inset 0 2px 4px rgba(255,255,255,0.06)`,
        }}
      >
        <div
          className="relative w-full h-full overflow-hidden bg-transparent"
          style={{ borderRadius: '9.5% / 4.4%' }}
        >
          {children}

          <div
            aria-hidden
            className="absolute left-1/2 -translate-x-1/2 pointer-events-none flex items-center justify-end"
            style={{
              top: '1.6%',
              width: '32%',
              height: '4%',
              borderRadius: '50px',
              background: '#000',
              zIndex: 30,
              paddingRight: '10%',
            }}
          >
            <span
              className="block rounded-full"
              style={{
                width: '18%',
                height: '52%',
                background: 'radial-gradient(circle at 38% 38%, #243040 0%, #08121c 55%, #000 100%)',
              }}
            />
          </div>
        </div>
      </div>

      <span aria-hidden className="absolute" style={{ left: '-2px', top: '14%', width: '2.5px', height: '3.5%', borderRadius: '2px 0 0 2px', background: '#0f0f0f' }} />
      <span aria-hidden className="absolute" style={{ left: '-2px', top: '21%', width: '2.5px', height: '7%', borderRadius: '2px 0 0 2px', background: '#0f0f0f' }} />
      <span aria-hidden className="absolute" style={{ left: '-2px', top: '30%', width: '2.5px', height: '7%', borderRadius: '2px 0 0 2px', background: '#0f0f0f' }} />
      <span aria-hidden className="absolute" style={{ right: '-2px', top: '24%', width: '2.5px', height: '11%', borderRadius: '0 2px 2px 0', background: '#0f0f0f' }} />
    </div>
  );
}

const SlideItem = memo(function SlideItem({
  slide,
  offset,
  isMobile,
  mockupScale,
  shadowStyle,
  isActive,
}: {
  slide: HeroScreen;
  offset: number;
  isMobile: boolean;
  mockupScale: number;
  shadowStyle: string;
  isActive: boolean;
}) {
  const abs = Math.abs(offset);
  const translateX = offset * (isMobile ? 52 : 60);
  const scale = isActive ? mockupScale : (isMobile ? 0.68 : 0.80) * mockupScale;
  const opacity = abs > 1 ? 0 : isActive ? 1 : 0.52;
  const zIndex = 10 - abs;

  return (
    <div
      className="absolute top-1/2 left-1/2"
      aria-hidden={!isActive}
      style={{
        transform: `translate(-50%, -50%) translateX(${translateX}%) scale(${scale})`,
        opacity,
        zIndex,
        transition: 'transform 500ms cubic-bezier(0.22, 1, 0.36, 1), opacity 500ms ease',
        willChange: abs <= 1 ? 'transform, opacity' : 'auto',
        pointerEvents: isActive ? 'auto' : 'none',
      }}
    >
      <IPhone16ProMax shadow={shadowStyle}>
        <MockupRenderer screenType={slide.screen_type} config={slide.config} scrollY={slide.scroll_y} />
      </IPhone16ProMax>
    </div>
  );
});

export default function HeroPhoneCarousel() {
  const { config, screens, isLoading } = useLandingHeroScreens();
  const slides = screens.length > 0 ? screens : FALLBACK_SLIDES;

  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const isVisible = useRef(true);

  const shadowStyle = getShadowStyle(config.mockup_shadow);
  const interval = config.slide_interval_ms;
  const scale = config.mockup_scale ?? 1;
  const sectionHeight = `clamp(${Math.round(540 * scale)}px, ${Math.round(104 * scale)}vw, ${Math.round(620 * scale)}px)`;

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReducedMotion(mq.matches);
    const handler = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)');
    setIsMobile(mq.matches);
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => { isVisible.current = entry.isIntersecting; },
      { threshold: 0.1 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!config.autoplay || paused || reducedMotion) return;
    const id = window.setInterval(() => {
      if (isVisible.current) {
        startTransition(() => setActive((i) => (i + 1) % slides.length));
      }
    }, interval);
    return () => window.clearInterval(id);
  }, [config.autoplay, paused, reducedMotion, interval, slides.length]);

  const go = useCallback((dir: 1 | -1) => {
    startTransition(() => setActive((i) => (i + dir + slides.length) % slides.length));
  }, [slides.length]);

  // Native passive touch listeners for swipe detection
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    let startX: number | null = null;

    const onTouchStart = (e: TouchEvent) => { startX = e.touches[0].clientX; };
    const onTouchEnd = (e: TouchEvent) => {
      if (startX == null) return;
      const delta = e.changedTouches[0].clientX - startX;
      if (Math.abs(delta) > 40) go(delta < 0 ? 1 : -1);
      startX = null;
    };

    el.addEventListener('touchstart', onTouchStart, { passive: true });
    el.addEventListener('touchend', onTouchEnd, { passive: true });
    return () => {
      el.removeEventListener('touchstart', onTouchStart);
      el.removeEventListener('touchend', onTouchEnd);
    };
  }, [go]);

  if (isLoading) {
    return (
      <div className="relative mx-auto w-full overflow-hidden" style={{ height: sectionHeight }}>
        <div className="flex items-center justify-center h-full">
          <div className="w-[170px] aspect-[393/852] rounded-[14%/6.4%] bg-gray-100 animate-pulse" />
        </div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="relative mx-auto w-full overflow-hidden"
      role="region"
      aria-roledescription="carousel"
      aria-label="Mockups do aplicativo"
      onMouseEnter={() => config.pause_on_hover && setPaused(true)}
      onMouseLeave={() => config.pause_on_hover && setPaused(false)}
    >
      <div
        className="relative flex items-center justify-center"
        style={{ height: sectionHeight }}
      >
        {slides.map((slide, i) => {
          const total = slides.length;
          let offset = i - active;
          if (offset > total / 2) offset -= total;
          if (offset < -total / 2) offset += total;

          return (
            <SlideItem
              key={slide.id}
              slide={slide}
              offset={offset}
              isMobile={isMobile}
              mockupScale={config.mockup_scale}
              shadowStyle={shadowStyle}
              isActive={offset === 0}
            />
          );
        })}
      </div>

      <button
        type="button"
        aria-label="Mockup anterior"
        onClick={() => go(-1)}
        className="hidden md:inline-flex absolute left-0 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-white/90 border items-center justify-center hover:bg-white transition-colors shadow-sm"
      >
        <ChevronLeft size={20} />
      </button>
      <button
        type="button"
        aria-label="Proximo mockup"
        onClick={() => go(1)}
        className="hidden md:inline-flex absolute right-0 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-white/90 border items-center justify-center hover:bg-white transition-colors shadow-sm"
      >
        <ChevronRight size={20} />
      </button>

      <div className="flex items-center justify-center gap-2 mt-8">
        {slides.map((slide, i) => (
          <button
            key={slide.id}
            type="button"
            onClick={() => startTransition(() => setActive(i))}
            aria-label={`Ir para ${slide.label}`}
            aria-current={i === active}
            className="h-1.5 rounded-full transition-all duration-300"
            style={{
              width: i === active ? 28 : 8,
              background: i === active ? '#0a0a0a' : '#d4d4d8',
            }}
          />
        ))}
      </div>
    </div>
  );
}
