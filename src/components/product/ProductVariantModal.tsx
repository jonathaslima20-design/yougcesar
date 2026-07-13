import { useState, useEffect } from 'react';
import { ShoppingCart, Plus, Minus, X, TrendingDown, Trash2, Palette, Ruler, IceCreamBowl as IceCream, Scale } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useCart } from '@/contexts/CartContext';
import { formatCurrencyI18n, useTranslation, type SupportedLanguage, type SupportedCurrency } from '@/lib/i18n';
import { toast } from 'sonner';
import { getColorValue } from '@/lib/utils';
import type { Product, PriceTier, WeightVariant } from '@/types';
import { fetchProductPriceTiers, calculateApplicablePrice, formatPriceTierRange } from '@/lib/tieredPricingUtils';
import { supabase } from '@/lib/supabase';
import TieredPricingIndicator from '@/components/product/TieredPricingIndicator';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

interface DistributionItem {
  id: string;
  color?: string;
  size?: string;
  quantity: number;
}

interface VariantStockInfo {
  id: string;
  color: string | null;
  size: string | null;
  flavor: string | null;
  weight_variant_id: string | null;
  quantity: number;
  reserved_quantity: number;
  available: number;
}

interface ProductVariantModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product: Product;
  currency?: SupportedCurrency;
  language?: SupportedLanguage;
  variantStockData?: VariantStockInfo[];
  inventoryEnabled?: boolean;
  blockZeroStock?: boolean;
  showStockOnStorefront?: boolean;
}

