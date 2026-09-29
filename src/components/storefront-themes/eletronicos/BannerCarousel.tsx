import { useEffect, useRef, useState } from 'react';
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
  const apiRef = useRef<CarouselApi | null>(null);
  const hoveredRef = useRef(false);
  const [selectedIndex, setSelectedIndex] = useState(0);

  useEffect(() => {
    const api = apiRef.current;
    if (!api) return;

    const onSelect = () => setSelectedIndex(api.selectedScrollSnap());
    onSelect();
    api.on('select', onSelect);
    return () => {
      api.off('select', onSelect);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [banners.length]);

  useEffect(() => {
    const api = apiRef.current;
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
  }, [banners.length, appearance.banners_autoplay_seconds]);

  if (loading || banners.length === 0) return null;

  return (
    <div
      className="relative"
      style={{ backgroundColor: appearance.banners_bg_color }}
      onMouseEnter={() => { hoveredRef.current = true; }}
      onMouseLeave={() => { hoveredRef.current = false; }}
    >
      <Carousel setApi={(api) => { apiRef.current = api; }} opts={{ loop: true }}>
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
              onClick={() => apiRef.current?.scrollTo(index)}
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
