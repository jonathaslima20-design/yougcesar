import { useEffect, useRef, useState } from 'react';
import { useStorefrontBanners } from '@/hooks/useStorefrontBanners';
import { useStorefrontTheme } from '@/contexts/StorefrontThemeContext';
import { cn } from '@/lib/utils';
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  type CarouselApi,
} from '@/components/ui/carousel';

interface BannerCarouselProps {
  userId: string;
}

export default function BannerCarousel({ userId }: BannerCarouselProps) {
  const { appearance } = useStorefrontTheme();
  const { banners, loading } = useStorefrontBanners(userId, { activeOnly: true });
  const apiRef = useRef<CarouselApi | null>(null);
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
    <div className="relative" style={{ backgroundColor: appearance.banners_bg_color }}>
      <Carousel setApi={(api) => { apiRef.current = api; }} opts={{ loop: true }}>
        <CarouselContent>
          {banners.map((banner) => {
            const content = (
              <picture>
                <source media="(max-width: 767px)" srcSet={banner.image_url_mobile} />
                <img
                  src={banner.image_url_desktop || banner.image_url_mobile}
                  alt=""
                  loading="lazy"
                  className="w-full aspect-[1920/650] object-cover"
                />
              </picture>
            );
            return (
              <CarouselItem key={banner.id}>
                {banner.link_url ? (
                  <a href={banner.link_url} target="_blank" rel="noopener noreferrer" className="block">
                    {content}
                  </a>
                ) : content}
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
