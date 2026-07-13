import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader, DollarSign, Percent, CircleMinus as MinusCircle } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import type { Product } from '@/types';

type PricingAction = 'discount_percent' | 'discount_fixed' | 'increase_percent' | 'remove_discounts';

interface BulkPricingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedProducts: Product[];
  userId: string;
  onComplete: () => void;
}

export function BulkPricingDialog({
  open,
  onOpenChange,
  selectedProducts,
  userId,
  onComplete,
}: BulkPricingDialogProps) {
  const [action, setAction] = useState<PricingAction>('discount_percent');
  const [value, setValue] = useState('');
  const [loading, setLoading] = useState(false);

  const actions: { id: PricingAction; label: string; icon: React.ReactNode; desc: string }[] = [
    { id: 'discount_percent', label: 'Desconto %', icon: <Percent className="h-4 w-4" />, desc: 'Aplicar desconto percentual' },
    { id: 'discount_fixed', label: 'Desconto R$', icon: <DollarSign className="h-4 w-4" />, desc: 'Reduzir valor fixo do preço' },
    { id: 'increase_percent', label: 'Aumentar %', icon: <Percent className="h-4 w-4" />, desc: 'Aumentar preço percentual' },
    { id: 'remove_discounts', label: 'Remover Descontos', icon: <MinusCircle className="h-4 w-4" />, desc: 'Limpar todos os descontos' },
  ];

  const getPreview = (product: Product): { before: number; after: number } | null => {
    const price = product.price;
    if (!price || price <= 0) return null;

    const numValue = parseFloat(value) || 0;

    switch (action) {
      case 'discount_percent':
        return { before: price, after: Math.max(0.01, price * (1 - numValue / 100)) };
      case 'discount_fixed':
        return { before: price, after: Math.max(0.01, price - numValue) };
      case 'increase_percent':
        return { before: price, after: price * (1 + numValue / 100) };
      case 'remove_discounts':
        return product.discounted_price ? { before: product.discounted_price, after: price } : null;
      default:
        return null;
    }
  };

  const handleApply = async () => {
    if (action !== 'remove_discounts' && (!value || parseFloat(value) <= 0)) {
      toast.error('Informe um valor válido');
      return;
    }

    try {
      setLoading(true);
      const numValue = parseFloat(value) || 0;
      let successCount = 0;

      for (const product of selectedProducts) {
        const price = product.price;
        if (!price || price <= 0) continue;

        let updates: Record<string, any> = {};

        switch (action) {
          case 'discount_percent': {
            const newPrice = Math.max(0.01, Math.round(price * (1 - numValue / 100) * 100) / 100);
            updates = { discounted_price: newPrice };
            break;
          }
          case 'discount_fixed': {
            const newPrice = Math.max(0.01, Math.round((price - numValue) * 100) / 100);
            updates = { discounted_price: newPrice };
            break;
          }
          case 'increase_percent': {
            const newPrice = Math.round(price * (1 + numValue / 100) * 100) / 100;
            updates = { price: newPrice };
            break;
          }
          case 'remove_discounts':
            updates = { discounted_price: null };
            break;
        }

        const { error } = await supabase
          .from('products')
          .update(updates)
          .eq('id', product.id)
          .eq('user_id', userId);

        if (!error) successCount++;
      }

      toast.success(`Preços atualizados para ${successCount} produtos`);
      onComplete();
      onOpenChange(false);
      setValue('');
    } catch (err) {
      toast.error('Erro ao atualizar preços');
    } finally {
      setLoading(false);
    }
  };

  const previewProducts = selectedProducts.slice(0, 3);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Alterar Preços em Lote</DialogTitle>
          <DialogDescription>
            Aplicar alteração para {selectedProducts.length} {selectedProducts.length === 1 ? 'produto' : 'produtos'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Action selector */}
          <div className="grid grid-cols-2 gap-2">
            {actions.map(a => (
              <button
                key={a.id}
                onClick={() => setAction(a.id)}
                className={`
                  flex items-center gap-2 p-2.5 rounded-lg border text-left transition-all text-xs
                  ${action === a.id
                    ? 'border-primary bg-primary/5 text-primary'
                    : 'border-border/50 hover:border-border text-muted-foreground hover:text-foreground'
                  }
                `}
              >
                {a.icon}
                <span className="font-medium">{a.label}</span>
              </button>
            ))}
          </div>

          {/* Value input */}
          {action !== 'remove_discounts' && (
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">
                {action === 'discount_percent' ? 'Percentual de desconto' :
                 action === 'discount_fixed' ? 'Valor do desconto (R$)' :
                 'Percentual de aumento'}
              </Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                max={action.includes('percent') ? '99' : undefined}
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder={action.includes('percent') ? 'Ex: 15' : 'Ex: 10.00'}
                className="h-9"
              />
            </div>
          )}

          {/* Preview */}
          {(value || action === 'remove_discounts') && previewProducts.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Preview</p>
              <div className="space-y-1 bg-muted/30 rounded-lg p-2">
                {previewProducts.map(p => {
                  const preview = getPreview(p);
                  if (!preview) return null;
                  return (
                    <div key={p.id} className="flex items-center justify-between text-xs">
                      <span className="truncate max-w-[150px] text-muted-foreground">{p.title}</span>
                      <div className="flex items-center gap-1.5">
                        <span className="line-through text-muted-foreground">R$ {preview.before.toFixed(2)}</span>
                        <span className="font-semibold text-primary">R$ {preview.after.toFixed(2)}</span>
                      </div>
                    </div>
                  );
                })}
                {selectedProducts.length > 3 && (
                  <p className="text-[10px] text-muted-foreground text-center pt-1">
                    +{selectedProducts.length - 3} produtos
                  </p>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button size="sm" onClick={handleApply} disabled={loading}>
            {loading && <Loader className="h-3.5 w-3.5 animate-spin mr-1.5" />}
            Aplicar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
