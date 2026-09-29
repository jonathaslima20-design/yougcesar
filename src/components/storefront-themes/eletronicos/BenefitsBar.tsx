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
      <div className="container mx-auto px-4 py-6">
        {/* Mobile/tablet: grid so items wrap into rows. Desktop: flex + centered,
            so a store with fewer than 5 items sits centered instead of packed left. */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-6 lg:flex lg:flex-wrap lg:justify-center lg:gap-x-12 lg:gap-y-6">
          {items.map((item, index) => {
            const Icon = getBenefitIcon(item.icon);
            return (
              <div key={'id' in item ? item.id : index} className="flex flex-col items-center text-center gap-2 lg:w-28">
                <Icon className="h-6 w-6" strokeWidth={1.5} />
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
