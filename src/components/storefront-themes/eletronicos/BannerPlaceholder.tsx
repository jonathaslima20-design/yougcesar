import { Image as ImageIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Stands in for an empty banner/mini-banner/feature-banner slot — a plain gray
 * block instead of hiding the section, so a merchant can see where it sits on
 * the page before uploading anything. Deliberately ignores the theme's own
 * background color: it needs to read as "empty placeholder", not as a banner
 * that happens to be blank, so it stays a flat gray regardless of what the
 * merchant picked for that section's colors.
 */
export function BannerPlaceholder({ className }: { className?: string }) {
  return (
    <div className={cn('flex items-center justify-center bg-neutral-300', className)}>
      <ImageIcon className="h-8 w-8 md:h-10 md:w-10 text-neutral-500" strokeWidth={1.5} />
    </div>
  );
}
