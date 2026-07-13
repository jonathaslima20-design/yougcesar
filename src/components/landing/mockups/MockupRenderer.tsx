import { useRef, useState, useEffect } from 'react';
import { MockupStorefront } from './MockupStorefront';
import { MockupProductDetail } from './MockupProductDetail';
import { MockupDashboard } from './MockupDashboard';
import { MockupMyProducts } from './MockupMyProducts';
import { MockupCustom } from './MockupCustom';
import { getMaxScrollForScreenType } from './mockupScrollUtils';

export const REAL_WIDTH = 393;
export const REAL_HEIGHT = 852;
export const STATUS_BAR_HEIGHT = 54;
export const BROWSER_BAR_HEIGHT = 52;
export const CHROME_HEIGHT = STATUS_BAR_HEIGHT + BROWSER_BAR_HEIGHT;
export const CONTENT_HEIGHT = REAL_HEIGHT - CHROME_HEIGHT;

interface MockupRendererProps {
  screenType: string;
  config: Record<string, any>;
  scrollY?: number;
}

export function MockupRenderer({ screenType, config, scrollY = 0 }: MockupRendererProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.5);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const width = entry.contentRect.width;
        if (width > 0) {
          setScale(width / REAL_WIDTH);
        }
      }
    });

    observer.observe(el);
    const width = el.clientWidth;
    if (width > 0) setScale(width / REAL_WIDTH);

    return () => observer.disconnect();
  }, []);

  const maxScroll = getMaxScrollForScreenType(screenType, config);

  return (
    <div ref={containerRef} className="w-full h-full relative overflow-hidden">
      <div
        className="absolute top-0 left-0 origin-top-left"
        style={{
          width: REAL_WIDTH,
          height: REAL_HEIGHT,
          transform: `scale(${scale})`,
        }}
      >
        <StatusBar clockTime={config.clock_time} />
        <BrowserBar screenType={screenType} config={config} />

        <div
          className="absolute left-0 right-0 bottom-0 overflow-hidden"
          style={{ top: CHROME_HEIGHT }}
        >
          <div
            style={{
              transform: `translateY(-${scrollY}px)`,
              transition: 'transform 150ms ease-out',
            }}
          >
            <ScreenContent screenType={screenType} config={config} />
          </div>

          {maxScroll > 0 && (
            <MockupScrollIndicator scrollY={scrollY} maxScroll={maxScroll} />
          )}
        </div>
      </div>
    </div>
  );
}

function MockupScrollIndicator({ scrollY, maxScroll }: { scrollY: number; maxScroll: number }) {
  const trackHeight = CONTENT_HEIGHT - 16;
  const totalContentHeight = CONTENT_HEIGHT + maxScroll;
  const thumbHeight = Math.max(30, (CONTENT_HEIGHT / totalContentHeight) * trackHeight);
  const thumbTop = maxScroll > 0
    ? (scrollY / maxScroll) * (trackHeight - thumbHeight)
    : 0;

  return (
    <div
      className="absolute right-[3px] pointer-events-none"
      style={{ top: 8, height: trackHeight, width: 4 }}
    >
      <div
        className="absolute w-full rounded-full bg-gray-400/40"
        style={{
          height: thumbHeight,
          top: thumbTop,
          transition: 'top 150ms ease-out',
        }}
      />
    </div>
  );
}

function StatusBar({ clockTime = '9:41' }: { clockTime?: string }) {
  return (
    <div
      className="absolute top-0 left-0 right-0"
      style={{ height: STATUS_BAR_HEIGHT, background: '#111' }}
    >
      {/* Dynamic Island */}
      <div
        className="absolute left-1/2 -translate-x-1/2 bg-black rounded-full"
        style={{ top: 12, width: 120, height: 34 }}
      />

      {/* Left: time */}
      <span
        className="absolute text-[15px] font-semibold tracking-tight"
        style={{ left: 28, bottom: 10, color: '#fff' }}
      >
        {clockTime || '9:41'}
      </span>

      {/* Right indicators */}
      <div
        className="absolute flex items-center gap-[6px]"
        style={{ right: 28, bottom: 10 }}
      >
        {/* Signal bars */}
        <svg width="17" height="12" viewBox="0 0 17 12" fill="none">
          <rect x="0" y="7.5" width="3" height="4.5" rx="0.8" fill="#fff" />
          <rect x="4.5" y="5" width="3" height="7" rx="0.8" fill="#fff" />
          <rect x="9" y="2.5" width="3" height="9.5" rx="0.8" fill="#fff" />
          <rect x="13.5" y="0" width="3" height="12" rx="0.8" fill="#fff" />
        </svg>

        {/* WiFi */}
        <svg width="16" height="12" viewBox="0 0 16 12" fill="none">
          <circle cx="8" cy="11" r="1.4" fill="#fff" />
          <path d="M4.6 8.4a4.8 4.8 0 016.8 0" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" fill="none" />
          <path d="M2 5.8a8.2 8.2 0 0112 0" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" fill="none" />
          <path d="M0 3a11.5 11.5 0 0116 0" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" fill="none" />
        </svg>

        {/* Battery */}
        <svg width="28" height="13" viewBox="0 0 28 13" fill="none">
          <rect x="0.5" y="0.5" width="23" height="12" rx="3.5" stroke="#fff" strokeWidth="1" opacity="0.5" />
          <rect x="2" y="2" width="19" height="9" rx="2" fill="#fff" />
          <path d="M25 4v5a2.5 2.5 0 000-5z" fill="#fff" opacity="0.5" />
        </svg>
      </div>
    </div>
  );
}

