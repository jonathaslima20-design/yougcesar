import { useStorefrontBenefits } from '@/hooks/useStorefrontBenefits';
import { DEFAULT_BENEFITS, getBenefitIcon } from '@/lib/storefrontBenefitsDefaults';
import { useStorefrontTheme } from '@/contexts/StorefrontThemeContext';

interface BenefitsBarProps {
  userId: string;
}

export default function BenefitsBar({ userId }: BenefitsBarProps) {
  const { appearance } = useStorefrontTheme();
  const { benefits, loading } = useStorefrontBenefits(userId);

  if (loading || !appearance.benefits_bar_enabled) return null;

  // Zero rows means this store has never opened "Personalizar Eletrônicos" for
  // this section yet — fall back to the same 5 items it always showed. Once a
  // row exists, only active ones render (a store can intentionally end up with 0).
  const items = benefits.length === 0
    ? DEFAULT_BENEFITS
    : benefits.filter((b) => b.is_active);

  if (items.length === 0) return null;

  return (
    <div className="border-b" style={{ backgroundColor: appearance.benefits_bg_color, color: appearance.benefits_text_color }}>
      <div className="container mx-auto px-4 py-2.5 sm:py-6">
        {/* Phones: one swipeable row, each item as icon + text side by side, so the bar
            is one line tall (it was a stacked item block that took ~100px of the first
            screen). Tablet: grid. Desktop: flex + centered, so a store with fewer than
            5 items sits centered instead of packed left. */}
        <div className="flex gap-4 overflow-x-auto snap-x pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:grid sm:grid-cols-3 sm:gap-6 sm:overflow-visible sm:pb-0 lg:flex lg:flex-wrap lg:justify-center lg:gap-x-12 lg:gap-y-6">
          {items.map((item, index) => {
            const Icon = getBenefitIcon(item.icon);
            return (
              <div key={'id' in item ? String(item.id) : index} className="flex items-center text-left gap-2.5 shrink-0 w-56 snap-start sm:flex-col sm:text-center sm:gap-2 sm:w-auto lg:w-28">
                <Icon className="h-5 w-5 shrink-0 sm:h-6 sm:w-6" strokeWidth={1.5} />
                <div>
                  <p className="text-sm font-semibold">{item.title}</p>
                  <p className="text-xs opacity-70">{item.subtitle}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