export default function ProductVariantModal({
  open,
  onOpenChange,
  product,
  currency = 'BRL',
  language = 'pt-BR',
  variantStockData = [],
  inventoryEnabled = false,
  blockZeroStock = false,
  showStockOnStorefront = false,
}: ProductVariantModalProps) {
  const [quantity, setQuantity] = useState(1);
  const [distributionMode, setDistributionMode] = useState(false);
  const [distributionItems, setDistributionItems] = useState<DistributionItem[]>([]);
  const [newItemColor, setNewItemColor] = useState<string | undefined>();
  const [newItemSize, setNewItemSize] = useState<string | undefined>();
  const [newItemQuantity, setNewItemQuantity] = useState(1);
  const [priceTiers, setPriceTiers] = useState<PriceTier[]>([]);
  const [hasTieredPricing, setHasTieredPricing] = useState(product.has_tiered_pricing || false);
  const [loadingTiers, setLoadingTiers] = useState(product.has_tiered_pricing ? true : false);
  const [minQuantity, setMinQuantity] = useState(1);
  const [selectedColor, setSelectedColor] = useState<string | undefined>();
  const [selectedSize, setSelectedSize] = useState<string | undefined>();
  const [selectedFlavor, setSelectedFlavor] = useState<string | undefined>();
  const [weightVariants, setWeightVariants] = useState<WeightVariant[]>([]);
  const [selectedWeightVariantId, setSelectedWeightVariantId] = useState<string | undefined>();
  const hasWeightVariants = !!product.has_weight_variants;
  const { addToCart, hasVariant, getVariantQuantity } = useCart();
  const { t } = useTranslation(language);

  const getVariantAvailable = (color?: string, size?: string, flavor?: string): number | null => {
    if (!inventoryEnabled || !product.track_inventory || variantStockData.length === 0) return null;
    const match = variantStockData.find(
      (v) =>
        (v.color || null) === (color || null) &&
        (v.size || null) === (size || null) &&
        (v.flavor || null) === (flavor || null)
    );
    if (match) return match.available;
    if (variantStockData.length === 1 && !variantStockData[0].color && !variantStockData[0].size && !variantStockData[0].flavor) {
      return variantStockData[0].available;
    }
    return null;
  };

  const currentVariantAvailable = getVariantAvailable(selectedColor, selectedSize, selectedFlavor);
  const isVariantOutOfStock = currentVariantAvailable !== null && currentVariantAvailable <= 0;
  const maxQuantityForVariant = currentVariantAvailable !== null && currentVariantAvailable > 0 ? currentVariantAvailable : undefined;

  useEffect(() => {
    const loadTieredPricing = async () => {
      if (!product.id) return;

      setLoadingTiers(true);
      try {
        const { data: productData } = await supabase
          .from('products')
          .select('has_tiered_pricing')
          .eq('id', product.id)
          .single();

        if (productData?.has_tiered_pricing) {
          const tiers = await fetchProductPriceTiers(product.id);
          setPriceTiers(tiers);
          setHasTieredPricing(true);

          if (tiers.length > 0) {
            const minTierQuantity = tiers[0].min_quantity;
            setMinQuantity(minTierQuantity);
            setQuantity(minTierQuantity);
          }
        }
      } catch (error) {
        console.error('Error loading tiered pricing:', error);
      } finally {
        setLoadingTiers(false);
      }
    };

    if (open) {
      loadTieredPricing();
    }
  }, [product.id, open]);

  useEffect(() => {
    if (!open || !hasWeightVariants) return;
    (async () => {
      const { data } = await supabase
        .from('product_weight_variants')
        .select('*')
        .eq('product_id', product.id)
        .order('display_order');
      if (data) {
        const mapped = data.map((v) => ({
          id: v.id,
          product_id: v.product_id,
          label: v.label,
          unit_value: Number(v.unit_value) || 0,
          unit_type: v.unit_type,
          price: Number(v.price) || 0,
          discounted_price:
            v.discounted_price != null ? Number(v.discounted_price) : null,
          display_order: v.display_order,
        })) as WeightVariant[];
        setWeightVariants(mapped);
        if (mapped.length > 0 && !selectedWeightVariantId) {
          setSelectedWeightVariantId(mapped[0].id);
        }
      }
    })();
  }, [product.id, open, hasWeightVariants, selectedWeightVariantId]);

  // More robust checking for colors and sizes
  const hasColors = Boolean(
    product.colors && 
    Array.isArray(product.colors) && 
    product.colors.length > 0 &&
    product.colors.some(color => color && typeof color === 'string' && color.trim().length > 0)
  );
                   
  const hasSizes = Boolean(
    product.sizes &&
    Array.isArray(product.sizes) &&
    product.sizes.length > 0 &&
    product.sizes.some(size => size && typeof size === 'string' && size.trim().length > 0)
  );

  const hasFlavors = Boolean(
    product.flavors &&
    Array.isArray(product.flavors) &&
    product.flavors.length > 0 &&
    product.flavors.some(flavor => flavor && typeof flavor === 'string' && flavor.trim().length > 0)
  );

  const hasOptions = hasColors || hasSizes;

  // Debug logging for development
  if (process.env.NODE_ENV === 'development') {
    console.log('🛒 ProductVariantModal - Product data:', {
      id: product.id,
      colors: product.colors,
      sizes: product.sizes,
      hasColors,
      hasSizes
    });
  }

  // Separate apparel sizes from shoe sizes
  const separateSizes = (sizes: string[]) => {
    const apparelSizes: string[] = [];
    const shoeSizes: string[] = [];
    
    sizes.forEach((size: string) => {
      const numericSize = parseInt(size);
      if (!isNaN(numericSize) && numericSize >= 17 && numericSize <= 43) {
        shoeSizes.push(size);
      } else {
        apparelSizes.push(size);
      }
    });

    return { apparelSizes, shoeSizes };
  };

  const sortSizes = (sizes: string[], isShoe: boolean) => {
    if (isShoe) {
      return sizes.sort((a, b) => parseInt(a) - parseInt(b));
    } else {
      const sizeOrder = ['PP', 'P', 'M', 'G', 'GG', 'XG', 'XXG'];
      return sizes.sort((a, b) => {
        const indexA = sizeOrder.indexOf(a);
        const indexB = sizeOrder.indexOf(b);
        if (indexA !== -1 && indexB !== -1) return indexA - indexB;
        if (indexA !== -1) return -1;
        if (indexB !== -1) return 1;
        return a.localeCompare(b);
      });
    }
  };

  // Calculate distributed quantity
  const distributedQuantity = distributionItems.reduce((sum, item) => sum + item.quantity, 0);
  const remainingQuantity = quantity - distributedQuantity;
  const isDistributionComplete = distributedQuantity === quantity;
  const isDistributionOverflow = distributedQuantity > quantity;

  // Enable distribution mode when quantity > 1 and product has options
  useEffect(() => {
    if (hasOptions && quantity > 1) {
      setDistributionMode(true);
    } else {
      setDistributionMode(false);
      setDistributionItems([]);
    }
  }, [quantity, hasOptions]);

  // Reset modal when closed
  useEffect(() => {
    if (!open) {
      setQuantity(hasTieredPricing ? minQuantity : 1);
      setDistributionMode(false);
      setDistributionItems([]);
      setNewItemColor(undefined);
      setNewItemSize(undefined);
      setNewItemQuantity(1);
      setSelectedFlavor(undefined);
      setSelectedColor(undefined);
      setSelectedSize(undefined);
    }
  }, [open, hasTieredPricing, minQuantity]);

  const addDistributionItem = () => {
    if (hasColors && !newItemColor) {
      toast.error('Selecione uma cor');
      return;
    }
    if (hasSizes && !newItemSize) {
      toast.error('Selecione um tamanho');
      return;
    }
    if (newItemQuantity <= 0) {
      toast.error('Quantidade deve ser maior que zero');
      return;
    }
    if (distributedQuantity + newItemQuantity > quantity) {
      toast.error(`Quantidade excede o total. Restante: ${remainingQuantity}`);
      return;
    }

    // Check for duplicate
    const isDuplicate = distributionItems.some(
      item => item.color === newItemColor && item.size === newItemSize
    );

    if (isDuplicate) {
      toast.error('Esta combinação de cor e tamanho já foi adicionada');
      return;
    }

    const newItem: DistributionItem = {
      id: `${Date.now()}-${Math.random()}`,
      color: hasColors ? newItemColor : undefined,
      size: hasSizes ? newItemSize : undefined,
      quantity: newItemQuantity,
    };

    setDistributionItems([...distributionItems, newItem]);
    setNewItemColor(undefined);
    setNewItemSize(undefined);
    setNewItemQuantity(1);
  };

  const removeDistributionItem = (id: string) => {
    setDistributionItems(distributionItems.filter(item => item.id !== id));
  };

  const updateDistributionItemQuantity = (id: string, newQty: number) => {
    if (newQty <= 0) {
      removeDistributionItem(id);
      return;
    }

    setDistributionItems(distributionItems.map(item =>
      item.id === id ? { ...item, quantity: newQty } : item
    ));
  };

  const handleAddToCart = () => {
    // Calculate the unit price (with tiered pricing if applicable)
    const unitPrice = hasTieredPricing && pricingInfo ? pricingInfo.unitPrice : undefined;

    if (hasFlavors && !selectedFlavor) {
      toast.error('Selecione um sabor antes de adicionar ao carrinho');
      return;
    }

    if (hasWeightVariants && !selectedWeightVariantId) {
      toast.error('Selecione uma variação de peso antes de adicionar ao carrinho');
      return;
    }

    const selectedWeight = hasWeightVariants
      ? weightVariants.find((v) => v.id === selectedWeightVariantId)
      : undefined;
    const weightPayload = selectedWeight
      ? {
          id: selectedWeight.id!,
          label: selectedWeight.label,
          price: selectedWeight.discounted_price ?? selectedWeight.price,
        }
      : undefined;

    // If distribution mode is active and has options
    if (distributionMode && hasOptions) {
      // Validate distribution is complete
      if (!isDistributionComplete) {
        toast.error(`Distribua todas as ${quantity} unidades. Restante: ${remainingQuantity}`);
        return;
      }

      if (distributionItems.length === 0) {
        toast.error('Adicione pelo menos uma variação');
        return;
      }

      // Add each distribution item to cart separately
      distributionItems.forEach(item => {
        addToCart(product, item.color, item.size, item.quantity, unitPrice, selectedFlavor, weightPayload);
      });

      toast.success(`${quantity} ${quantity === 1 ? 'item adicionado' : 'itens adicionados'} ao carrinho`);
    } else {
      // Simple add to cart - pass selected color and size if available
      addToCart(product, selectedColor, selectedSize, quantity, unitPrice, selectedFlavor, weightPayload);
      toast.success(`${quantity} ${quantity === 1 ? 'item adicionado' : 'itens adicionados'} ao carrinho`);
    }

    // Reset and close
    onOpenChange(false);
  };

  const stockBlocked = blockZeroStock && isVariantOutOfStock;
  const canAddToCart = (distributionMode ? isDistributionComplete : true) && (!hasFlavors || !!selectedFlavor) && (!hasWeightVariants || !!selectedWeightVariantId) && !stockBlocked;

  const selectedWeightVariantForPrice = hasWeightVariants
    ? weightVariants.find((v) => v.id === selectedWeightVariantId)
    : undefined;
  const weightBasePrice = selectedWeightVariantForPrice
    ? selectedWeightVariantForPrice.discounted_price ?? selectedWeightVariantForPrice.price
    : undefined;

  // Calculate price with tiered pricing if applicable
  let price = weightBasePrice ?? product.discounted_price ?? product.price;
  let displayPrice = price;
  let totalPrice = price * quantity;
  let pricingInfo = null;

  if (hasTieredPricing && priceTiers.length > 0) {
    const result = calculateApplicablePrice(
      quantity,
      priceTiers,
      product.price || 0,
      product.discounted_price
    );
    price = result.unitPrice;
    totalPrice = result.totalPrice;
    pricingInfo = result;

    // Find the lowest unit price across all tiers for display
    const lowestPrice = Math.min(
      ...priceTiers.map(tier => tier.discounted_unit_price || tier.unit_price)
    );
    displayPrice = lowestPrice;
  }

  // If price is still 0 or undefined and we have tiered pricing, use the minimum tier price
  if ((!price || price === 0) && hasTieredPricing && priceTiers.length > 0) {
    const firstTier = priceTiers[0];
    price = firstTier.discounted_unit_price || firstTier.unit_price;
    totalPrice = price * quantity;
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] flex flex-col">
        <>
          <DialogHeader className="flex-shrink-0">
            <DialogTitle className="flex items-center gap-2">
              <ShoppingCart className="h-5 w-5" />
              Selecionar Opções
            </DialogTitle>
            <DialogDescription>
              {product.title}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 overflow-y-auto pr-2 -mr-2">
          {/* Product Image and Price */}
          <div className="flex gap-4">
            <div className="w-20 h-20 bg-white rounded-lg overflow-hidden border border-gray-200 shadow-sm flex-shrink-0">
              <img
                src={(selectedColor && product.product_images?.find((img) => img.associated_color === selectedColor)?.url) || product.featured_image_url || 'https://images.pexels.com/photos/3802510/pexels-photo-3802510.jpeg'}
                alt={product.title}
                className="w-full h-full object-cover"
              />
            </div>
            <div className="flex-1">
              <div className="text-lg font-bold text-primary">
                {(product.is_starting_price || hasTieredPricing) ? t('product.starting_from') + ' ' : ''}
                {formatCurrencyI18n(displayPrice, currency, language)}
              </div>
              {product.short_description && (
                <p className="text-sm text-muted-foreground mt-1">
                  {product.short_description}
                </p>
              )}
            </div>
          </div>

          {/* Variant stock indicator */}
          {inventoryEnabled && product.track_inventory && currentVariantAvailable !== null && (
            <div className={`flex items-center gap-2 rounded-lg px-3 py-2 text-xs ${
              isVariantOutOfStock
                ? 'bg-red-500/10 text-red-600'
                : currentVariantAvailable <= (product.low_stock_threshold ?? 5)
                ? 'bg-amber-500/10 text-amber-600'
                : showStockOnStorefront
                ? 'bg-emerald-500/10 text-emerald-600'
                : ''
            }`}>
              {isVariantOutOfStock ? (
                <span className="font-medium">Variante esgotada</span>
              ) : currentVariantAvailable <= (product.low_stock_threshold ?? 5) ? (
                <span className="font-medium">Restam apenas {currentVariantAvailable} unidades</span>
              ) : showStockOnStorefront ? (
                <span>{currentVariantAvailable} unidades disponíveis</span>
              ) : null}
            </div>
          )}

          {/* Quantity Selection - Only shown when NO tiered pricing */}
          {!hasTieredPricing && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium">Quantidade Total</Label>
              </div>
              <div className="flex items-center gap-3">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setQuantity(Math.max(minQuantity, quantity - 1))}
                  disabled={quantity <= minQuantity}
                >
                  <Minus className="h-4 w-4" />
                </Button>
                <span className="text-lg font-semibold w-12 text-center">
                  {quantity}
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    if (maxQuantityForVariant && quantity >= maxQuantityForVariant) return;
                    setQuantity(quantity + 1);
                  }}
                  disabled={maxQuantityForVariant !== undefined && quantity >= maxQuantityForVariant}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}

          {/* Tiered Pricing Info */}
          {hasTieredPricing && (
            <>
              {loadingTiers ? (
                <Card className="border-blue-200 dark:border-blue-800">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <TrendingDown className="h-4 w-4 text-blue-600" />
                      Carregando Faixas de Preço...
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="h-8 bg-muted animate-pulse rounded" />
                    <div className="grid grid-cols-2 gap-2">
                      {[1, 2, 3, 4].map((i) => (
                        <div key={i} className="h-20 bg-muted animate-pulse rounded" />
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ) : pricingInfo ? (
                <TieredPricingIndicator
                  currentQuantity={quantity}
                  nextTierQuantity={pricingInfo.nextTier?.quantity || 0}
                  nextTierSavings={pricingInfo.nextTierSavings}
                  appliedTierSavings={pricingInfo.savings}
                  currency={currency}
                  language={language}
                />
              ) : null}
            </>
          )}

          {/* Quick Tier Selector */}
          {hasTieredPricing && !loadingTiers && priceTiers.length > 0 && (
            <Card className="border-blue-200 dark:border-blue-800">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <TrendingDown className="h-4 w-4 text-blue-600" />
                  Seleção Rápida de Quantidade
                </CardTitle>
                <CardDescription className="text-xs">
                  Clique para selecionar uma quantidade e ver o preço
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-2">
                  {priceTiers.slice(0, 4).map((tier) => {
                    const tierPrice = tier.discounted_unit_price || tier.unit_price;
                    const tierTotal = tierPrice * tier.min_quantity;
                    const basePrice = product.discounted_price || product.price;
                    const savings = (basePrice * tier.min_quantity) - tierTotal;
                    const savingsPercent = Math.round((savings / (basePrice * tier.min_quantity)) * 100);

                    return (
                      <Button
                        key={tier.id}
                        variant={quantity === tier.min_quantity ? "default" : "outline"}
                        className="h-auto py-2 px-3 flex flex-col items-start"
                        onClick={() => setQuantity(tier.min_quantity)}
                      >
                        <div className="text-xs font-semibold">{tier.min_quantity} {tier.min_quantity === 1 ? 'Unidade' : 'Unidades'}</div>
                        <div className="text-xs text-muted-foreground">
                          {formatCurrencyI18n(tierPrice, currency, language)}/un
                        </div>
                        {savingsPercent > 0 && (
                          <div className="text-xs text-green-600 font-medium">
                            -{savingsPercent}%
                          </div>
                        )}
                      </Button>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Distribution Section - NEW */}
          {distributionMode && hasOptions && (
            <Card className="border-orange-200 dark:border-orange-800">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Distribuir por Cor e Tamanho</CardTitle>
                <CardDescription className="text-xs">
                  Distribua as {quantity} unidades entre cores e tamanhos
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Distribution Progress */}
                <div className="space-y-2">
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Distribuído</span>
                    <span className={isDistributionOverflow ? 'text-destructive font-bold' : isDistributionComplete ? 'text-green-600 font-bold' : 'font-medium'}>
                      {distributedQuantity} / {quantity}
                    </span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Restante</span>
                    <span className={remainingQuantity < 0 ? 'text-destructive font-bold' : remainingQuantity === 0 ? 'text-green-600 font-bold' : 'font-medium'}>
                      {remainingQuantity}
                    </span>
                  </div>
                </div>

                {/* Add Distribution Item Form */}
                <div className="space-y-3 p-3 bg-muted/50 rounded-lg">
                  <Label className="text-xs font-medium">Adicionar Variação</Label>
                  <div className="grid gap-2">
                    {hasColors && (
                      <Select value={newItemColor || ''} onValueChange={(value) => setNewItemColor(value || undefined)}>
                        <SelectTrigger className="h-9">
                          <SelectValue placeholder="Cor">
                            {newItemColor && (
                              <div className="flex items-center gap-2">
                                <div
                                  className="w-3 h-3 rounded-full border border-gray-300"
                                  style={{ backgroundColor: getColorValue(newItemColor) }}
                                />
                                <span className="capitalize text-xs">{newItemColor}</span>
                              </div>
                            )}
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          {product.colors!.map((color: string) => (
                            <SelectItem key={color} value={color}>
                              <div className="flex items-center gap-2">
                                <div
                                  className="w-3 h-3 rounded-full border border-gray-300"
                                  style={{ backgroundColor: getColorValue(color) }}
                                />
                                <span className="capitalize text-xs">{color}</span>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}

                    {hasSizes && (
                      <Select value={newItemSize || ''} onValueChange={(value) => setNewItemSize(value || undefined)}>
                        <SelectTrigger className="h-9">
                          <SelectValue placeholder="Tamanho">
                            {newItemSize && (
                              <span className="text-xs">{newItemSize}</span>
                            )}
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          {(() => {
                            const { apparelSizes, shoeSizes } = separateSizes(product.sizes!);
                            const sortedApparelSizes = sortSizes(apparelSizes, false);
                            const sortedShoeSizes = sortSizes(shoeSizes, true);
                            return [...sortedApparelSizes, ...sortedShoeSizes].map((size: string) => (
                              <SelectItem key={size} value={size}>
                                <span className="text-xs">{size}</span>
                              </SelectItem>
                            ));
                          })()}
                        </SelectContent>
                      </Select>
                    )}

                    <div className="flex gap-2">
                      <div className="flex-1 flex items-center gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-9 w-9 p-0"
                          onClick={() => setNewItemQuantity(Math.max(1, newItemQuantity - 1))}
                        >
                          <Minus className="h-3 w-3" />
                        </Button>
                        <span className="text-sm font-medium w-8 text-center">{newItemQuantity}</span>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-9 w-9 p-0"
                          onClick={() => setNewItemQuantity(newItemQuantity + 1)}
                        >
                          <Plus className="h-3 w-3" />
                        </Button>
                      </div>
                      <Button
                        size="sm"
                        onClick={addDistributionItem}
                        disabled={remainingQuantity <= 0 || (hasColors && !newItemColor) || (hasSizes && !newItemSize)}
                        className="h-9"
                      >
                        <Plus className="h-3 w-3 mr-1" />
                        Adicionar
                      </Button>
                    </div>
                  </div>
                </div>

                {/* Distribution Items List */}
                {distributionItems.length > 0 && (
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {distributionItems.map((item) => (
                      <div key={item.id} className="flex items-center gap-2 p-2 bg-background border rounded-lg">
                        <div className="flex-1 flex items-center gap-2 text-xs">
                          {item.color && (
                            <div className="flex items-center gap-1">
                              <Palette className="h-3 w-3 text-muted-foreground" />
                              <div
                                className="w-3 h-3 rounded-full border border-gray-300"
                                style={{ backgroundColor: getColorValue(item.color) }}
                              />
                              <span className="capitalize">{item.color}</span>
                            </div>
                          )}
                          {item.size && (
                            <div className="flex items-center gap-1">
                              <Ruler className="h-3 w-3 text-muted-foreground" />
                              <span>{item.size}</span>
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 w-7 p-0"
                            onClick={() => updateDistributionItemQuantity(item.id, item.quantity - 1)}
                          >
                            <Minus className="h-3 w-3" />
                          </Button>
                          <Badge variant="secondary" className="text-xs min-w-[2rem] justify-center">{item.quantity}</Badge>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 w-7 p-0"
                            onClick={() => updateDistributionItemQuantity(item.id, item.quantity + 1)}
                          >
                            <Plus className="h-3 w-3" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 w-7 p-0 text-destructive"
                            onClick={() => removeDistributionItem(item.id)}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Validation Messages */}
                {!isDistributionComplete && distributionItems.length > 0 && (
                  <div className="p-2 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg">
                    <p className="text-xs text-amber-800 dark:text-amber-200">
                      Você ainda precisa distribuir {remainingQuantity} {remainingQuantity === 1 ? 'unidade' : 'unidades'}
                    </p>
                  </div>
                )}

                {isDistributionOverflow && (
                  <div className="p-2 bg-destructive/10 border border-destructive/20 rounded-lg">
                    <p className="text-xs text-destructive">
                      Você distribuiu {Math.abs(remainingQuantity)} {Math.abs(remainingQuantity) === 1 ? 'unidade' : 'unidades'} a mais que o total
                    </p>
                  </div>
                )}

                {isDistributionComplete && (
                  <div className="p-2 bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 rounded-lg">
                    <p className="text-xs text-green-800 dark:text-green-200 flex items-center gap-1">
                      <Badge className="bg-green-600 text-white h-4 w-4 p-0 flex items-center justify-center">
                        ✓
                      </Badge>
                      Distribuição completa!
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Color Selection - REMOVED (now in distribution) */}
          {!distributionMode && hasColors && (
            <div className="space-y-3">
              <Label className="text-sm font-medium">
                Cor <span className="text-destructive">*</span>
              </Label>
              <Select value={selectedColor || ''} onValueChange={(value) => setSelectedColor(value || undefined)}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione uma cor">
                    {selectedColor && (
                      <div className="flex items-center gap-2">
                        <div 
                          className="w-4 h-4 rounded-full border border-gray-300 shadow-sm"
                          style={{ backgroundColor: getColorValue(selectedColor) }}
                        />
                        <span className="capitalize">{selectedColor}</span>
                      </div>
                    )}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {product.colors!.map((color: string) => {
                    const colorValue = getColorValue(color);
                    return (
                      <SelectItem key={color} value={color}>
                        <div className="flex items-center gap-2">
                          <div 
                            className="w-4 h-4 rounded-full border border-gray-300 shadow-sm"
                            style={{ backgroundColor: colorValue }}
                          />
                          <span className="capitalize">{color}</span>
                        </div>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Size Selection - REMOVED (now in distribution) */}
          {!distributionMode && hasSizes && (
            <div className="space-y-3">
              <Label className="text-sm font-medium">
                Tamanho <span className="text-destructive">*</span>
              </Label>
              <Select value={selectedSize || ''} onValueChange={(value) => setSelectedSize(value || undefined)}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um tamanho">
                    {selectedSize && (
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{selectedSize}</span>
                        {(() => {
                          const numericSize = parseInt(selectedSize);
                          if (!isNaN(numericSize) && numericSize >= 17 && numericSize <= 43) {
                            return null;
                          } else if (['PP', 'P', 'M', 'G', 'GG', 'XG', 'XXG'].includes(selectedSize)) {
                            return <Badge variant="outline" className="text-xs">Vestuário</Badge>;
                          } else {
                            return <Badge variant="outline" className="text-xs">Personalizado</Badge>;
                          }
                        })()}
                      </div>
                    )}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {(() => {
                    const { apparelSizes, shoeSizes } = separateSizes(product.sizes!);
                    const sortedApparelSizes = sortSizes(apparelSizes, false);
                    const sortedShoeSizes = sortSizes(shoeSizes, true);
                    const allSizes = [...sortedApparelSizes, ...sortedShoeSizes];
                    
                    return allSizes.map((size: string) => {
                      const numericSize = parseInt(size);
                      const isShoeSize = !isNaN(numericSize) && numericSize >= 17 && numericSize <= 43;
                      const isApparelSize = ['PP', 'P', 'M', 'G', 'GG', 'XG', 'XXG'].includes(size);
                      
                      return (
                        <SelectItem key={size} value={size}>
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{size}</span>
                            {isShoeSize && (
                              null
                            )}
                            {isApparelSize && (
                              <Badge variant="outline" className="text-xs">Vestuário</Badge>
                            )}
                            {!isShoeSize && !isApparelSize && (
                              <Badge variant="outline" className="text-xs">Personalizado</Badge>
                            )}
                          </div>
                        </SelectItem>
                      );
                    });
                  })()}
                </SelectContent>
              </Select>
            </div>
          )}


          {/* Weight Variant Selection */}
          {hasWeightVariants && weightVariants.length > 0 && (
            <div className="space-y-3">
              <Label className="text-sm font-medium flex items-center gap-2">
                <Scale className="h-4 w-4" />
                Peso/Tamanho <span className="text-destructive">*</span>
              </Label>
              <div className="flex flex-wrap gap-2">
                {weightVariants.map((v) => {
                  const isSelected = selectedWeightVariantId === v.id;
                  const effective = v.discounted_price ?? v.price;
                  return (
                    <button
                      key={v.id}
                      type="button"
                      onClick={() => setSelectedWeightVariantId(v.id)}
                      className={`px-4 py-2 rounded-lg border text-sm transition-colors ${
                        isSelected
                          ? 'bg-primary text-primary-foreground border-primary'
                          : 'bg-background hover:bg-accent border-border'
                      }`}
                    >
                      <div className="font-medium">{v.label}</div>
                      <div className={`text-xs ${isSelected ? 'opacity-90' : 'text-muted-foreground'}`}>
                        {formatCurrencyI18n(effective, currency, language)}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Flavor Selection */}
          {hasFlavors && (
            <div className="space-y-3">
              <Label className="text-sm font-medium flex items-center gap-2">
                <IceCream className="h-4 w-4" />
                Sabor <span className="text-destructive">*</span>
              </Label>
              <Select value={selectedFlavor || ''} onValueChange={(value) => setSelectedFlavor(value || undefined)}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um sabor">
                    {selectedFlavor && (
                      <span className="capitalize">{selectedFlavor}</span>
                    )}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {product.flavors!.map((flavor: string) => (
                    <SelectItem key={flavor} value={flavor}>
                      <span className="capitalize">{flavor}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Total Price */}
          <div className="flex justify-between items-center p-3 bg-muted rounded-lg">
            <span className="font-medium">Total:</span>
            <span className="text-lg font-bold text-primary">
              {formatCurrencyI18n(totalPrice, currency, language)}
            </span>
          </div>

          </div>

          {/* Action Buttons */}
          <div className="flex gap-2 flex-shrink-0 pt-4 border-t">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="flex-1"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleAddToCart}
              disabled={!canAddToCart}
              className="flex-1"
            >
              <ShoppingCart className="h-4 w-4 mr-2" />
              Adicionar {quantity > 1 ? `(${quantity})` : ''}
            </Button>
          </div>
        </>
      </DialogContent>
    </Dialog>
  );
}