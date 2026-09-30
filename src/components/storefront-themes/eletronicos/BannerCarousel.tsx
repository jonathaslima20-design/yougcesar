import { useEffect, useRef, useState } from 'react';
import { Image as ImageIcon } from 'lucide-react';
import { useStorefrontBanners } from '@/hooks/useStorefrontBanners';
import { useStorefrontTheme } from '@/contexts/StorefrontThemeContext';
import { cn } from '@/lib/utils';
import { getImageSrcSet, getResizedImageUrl } from '@/lib/imageUrl';
import BannerLinkWrapper, { hasBannerLink, type BannerLinkContext } from '@/components/storefront-themes/eletronicos/BannerLinkWrapper';
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  type CarouselApi,
} from '@/components/ui/carousel';

interface BannerCarouselProps {
  userId: string;
  linkContext: BannerLinkContext;
}

export default function BannerCarousel({ userId, linkContext }: BannerCarouselProps) {
  const { appearance } = useStorefrontTheme();
  const { banners, loading } = useStorefrontBanners(userId, { activeOnly: true });
  // A plain ref here used to be read once, synchronously, the moment each effect below
  // was set up — but embla's api isn't ready on that very first pass (it becomes
  // available a render later), so both the autoplay timer and the dot highlighting
  // silently never activated. State instead, so the effects that need it re-run once
  // it's actually there.
  const [api, setApi] = useState<CarouselApi | null>(null);
  const hoveredRef = useRef(false);
  const [selectedIndex, setSelectedIndex] = useState(0);

  useEffect(() => {
    if (!api) return;
    const onSelect = () => setSelectedIndex(api.selectedScrollSnap());
    onSelect();
    api.on('select', onSelect);
    return () => {
      api.off('select', onSelect);
    };
  }, [api]);

  useEffect(() => {
    const intervalMs = (appearance.banners_autoplay_seconds ?? 5) * 1000;
    if (!api || banners.length <= 1 || intervalMs <= 0) return;

    const interval = setInterval(() => {
      // Don't yank the banner away while the shopper is looking at it.
      if (hoveredRef.current) return;
      if (api.canScrollNext()) {
        api.scrollNext();
      } else {
        api.scrollTo(0);
      }
    }, intervalMs);

    return () => clearInterval(interval);
  }, [api, banners.length, appearance.banners_autoplay_seconds]);

  if (loading) return null;

  // No banner uploaded yet — a plain placeholder block, same size the real
  // carousel would take, instead of hiding the section entirely. Lets a
  // merchant see where it sits on the page before they've added one, and
  // shows on the live storefront (not just the dashboard) so it's visible
  // from the same place they'll eventually check their actual banners.
  if (banners.length === 0) {
    return (
      <div
        className="flex w-full aspect-[960/425] md:aspect-[1920/650] items-center justify-center"
        style={{ backgroundColor: appearance.banners_bg_color, color: appearance.banners_text_color }}
      >
        <ImageIcon className="h-10 w-10 md:h-14 md:w-14 opacity-20" />
      </div>
    );
  }

  return (
    <div
      className="relative"
      style={{ backgroundColor: appearance.banners_bg_color }}
      onMouseEnter={() => { hoveredRef.current = true; }}
      onMouseLeave={() => { hoveredRef.current = false; }}
    >
      <Carousel setApi={setApi} opts={{ loop: true }}>
        <CarouselContent>
          {banners.map((banner, index) => {
            const desktopUrl = banner.image_url_desktop || banner.image_url_mobile;
            const clickable = hasBannerLink(banner.link_url);
            const content = (
              <picture>
                <source
                  media="(max-width: 767px)"
                  srcSet={getImageSrcSet(banner.image_url_mobile, [480, 768, 960]) ?? banner.image_url_mobile}
                  sizes="100vw"
                />
                <img
                  src={getResizedImageUrl(desktopUrl, 1440)}
                  srcSet={getImageSrcSet(desktopUrl, [960, 1440, 1920])}
                  sizes="100vw"
                  alt=""
                  // The first banner is the page's largest image: load it right away and
                  // at high priority. The rest of the carousel can wait.
                  loading={index === 0 ? 'eager' : 'lazy'}
                  fetchPriority={index === 0 ? 'high' : undefined}
                  decoding="async"
                  // Phones show the 960x425 image, desktops the 1920x650 one — each in a box
                  // with its own ratio so neither gets cropped by `object-cover`.
                  className={cn(
                    'w-full object-cover aspect-[960/425] md:aspect-[1920/650]',
                    'transition-transform duration-700 ease-out motion-reduce:transition-none',
                    'group-hover:scale-[1.03] motion-reduce:group-hover:scale-100'
                  )}
                />
              </picture>
            );
            return (
              <CarouselItem key={banner.id}>
                <BannerLinkWrapper
                  link={banner.link_url}
                  context={linkContext}
                  className={cn(
                    'group block overflow-hidden',
                    clickable && 'cursor-pointer active:brightness-95 transition-[filter] duration-150'
                  )}
                >
                  {content}
                </BannerLinkWrapper>
              </CarouselItem>
            );
          })}
        </CarouselContent>
      </Carousel>

      {banners.length > 1 && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2">
          {banners.map((banner, index) => (
            <button
              key={banner.id}
              type="button"
              aria-label={`Ir para o banner ${index + 1}`}
              onClick={() => api?.scrollTo(index)}
              className={cn(
                'rounded-full transition-all',
                index === selectedIndex
                  ? 'h-2.5 w-2.5 border-2 border-white'
                  : 'h-2.5 w-2.5 bg-white/70 hover:bg-white'
              )}
            />
          ))}
        </div>
      )}
    </div>
  );
}
