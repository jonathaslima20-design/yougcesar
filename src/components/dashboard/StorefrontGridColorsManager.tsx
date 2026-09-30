import { useEffect, useState } from 'react';
import { RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/contexts/AuthContext';
import { useStorefrontAppearance } from '@/hooks/useStorefrontAppearance';
import { getUsedThemeColors, type StorefrontAppearance } from '@/lib/appearanceDefaults';
import { ColorSwatchField } from '@/components/dashboard/ThemeSection';

type GridColorField =
  | 'grid_card_bg_color'
  | 'grid_card_border_color'
  | 'grid_title_color'
  | 'grid_price_color'
  | 'grid_button_bg_color'
  | 'grid_button_text_color'
  | 'grid_badge_bg_color'
  | 'grid_section_bg_color';

// `fallback` is only what the swatch shows while nothing is set: it mirrors the card's
// current look, which is what stays on the storefront until a color is picked.
const GRID_COLORS: { field: GridColorField; label: string; hint: string; fallback: string }[] = [
  { field: 'grid_card_bg_color', label: 'Fundo do card', hint: 'A caixa de cada produto.', fallback: '#f8fafc' },
  { field: 'grid_card_border_color', label: 'Borda do card', hint: 'O contorno da caixa.', fallback: '#e4e4e7' },
  { field: 'grid_title_color', label: 'Nome do produto', hint: 'Texto do título.', fallback: '#0a0a0a' },
  { field: 'grid_price_color', label: 'Preço', hint: 'O valor do produto.', fallback: '#0a0a0a' },
  { field: 'grid_button_bg_color', label: 'Botão "Adicionar" (fundo)', hint: 'Cor do botão de comprar.', fallback: '#0a0a0a' },
  { field: 'grid_button_text_color', label: 'Botão "Adicionar" (texto)', hint: 'Cor do texto e do ícone do botão.', fallback: '#ffffff' },
  { field: 'grid_badge_bg_color', label: 'Selo de desconto', hint: 'O "-20%" no canto da foto.', fallback: '#16a34a' },
  { field: 'grid_section_bg_color', label: 'Fundo da área de produtos', hint: 'Atrás da lista de produtos, ao filtrar por categoria.', fallback: '#ffffff' },
];

function ColorRow({
  label,
  hint,
  value,
  fallback,
  palette,
  onCommit,
}: {
  label: string;
  hint: string;
  value: string | null;
  fallback: string;
  palette: string[];
  onCommit: (value: string | null) => void;
}) {
  const [local, setLocal] = useState(value || fallback);

  // Follow the stored value when it changes from outside (reset, reload).
  useEffect(() => setLocal(value || fallback), [value, fallback]);

  return (
    <div className="flex items-center gap-3 rounded-lg border p-3">
      <ColorSwatchField
        value={local}
        label={label}
        palette={palette}
        onCommit={(next) => {
          setLocal(next);
          onCommit(next);
        }}
      />
      <div className="flex-1 min-w-0">
        <Label className="text-sm font-medium">{label}</Label>
        <p className="text-xs text-muted-foreground">{value ? value.toUpperCase() : 'Padrão do tema'} · {hint}</p>
      </div>
      {value && (
        <Button type="button" variant="ghost" size="sm" onClick={() => onCommit(null)} title="Voltar à cor padrão">
          <RotateCcw className="mr-1.5 h-3.5 w-3.5" /> Padrão
        </Button>
      )}
    </div>
  );
}

/**
 * Colors for the product cards shown in the theme's grids (Ofertas, Novidades e a
 * category/search listing). Every color is optional: leave it on "Padrão do tema" and the
 * card keeps its current look.
 */
export function StorefrontGridColorsManager() {
  const { user } = useAuth();
  const { appearance, loading, save } = useStorefrontAppearance(user?.id, 'eletronicos');

  if (loading) return null;

  const palette = getUsedThemeColors(appearance);
  const commit = (field: GridColorField) => (value: string | null) =>
    save({ [field]: value } as Partial<StorefrontAppearance>);
  const hasAny = GRID_COLORS.some(({ field }) => !!appearance[field]);

  return (
    <div className="space-y-2">
      {GRID_COLORS.map(({ field, label, hint, fallback }) => (
        <ColorRow
          key={field}
          label={label}
          hint={hint}
          value={appearance[field]}
          fallback={fallback}
          palette={palette}
          onCommit={commit(field)}
        />
      ))}
      {hasAny && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="mt-2"
          onClick={() => save(Object.fromEntries(GRID_COLORS.map(({ field }) => [field, null])) as Partial<StorefrontAppearance>)}
        >
          <RotateCcw className="mr-1.5 h-3.5 w-3.5" /> Restaurar todas as cores padrão
        </Button>
      )}
    </div>
  );
}
