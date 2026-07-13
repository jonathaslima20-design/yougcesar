import { useState } from 'react';
import { PackagePlus } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { registerStockEntry } from '@/lib/stockMovementService';

interface StockEntryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  productId: string;
  productTitle: string;
  currentStock: number;
  performedBy: string;
  variantStockId?: string | null;
  variantLabel?: string;
  onSuccess?: () => void;
}

export default function StockEntryDialog({
  open,
  onOpenChange,
  productId,
  productTitle,
  currentStock,
  performedBy,
  variantStockId,
  variantLabel,
  onSuccess,
}: StockEntryDialogProps) {
  const [quantity, setQuantity] = useState('');
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async () => {
    const qty = parseInt(quantity);
    if (!qty || qty <= 0) {
      toast.error('Informe uma quantidade válida');
      return;
    }

    setSaving(true);
    const success = await registerStockEntry(
      productId,
      qty,
      reason || 'Entrada de estoque',
      performedBy,
      variantStockId
    );

    if (success) {
      toast.success(`${qty} unidades adicionadas ao estoque`);
      setQuantity('');
      setReason('');
      onOpenChange(false);
      onSuccess?.();
    } else {
      toast.error('Erro ao registrar entrada de estoque');
    }
    setSaving(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <PackagePlus className="h-5 w-5 text-green-600" />
            Registrar Entrada de Estoque
          </DialogTitle>
          <DialogDescription>
            Adicionar unidades ao estoque de <span className="font-medium text-foreground">{productTitle}</span>
            {variantLabel && (
              <span className="block text-xs mt-1">Variante: {variantLabel}</span>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="flex items-center justify-between rounded-lg bg-muted/50 p-3">
            <span className="text-sm text-muted-foreground">Estoque atual</span>
            <span className="text-sm font-semibold">{currentStock} un.</span>
          </div>

          <div className="space-y-2">
            <Label htmlFor="entry-qty">Quantidade a adicionar *</Label>
            <Input
              id="entry-qty"
              type="number"
              min={1}
              placeholder="0"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleSubmit(); }}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="entry-reason">Motivo</Label>
            <Textarea
              id="entry-reason"
              placeholder="Ex: Reposição de fornecedor, Produção própria..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={2}
            />
          </div>

          {quantity && parseInt(quantity) > 0 && (
            <div className="flex items-center justify-between rounded-lg bg-green-500/10 p-3">
              <span className="text-sm text-green-700 dark:text-green-400">Novo estoque</span>
              <span className="text-sm font-semibold text-green-700 dark:text-green-400">
                {currentStock + parseInt(quantity)} un.
              </span>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={saving || !quantity || parseInt(quantity) <= 0}>
            {saving ? 'Salvando...' : 'Registrar Entrada'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
