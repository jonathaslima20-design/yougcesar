import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CircleAlert as AlertCircle, Check, Plus, X, Package } from 'lucide-react';
import type { Product, PriceTier } from '@/types';
import { fetchProductPriceTiers, calculateApplicablePrice } from '@/lib/tieredPricingUtils';
import { validateDistribution } from '@/lib/distributionUtils';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';

interface DistributionItemInput {
  id: string;
  color?: string;
  size?: string;
  quantity: number;
}

interface ProductDistributionModalProps {
  open: boolean;
  onClose: () => void;
  product: Product;
  onConfirm: (totalQuantity: number, items: Array<{ color?: string; size?: string; quantity: number }>) => void;
}

export function ProductDistributionModal({
  open,
  onClose,
  product,
  onConfirm,
}: ProductDistributionModalProps) {
  const [totalQuantity, setTotalQuantity] = useState<number>(1);
  const [items, setItems] = useState<DistributionItemInput[]>([]);
  const [tiers, setTiers] = useState<PriceTier[]>([]);
  const [loading, setLoading] = useState(false);

  const [newColor, setNewColor] = useState<string>('');
  const [newSize, setNewSize] = useState<string>('');
  const [newQuantity, setNewQuantity] = useState<number>(1);

  const hasColors = product.colors && product.colors.length > 0;
  const hasSizes = product.sizes && product.sizes.length > 0;

  useEffect(() => {
    if (open && product.has_tiered_pricing) {
      loadTiers();
    }
  }, [open, product.id]);

  const loadTiers = async () => {
    setLoading(true);
    try {
      const fetchedTiers = await fetchProductPriceTiers(product.id);
      setTiers(fetchedTiers);
    } catch (error) {
      console.error('Error loading tiers:', error);
    } finally {
      setLoading(false);
    }
  };

  const distributedSum = items.reduce((sum, item) => sum + item.quantity, 0);

  const hasTieredPricing = product.has_tiered_pricing && tiers.length > 0;

  // Para preços escalonados, a quantidade total é a soma dos itens
  const effectiveTotalQuantity = hasTieredPricing ? distributedSum : totalQuantity;

  const remainingQuantity = totalQuantity - distributedSum;
  const isComplete = hasTieredPricing ? items.length > 0 && distributedSum > 0 : remainingQuantity === 0;
  const isOverDistributed = !hasTieredPricing && remainingQuantity < 0;

  const priceResult = effectiveTotalQuantity > 0 && tiers.length > 0
    ? calculateApplicablePrice(effectiveTotalQuantity, tiers, product.price || 0, product.discounted_price)
    : null;

  // Validação adaptada para preço escalonado
  const validation = hasTieredPricing
    ? {
        isValid: items.length > 0 && distributedSum > 0 && items.every(item => item.quantity > 0),
        errors: items.length === 0 ? ['Adicione pelo menos uma variação'] :
                distributedSum === 0 ? ['A quantidade total deve ser maior que zero'] :
                items.some(item => item.quantity <= 0) ? ['Todas as quantidades devem ser maiores que zero'] : [],
        warnings: []
      }
    : validateDistribution(totalQuantity, items);

  const addItem = () => {
    if (newQuantity <= 0) return;
    if (hasColors && !newColor) return;
    if (hasSizes && !newSize) return;

    const isDuplicate = items.some(
      item => item.color === newColor && item.size === newSize
    );

    if (isDuplicate) {
      return;
    }

    const newItem: DistributionItemInput = {
      id: `${Date.now()}-${Math.random()}`,
      color: hasColors ? newColor : undefined,
      size: hasSizes ? newSize : undefined,
      quantity: newQuantity,
    };

    setItems([...items, newItem]);

    setNewColor('');
    setNewSize('');
    setNewQuantity(1);
  };

  const removeItem = (id: string) => {
    setItems(items.filter(item => item.id !== id));
  };

  const updateItemQuantity = (id: string, quantity: number) => {
    if (quantity < 0) return;
    setItems(items.map(item =>
      item.id === id ? { ...item, quantity } : item
    ));
  };

  const handleConfirm = () => {
    if (!validation.isValid) return;

    const cleanedItems = items.map(({ color, size, quantity }) => ({
      color,
      size,
      quantity,
    }));

    onConfirm(effectiveTotalQuantity, cleanedItems);
    handleClose();
  };

  const handleClose = () => {
    setTotalQuantity(1);
    setItems([]);
    setNewColor('');
    setNewSize('');
    setNewQuantity(1);
    onClose();
  };

  const distributeEqually = () => {
    if (items.length === 0) return;

    const quantityPerItem = Math.floor(totalQuantity / items.length);
    const remainder = totalQuantity % items.length;

    const updatedItems = items.map((item, index) => ({
      ...item,
      quantity: quantityPerItem + (index < remainder ? 1 : 0),
    }));

    setItems(updatedItems);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Distribuir Variações
          </DialogTitle>
          <DialogDescription>
            {product.title}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 flex-1 overflow-y-auto overflow-x-hidden px-1">
          {!hasTieredPricing && (
            <div className="space-y-2">
              <Label htmlFor="total-quantity">Quantidade Total Desejada</Label>
              <Input
                id="total-quantity"
                type="number"
                min="1"
                value={totalQuantity}
                onChange={(e) => setTotalQuantity(Math.max(1, parseInt(e.target.value) || 1))}
              />
            </div>
          )}

          {priceResult && (
            <Alert className="bg-emerald-50 border-emerald-200 dark:bg-emerald-950 dark:border-emerald-800">
              <Check className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              <AlertDescription className="text-emerald-800 dark:text-emerald-200">
                <div className="space-y-1">
                  <p className="font-semibold">Preço Escalonado Aplicado</p>
                  <p className="text-sm">
                    {priceResult.minQuantity} - {priceResult.maxQuantity ? `${priceResult.maxQuantity} unidades` : 'mais unidades'}
                  </p>
                  <p className="text-lg font-bold">
                    R$ {priceResult.unitPrice.toFixed(2)} por unidade
                  </p>
                  {effectiveTotalQuantity > 0 && (
                    <p className="text-sm">
                      Total ({effectiveTotalQuantity} {effectiveTotalQuantity === 1 ? 'unidade' : 'unidades'}): R$ {(priceResult.unitPrice * effectiveTotalQuantity).toFixed(2)}
                    </p>
                  )}
                </div>
              </AlertDescription>
            </Alert>
          )}

          {!hasTieredPricing && <Separator />}

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Distribuição de Variações</Label>
              {items.length > 0 && !hasTieredPricing && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={distributeEqually}
                >
                  Distribuir Igualmente
                </Button>
              )}
            </div>

            <div className="grid gap-2 grid-cols-[1fr_1fr_100px_40px]">
              {hasColors && (
                <div>
                  <Label htmlFor="new-color" className="text-xs">Cor</Label>
                  <select
                    id="new-color"
                    value={newColor}
                    onChange={(e) => setNewColor(e.target.value)}
                    className="w-full h-9 px-3 rounded-md border border-input bg-background text-sm"
                  >
                    <option value="">Selecione</option>
                    {product.colors?.map(color => (
                      <option key={color} value={color}>{color}</option>
                    ))}
                  </select>
                </div>
              )}

              {hasSizes && (
                <div>
                  <Label htmlFor="new-size" className="text-xs">Tamanho</Label>
                  <select
                    id="new-size"
                    value={newSize}
                    onChange={(e) => setNewSize(e.target.value)}
                    className="w-full h-9 px-3 rounded-md border border-input bg-background text-sm"
                  >
                    <option value="">Selecione</option>
                    {product.sizes?.map(size => (
                      <option key={size} value={size}>{size}</option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <Label htmlFor="new-quantity" className="text-xs">Qtd.</Label>
                <Input
                  id="new-quantity"
                  type="number"
                  min="1"
                  value={newQuantity}
                  onChange={(e) => setNewQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                  className="h-9"
                />
              </div>

              <div className="flex items-end">
                <Button
                  type="button"
                  size="icon"
                  onClick={addItem}
                  disabled={
                    (hasColors && !newColor) ||
                    (hasSizes && !newSize) ||
                    newQuantity <= 0
                  }
                  className="h-9 w-9"
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>

          {items.length === 0 ? (
            <div className="border-2 border-dashed rounded-lg p-8 text-center">
              <p className="text-sm text-muted-foreground">Nenhuma variação adicionada ainda</p>
            </div>
          ) : (
            <div className="space-y-2 overflow-y-auto" style={{ maxHeight: hasTieredPricing ? '220px' : '260px' }}>
              {items.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center gap-3 p-3 border rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors"
                >
                  <div className="flex-1 flex items-center gap-2 flex-wrap min-w-0">
                    {item.color && (
                      <Badge variant="secondary" className="text-xs">{item.color}</Badge>
                    )}
                    {item.size && (
                      <Badge variant="secondary" className="text-xs">{item.size}</Badge>
                    )}
                    {!item.color && !item.size && (
                      <span className="text-xs text-muted-foreground">Sem variação</span>
                    )}
                  </div>

                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button
                      type="button"
                      className="h-7 w-7 rounded border border-input bg-background flex items-center justify-center text-sm hover:bg-muted transition-colors"
                      onClick={() => updateItemQuantity(item.id, Math.max(1, item.quantity - 1))}
                    >
                      −
                    </button>
                    <Input
                      type="number"
                      min="1"
                      value={item.quantity}
                      onChange={(e) => updateItemQuantity(item.id, Math.max(1, parseInt(e.target.value) || 1))}
                      className="w-16 h-7 text-center text-sm px-1"
                    />
                    <button
                      type="button"
                      className="h-7 w-7 rounded border border-input bg-background flex items-center justify-center text-sm hover:bg-muted transition-colors"
                      onClick={() => updateItemQuantity(item.id, item.quantity + 1)}
                    >
                      +
                    </button>
                  </div>

                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    onClick={() => removeItem(item.id)}
                    className="h-7 w-7 flex-shrink-0 text-muted-foreground hover:text-destructive"
                  >
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          )}

          {!hasTieredPricing && items.length > 0 && (
            <div className="bg-muted/40 rounded-lg px-4 py-3 flex items-center justify-between gap-4 text-sm">
              <div className="flex items-center gap-4">
                <span className="text-muted-foreground">Total: <span className="font-semibold text-foreground">{totalQuantity}</span></span>
                <span className="text-muted-foreground">Distribuído: <span className={`font-semibold ${distributedSum > totalQuantity ? 'text-destructive' : 'text-foreground'}`}>{distributedSum}</span></span>
              </div>
              <span className={`font-semibold ${remainingQuantity < 0 ? 'text-destructive' : remainingQuantity === 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-foreground'}`}>
                {remainingQuantity === 0 ? 'Completo' : `Restante: ${remainingQuantity}`}
              </span>
            </div>
          )}

          {validation.errors.length > 0 && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                <ul className="list-disc list-inside space-y-1">
                  {validation.errors.map((error, index) => (
                    <li key={index} className="text-sm">{error}</li>
                  ))}
                </ul>
              </AlertDescription>
            </Alert>
          )}

          {validation.warnings.length > 0 && validation.errors.length === 0 && (
            <Alert className="bg-amber-50 border-amber-200 dark:bg-amber-950 dark:border-amber-800">
              <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
              <AlertDescription className="text-amber-800 dark:text-amber-200">
                <ul className="list-disc list-inside space-y-1">
                  {validation.warnings.map((warning, index) => (
                    <li key={index} className="text-sm">{warning}</li>
                  ))}
                </ul>
              </AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter className="flex-shrink-0 pt-4">
          <Button type="button" variant="outline" onClick={handleClose}>
            Cancelar
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={!validation.isValid || loading}
          >
            {hasTieredPricing ? 'Adicionar ao Carrinho' : (isComplete ? 'Adicionar ao Carrinho' : 'Adicionar Parcialmente')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
