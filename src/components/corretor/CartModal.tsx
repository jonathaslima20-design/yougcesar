import { useState, useEffect } from 'react';
import { X, Plus, Minus, Trash2, ShoppingCart, MessageCircle, CreditCard as Edit3, Palette, Ruler, TrendingDown, Package, ChevronDown, ChevronUp, ArrowLeft, Ticket, Loader as Loader2, Truck, Wallet } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Input } from '@/components/ui/input';
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
import { formatCurrencyI18n, generateWhatsAppMessage, useTranslation, type SupportedLanguage, type SupportedCurrency } from '@/lib/i18n';
import { generateWhatsAppUrl } from '@/lib/utils';
import { trackWhatsAppClick } from '@/lib/tracking';
import type { User as UserType, PriceTier } from '@/types';
import { generateCartOrderMessage } from '@/lib/cartUtils';
import { createOrder } from '@/lib/orderService';
import { fetchProductPriceTiers, calculateApplicablePrice } from '@/lib/tieredPricingUtils';
import { supabase } from '@/lib/supabase';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import TieredPricingIndicator from '@/components/product/TieredPricingIndicator';
import { PhoneInputWithCountry, COUNTRIES } from '@/components/ui/phone-input-with-country';
import { useInventoryEnabledForStore } from '@/hooks/useInventoryEnabled';
import { useCouponValidation } from '@/hooks/useCouponValidation';
import { useCheckoutSettingsForStore } from '@/hooks/useCheckoutSettings';


interface CartModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  corretor: UserType;
  currency?: SupportedCurrency;
  language?: SupportedLanguage;
}

