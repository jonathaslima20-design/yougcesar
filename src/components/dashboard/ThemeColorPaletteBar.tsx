import { Copy } from 'lucide-react';
import { toast } from 'sonner';
import { getUsedThemeColors, type StorefrontAppearance } from '@/lib/appearanceDefaults';

function copyHex(hex: string) {
  navigator.clipboard.writeText(hex);
  toast.success(`${hex.toUpperCase()} copiado`);
}

/**
 * Quick-reference strip shown above the Eletrônicos customization tabs: every
 * color already applied somewhere in the theme, one click away from being
 * copied. Solves the risk of eyeballing a new color for a section when it
 * should match one already used elsewhere — the same swatch is also offered
 * as a quick-pick inside every individual color popover.
 */
export function ThemeColorPaletteBar({ appearance }: { appearance: StorefrontAppearance }) {
  const usedColors = getUsedThemeColors(appearance);

  if (usedColors.length === 0) return null;

  return (
    <div className="rounded-lg border bg-muted/20 p-3">
      <p className="mb-1.5 text-xs font-medium text-muted-foreground">
        Cores em uso neste tema — clique para copiar o código e usar em outra seção
      </p>
      <div className="flex flex-wrap gap-1.5">
        {usedColors.map((hex) => (
          <button
            key={hex}
            type="button"
            title={`Copiar ${hex.toUpperCase()}`}
            onClick={() => copyHex(hex)}
            className="group relative h-7 w-7 shrink-0 rounded-full border border-border shadow-sm transition-transform hover:scale-110"
            style={{ backgroundColor: hex }}
          >
            <Copy className="absolute inset-0 m-auto h-3 w-3 text-white opacity-0 mix-blend-difference transition-opacity group-hover:opacity-100" />
          </button>
        ))}
      </div>
    </div>
  );
}
