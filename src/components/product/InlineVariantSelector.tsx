import { useState } from 'react';
import { ShoppingCart } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { QuantityStepper } from '@/components/ui/quantity-stepper';
import { getColorValue } from '@/lib/utils';
import { getVariantAvailable, type VariantStockInfo } from '@/lib/variantAvailability';
import { useCart } from '@/contexts/CartContext';
import { toast } from 'sonner';
import type { Product } from '@/types';

interface InlineVariantSelectorProps {
  product: Product;
  variantStockData: VariantStockInfo[];
  inventoryEnabled: boolean;
  blockZeroStock: boolean;
  onOpenVariantModal: () => void;
}

const LIGHT_COLORS = ['branco', 'amarelo', 'bege', 'off-white', 'creme'];

// Past this many options, swatch/badge buttons for that dimension stop
// scaling — a wall of buttons gets hard to scan and eats a lot of vertical
// space. Above the threshold that dimension renders as a compact dropdown
// instead (same reasoning ProductVariantModal already uses Select for
// color/size there), while dimensions still under it keep the more visual,
// faster-to-tap button/swatch row.
const MANY_OPTIONS_THRESHOLD = 8;

// Non-modal counterpart to ProductVariantModal, scoped to plain-priced
// products (no tiered pricing, no weight variants — those keep using the
// modal, see ProductDetailsPage's useInlineSelector flag). Lets a buyer pick
// one color/size/flavor combination + quantity right on the page instead of
// opening a dialog first; "add another combination" still routes to the
// modal's existing distribution mode via onOpenVariantModal.
export default function InlineVariantSelector({
  product,
  variantStockData,
  inventoryEnabled,
  blockZeroStock,
  onOpenVariantModal,
}: InlineVariantSelectorProps) {
  const { addToCart, getItemQuantity } = useCart();
  const [selectedColor, setSelectedColor] = useState<string | undefined>();
  const [selectedSize, setSelectedSize] = useState<string | undefined>();
  const [selectedFlavor, setSelectedFlavor] = useState<string | undefined>();
  const [quantity, setQuantity] = useState(1);

  const colors = product.colors ?? [];
  const sizes = product.sizes ?? [];
  const flavors = product.flavors ?? [];
  const hasColors = colors.some((c) => c?.trim());
  const hasSizes = sizes.some((s) => s?.trim());
  const hasFlavors = flavors.some((f) => f?.trim());
  const useColorDropdown = colors.length > MANY_OPTIONS_THRESHOLD;
  const useSizeDropdown = sizes.length > MANY_OPTIONS_THRESHOLD;
  const useFlavorDropdown = flavors.length > MANY_OPTIONS_THRESHOLD;

  const availableFor = (color?: string, size?: string, flavor?: string) =>
    getVariantAvailable(product, variantStockData, inventoryEnabled, color, size, flavor);

  const currentAvailable = availableFor(
    hasColors ? selectedColor : undefined,
    hasSizes ? selectedSize : undefined,
    hasFlavors ? selectedFlavor : undefined
  );
  const isSelectionOutOfStock = currentAvailable !== null && currentAvailable <= 0;
  const maxQuantity = currentAvailable ?? undefined;

  const canAddToCart =
    (!hasColors || !!selectedColor) &&
    (!hasSizes || !!selectedSize) &&
    (!hasFlavors || !!selectedFlavor) &&
    !(blockZeroStock && isSelectionOutOfStock);

  const totalInCart = getItemQuantity(product.id);

  function handleAdd() {
    if (!canAddToCart) {
      toast.error('Selecione as opções do produto');
      return;
    }
    addToCart(product, selectedColor, selectedSize, quantity, undefined, selectedFlavor);
    toast.success(`${quantity} ${quantity === 1 ? 'item adicionado' : 'itens adicionados'} ao carrinho`);
    setQuantity(1);
  }

  return (
    <div className="mt-8 space-y-6">
      {hasColors && (
        <div className="space-y-3">
          <h3 className="text-lg font-semibold text-foreground">Cor</h3>
          {useColorDropdown ? (
            <Select value={selectedColor || ''} onValueChange={(v) => setSelectedColor(v || undefined)}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione uma cor">
                  {selectedColor && (
                    <div className="flex items-center gap-2">
                      <div
                        className="w-4 h-4 rounded-full border border-border shadow-sm"
                        style={{ backgroundColor: getColorValue(selectedColor) }}
                      />
                      <span className="capitalize">{selectedColor}</span>
                    </div>
                  )}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {colors.map((color) => {
                  const available = availableFor(color, hasSizes ? selectedSize : undefined, hasFlavors ? selectedFlavor : undefined);
                  const outOfStock = available !== null && available <= 0;
                  return (
                    <SelectItem key={color} value={color} disabled={outOfStock}>
                      <div className="flex items-center gap-2">
                        <div
                          className="w-3 h-3 rounded-full border border-border"
                          style={{ backgroundColor: getColorValue(color) }}
                        />
                        <span className="capitalize">{color}</span>
                        {outOfStock && <Badge variant="destructive" className="text-[10px] px-1 py-0">Esgotado</Badge>}
                      </div>
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          ) : (
            <div className="flex flex-wrap gap-3">
              {colors.map((color) => {
                const colorValue = getColorValue(color);
                const isLightColor = LIGHT_COLORS.includes(color.toLowerCase());
                const isSelected = selectedColor === color;
                const available = availableFor(color, hasSizes ? selectedSize : undefined, hasFlavors ? selectedFlavor : undefined);
                const outOfStock = available !== null && available <= 0;
                return (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setSelectedColor(color)}
                    disabled={outOfStock}
                    className={`relative flex items-center gap-2 px-3 py-2 rounded-lg border-2 bg-card transition-all ${
                      isSelected ? 'border-primary shadow-md' : 'border-border hover:border-border/80'
                    } ${outOfStock ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    <div
                      className={`w-4 h-4 rounded-full border ${isLightColor ? 'border-border' : 'border-border/60'} shadow-sm`}
                      style={{ backgroundColor: colorValue }}
                    />
                    <span className={`text-sm capitalize text-foreground ${outOfStock ? 'line-through text-muted-foreground' : ''}`}>
                      {color}
                    </span>
                    {outOfStock && (
                      <span className="absolute -bottom-2 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-red-600 px-1.5 py-0.5 text-[9px] font-medium leading-none text-white">
                        Esgotado
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {hasSizes && (
        <div className="space-y-3">
          <h3 className="text-lg font-semibold text-foreground">Tamanho</h3>
          {useSizeDropdown ? (
            <Select value={selectedSize || ''} onValueChange={(v) => setSelectedSize(v || undefined)}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione um tamanho">
                  {selectedSize && <span className="font-medium">{selectedSize}</span>}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {sizes.map((size) => {
                  const available = availableFor(hasColors ? selectedColor : undefined, size, hasFlavors ? selectedFlavor : undefined);
                  const outOfStock = available !== null && available <= 0;
                  return (
                    <SelectItem key={size} value={size} disabled={outOfStock}>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{size}</span>
                        {outOfStock && <Badge variant="destructive" className="text-[10px] px-1 py-0">Esgotado</Badge>}
                      </div>
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          ) : (
            <div className="flex flex-wrap gap-3">
              {sizes.map((size) => {
                const isSelected = selectedSize === size;
                const available = availableFor(hasColors ? selectedColor : undefined, size, hasFlavors ? selectedFlavor : undefined);
                const outOfStock = available !== null && available <= 0;
                return (
                  <button
                    key={size}
                    type="button"
                    onClick={() => setSelectedSize(size)}
                    disabled={outOfStock}
                    className={`relative flex items-center justify-center w-12 h-12 rounded-full border-2 shadow-sm transition-all duration-200 ${
                      isSelected ? 'border-primary bg-primary/10' : 'border-border bg-card hover:border-border/80'
                    } ${outOfStock ? 'opacity-50 cursor-not-allowed' : 'hover:shadow-md'}`}
                  >
                    <span className={`text-sm font-semibold ${outOfStock ? 'text-muted-foreground line-through' : 'text-foreground'}`}>
                      {size}
                    </span>
                    {outOfStock && (
                      <span className="absolute -bottom-2 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-red-600 px-1.5 py-0.5 text-[9px] font-medium leading-none text-white">
                        Esgotado
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {hasFlavors && (
        <div className="space-y-3">
          <h3 className="text-lg font-semibold text-foreground">Sabor</h3>
          {useFlavorDropdown ? (
            <Select value={selectedFlavor || ''} onValueChange={(v) => setSelectedFlavor(v || undefined)}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione um sabor">
                  {selectedFlavor && <span className="capitalize">{selectedFlavor}</span>}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {flavors.map((flavor) => (
                  <SelectItem key={flavor} value={flavor}>
                    <span className="capitalize">{flavor}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <div className="flex flex-wrap gap-3">
              {flavors.map((flavor) => {
                const isSelected = selectedFlavor === flavor;
                return (
                  <button
                    key={flavor}
                    type="button"
                    onClick={() => setSelectedFlavor(flavor)}
                    className={`flex items-center px-4 py-2 rounded-full border-2 bg-background shadow-sm transition-all duration-200 ${
                      isSelected ? 'border-primary bg-primary/10' : 'border-primary/20 hover:border-primary/40'
                    }`}
                  >
                    <span className="text-sm font-semibold text-foreground capitalize">{flavor}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      <div className="space-y-3">
        <h3 className="text-lg font-semibold text-foreground">Quantidade</h3>
        <QuantityStepper value={quantity} onChange={setQuantity} max={maxQuantity} />
      </div>

      <div className="space-y-2">
        <Button size="lg" className="w-full" onClick={handleAdd} disabled={!canAddToCart}>
          <ShoppingCart className="h-5 w-5 mr-2" />
          {totalInCart > 0 ? `No Carrinho (${totalInCart}) · Adicionar mais` : 'Adicionar ao carrinho'}
        </Button>
        <button
          type="button"
          onClick={onOpenVariantModal}
          className="w-full text-center text-sm text-muted-foreground hover:text-foreground underline underline-offset-2"
        >
          Quero adicionar mais de uma cor/tamanho
        </button>
      </div>
    </div>
  );
}
