import { useStorefrontTheme } from '@/contexts/StorefrontThemeContext';

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
      {mobile && <source media="(max-width: 767px)" srcSet={mobile} />}
      <img
        src={desktop || mobile || ''}
        alt=""
        loading="lazy"
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
