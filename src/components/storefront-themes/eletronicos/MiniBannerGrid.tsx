import { useStorefrontMiniBanners } from '@/hooks/useStorefrontMiniBanners';
import { useStorefrontTheme } from '@/contexts/StorefrontThemeContext';
import { getImageSrcSet, getResizedImageUrl } from '@/lib/imageUrl';
import { cn } from '@/lib/utils';
import BannerLinkWrapper, { hasBannerLink, type BannerLinkContext } from '@/components/storefront-themes/eletronicos/BannerLinkWrapper';

interface MiniBannerGridProps {
  userId: string;
  linkContext: BannerLinkContext;
}

export default function MiniBannerGrid({ userId, linkContext }: MiniBannerGridProps) {
  const { appearance } = useStorefrontTheme();
  const { banners, loading } = useStorefrontMiniBanners(userId, { activeOnly: true });

  if (loading || !appearance.mini_banners_enabled || banners.length === 0) return null;

  return (
    <div style={{ backgroundColor: appearance.mini_banners_bg_color }}>
      <div className="container mx-auto px-4 py-6">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {banners.map((banner) => {
            const clickable = hasBannerLink(banner.link_url);
            return (
              <BannerLinkWrapper
                key={banner.id}
                link={banner.link_url}
                context={linkContext}
                className={cn(
                  'group block overflow-hidden transition-all duration-300 motion-reduce:transition-none',
                  'hover:shadow-lg hover:-translate-y-0.5 motion-reduce:hover:translate-y-0',
                  clickable && 'cursor-pointer active:translate-y-0 active:scale-[0.99]'
                )}
              >
                <img
                  src={getResizedImageUrl(banner.image_url, 640)}
                  srcSet={getImageSrcSet(banner.image_url, [320, 640, 960])}
                  sizes="(min-width: 640px) 33vw, 100vw"
                  alt=""
                  loading="lazy"
                  decoding="async"
                  className="w-full aspect-[416/480] object-cover transition-transform duration-500 ease-out group-hover:scale-105 motion-reduce:transition-none motion-reduce:group-hover:scale-100"
                />
              </BannerLinkWrapper>
            );
          })}
        </div>
      </div>
    </div>
  );
}
