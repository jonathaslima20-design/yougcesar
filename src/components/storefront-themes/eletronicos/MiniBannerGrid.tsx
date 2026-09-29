import { useStorefrontMiniBanners } from '@/hooks/useStorefrontMiniBanners';
import { useStorefrontTheme } from '@/contexts/StorefrontThemeContext';
import { getImageSrcSet, getResizedImageUrl } from '@/lib/imageUrl';

interface MiniBannerGridProps {
  userId: string;
}

export default function MiniBannerGrid({ userId }: MiniBannerGridProps) {
  const { appearance } = useStorefrontTheme();
  const { banners, loading } = useStorefrontMiniBanners(userId, { activeOnly: true });

  if (loading || !appearance.mini_banners_enabled || banners.length === 0) return null;

  return (
    <div style={{ backgroundColor: appearance.mini_banners_bg_color }}>
      <div className="container mx-auto px-4 py-6">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {banners.map((banner) => {
          const content = (
            <img
              src={getResizedImageUrl(banner.image_url, 640)}
              srcSet={getImageSrcSet(banner.image_url, [320, 640, 960])}
              sizes="(min-width: 640px) 33vw, 100vw"
              alt=""
              loading="lazy"
              decoding="async"
              className="w-full aspect-[416/480] object-cover"
            />
          );
          return banner.link_url ? (
            <a key={banner.id} href={banner.link_url} target="_blank" rel="noopener noreferrer" className="block">
              {content}
            </a>
          ) : (
            <div key={banner.id}>{content}</div>
          );
        })}
        </div>
      </div>
    </div>
  );
}
