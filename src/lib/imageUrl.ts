/**
 * Responsive image URLs for files stored in Supabase Storage.
 *
 * Supabase can resize on the fly through `/storage/v1/render/image/public/...` (same
 * path as `/object/public/...`, plus `width`/`quality`), so every already-uploaded
 * photo gets smaller variants without migrating anything. Anything that isn't a
 * public Supabase Storage image (external URLs, blobs, gifs, svgs) is returned as-is.
 */

const OBJECT_PATH = '/storage/v1/object/public/';
const RENDER_PATH = '/storage/v1/render/image/public/';
const SKIP_EXTENSIONS = /\.(svg|gif)(\?|$)/i;

export function isTransformableImage(url: string | null | undefined): url is string {
  if (!url) return false;
  return url.includes(OBJECT_PATH) && !SKIP_EXTENSIONS.test(url);
}

/** A copy of `url` resized to `width` px (aspect ratio kept). Non-Supabase URLs pass through. */
export function getResizedImageUrl(url: string, width: number, quality = 78): string {
  if (!isTransformableImage(url)) return url;
  const base = url.split('?')[0].replace(OBJECT_PATH, RENDER_PATH);
  // resize=contain is essential: with only a width, Supabase's default ("cover") crops
  // the image to a strip of the original height instead of scaling it proportionally.
  return `${base}?width=${Math.round(width)}&quality=${quality}&resize=contain`;
}

/** `srcset` string with one entry per width, or undefined when the URL can't be resized. */
export function getImageSrcSet(url: string | null | undefined, widths: number[], quality = 78): string | undefined {
  if (!isTransformableImage(url)) return undefined;
  return widths.map((w) => `${getResizedImageUrl(url, w, quality)} ${w}w`).join(', ');
}