function BrowserBar({ screenType, config }: MockupRendererProps) {
  const url = getBrowserUrl(screenType, config);

  return (
    <div
      className="absolute left-0 right-0 border-b"
      style={{ top: STATUS_BAR_HEIGHT, height: BROWSER_BAR_HEIGHT, background: '#111', borderColor: 'rgba(255,255,255,0.1)' }}
    >
      {/* Main row: back/forward + address pill + share/tabs */}
      <div className="flex items-center px-4 gap-2" style={{ height: BROWSER_BAR_HEIGHT }}>

        {/* Back button */}
        <button className="flex items-center justify-center w-8 h-8 shrink-0">
          <svg width="11" height="18" viewBox="0 0 11 18" fill="none">
            <path d="M9.5 1.5L2 9l7.5 7.5" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>

        {/* Forward button (dimmed) */}
        <button className="flex items-center justify-center w-6 h-8 shrink-0 opacity-30">
          <svg width="11" height="18" viewBox="0 0 11 18" fill="none">
            <path d="M1.5 1.5L9 9l-7.5 7.5" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>

        {/* Address pill */}
        <div className="flex-1 flex items-center gap-[6px] rounded-[10px] px-3 h-[36px] min-w-0" style={{ background: 'rgba(255,255,255,0.12)' }}>
          {/* Lock */}
          <svg width="11" height="13" viewBox="0 0 11 13" fill="none" className="shrink-0">
            <rect x="0.5" y="5" width="10" height="7.5" rx="2" stroke="rgba(255,255,255,0.6)" strokeWidth="1.1" />
            <path d="M2.5 5V3.5a3 3 0 016 0V5" stroke="rgba(255,255,255,0.6)" strokeWidth="1.1" fill="none" />
          </svg>
          <span className="text-[12.5px] truncate font-normal" style={{ color: 'rgba(255,255,255,0.85)' }}>{url}</span>
        </div>

        {/* Share button */}
        <button className="flex items-center justify-center w-8 h-8 shrink-0">
          <svg width="16" height="18" viewBox="0 0 16 18" fill="none">
            <path d="M8 1v11M4 4.5L8 1l4 3.5" stroke="#fff" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M1 10v5.5A1.5 1.5 0 002.5 17h11a1.5 1.5 0 001.5-1.5V10" stroke="#fff" strokeWidth="1.9" strokeLinecap="round" />
          </svg>
        </button>

        {/* Tabs button */}
        <button className="flex items-center justify-center w-8 h-8 shrink-0">
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
            <rect x="4.5" y="1" width="12.5" height="12.5" rx="3" stroke="#fff" strokeWidth="1.9" />
            <rect x="1" y="4.5" width="12.5" height="12.5" rx="3" fill="#111" stroke="#fff" strokeWidth="1.9" />
            <text x="7.25" y="13.5" fontSize="7" fontWeight="600" fill="#fff" fontFamily="system-ui">2</text>
          </svg>
        </button>
      </div>
    </div>
  );
}

function getBrowserUrl(screenType: string, config: Record<string, any>): string {
  if (config.custom_url && config.custom_url.trim()) return config.custom_url.trim();

  switch (screenType) {
    case 'storefront':
      return `vitrine.app/${(config.store_name || 'loja').toLowerCase().replace(/\s+/g, '')}`;
    case 'product_detail':
      return `vitrine.app/produto/${(config.product_title || 'item').toLowerCase().replace(/\s+/g, '-').slice(0, 20)}`;
    case 'dashboard':
      return 'vitrine.app/dashboard';
    case 'my_products':
      return 'vitrine.app/dashboard/produtos';
    default:
      return 'vitrine.app';
  }
}

function ScreenContent({ screenType, config }: MockupRendererProps) {
  switch (screenType) {
    case 'storefront':
      return <MockupStorefront config={config} />;
    case 'product_detail':
      return <MockupProductDetail config={config} />;
    case 'dashboard':
      return <MockupDashboard config={config} />;
    case 'my_products':
      return <MockupMyProducts config={config} />;
    case 'custom':
      return <MockupCustom config={config} />;
    default:
      return <MockupCustom config={config} />;
  }
}
