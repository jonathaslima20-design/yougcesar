import { useState, useEffect, useCallback } from 'react';
import { Loader as Loader2, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { fetchVariantStockForProduct, upsertVariantStock, getVariantStockStatus } from '@/lib/stockUtils';
import type { ProductVariantStock } from '@/types';

interface VariantStockGridProps {
  productId: string;
  colors: string[];
  sizes: string[];
  flavors: string[];
  lowStockThreshold: number;
  performedBy: string;
  onStockChanged?: () => void;
}

interface CellState {
  key: string;
  color: string | null;
  size: string | null;
  flavor: string | null;
  quantity: number;
  original: number;
  dirty: boolean;
}

export default function VariantStockGrid({
  productId,
  colors,
  sizes,
  flavors,
  lowStockThreshold,
  performedBy,
  onStockChanged,
}: VariantStockGridProps) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [cells, setCells] = useState<CellState[]>([]);
  const [existingStock, setExistingStock] = useState<ProductVariantStock[]>([]);

  const hasColors = colors.length > 0;
  const hasSizes = sizes.length > 0;
  const hasFlavors = flavors.length > 0;

  const buildCells = useCallback((stockData: ProductVariantStock[]) => {
    const newCells: CellState[] = [];
    const stockMap = new Map<string, number>();

    for (const s of stockData) {
      const key = `${s.color || ''}-${s.size || ''}-${s.flavor || ''}`;
      stockMap.set(key, s.quantity);
    }

    if (!hasColors && !hasSizes && !hasFlavors) {
      const key = '--';
      const qty = stockMap.get(key) ?? 0;
      newCells.push({ key, color: null, size: null, flavor: null, quantity: qty, original: qty, dirty: false });
    } else if (hasColors && hasSizes) {
      for (const color of colors) {
        for (const size of sizes) {
          const key = `${color}-${size}-`;
          const qty = stockMap.get(key) ?? 0;
          newCells.push({ key, color, size, flavor: null, quantity: qty, original: qty, dirty: false });
        }
      }
    } else if (hasColors && hasFlavors) {
      for (const color of colors) {
        for (const flavor of flavors) {
          const key = `${color}--${flavor}`;
          const qty = stockMap.get(key) ?? 0;
          newCells.push({ key, color, size: null, flavor, quantity: qty, original: qty, dirty: false });
        }
      }
    } else if (hasSizes && hasFlavors) {
      for (const size of sizes) {
        for (const flavor of flavors) {
          const key = `-${size}-${flavor}`;
          const qty = stockMap.get(key) ?? 0;
          newCells.push({ key, color: null, size, flavor, quantity: qty, original: qty, dirty: false });
        }
      }
    } else if (hasColors) {
      for (const color of colors) {
        const key = `${color}--`;
        const qty = stockMap.get(key) ?? 0;
        newCells.push({ key, color, size: null, flavor: null, quantity: qty, original: qty, dirty: false });
      }
    } else if (hasSizes) {
      for (const size of sizes) {
        const key = `-${size}-`;
        const qty = stockMap.get(key) ?? 0;
        newCells.push({ key, color: null, size, flavor: null, quantity: qty, original: qty, dirty: false });
      }
    } else if (hasFlavors) {
      for (const flavor of flavors) {
        const key = `--${flavor}`;
        const qty = stockMap.get(key) ?? 0;
        newCells.push({ key, color: null, size: null, flavor, quantity: qty, original: qty, dirty: false });
      }
    }

    setCells(newCells);
  }, [colors, sizes, flavors, hasColors, hasSizes, hasFlavors]);

  useEffect(() => {
    if (!productId) return;

    const load = async () => {
      setLoading(true);
      const data = await fetchVariantStockForProduct(productId);
      setExistingStock(data);
      buildCells(data);
      setLoading(false);
    };

    load();
  }, [productId, buildCells]);

  const handleQuantityChange = (key: string, value: string) => {
    const qty = Math.max(0, parseInt(value) || 0);
    setCells((prev) =>
      prev.map((c) => (c.key === key ? { ...c, quantity: qty, dirty: qty !== c.original } : c))
    );
  };

  const hasDirty = cells.some((c) => c.dirty);

  const handleSave = async () => {
    const dirtyItems = cells.filter((c) => c.dirty);
    if (dirtyItems.length === 0) return;

    setSaving(true);

    let allSuccess = true;
    for (const cell of dirtyItems) {
      const success = await upsertVariantStock(
        productId,
        cell.color,
        cell.size,
        cell.flavor,
        cell.quantity,
        performedBy
      );
      if (!success) allSuccess = false;
    }

    if (allSuccess) {
      toast.success('Estoque por variante salvo');
      setCells((prev) => prev.map((c) => ({ ...c, original: c.quantity, dirty: false })));
      onStockChanged?.();
    } else {
      toast.error('Erro ao salvar algumas variantes');
    }

    setSaving(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!hasColors && !hasSizes && !hasFlavors) {
    return null;
  }

  const totalStock = cells.reduce((sum, c) => sum + c.quantity, 0);

  if (hasColors && hasSizes) {
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium">Estoque por Variante</p>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-xs">
              Total: {totalStock} un.
            </Badge>
            {hasDirty && (
              <Button size="sm" onClick={handleSave} disabled={saving} className="h-7 text-xs gap-1">
                <Save className="h-3 w-3" />
                {saving ? 'Salvando...' : 'Salvar'}
              </Button>
            )}
          </div>
        </div>

        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="text-left px-3 py-2 font-medium text-muted-foreground">Cor / Tamanho</th>
                {sizes.map((s) => (
                  <th key={s} className="text-center px-2 py-2 font-medium text-muted-foreground min-w-[70px]">{s}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {colors.map((color) => (
                <tr key={color} className="border-b last:border-0">
                  <td className="px-3 py-2 font-medium">{color}</td>
                  {sizes.map((size) => {
                    const key = `${color}-${size}-`;
                    const cell = cells.find((c) => c.key === key);
                    const status = cell ? getVariantStockStatus({ quantity: cell.quantity, reserved_quantity: 0 }, lowStockThreshold) : 'out_of_stock';

                    return (
                      <td key={key} className="px-2 py-1.5 text-center">
                        <Input
                          type="number"
                          min={0}
                          value={cell?.quantity ?? 0}
                          onChange={(e) => handleQuantityChange(key, e.target.value)}
                          className={`h-8 w-16 mx-auto text-center text-xs ${
                            cell?.dirty ? 'border-blue-400 ring-1 ring-blue-200' : ''
                          } ${status === 'out_of_stock' ? 'text-red-600' : status === 'low_stock' ? 'text-amber-600' : ''}`}
                        />
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  const listItems = hasColors ? colors : hasSizes ? sizes : flavors;
  const listLabel = hasColors ? 'Cor' : hasSizes ? 'Tamanho' : 'Sabor';

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium">Estoque por {listLabel}</p>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-xs">
            Total: {totalStock} un.
          </Badge>
          {hasDirty && (
            <Button size="sm" onClick={handleSave} disabled={saving} className="h-7 text-xs gap-1">
              <Save className="h-3 w-3" />
              {saving ? 'Salvando...' : 'Salvar'}
            </Button>
          )}
        </div>
      </div>

      <div className="space-y-2">
        {listItems.map((item) => {
          const key = hasColors ? `${item}--` : hasSizes ? `-${item}-` : `--${item}`;
          const cell = cells.find((c) => c.key === key);
          const status = cell ? getVariantStockStatus({ quantity: cell.quantity, reserved_quantity: 0 }, lowStockThreshold) : 'out_of_stock';

          return (
            <div key={key} className="flex items-center justify-between rounded-lg border p-3">
              <span className="text-sm font-medium">{item}</span>
              <div className="flex items-center gap-2">
                {status === 'out_of_stock' && cell && cell.quantity <= 0 && (
                  <Badge className="bg-red-500/10 text-red-600 border-transparent text-[10px]">Esgotado</Badge>
                )}
                {status === 'low_stock' && (
                  <Badge className="bg-amber-500/10 text-amber-600 border-transparent text-[10px]">Baixo</Badge>
                )}
                <Input
                  type="number"
                  min={0}
                  value={cell?.quantity ?? 0}
                  onChange={(e) => handleQuantityChange(key, e.target.value)}
                  className={`h-8 w-20 text-center text-sm ${cell?.dirty ? 'border-blue-400 ring-1 ring-blue-200' : ''}`}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
