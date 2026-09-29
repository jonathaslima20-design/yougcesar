import { useStorefrontTheme } from '@/contexts/StorefrontThemeContext';
import { getImageSrcSet, getResizedImageUrl } from '@/lib/imageUrl';

/**
 * "Banner de destaque" — a single wide banner between the product shelves, with a
 * separate image for phones. No rotation. Hidden until the merchant uploads an
 * image (either one is enough — the other falls back to it).
 */
export default function FeatureBanner() {
  const { appearance } = useStorefrontTheme();
  const desktop = appearance.feature_banner_desktop_url;
  const mobile = appearance.feature_banner_mobile_url;

  if (!appearance.feature_banner_enabled || (!desktop && !mobile)) return null;

  const image = (
    <picture>
      {mobile && (
        <source media="(max-width: 767px)" srcSet={getImageSrcSet(mobile, [480, 768, 960]) ?? mobile} sizes="100vw" />
      )}
      <img
        src={getResizedImageUrl(desktop || mobile || '', 1440)}
        srcSet={getImageSrcSet(desktop || mobile, [960, 1440, 1920])}
        sizes="(min-width: 1280px) 1248px, 100vw"
        alt=""
        loading="lazy"
        decoding="async"
        className="w-full aspect-[4/3] md:aspect-[1290/300] object-cover rounded-lg"
      />
    </picture>
  );

  return (
    <section className="container mx-auto px-4 py-6">
      {appearance.feature_banner_link_url ? (
        <a href={appearance.feature_banner_link_url} target="_blank" rel="noopener noreferrer" className="block">
          {image}
        </a>
      ) : (
        image
      )}
    </section>
  );
}