export default function CartModal({
  open,
  onOpenChange,
  corretor,
  currency = 'BRL',
  language = 'pt-BR'
}: CartModalProps) {
  const { cart, updateVariantQuantity, removeCartVariant, clearCart, updateVariantNotes, updateVariantOptions, removeDistribution, appliedCoupon, setAppliedCoupon, clearAppliedCoupon } = useCart();
  const { t } = useTranslation(language);
  const { autoDeductStock, inventoryEnabled } = useInventoryEnabledForStore(corretor?.id);
  const { loading: couponLoading, error: couponError, validateCoupon, clearCoupon, setError: setCouponError } = useCouponValidation();
  const { settings: checkoutSettings, loading: checkoutSettingsLoading } = useCheckoutSettingsForStore(corretor?.id);
  const [sendingOrder, setSendingOrder] = useState(false);
  const [editingNotes, setEditingNotes] = useState<string | null>(null);
  const [editingVariant, setEditingVariant] = useState<string | null>(null);
  const [productTiers, setProductTiers] = useState<Map<string, { tiers: PriceTier[], hasTieredPricing: boolean }>>(new Map());
  const [expandedDistributions, setExpandedDistributions] = useState<Set<string>>(new Set());

  const [step, setStep] = useState<'cart' | 'checkout'>('cart');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerCountryCode, setCustomerCountryCode] = useState(corretor.country_code || '55');
  const [formErrors, setFormErrors] = useState<{ name?: string; phone?: string; payment?: string; delivery?: string }>({});
  const [couponCode, setCouponCode] = useState('');
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<string | null>(null);
  const [selectedDeliveryOption, setSelectedDeliveryOption] = useState<string | null>(null);

  const enabledPaymentMethods = checkoutSettings.paymentMethods.filter(m => m.enabled);
  const enabledDeliveryOptions = checkoutSettings.deliveryOptions.filter(d => d.enabled);

  const selectedPaymentConfig = enabledPaymentMethods.find(m => m.id === selectedPaymentMethod);
  const selectedDeliveryConfig = enabledDeliveryOptions.find(d => d.id === selectedDeliveryOption);

  const discountAmount = appliedCoupon?.calculatedDiscount || 0;

  const paymentMethodDiscount = (() => {
    if (!selectedPaymentConfig?.discountValue || !selectedPaymentConfig.discountType) return 0;
    const subtotalAfterCoupon = Math.max(0, cart.total - discountAmount);
    if (selectedPaymentConfig.discountType === 'percentage') {
      return Math.round(subtotalAfterCoupon * (selectedPaymentConfig.discountValue / 100) * 100) / 100;
    }
    return Math.min(selectedPaymentConfig.discountValue, subtotalAfterCoupon);
  })();

  const deliveryFee = (() => {
    if (!selectedDeliveryConfig) return 0;
    const subtotalAfterDiscounts = Math.max(0, cart.total - discountAmount - paymentMethodDiscount);
    if (selectedDeliveryConfig.freeAbove && subtotalAfterDiscounts >= selectedDeliveryConfig.freeAbove) return 0;
    return selectedDeliveryConfig.fee;
  })();

  const finalTotal = Math.max(0, cart.total - discountAmount - paymentMethodDiscount + deliveryFee);

  useEffect(() => {
    const loadTieredPricing = async () => {
      const tiersMap = new Map<string, { tiers: PriceTier[], hasTieredPricing: boolean }>();

      for (const item of cart.items) {
        const { data: product } = await supabase
          .from('products')
          .select('has_tiered_pricing')
          .eq('id', item.id)
          .single();

        if (product?.has_tiered_pricing) {
          const tiers = await fetchProductPriceTiers(item.id);
          tiersMap.set(item.id, { tiers, hasTieredPricing: true });
        } else {
          tiersMap.set(item.id, { tiers: [], hasTieredPricing: false });
        }
      }

      setProductTiers(tiersMap);
    };

    if (cart.items.length > 0) {
      loadTieredPricing();
    }
  }, [cart.items.map(i => `${i.id}-${i.quantity}`).join(',')]);

  const generateOrderMessage = (customer?: { name: string; whatsapp: string; countryCode: string }) => {
    return generateCartOrderMessage(
      cart.items,
      finalTotal,
      corretor.name,
      corretor.slug || '',
      currency,
      language,
      cart.distributions,
      customer,
      appliedCoupon,
      {
        paymentMethod: selectedPaymentConfig?.name || null,
        paymentMethodDiscount,
        deliveryOption: selectedDeliveryConfig?.name || null,
        deliveryFee,
      }
    );
  };

  const handleApplyCoupon = async () => {
    if (!couponCode.trim()) return;
    const cleanPhone = customerPhone.replace(/\D/g, '');
    const fullPhone = customerCountryCode.replace('+', '') + cleanPhone;
    const productIds = cart.items.map(item => item.id);
    const result = await validateCoupon(corretor.id, couponCode, fullPhone, cart.total, productIds);
    if (result) {
      setAppliedCoupon(result);
    }
  };

  const handleRemoveCoupon = () => {
    clearCoupon();
    clearAppliedCoupon();
    setCouponCode('');
  };

  const handleGoToCheckout = () => {
    if (cart.items.length === 0 && cart.distributions.length === 0) return;
    setStep('checkout');
  };

  const validateCustomerInfo = (): boolean => {
    const newErrors: { name?: string; phone?: string; payment?: string; delivery?: string } = {};
    if (!customerName.trim()) {
      newErrors.name = 'Informe seu nome';
    }
    const cleanPhone = customerPhone.replace(/\D/g, '');
    const ddiWithoutPlus = customerCountryCode.replace('+', '');
    const matchedCountry = COUNTRIES.find(c => c.ddi === `+${ddiWithoutPlus}`);
    const minLen = matchedCountry?.minLength || 8;
    if (!cleanPhone || cleanPhone.length < minLen) {
      newErrors.phone = 'Informe um numero de WhatsApp valido';
    }
    if (checkoutSettings.requirePaymentMethod && enabledPaymentMethods.length > 0 && !selectedPaymentMethod) {
      newErrors.payment = 'Selecione uma forma de pagamento';
    }
    if (checkoutSettings.requireDeliveryOption && enabledDeliveryOptions.length > 0 && !selectedDeliveryOption) {
      newErrors.delivery = 'Selecione uma opcao de entrega';
    }
    setFormErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSendOrder = async () => {
    if (!validateCustomerInfo()) return;
    if (cart.items.length === 0 && cart.distributions.length === 0) return;

    try {
      setSendingOrder(true);

      const cleanPhone = customerPhone.replace(/\D/g, '');
      const countryCode = customerCountryCode.replace('+', '');
      const customer = { name: customerName.trim(), whatsapp: cleanPhone, countryCode };
      const orderMessage = generateOrderMessage(customer);
      const whatsappUrl = generateWhatsAppUrl(corretor.whatsapp || '', orderMessage, corretor.country_code || '55');

      // Open WhatsApp immediately while still in the synchronous user-gesture context.
      // Mobile browsers (iOS Safari, Android Chrome) block window.open() if called
      // after any await, because the user-gesture context is lost across async boundaries.
      window.open(whatsappUrl, '_blank');

      const orderItems = [
        ...cart.distributions.map((dist) => ({
          product_id: dist.product.id,
          product_title: dist.product.title,
          product_image_url: dist.product.featured_image_url || '',
          quantity: dist.distribution.total_quantity,
          unit_price: dist.distribution.applied_tier_price,
          subtotal: dist.distribution.applied_tier_price * dist.distribution.total_quantity,
        })),
        ...cart.items.map((item) => ({
          product_id: item.id,
          product_title: item.title,
          product_image_url: item.featured_image_url || '',
          quantity: item.quantity,
          unit_price: item.applied_tier_price || item.discounted_price || item.price,
          selected_color: item.selectedColor || null,
          selected_size: item.selectedSize || null,
          selected_flavor: item.selectedFlavor || null,
          selected_variant_label: item.selectedVariantLabel || null,
          item_notes: item.notes || '',
          subtotal: (item.applied_tier_price || item.discounted_price || item.price) * item.quantity,
        })),
      ];

      try {
        await createOrder(
          {
            store_owner_id: corretor.id,
            customer_name: customer.name,
            customer_whatsapp: cleanPhone,
            customer_country_code: countryCode,
            order_type: 'whatsapp',
            subtotal: cart.total,
            total: finalTotal,
            whatsapp_message: orderMessage,
            source: 'cart',
            coupon_id: appliedCoupon?.couponId || null,
            coupon_code: appliedCoupon?.code || null,
            discount_amount: discountAmount,
            payment_method: selectedPaymentConfig?.name || null,
            payment_method_discount: paymentMethodDiscount,
            delivery_fee: deliveryFee,
            delivery_option: selectedDeliveryConfig?.name || null,
          },
          orderItems,
          inventoryEnabled && autoDeductStock
            ? { enabled: true, storeOwnerId: corretor.id }
            : undefined
        );
      } catch (err) {
        console.error('Failed to save order, proceeding with WhatsApp:', err);
      }

      await trackWhatsAppClick('storefront', 'product', 'cart_checkout');

      clearCart();
      clearCoupon();
      setCouponCode('');
      setSelectedPaymentMethod(null);
      setSelectedDeliveryOption(null);
      setStep('cart');
      setCustomerName('');
      setCustomerPhone('');
      setCustomerCountryCode(corretor.country_code || '55');
      setFormErrors({});
      onOpenChange(false);
    } catch (error) {
      console.error('Error sending order:', error);
    } finally {
      setSendingOrder(false);
    }
  };

  // Get color value for circle display
  const getColorValue = (colorName: string) => {
    const colorMap: Record<string, string> = {
      'preto': '#000000',
      'branco': '#FFFFFF',
      'cinza': '#808080',
      'azul': '#0066CC',
      'vermelho': '#CC0000',
      'verde': '#00CC00',
      'amarelo': '#FFCC00',
      'rosa': '#FF69B4',
      'roxo': '#8A2BE2',
      'laranja': '#FF8C00',
      'marrom': '#8B4513',
      'bege': '#F5F5DC',
      'dourado': '#FFD700',
      'prateado': '#C0C0C0',
      'navy': '#000080',
      'vinho': '#722F37',
      'nude': '#E3C4A8',
      'off-white': '#FAF0E6',
      'creme': '#FFFDD0',
      'caramelo': '#D2691E'
    };
    
    const normalizedColor = colorName.toLowerCase().trim();
    return colorMap[normalizedColor] || '#6B7280';
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShoppingCart className="h-5 w-5" />
            Carrinho de Compras
          </DialogTitle>
          <DialogDescription>
            {cart.items.length === 0 && cart.distributions.length === 0
              ? 'Seu carrinho está vazio'
              : `${cart.itemCount} ${cart.itemCount === 1 ? 'item' : 'itens'} no carrinho`
            }
          </DialogDescription>
        </DialogHeader>

        {cart.items.length === 0 && cart.distributions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <ShoppingCart className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">
              Adicione produtos ao carrinho para fazer um pedido
            </p>
          </div>
        ) : (
          <>
            {/* Cart Items */}
            <div className="flex-1 overflow-y-auto space-y-3 max-h-[400px]">
              {/* Distribution Groups */}
              {cart.distributions.map((dist) => {
                const isExpanded = expandedDistributions.has(dist.distribution.id);
                const totalPrice = dist.distribution.applied_tier_price * dist.distribution.total_quantity;

                return (
                  <div key={dist.distribution.id} className="border rounded-lg overflow-hidden">
                    {/* Distribution Header */}
                    <div
                      className="flex gap-3 p-3 bg-blue-50 dark:bg-blue-950 border-b cursor-pointer hover:bg-blue-100 dark:hover:bg-blue-900 transition-colors"
                      onClick={() => {
                        setExpandedDistributions(prev => {
                          const newSet = new Set(prev);
                          if (newSet.has(dist.distribution.id)) {
                            newSet.delete(dist.distribution.id);
                          } else {
                            newSet.add(dist.distribution.id);
                          }
                          return newSet;
                        });
                      }}
                    >
                      <div className="w-16 h-16 bg-white rounded-lg overflow-hidden border border-gray-200 shadow-sm flex-shrink-0">
                        <img
                          src={dist.product.featured_image_url || 'https://images.pexels.com/photos/3802510/pexels-photo-3802510.jpeg'}
                          alt={dist.product.title}
                          className="w-full h-full object-cover"
                        />
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between mb-1">
                          <h4 className="font-medium text-sm line-clamp-2">
                            {dist.product.title}
                          </h4>
                          {isExpanded ? (
                            <ChevronUp className="h-4 w-4 flex-shrink-0 ml-2" />
                          ) : (
                            <ChevronDown className="h-4 w-4 flex-shrink-0 ml-2" />
                          )}
                        </div>

                        <div className="flex items-center gap-2 mb-2">
                          <Badge className="bg-blue-600 text-white text-xs">
                            <Package className="h-3 w-3 mr-1" />
                            Distribuição
                          </Badge>
                          <Badge variant="outline" className="text-xs">
                            {dist.distribution.total_quantity} unidades
                          </Badge>
                          <Badge variant="outline" className="text-xs">
                            {dist.items.length} variações
                          </Badge>
                        </div>

                        <div className="flex items-center justify-between">
                          <div className="text-sm text-primary font-semibold">
                            {formatCurrencyI18n(dist.distribution.applied_tier_price, currency, language)} / un
                          </div>
                          <div className="text-sm font-semibold">
                            {formatCurrencyI18n(totalPrice, currency, language)}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Distribution Items (Expanded) */}
                    {isExpanded && (
                      <div className="p-3 space-y-2 bg-gray-50 dark:bg-gray-900">
                        {dist.items.map((item) => (
                          <div key={item.id} className="flex items-center gap-2 text-xs">
                            <div className="flex-1 flex items-center gap-2">
                              {item.color && (
                                <div className="flex items-center gap-1">
                                  <Palette className="h-3 w-3 text-muted-foreground" />
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
                            <Badge variant="secondary" className="text-xs">
                              {item.quantity}x
                            </Badge>
                          </div>
                        ))}

                        <Separator className="my-2" />

                        <Button
                          size="sm"
                          variant="destructive"
                          className="w-full text-xs h-8"
                          onClick={(e) => {
                            e.stopPropagation();
                            removeDistribution(dist.distribution.id);
                          }}
                        >
                          <Trash2 className="h-3 w-3 mr-1" />
                          Remover Distribuição
                        </Button>
                      </div>
                    )}
                  </div>
                );
              })}

              {/* Regular Cart Items */}
              {cart.items.map((item) => {
                const tierInfo = productTiers.get(item.id);
                const hasTieredPricing = item.has_tiered_pricing || tierInfo?.hasTieredPricing || false;
                const tiers = tierInfo?.tiers || [];

                // Use the stored applied tier price if available
                let price = item.applied_tier_price || item.discounted_price || item.price;
                let itemTotal = price * item.quantity;
                let pricingInfo = null;

                // Recalculate if tiered pricing is enabled and we have tiers
                if (hasTieredPricing && tiers.length > 0) {
                  const result = calculateApplicablePrice(
                    item.quantity,
                    tiers,
                    item.price,
                    item.discounted_price
                  );
                  price = result.unitPrice;
                  itemTotal = result.totalPrice;
                  pricingInfo = result;
                }

                return (
                  <div key={item.id} className="flex gap-3 p-3 border rounded-lg">
                    {/* Product Image */}
                    <div className="w-16 h-16 bg-white rounded-lg overflow-hidden border border-gray-200 shadow-sm flex-shrink-0">
                      <img
                        src={item.featured_image_url || 'https://images.pexels.com/photos/3802510/pexels-photo-3802510.jpeg'}
                        alt={item.title}
                        className="w-full h-full object-cover"
                      />
                    </div>

                    {/* Product Info */}
                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium text-sm line-clamp-2 mb-1">
                        {item.title}
                      </h4>
                      
                      <div className="space-y-1 mb-2">
                        <div className="flex items-center gap-2">
                          <div className="text-sm text-primary font-semibold">
                            {item.is_starting_price ? t('product.starting_from') + ' ' : ''}
                            {formatCurrencyI18n(price, currency, language)}
                          </div>
                          {hasTieredPricing && (
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Badge className="bg-blue-600 text-white text-xs cursor-help">
                                    <TrendingDown className="h-3 w-3 mr-1" />
                                    Preço Escalonado
                                  </Badge>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p className="text-xs">Preço calculado por quantidade</p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          )}
                        </div>

                      </div>

                      {pricingInfo && (pricingInfo.savings > 0 || (pricingInfo.nextTier && pricingInfo.unitsToNextTier > 0)) && (
                        <div className="mb-2">
                          <TieredPricingIndicator
                            currentQuantity={item.quantity}
                            nextTierQuantity={pricingInfo.nextTier?.quantity || 0}
                            nextTierSavings={pricingInfo.nextTierSavings}
                            appliedTierSavings={pricingInfo.savings}
                            currency={currency}
                            language={language}
                          />
                        </div>
                      )}

                      {/* Selected Variant Display */}
                      {(item.selectedColor || item.selectedSize || item.selectedFlavor || item.selectedVariantLabel) && (
                        <div className="mb-2">
                          {editingVariant === item.variantId ? (
                            <div className="space-y-2">
                              {/* Color Selection */}
                              {item.availableColors && item.availableColors.length > 0 && (
                                <div className="space-y-1">
                                  <Label className="text-xs">Cor</Label>
                                  <Select
                                    value={item.selectedColor || ''}
                                    onValueChange={(value) => {
                                      updateVariantOptions(item.variantId!, value || undefined, item.selectedSize);
                                      setEditingVariant(null);
                                    }}
                                  >
                                    <SelectTrigger className="h-8 text-xs">
                                      <SelectValue placeholder="Selecionar cor">
                                        {item.selectedColor && (
                                          <div className="flex items-center gap-2">
                                            <div 
                                              className="w-3 h-3 rounded-full border border-gray-300"
                                              style={{ backgroundColor: getColorValue(item.selectedColor) }}
                                            />
                                            <span className="capitalize">{item.selectedColor}</span>
                                          </div>
                                        )}
                                      </SelectValue>
                                    </SelectTrigger>
                                    <SelectContent>
                                      {item.availableColors.map((color) => (
                                        <SelectItem key={color} value={color}>
                                          <div className="flex items-center gap-2">
                                            <div 
                                              className="w-3 h-3 rounded-full border border-gray-300"
                                              style={{ backgroundColor: getColorValue(color) }}
                                            />
                                            <span className="capitalize">{color}</span>
                                          </div>
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </div>
                              )}

                              {/* Size Selection */}
                              {item.availableSizes && item.availableSizes.length > 0 && (
                                <div className="space-y-1">
                                  <Label className="text-xs">Tamanho</Label>
                                  <Select
                                    value={item.selectedSize || ''}
                                    onValueChange={(value) => {
                                      updateVariantOptions(item.variantId!, item.selectedColor, value || undefined);
                                      setEditingVariant(null);
                                    }}
                                  >
                                    <SelectTrigger className="h-8 text-xs">
                                      <SelectValue placeholder="Selecionar tamanho">
                                        {item.selectedSize && (
                                          <div className="flex items-center gap-2">
                                            <span className="font-medium">{item.selectedSize}</span>
                                            {(() => {
                                              const numericSize = parseInt(item.selectedSize);
                                              if (!isNaN(numericSize) && numericSize >= 17 && numericSize <= 43) {
                                                return null;
                                              } else if (['PP', 'P', 'M', 'G', 'GG', 'XG', 'XXG'].includes(item.selectedSize)) {
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
                                      {item.availableSizes.map((size) => {
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
                                      })}
                                    </SelectContent>
                                  </Select>
                                </div>
                              )}
                            </div>
                          ) : (
                            <div 
                              className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer hover:text-foreground transition-colors"
                              onClick={() => setEditingVariant(item.variantId!)}
                            >
                              {item.selectedColor && (
                                <div className="flex items-center gap-1">
                                  <Palette className="h-3 w-3" />
                                  <div 
                                    className="w-3 h-3 rounded-full border border-gray-300"
                                    style={{ backgroundColor: getColorValue(item.selectedColor) }}
                                  />
                                  <span className="capitalize">{item.selectedColor}</span>
                                </div>
                              )}
                              {item.selectedSize && (
                                <div className="flex items-center gap-1">
                                  <Ruler className="h-3 w-3" />
                                  <span>{item.selectedSize}</span>
                                </div>
                              )}
                              {item.selectedFlavor && (
                                <div className="flex items-center gap-1">
                                  <span className="font-medium">Sabor:</span>
                                  <span className="capitalize">{item.selectedFlavor}</span>
                                </div>
                              )}
                              {item.selectedVariantLabel && (
                                <div className="flex items-center gap-1">
                                  <span className="font-medium">Peso:</span>
                                  <span>{item.selectedVariantLabel}</span>
                                </div>
                              )}
                              <Edit3 className="h-3 w-3 ml-1" />
                            </div>
                          )}
                        </div>
                      )}

                      {/* Notes Section */}
                      <div className="mb-2">
                        {editingNotes === item.variantId ? (
                          <div className="space-y-2">
                            <Label className="text-xs">Observação (cor, tamanho, etc.)</Label>
                            <Input
                              placeholder="Ex: Cor preta, tamanho M"
                              defaultValue={item.notes || ''}
                              className="text-xs h-8"
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  const input = e.target as HTMLInputElement;
                                  updateVariantNotes(item.variantId!, input.value);
                                  setEditingNotes(null);
                                }
                                if (e.key === 'Escape') {
                                  setEditingNotes(null);
                                }
                              }}
                              onBlur={(e) => {
                                updateVariantNotes(item.variantId!, e.target.value);
                                setEditingNotes(null);
                              }}
                              autoFocus
                            />
                          </div>
                        ) : (
                          <div 
                            className="text-xs text-muted-foreground cursor-pointer hover:text-foreground transition-colors min-h-[16px] flex items-center gap-1"
                            onClick={() => setEditingNotes(item.variantId!)}
                          >
                            <Edit3 className="h-3 w-3" />
                            {item.notes ? item.notes : 'Adicionar observação'}
                          </div>
                        )}
                      </div>

                      {/* Quantity Controls */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 w-8 p-0"
                            onClick={() => updateVariantQuantity(item.variantId!, item.quantity - 1)}
                          >
                            <Minus className="h-3 w-3" />
                          </Button>
                          <span className="text-sm font-medium w-8 text-center">
                            {item.quantity}
                          </span>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 w-8 p-0"
                            onClick={() => updateVariantQuantity(item.variantId!, item.quantity + 1)}
                          >
                            <Plus className="h-3 w-3" />
                          </Button>
                        </div>

                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold">
                            {formatCurrencyI18n(itemTotal, currency, language)}
                          </span>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                            onClick={() => removeCartVariant(item.variantId!)}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <Separator />

            {step === 'cart' ? (
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-lg font-semibold">Total:</span>
                  <span className="text-xl font-bold text-primary">
                    {formatCurrencyI18n(cart.total, currency, language)}
                  </span>
                </div>

                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={clearCart}
                    className="flex-1"
                  >
                    Limpar Carrinho
                  </Button>

                  {corretor.whatsapp && (
                    <Button
                      onClick={handleGoToCheckout}
                      className="flex-1"
                    >
                      <MessageCircle className="h-4 w-4 mr-2" />
                      Enviar Pedido
                    </Button>
                  )}
                </div>

                {!corretor.whatsapp && (
                  <p className="text-xs text-muted-foreground text-center">
                    WhatsApp nao configurado para este vendedor
                  </p>
                )}
              </div>
            ) : (
              <div className="flex flex-col gap-0 -mb-2">
                <div className="flex-1 overflow-y-auto space-y-3 pr-1 max-h-[calc(85vh-200px)]">
                  {/* Customer Info */}
                  <div className="space-y-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="checkout-name" className="text-xs text-muted-foreground">
                        Nome
                      </Label>
                      <Input
                        id="checkout-name"
                        placeholder="Seu nome"
                        value={customerName}
                        onChange={(e) => {
                          setCustomerName(e.target.value);
                          if (formErrors.name) setFormErrors((p) => ({ ...p, name: undefined }));
                        }}
                        className="h-9 text-xs px-3"
                        autoFocus
                      />
                      {formErrors.name && (
                        <p className="text-xs text-destructive">{formErrors.name}</p>
                      )}
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">
                        WhatsApp
                      </Label>
                      <PhoneInputWithCountry
                        value={customerPhone}
                        defaultCountry={COUNTRIES.find(c => c.ddi === `+${corretor.country_code || '55'}`)?.code || 'BR'}
                        onChange={(data) => {
                          setCustomerPhone(data.phone);
                          setCustomerCountryCode(data.ddi.replace('+', ''));
                          if (formErrors.phone) setFormErrors((p) => ({ ...p, phone: undefined }));
                        }}
                      />
                      {formErrors.phone && (
                        <p className="text-xs text-destructive">{formErrors.phone}</p>
                      )}
                    </div>
                  </div>

                  {/* Coupon Section */}
                  <div className="space-y-1.5">
                    {appliedCoupon ? (
                      <div className="flex items-center gap-2 h-9 px-3 rounded-md border border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950">
                        <Ticket className="h-3.5 w-3.5 text-green-600 dark:text-green-400 flex-shrink-0" />
                        <span className="text-xs font-medium text-green-700 dark:text-green-300 flex-1 truncate">
                          {appliedCoupon.code}
                          <span className="font-normal ml-1.5">
                            -{formatCurrencyI18n(appliedCoupon.calculatedDiscount, currency, language)}
                            {appliedCoupon.discountType === 'percentage' && ` (${appliedCoupon.discountValue}%)`}
                          </span>
                        </span>
                        <button
                          type="button"
                          className="text-green-600 hover:text-red-500 dark:text-green-400 transition-colors p-0.5"
                          onClick={handleRemoveCoupon}
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ) : (
                      <div className="flex gap-2">
                        <div className="relative flex-1">
                          <Ticket className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                          <Input
                            placeholder="Codigo do cupom"
                            value={couponCode}
                            onChange={(e) => {
                              setCouponCode(e.target.value.toUpperCase());
                              if (couponError) setCouponError(null);
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                handleApplyCoupon();
                              }
                            }}
                            className="h-9 pl-9 pr-3 uppercase text-xs"
                            disabled={couponLoading}
                          />
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleApplyCoupon}
                          disabled={couponLoading || !couponCode.trim()}
                          className="h-9 px-3 shrink-0 text-xs"
                        >
                          {couponLoading ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            'Aplicar'
                          )}
                        </Button>
                      </div>
                    )}
                    {couponError && !appliedCoupon && (
                      <p className="text-xs text-destructive">{couponError}</p>
                    )}
                  </div>

                  {/* Payment & Delivery Row */}
                  {(enabledPaymentMethods.length > 0 || enabledDeliveryOptions.length > 0) && (
                    <div className="grid grid-cols-2 gap-3">
                      {enabledPaymentMethods.length > 0 && (
                        <div className="space-y-1.5">
                          <Label className="text-xs text-muted-foreground">
                            Pagamento {checkoutSettings.requirePaymentMethod && <span className="text-destructive">*</span>}
                          </Label>
                          <Select
                            value={selectedPaymentMethod || ''}
                            onValueChange={(value) => {
                              setSelectedPaymentMethod(value || null);
                              if (formErrors.payment) setFormErrors(p => ({ ...p, payment: undefined }));
                            }}
                          >
                            <SelectTrigger className="h-9 text-xs px-3">
                              <SelectValue placeholder="Selecione" />
                            </SelectTrigger>
                            <SelectContent>
                              {enabledPaymentMethods.map((method) => {
                                const hasDiscount = method.discountValue && method.discountValue > 0;
                                return (
                                  <SelectItem key={method.id} value={method.id} className="text-xs">
                                    <div className="flex items-center gap-1.5">
                                      <span>{method.name}</span>
                                      {hasDiscount && (
                                        <span className="text-xs text-green-600 dark:text-green-400">
                                          {method.discountType === 'percentage'
                                            ? `-${method.discountValue}%`
                                            : `-${formatCurrencyI18n(method.discountValue!, currency, language)}`
                                          }
                                        </span>
                                      )}
                                    </div>
                                  </SelectItem>
                                );
                              })}
                            </SelectContent>
                          </Select>
                          {formErrors.payment && (
                            <p className="text-xs text-destructive">{formErrors.payment}</p>
                          )}
                        </div>
                      )}

                      {enabledDeliveryOptions.length > 0 && (
                        <div className="space-y-1.5">
                          <Label className="text-xs text-muted-foreground">
                            Entrega {checkoutSettings.requireDeliveryOption && <span className="text-destructive">*</span>}
                          </Label>
                          <Select
                            value={selectedDeliveryOption || ''}
                            onValueChange={(value) => {
                              setSelectedDeliveryOption(value || null);
                              if (formErrors.delivery) setFormErrors(p => ({ ...p, delivery: undefined }));
                            }}
                          >
                            <SelectTrigger className="h-9 text-xs px-3">
                              <SelectValue placeholder="Selecione" />
                            </SelectTrigger>
                            <SelectContent>
                              {enabledDeliveryOptions.map((option) => {
                                const subtotalForFreeCheck = Math.max(0, cart.total - discountAmount - paymentMethodDiscount);
                                const isFreeDelivery = option.freeAbove && subtotalForFreeCheck >= option.freeAbove;
                                const displayFee = isFreeDelivery ? 0 : option.fee;
                                return (
                                  <SelectItem key={option.id} value={option.id} className="text-xs">
                                    <div className="flex items-center gap-1.5">
                                      <span>{option.name}</span>
                                      <span className={displayFee === 0 ? 'text-xs text-green-600 dark:text-green-400' : 'text-xs text-muted-foreground'}>
                                        {displayFee === 0 ? 'Gratis' : `+${formatCurrencyI18n(displayFee, currency, language)}`}
                                      </span>
                                    </div>
                                  </SelectItem>
                                );
                              })}
                            </SelectContent>
                          </Select>
                          {formErrors.delivery && (
                            <p className="text-xs text-destructive">{formErrors.delivery}</p>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Invoice-style Order Summary */}
                  <div className="border rounded-lg overflow-hidden">
                    <div className="bg-muted/40 px-3 py-2">
                      <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        Resumo do pedido
                      </span>
                    </div>
                    <div className="px-3 py-2.5 space-y-1.5 text-sm">
                      <div className="flex justify-between items-center">
                        <span className="text-muted-foreground">
                          Subtotal ({cart.itemCount} {cart.itemCount === 1 ? 'item' : 'itens'})
                        </span>
                        <span>{formatCurrencyI18n(cart.total, currency, language)}</span>
                      </div>
                      {appliedCoupon && discountAmount > 0 && (
                        <div className="flex justify-between items-center text-green-600 dark:text-green-400">
                          <span className="flex items-center gap-1.5">
                            <Ticket className="h-3 w-3" />
                            Cupom {appliedCoupon.code}
                          </span>
                          <span>-{formatCurrencyI18n(discountAmount, currency, language)}</span>
                        </div>
                      )}
                      {paymentMethodDiscount > 0 && selectedPaymentConfig && (
                        <div className="flex justify-between items-center text-green-600 dark:text-green-400">
                          <span className="flex items-center gap-1.5">
                            <Wallet className="h-3 w-3" />
                            Desc. {selectedPaymentConfig.name}
                          </span>
                          <span>-{formatCurrencyI18n(paymentMethodDiscount, currency, language)}</span>
                        </div>
                      )}
                      {selectedDeliveryConfig && (
                        <div className={`flex justify-between items-center ${deliveryFee === 0 ? 'text-green-600 dark:text-green-400' : ''}`}>
                          <span className={`flex items-center gap-1.5 ${deliveryFee > 0 ? 'text-muted-foreground' : ''}`}>
                            <Truck className="h-3 w-3" />
                            {selectedDeliveryConfig.name}
                          </span>
                          <span>
                            {deliveryFee === 0 ? 'Gratis' : `+${formatCurrencyI18n(deliveryFee, currency, language)}`}
                          </span>
                        </div>
                      )}
                    </div>
                    <div className="border-t px-3 py-2.5 bg-muted/20 flex justify-between items-center">
                      <span className="font-semibold">Total</span>
                      <span className="text-lg font-bold text-primary">
                        {formatCurrencyI18n(finalTotal, currency, language)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Fixed Action Buttons */}
                <div className="flex gap-2 pt-3 border-t mt-3">
                  <Button
                    variant="outline"
                    onClick={() => setStep('cart')}
                    disabled={sendingOrder}
                    size="sm"
                    className="flex-1 h-10"
                  >
                    <ArrowLeft className="h-4 w-4 mr-1.5" />
                    Voltar
                  </Button>
                  <Button
                    onClick={handleSendOrder}
                    disabled={sendingOrder}
                    size="sm"
                    className="flex-1 h-10"
                  >
                    {sendingOrder ? 'Enviando...' : 'Confirmar'}
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}