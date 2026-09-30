import { Image as ImageIcon } from 'lucide-react';

/**
 * Stands in for a product slot in Ofertas/Novidades/Destaques when the merchant
 * hasn't picked any product for that row yet — same idea as BannerPlaceholder,
 * a flat gray card instead of hiding the whole section, so it's clear where it
 * sits on the page and that it's just waiting to be filled in.
 */
export function ProductCardPlaceholder() {
  return (
    <div className="h-full rounded-xl border overflow-hidden flex flex-col">
      <div className="aspect-square flex items-center justify-center bg-neutral-300">
        <ImageIcon className="h-8 w-8 text-neutral-500" strokeWidth={1.5} />
      </div>
      <div className="p-3 space-y-2">
        <div className="h-3 w-3/4 rounded-full bg-neutral-200" />
        <div className="h-3 w-1/2 rounded-full bg-neutral-200" />
      </div>
    </div>
  );
}
