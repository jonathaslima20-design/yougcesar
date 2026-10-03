import { useStorefrontTheme } from '@/contexts/StorefrontThemeContext';
import { getImageSrcSet, getResizedImageUrl } from '@/lib/imageUrl';
import { cn } from '@/lib/utils';
import BannerLinkWrapper, { hasBannerLink, type BannerLinkContext } from '@/components/storefront-themes/eletronicos/BannerLinkWrapper';
import { BannerPlaceholder } from '@/components/storefront-themes/eletronicos/BannerPlaceholder';

/**
 * "Banner de destaque" — a single wide banner between the product shelves, with a
 * separate image for phones. No rotation. Shows a gray placeholder, not hidden,
 * until the merchant uploads an image (either one is enough — the other falls
 * back to it) — turning the section off (feature_banner_enabled) still hides
 * it, that's a deliberate choice, not "not filled in yet".
 */
export default function FeatureBanner({ linkContext }: { linkContext: BannerLinkContext }) {
  const { appearance } = useStorefrontTheme();
  const desktop = appearance.feature_banner_desktop_url;
  const mobile = appearance.feature_banner_mobile_url;

  if (!appearance.feature_banner_enabled) return null;

  if (!desktop && !mobile) {
    return (
      <section className="container mx-auto px-4 py-8 md:py-6">
        <BannerPlaceholder className="rounded-lg aspect-[4/3] md:aspect-[1290/300]" />
      </section>
    );
  }

  const link = appearance.feature_banner_link_url;
  const clickable = hasBannerLink(link);

  return (
    <section className="container mx-auto px-4 py-8 md:py-6">
      <BannerLinkWrapper
        link={link}
        context={linkContext}
        className={cn(
          'group block overflow-hidden rounded-lg transition-all duration-300 motion-reduce:transition-none',
          'hover:shadow-lg hover:-translate-y-0.5 motion-reduce:hover:translate-y-0',
          clickable && 'cursor-pointer active:translate-y-0 active:scale-[0.995]'
        )}
      >
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
            className="w-full aspect-[4/3] md:aspect-[1290/300] object-cover transition-transform duration-500 ease-out group-hover:scale-[1.03] motion-reduce:transition-none motion-reduce:group-hover:scale-100"
          />
        </picture>
      </BannerLinkWrapper>
    </section>
  );
}
