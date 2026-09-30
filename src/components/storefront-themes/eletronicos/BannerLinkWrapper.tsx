import { Link } from 'react-router-dom';
import { useCustomDomain } from '@/contexts/CustomDomainContext';
import { parseBannerLink } from '@/lib/bannerLink';
import type { StorefrontPageBodyProps } from '@/components/storefront-themes/types';

/** What a banner needs to send the shopper to a category or a product page. */
export interface BannerLinkContext {
  slug: string;
  filters: StorefrontPageBodyProps['filters'];
  onFiltersChange: StorefrontPageBodyProps['onFiltersChange'];
}

interface BannerLinkWrapperProps {
  /** The stored `link_url` (see lib/bannerLink.ts). */
  link: string | null | undefined;
  context: BannerLinkContext;
  className?: string;
  style?: React.CSSProperties;
  children: React.ReactNode;
}

/**
 * Wraps a banner in the right kind of clickable element: external link, "show this
 * category" (a button — no navigation, it filters the store like the category menu does)
 * or a link to a product page. Without a link it renders a plain block.
 */
export default function BannerLinkWrapper({ link, context, className, style, children }: BannerLinkWrapperProps) {
  const { isCustomDomain } = useCustomDomain();
  const parsed = parseBannerLink(link);

  if (parsed.type === 'url') {
    return (
      <a href={parsed.value} target="_blank" rel="noopener noreferrer" className={className} style={style}>
        {children}
      </a>
    );
  }

  if (parsed.type === 'category') {
    return (
      <button
        type="button"
        onClick={() => context.onFiltersChange({ ...context.filters, category: parsed.value })}
        className={`${className ?? ''} w-full text-left`}
        style={style}
      >
        {children}
      </button>
    );
  }

  if (parsed.type === 'product') {
    const to = isCustomDomain ? `/produtos/${parsed.value}` : `/${context.slug}/produtos/${parsed.value}`;
    return (
      <Link to={to} className={className} style={style}>
        {children}
      </Link>
    );
  }

  return <div className={className} style={style}>{children}</div>;
}

export function hasBannerLink(link: string | null | undefined): boolean {
  return parseBannerLink(link).type !== 'none';
}
