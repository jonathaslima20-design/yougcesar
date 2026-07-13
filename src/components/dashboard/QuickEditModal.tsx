import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Loader, Save } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { logActivity } from '@/lib/activityLogger';
import { toast } from 'sonner';
import type { Product } from '@/types';

interface QuickEditModalProps {
  product: Product | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: (updated: Partial<Product> & { id: string }) => void;
}

export function QuickEditModal({ product, open, onOpenChange, onSaved }: QuickEditModalProps) {
  const [title, setTitle] = useState('');
  const [price, setPrice] = useState('');
  const [discountedPrice, setDiscountedPrice] = useState('');
  const [shortDescription, setShortDescription] = useState('');
  const [stockQuantity, setStockQuantity] = useState('');
  const [isVisible, setIsVisible] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (product) {
      setTitle(product.title || '');
      setPrice(product.price ? String(product.price) : '');
      setDiscountedPrice(product.discounted_price ? String(product.discounted_price) : '');
      setShortDescription(product.short_description || '');
      setStockQuantity(product.stock_quantity != null ? String(product.stock_quantity) : '');
      setIsVisible(product.is_visible_on_storefront ?? true);
    }
  }, [product]);

  const handleSave = async () => {
    if (!product) return;

    const updates: Record<string, any> = {};

    if (title.trim() !== product.title) updates.title = title.trim();
    const newPrice = parseFloat(price);
    if (!isNaN(newPrice) && newPrice !== product.price) updates.price = newPrice;
    const newDiscount = discountedPrice ? parseFloat(discountedPrice) : null;
    if (newDiscount !== (product.discounted_price || null)) updates.discounted_price = newDiscount;
    if (shortDescription !== (product.short_description || '')) updates.short_description = shortDescription;
    if (product.track_inventory) {
      const newStock = stockQuantity ? parseInt(stockQuantity) : null;
      if (newStock !== product.stock_quantity) updates.stock_quantity = newStock;
    }
    if (isVisible !== (product.is_visible_on_storefront ?? true)) updates.is_visible_on_storefront = isVisible;

    if (Object.keys(updates).length === 0) {
      onOpenChange(false);
      return;
    }

    try {
      setSaving(true);
      const { error } = await supabase
        .from('products')
        .update(updates)
        .eq('id', product.id);

      if (error) throw error;

      logActivity('product.update', `Editou o produto "${product.title}"`, 'product', product.id);
      onSaved({ id: product.id, ...updates });
      toast.success('Produto atualizado');
      onOpenChange(false);
    } catch (err) {
      console.error('Error saving quick edit:', err);
      toast.error('Erro ao salvar alterações');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-lg">Edição Rápida</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="qe-title" className="text-xs font-medium">Título</Label>
            <Input
              id="qe-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="h-9"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="qe-price" className="text-xs font-medium">Preço (R$)</Label>
              <Input
                id="qe-price"
                type="number"
                step="0.01"
                min="0"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                className="h-9"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="qe-discount" className="text-xs font-medium">Preço Promocional</Label>
              <Input
                id="qe-discount"
                type="number"
                step="0.01"
                min="0"
                value={discountedPrice}
                onChange={(e) => setDiscountedPrice(e.target.value)}
                placeholder="Opcional"
                className="h-9"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="qe-desc" className="text-xs font-medium">Descrição Curta</Label>
            <Textarea
              id="qe-desc"
              value={shortDescription}
              onChange={(e) => setShortDescription(e.target.value)}
              rows={2}
              maxLength={120}
              className="resize-none text-sm"
            />
          </div>

          {product?.track_inventory && (
            <div className="space-y-1.5">
              <Label htmlFor="qe-stock" className="text-xs font-medium">Estoque</Label>
              <Input
                id="qe-stock"
                type="number"
                min="0"
                value={stockQuantity}
                onChange={(e) => setStockQuantity(e.target.value)}
                className="h-9"
              />
            </div>
          )}

          <div className="flex items-center justify-between">
            <Label className="text-xs font-medium">Visível na Vitrine</Label>
            <Switch checked={isVisible} onCheckedChange={setIsVisible} />
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button size="sm" onClick={handleSave} disabled={saving}>
            {saving ? <Loader className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <Save className="h-3.5 w-3.5 mr-1.5" />}
            Salvar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
