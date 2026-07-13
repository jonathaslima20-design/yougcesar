import { Plus, Trash2, Scale } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { CurrencyInput } from '@/components/ui/currency-input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { WeightVariant, WeightUnitType } from '@/types';

interface ProductWeightVariantsManagerProps {
  enabled: boolean;
  onEnabledChange: (enabled: boolean) => void;
  variants: WeightVariant[];
  onChange: (variants: WeightVariant[]) => void;
}

const UNIT_OPTIONS: { value: WeightUnitType; label: string }[] = [
  { value: 'kg', label: 'kg' },
  { value: 'g', label: 'g' },
  { value: 'l', label: 'L' },
  { value: 'ml', label: 'ml' },
  { value: 'un', label: 'un' },
  { value: 'cps', label: 'cápsulas' },
];

export function ProductWeightVariantsManager({
  enabled,
  onEnabledChange,
  variants,
  onChange,
}: ProductWeightVariantsManagerProps) {
  const handleAdd = () => {
    const newVariant: WeightVariant = {
      label: '',
      unit_value: 0,
      unit_type: 'kg',
      price: 0,
      discounted_price: null,
      display_order: variants.length,
    };
    onChange([...variants, newVariant]);
  };

  const handleRemove = (index: number) => {
    onChange(variants.filter((_, i) => i !== index));
  };

  const handleUpdate = <K extends keyof WeightVariant>(
    index: number,
    field: K,
    value: WeightVariant[K]
  ) => {
    const next = [...variants];
    next[index] = { ...next[index], [field]: value };
    onChange(next);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4 p-4 bg-muted/30 rounded-lg border">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <Scale className="h-4 w-4 text-primary" />
            <Label className="text-base font-medium cursor-pointer">
              Este produto tem variações de peso
            </Label>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Ative para cadastrar variações como 1kg, 500g, etc. Cada variação pode ter seu
            próprio preço. Quando ativado, o preço simples do produto é substituído pelos
            preços das variações.
          </p>
        </div>
        <Switch checked={enabled} onCheckedChange={onEnabledChange} />
      </div>

      {enabled && (
        <div className="space-y-3">
          {variants.length === 0 && (
            <div className="p-6 border border-dashed rounded-lg text-center text-sm text-muted-foreground">
              Nenhuma variação cadastrada. Adicione ao menos 2 variações de peso.
            </div>
          )}

          {variants.map((variant, index) => (
            <div
              key={index}
              className="p-4 border rounded-lg space-y-3 bg-background"
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-muted-foreground">
                  Variação {index + 1}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => handleRemove(index)}
                  className="h-8 w-8 p-0 text-destructive hover:bg-destructive/10"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Rótulo (ex.: 1kg)</Label>
                  <Input
                    value={variant.label}
                    onChange={(e) => handleUpdate(index, 'label', e.target.value)}
                    placeholder="1kg"
                    maxLength={30}
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label className="text-xs">Valor</Label>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      value={variant.unit_value || ''}
                      onChange={(e) =>
                        handleUpdate(index, 'unit_value', parseFloat(e.target.value) || 0)
                      }
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Unidade</Label>
                    <Select
                      value={variant.unit_type}
                      onValueChange={(v) =>
                        handleUpdate(index, 'unit_type', v as WeightUnitType)
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {UNIT_OPTIONS.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value}>
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs">Preço</Label>
                  <CurrencyInput
                    value={variant.price}
                    onChange={(v) => handleUpdate(index, 'price', v)}
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-xs">Preço com desconto (opcional)</Label>
                  <CurrencyInput
                    value={variant.discounted_price ?? undefined}
                    onChange={(v) =>
                      handleUpdate(index, 'discounted_price', v > 0 ? v : null)
                    }
                  />
                </div>
              </div>
            </div>
          ))}

          <Button type="button" variant="outline" onClick={handleAdd} className="w-full">
            <Plus className="h-4 w-4 mr-2" />
            Adicionar variação
          </Button>

          {variants.length > 0 && variants.length < 2 && (
            <p className="text-xs text-amber-600 dark:text-amber-500">
              Adicione ao menos 2 variações para ativar a seleção de peso.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
