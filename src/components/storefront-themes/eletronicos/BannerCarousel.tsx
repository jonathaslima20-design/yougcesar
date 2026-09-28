import { useEffect, useRef } from 'react';
import { useStorefrontBanners } from '@/hooks/useStorefrontBanners';
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
  type CarouselApi,
} from '@/components/ui/carousel';

const AUTOPLAY_INTERVAL_MS = 5000;

interface BannerCarouselProps {
  userId: string;
}

export default function BannerCarousel({ userId }: BannerCarouselProps) {
  const { banners, loading } = useStorefrontBanners(userId, { activeOnly: true });
  const apiRef = useRef<CarouselApi | null>(null);

  useEffect(() => {
    const api = apiRef.current;
    if (!api || banners.length <= 1) return;

    const interval = setInterval(() => {
      if (api.canScrollNext()) {
        api.scrollNext();
      } else {
        api.scrollTo(0);
      }
    }, AUTOPLAY_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [banners.length]);

  if (loading || banners.length === 0) return null;

  return (
    <div className="container mx-auto px-4 mt-4">
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
                  className="w-full h-auto rounded-lg object-cover"
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
        {banners.length > 1 && (
          <>
            <CarouselPrevious />
            <CarouselNext />
          </>
        )}
      </Carousel>
    </div>
  );
}
