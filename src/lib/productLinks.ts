const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * The product part of a store URL: the readable slug when the product has one, otherwise
 * its id. Old links carry the id and keep working (see ProductDetailsPage).
 */
export function productUrlSegment(product: { id: string; slug?: string | null }): string {
  return product.slug || product.id;
}

/** True when a URL segment is an id (UUID) rather than a slug. */
export function isProductIdSegment(segment: string): boolean {
  return UUID_PATTERN.test(segment);
}
