import { useState } from 'react';
import { Package, TriangleAlert as AlertTriangle, Undo2 } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import type { OrderItem } from '@/types';

interface InventoryItemInfo {
  product_id: string;
  product_title: string;
  quantity: number;
  current_stock: number | null;
  track_inventory: boolean;
  selected_color?: string | null;
  selected_size?: string | null;
  selected_flavor?: string | null;
  selected_variant_label?: string | null;
}

interface InventoryDeductionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: 'deduct' | 'restore';
  items: InventoryItemInfo[];
  onConfirm: () => Promise<void>;
  onSkip: () => void;
}

export default function InventoryDeductionDialog({
  open,
  onOpenChange,
  mode,
  items,
  onConfirm,
  onSkip,
}: InventoryDeductionDialogProps) {
  const [processing, setProcessing] = useState(false);

  const trackedItems = items.filter((item) => item.track_inventory);

  if (trackedItems.length === 0) return null;

  const handleConfirm = async () => {
    setProcessing(true);
    try {
      await onConfirm();
    } finally {
      setProcessing(false);
      onOpenChange(false);
    }
  };

  const handleSkip = () => {
    onSkip();
    onOpenChange(false);
  };

  const isDeduct = mode === 'deduct';

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            {isDeduct ? (
              <Package className="h-5 w-5 text-primary" />
            ) : (
              <Undo2 className="h-5 w-5 text-amber-500" />
            )}
            {isDeduct ? 'Reduzir estoque?' : 'Devolver itens ao estoque?'}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {isDeduct
              ? 'Os seguintes produtos têm controle de estoque ativo. Deseja reduzir a quantidade?'
              : 'O estoque foi reduzido quando este pedido foi confirmado. Deseja devolver os itens?'}
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="my-2 space-y-2 max-h-[200px] overflow-y-auto">
          {trackedItems.map((item, index) => {
            const variantParts = [item.selected_color, item.selected_size, item.selected_flavor, item.selected_variant_label].filter(Boolean);
            const variantLabel = variantParts.length > 0 ? variantParts.join(' / ') : null;

            return (
            <div
              key={`${item.product_id}-${index}`}
              className="flex items-center justify-between rounded-lg border p-3 text-sm"
            >
              <div className="min-w-0 flex-1">
                <p className="font-medium truncate">{item.product_title}</p>
                {variantLabel && (
                  <p className="text-xs text-muted-foreground truncate">{variantLabel}</p>
                )}
                <p className="text-xs text-muted-foreground">
                  Estoque atual: {item.current_stock ?? 0} un.
                </p>
              </div>
              <div className="flex items-center gap-1.5 ml-3 shrink-0">
                {isDeduct ? (
                  <span className="text-sm font-semibold text-red-600">-{item.quantity}</span>
                ) : (
                  <span className="text-sm font-semibold text-green-600">+{item.quantity}</span>
                )}
              </div>
            </div>
            );
          })}
        </div>

        {isDeduct && trackedItems.some((item) => (item.current_stock ?? 0) < item.quantity) && (
          <div className="flex items-start gap-2 rounded-lg bg-amber-500/10 p-3 text-xs text-amber-700 dark:text-amber-400">
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
            <span>Alguns produtos ficarão com estoque negativo. O pedido será confirmado normalmente.</span>
          </div>
        )}

        <AlertDialogFooter className="flex-col sm:flex-row gap-2">
          <Button variant="outline" onClick={handleSkip} disabled={processing}>
            {isDeduct ? 'Confirmar sem reduzir' : 'Cancelar sem devolver'}
          </Button>
          <Button onClick={handleConfirm} disabled={processing}>
            {processing
              ? 'Processando...'
              : isDeduct
                ? 'Reduzir estoque e confirmar'
                : 'Devolver e cancelar'}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export type { InventoryItemInfo };
