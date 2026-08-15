import { useState, useEffect, useCallback, useImperativeHandle, forwardRef } from 'react';
import { Loader as Loader2, Save, TriangleAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { fetchVariantStockForProduct, upsertVariantStock, getVariantStockStatus } from '@/lib/stockUtils';
import { syncProductAggregateStock } from '@/lib/stockMovementService';
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

export interface VariantStockGridHandle {
  // Persists any unsaved quantity edits. Returns true if there was nothing
  // dirty or everything saved successfully, false if a save failed — lets a
  // parent form flush this grid's independent state before it navigates away.
  flush: () => Promise<boolean>;
}

interface CellState {
  key: string;
  color: string | null;
  size: string | null;
  flavor: string | null;
  quantity: number;
  original: number;
  dirty: boolean;
  hasRow: boolean;
}

const VariantStockGrid = forwardRef<VariantStockGridHandle, VariantStockGridProps>(function VariantStockGrid({
  productId,
  colors,
  sizes,
  flavors,
  lowStockThreshold,
  performedBy,
  onStockChanged,
}, ref) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [cells, setCells] = useState<CellState[]>([]);
  const [existingStock, setExistingStock] = useState<ProductVariantStock[]>([]);

  const hasColors = colors.length > 0;
  const hasSizes = sizes.length > 0;
  const hasFlavors = flavors.length > 0;

  // Linhas de estoque de combinacoes que o produto NAO oferece mais (o lojista
  // tirou a cor ou o tamanho da lista, mas o saldo continuou no banco). Ficam
  // invisiveis nesta grade e fora do total do produto — o lojista precisa
  // saber que existem para decidir se reativa a variante ou zera as pecas.
  const orphanStock = existingStock.filter((s) => {
    const colorOk = hasColors ? !!s.color && colors.includes(s.color) : s.color === null;
    const sizeOk = hasSizes ? !!s.size && sizes.includes(s.size) : s.size === null;
    const flavorOk = hasFlavors ? !!s.flavor && flavors.includes(s.flavor) : s.flavor === null;
    return !(colorOk && sizeOk && flavorOk) && s.quantity !== 0;
  });

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
      newCells.push({ key, color: null, size: null, flavor: null, quantity: qty, original: qty, dirty: false, hasRow: stockMap.has(key) });
    } else if (hasColors && hasSizes && hasFlavors) {
      for (const color of colors) {
        for (const size of sizes) {
          for (const flavor of flavors) {
            const key = `${color}-${size}-${flavor}`;
            const qty = stockMap.get(key) ?? 0;
            newCells.push({ key, color, size, flavor, quantity: qty, original: qty, dirty: false, hasRow: stockMap.has(key) });
          }
        }
      }
    } else if (hasColors && hasSizes) {
      for (const color of colors) {
        for (const size of sizes) {
          const key = `${color}-${size}-`;
          const qty = stockMap.get(key) ?? 0;
          newCells.push({ key, color, size, flavor: null, quantity: qty, original: qty, dirty: false, hasRow: stockMap.has(key) });
        }
      }
    } else if (hasColors && hasFlavors) {
      for (const color of colors) {
        for (const flavor of flavors) {
          const key = `${color}--${flavor}`;
          const qty = stockMap.get(key) ?? 0;
          newCells.push({ key, color, size: null, flavor, quantity: qty, original: qty, dirty: false, hasRow: stockMap.has(key) });
        }
      }
    } else if (hasSizes && hasFlavors) {
      for (const size of sizes) {
        for (const flavor of flavors) {
          const key = `-${size}-${flavor}`;
          const qty = stockMap.get(key) ?? 0;
          newCells.push({ key, color: null, size, flavor, quantity: qty, original: qty, dirty: false, hasRow: stockMap.has(key) });
        }
      }
    } else if (hasColors) {
      for (const color of colors) {
        const key = `${color}--`;
        const qty = stockMap.get(key) ?? 0;
        newCells.push({ key, color, size: null, flavor: null, quantity: qty, original: qty, dirty: false, hasRow: stockMap.has(key) });
      }
    } else if (hasSizes) {
      for (const size of sizes) {
        const key = `-${size}-`;
        const qty = stockMap.get(key) ?? 0;
        newCells.push({ key, color: null, size, flavor: null, quantity: qty, original: qty, dirty: false, hasRow: stockMap.has(key) });
      }
    } else if (hasFlavors) {
      for (const flavor of flavors) {
        const key = `--${flavor}`;
        const qty = stockMap.get(key) ?? 0;
        newCells.push({ key, color: null, size: null, flavor, quantity: qty, original: qty, dirty: false, hasRow: stockMap.has(key) });
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

  // A cell also needs saving when it has no stock record yet, even if its
  // quantity was never edited — otherwise a variant left at the default "0"
  // never gets persisted and reads back as "untracked" instead of "esgotado".
  const hasDirty = cells.some((c) => c.dirty || !c.hasRow);

  const save = useCallback(async (): Promise<boolean> => {
    const itemsToSave = cells.filter((c) => c.dirty || !c.hasRow);

    setSaving(true);

    let allSuccess = true;
    for (const cell of itemsToSave) {
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

    // Always reconcile the aggregate, even when nothing was dirty: if a past
    // save persisted the variant rows but the aggregate RPC failed silently
    // (as happened in production — product_variant_stock summed correctly
    // while products.stock_quantity stayed stuck at 0), the cells already
    // read as "clean" and a normal resave would otherwise never touch it
    // again, leaving the product permanently stuck showing "esgotado".
    if (allSuccess && cells.length > 0) {
      const recalculated = await syncProductAggregateStock(productId);
      if (!recalculated) {
        // Fall back to a direct write using the grid's own total. `cells`
        // only ever holds the currently offered combos (orphans are tracked
        // separately), so this total is exactly the same number the RPC
        // would have computed.
        const total = cells.reduce((sum, c) => sum + c.quantity, 0);
        const { error: fallbackError } = await supabase
          .from('products')
          .update({ stock_quantity: total })
          .eq('id', productId);
        if (fallbackError) allSuccess = false;
      }
    }

    if (allSuccess) {
      if (itemsToSave.length > 0) {
        setCells((prev) => prev.map((c) => ({ ...c, original: c.quantity, dirty: false, hasRow: true })));
      }
      onStockChanged?.();
    }

    setSaving(false);
    return allSuccess;
  }, [cells, productId, performedBy, onStockChanged]);

  const handleSave = async () => {
    const success = await save();
    if (success) {
      toast.success('Estoque por variante salvo');
    } else {
      toast.error('Erro ao salvar algumas variantes');
    }
  };

  useImperativeHandle(ref, () => ({ flush: save }), [save]);

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

  const orphanWarning = orphanStock.length > 0 && (
    <div className="rounded-lg border border-amber-300 bg-amber-50 dark:bg-amber-950/30 p-3 space-y-1.5">
      <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400">
        <TriangleAlert className="h-4 w-4 shrink-0" />
        <p className="text-xs font-semibold">Estoque fora da oferta atual</p>
      </div>
      <p className="text-[11px] text-amber-700/90 dark:text-amber-400/90">
        Estas combinações têm saldo no estoque mas não estão mais na lista de
        cores/tamanhos deste produto, então não entram no total nem podem ser
        vendidas. Reative a cor ou o tamanho acima para voltar a usá-las.
      </p>
      <ul className="text-[11px] text-amber-800 dark:text-amber-300 space-y-0.5">
        {orphanStock.map((s) => (
          <li key={s.id}>
            • {[s.color, s.size, s.flavor].filter(Boolean).join(' / ') || 'sem variante'}: {s.quantity} un.
          </li>
        ))}
      </ul>
    </div>
  );

  if (hasColors && hasSizes && !hasFlavors) {
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium">Estoque por Variante</p>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-xs">
              Total: {totalStock} un.
            </Badge>
            {hasDirty && (
              <Button type="button" size="sm" onClick={handleSave} disabled={saving} className="h-7 text-xs gap-1">
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

        {orphanWarning}
      </div>
    );
  }

  // Generic fallback for every other combination (single dimension, or any
  // pairing/triple that isn't the pure color×size case above) — driven
  // directly by `cells`, which already holds the correct combo per variant,
  // instead of reconstructing keys from a single dimension's list.
  const listLabel = [hasColors && 'Cor', hasSizes && 'Tamanho', hasFlavors && 'Sabor']
    .filter(Boolean)
    .join(' / ');

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium">Estoque por {listLabel}</p>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-xs">
            Total: {totalStock} un.
          </Badge>
          {hasDirty && (
            <Button type="button" size="sm" onClick={handleSave} disabled={saving} className="h-7 text-xs gap-1">
              <Save className="h-3 w-3" />
              {saving ? 'Salvando...' : 'Salvar'}
            </Button>
          )}
        </div>
      </div>

      <div className="space-y-2">
        {cells.map((cell) => {
          const label = [cell.color, cell.size, cell.flavor].filter(Boolean).join(' / ');
          const status = getVariantStockStatus({ quantity: cell.quantity, reserved_quantity: 0 }, lowStockThreshold);

          return (
            <div key={cell.key} className="flex items-center justify-between rounded-lg border p-3">
              <span className="text-sm font-medium">{label}</span>
              <div className="flex items-center gap-2">
                {status === 'out_of_stock' && cell.quantity <= 0 && (
                  <Badge className="bg-red-500/10 text-red-600 border-transparent text-[10px]">Esgotado</Badge>
                )}
                {status === 'low_stock' && (
                  <Badge className="bg-amber-500/10 text-amber-600 border-transparent text-[10px]">Baixo</Badge>
                )}
                <Input
                  type="number"
                  min={0}
                  value={cell.quantity}
                  onChange={(e) => handleQuantityChange(cell.key, e.target.value)}
                  className={`h-8 w-20 text-center text-sm ${cell.dirty ? 'border-blue-400 ring-1 ring-blue-200' : ''}`}
                />
              </div>
            </div>
          );
        })}
      </div>

      {orphanWarning}
    </div>
  );
});

export default VariantStockGrid;
