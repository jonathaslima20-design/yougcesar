/**
 * Where a banner sends the shopper. Stored in the banners' existing `link_url` text
 * column so no schema change is needed and every URL already saved keeps working:
 *
 *   https://...            -> external link (anything that isn't one of the prefixes below)
 *   category:<name>        -> filters the store by that category
 *   product:<product id>   -> opens that product's page
 */
export type BannerLinkType = 'none' | 'url' | 'category' | 'product';

export interface BannerLink {
  type: BannerLinkType;
  value: string;
}

const CATEGORY_PREFIX = 'category:';
const PRODUCT_PREFIX = 'product:';

export function parseBannerLink(raw: string | null | undefined): BannerLink {
  const text = (raw || '').trim();
  if (!text) return { type: 'none', value: '' };
  if (text.startsWith(CATEGORY_PREFIX)) return { type: 'category', value: text.slice(CATEGORY_PREFIX.length) };
  if (text.startsWith(PRODUCT_PREFIX)) return { type: 'product', value: text.slice(PRODUCT_PREFIX.length) };
  return { type: 'url', value: text };
}

/** The string to store in `link_url`, or null when there's no link. */
export function serializeBannerLink(link: BannerLink): string | null {
  const value = link.value.trim();
  if (link.type === 'none' || !value) return null;
  if (link.type === 'category') return `${CATEGORY_PREFIX}${value}`;
  if (link.type === 'product') return `${PRODUCT_PREFIX}${value}`;
  return value;
}
