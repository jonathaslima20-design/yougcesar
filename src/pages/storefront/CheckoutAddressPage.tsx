import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Loader as Loader2, ArrowLeft, MapPin, Ticket, Truck, Check, ShieldCheck, Clock, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Checkbox } from '@/components/ui/checkbox';
import { useCorretorData } from '@/hooks/useCorretorData';
import { useCart } from '@/contexts/CartContext';
import { useBuyerAuth } from '@/contexts/BuyerAuthContext';
import { useCheckoutSettingsForStore } from '@/hooks/useCheckoutSettings';
import { useInventoryEnabledForStore } from '@/hooks/useInventoryEnabled';
import { useCouponValidation } from '@/hooks/useCouponValidation';
import { fetchCustomerAddresses, createCustomerAddress, type CustomerAddress } from '@/lib/customerAddressService';
import { fetchAddressByCep } from '@/lib/viaCep';
import { createOrder } from '@/lib/orderService';
import { findCartStockShortfalls, formatShortfallMessage, formatShortfallLines } from '@/lib/stockAvailabilityService';
import { resolveAttributedAffiliateId } from '@/lib/affiliateUtils';
import { formatCurrencyI18n } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import { getShippingQuote } from '@/lib/merchantShipping';
import { fetchProductShippingDims, fetchVariantShippingWeights, buildSuperFreteProducts } from '@/lib/shippingUtils';
import type { ShippingQuote } from '@/types';
import { normalizeCityName, filterEligibleDeliveryOptions, hasNoMatchingLocalOption as computeHasNoMatchingLocalOption, buildPickupInstructionsSnapshot } from '@/lib/localDelivery';
import { formatCpfCnpj, isValidCpfCnpj } from '@/lib/document';
import { OrderItemsSummary } from '@/components/buyer/OrderItemsSummary';

interface ManualAddress {
  street: string;
  number: string;
  complement: string;
  neighborhood: string;
  city: string;
  state: string;
  zipCode: string;
}

const EMPTY_ADDRESS: ManualAddress = {
  street: '',
  number: '',
  complement: '',
  neighborhood: '',
  city: '',
  state: '',
  zipCode: '',
};

export default function CheckoutAddressPage() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { corretor, loading: corretorLoading } = useCorretorData({ slug });
  const { cart, clearCart, appliedCoupon, setAppliedCoupon, clearAppliedCoupon, updateVariantQuantity, removeCartVariant } = useCart();
  const { customer: buyerAccount, loading: authLoading, saveCpf } = useBuyerAuth();
  const { settings: checkoutSettings } = useCheckoutSettingsForStore(corretor?.id);
  // autoDeductStock nao e lido aqui: a baixa deste fluxo acontece no webhook
  // de pagamento, na aprovacao. inventoryEnabled ainda serve para revalidar
  // a disponibilidade antes de criar o pedido.
  const { inventoryEnabled } = useInventoryEnabledForStore(corretor?.id);
  const { loading: couponLoading, error: couponError, validateCoupon, clearCoupon, setError: setCouponError } = useCouponValidation();

  const [savedAddresses, setSavedAddresses] = useState<CustomerAddress[]>([]);
  const [addressesLoading, setAddressesLoading] = useState(true);
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(null);
  const [showManualForm, setShowManualForm] = useState(false);
  const [manualAddress, setManualAddress] = useState<ManualAddress>(EMPTY_ADDRESS);
  const [cepLoading, setCepLoading] = useState(false);
  const [whatsappFallback, setWhatsappFallback] = useState('');
  const [cpf, setCpf] = useState('');
  const [couponCode, setCouponCode] = useState('');
  const [selectedDeliveryOption, setSelectedDeliveryOption] = useState<string | null>(null);
  const [insuranceOptIn, setInsuranceOptIn] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [shippingQuotes, setShippingQuotes] = useState<ShippingQuote[]>([]);
  const [shippingQuotesLoading, setShippingQuotesLoading] = useState(false);
  const [shippingQuotesError, setShippingQuotesError] = useState(false);

  const hasItems = cart.items.length > 0 || cart.distributions.length > 0;

  useEffect(() => {
    if (authLoading) return;
    if (!buyerAccount) {
      navigate('/conta/entrar', { state: { from: `/${slug}/pedido/endereco` } });
    }
  }, [authLoading, buyerAccount, navigate, slug]);

  useEffect(() => {
    if (!corretorLoading && !hasItems) {
      navigate(`/${slug}`);
    }
  }, [corretorLoading, hasItems, navigate, slug]);

  useEffect(() => {
    if (buyerAccount?.cpf) setCpf(formatCpfCnpj(buyerAccount.cpf));
  }, [buyerAccount?.cpf]);

  useEffect(() => {
    if (!buyerAccount) return;
    fetchCustomerAddresses(buyerAccount.id)
      .then((addresses) => {
        setSavedAddresses(addresses);
        const defaultAddress = addresses.find((a) => a.is_default) || addresses[0];
        if (defaultAddress) {
          setSelectedAddressId(defaultAddress.id);
        } else {
          setShowManualForm(true);
        }
      })
      .catch(() => setShowManualForm(true))
      .finally(() => setAddressesLoading(false));
  }, [buyerAccount]);

  // Looks up the address automatically as soon as the CEP reaches 8 digits,
  // instead of waiting for the field to lose focus — matches how
  // professional checkouts behave and doesn't require an extra tap on
  // mobile. Re-fetching a value the buyer already edited manually is a
  // non-issue: this only fires when the digit count changes, and the
  // lookup result only fills fields, never overwrites zipCode itself.
  useEffect(() => {
    const digits = manualAddress.zipCode.replace(/\D/g, '');
    if (digits.length !== 8) return;

    let cancelled = false;
    setCepLoading(true);
    fetchAddressByCep(digits)
      .then((result) => {
        if (cancelled || !result) return;
        setManualAddress((prev) => ({
          ...prev,
          street: result.street || prev.street,
          neighborhood: result.neighborhood || prev.neighborhood,
          city: result.city || prev.city,
          state: result.state || prev.state,
        }));
      })
      .finally(() => {
        if (!cancelled) setCepLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [manualAddress.zipCode]);

  const selectedSavedAddress = savedAddresses.find((a) => a.id === selectedAddressId) || null;

  const currentState = showManualForm ? manualAddress.state : (selectedSavedAddress?.state || '');
  const currentCity = showManualForm ? manualAddress.city : (selectedSavedAddress?.city || '');
  const currentZip = showManualForm ? manualAddress.zipCode : (selectedSavedAddress?.zip_code || '');

  const buyerCity = currentCity ? normalizeCityName(currentCity) : null;
  // Merchants who ship nationwide and don't want buyers gated on a CEP lookup
  // can turn this off — every enabled delivery option is then shown as-is.
  const skipLocationMatch = checkoutSettings.requireDeliveryCep === false;

  const enabledDeliveryOptions = useMemo(
    () =>
      filterEligibleDeliveryOptions(checkoutSettings.deliveryOptions, {
        merchantCity: corretor?.city,
        merchantState: corretor?.state,
        buyerCity: currentCity,
        buyerState: currentState,
        skipLocationMatch,
        excludeQuoteOnRequest: true,
      }),
    [checkoutSettings.deliveryOptions, currentState, currentCity, corretor?.city, corretor?.state, skipLocationMatch]
  );

  const hasNoMatchingLocalOption = computeHasNoMatchingLocalOption(
    enabledDeliveryOptions.length,
    buyerCity,
    checkoutSettings.deliveryOptions,
    skipLocationMatch
  );

  const zipDigits = currentZip.replace(/\D/g, '');

  useEffect(() => {
    if (!corretor?.id || zipDigits.length !== 8) {
      setShippingQuotes([]);
      setShippingQuotesError(false);
      return;
    }
    const superFreteEnabled = checkoutSettings.superFrete?.enabled;
    const serviceIds = checkoutSettings.superFrete?.serviceIds || [];
    if (!superFreteEnabled || serviceIds.length === 0) {
      setShippingQuotes([]);
      setShippingQuotesError(false);
      return;
    }

    let cancelled = false;
    setShippingQuotes([]);
    setShippingQuotesError(false);
    setShippingQuotesLoading(true);

    (async () => {
      try {
        const productIds = cart.items.map((item) => item.id);
        const variantIds = cart.items.map((item) => item.selectedVariantId).filter((id): id is string => !!id);
        const [dims, variantWeights] = await Promise.all([
          fetchProductShippingDims(productIds),
          fetchVariantShippingWeights(variantIds),
        ]);
        const products = buildSuperFreteProducts(cart.items, cart.distributions, dims, variantWeights);
        const { quotes } = await getShippingQuote(corretor.id, zipDigits, products, serviceIds);
        if (cancelled) return;
        setShippingQuotes(quotes);
        setShippingQuotesError(quotes.length === 0);
      } catch {
        if (!cancelled) setShippingQuotesError(true);
      } finally {
        if (!cancelled) setShippingQuotesLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [corretor?.id, zipDigits, checkoutSettings.superFrete?.enabled, checkoutSettings.superFrete?.serviceIds, cart.items, cart.distributions]);

  const superFreteOptions = shippingQuotes.map((q) => ({
    id: `superfrete:${q.id}`,
    name: q.name,
    fee: q.price,
    enabled: true,
    freeAbove: null,
    calculationType: 'carrier' as const,
    carrierProvider: 'superfrete' as const,
    scope: 'national' as const,
  }));
  // When a live carrier quote exists for this CEP, it replaces the merchant's
  // manual national option(s) entirely — showing a flat manual rate next to
  // real per-carrier quotes for the same destination is confusing (the buyer
  // can't tell which "R$" is actually calculated for their address). Local
  // and pickup options are unaffected: they're independent buckets decided
  // by city match / always-on, not by carrier availability. Pickup must stay
  // in its own bucket rather than falling into "everything that isn't local"
  // — otherwise it would silently disappear whenever a live SuperFrete quote
  // replaces the national bucket.
  const nationalDeliveryOptions = superFreteOptions.length > 0
    ? superFreteOptions
    : enabledDeliveryOptions.filter((d) => d.scope !== 'local' && d.scope !== 'pickup');
  const localDeliveryOptions = enabledDeliveryOptions.filter((d) => d.scope === 'local');
  const pickupDeliveryOptions = enabledDeliveryOptions.filter((d) => d.scope === 'pickup');
  const allDeliveryOptions = [...localDeliveryOptions, ...pickupDeliveryOptions, ...nationalDeliveryOptions];

  const selectedDeliveryConfig = allDeliveryOptions.find((d) => d.id === selectedDeliveryOption);
  const isPickupSelected = selectedDeliveryConfig?.scope === 'pickup';

  const discountAmount = appliedCoupon?.calculatedDiscount || 0;
  const subtotalAfterDiscount = Math.max(0, cart.total - discountAmount);

  const deliveryFee = (() => {
    if (!selectedDeliveryConfig) return 0;
    if (selectedDeliveryConfig.freeAbove && subtotalAfterDiscount >= selectedDeliveryConfig.freeAbove) return 0;
    return selectedDeliveryConfig.fee;
  })();

  const insuranceRate = checkoutSettings.shippingInsurance?.enabled
    ? checkoutSettings.shippingInsurance.percentageRate || 0
    : 0;
  const insuranceFee = insuranceOptIn && insuranceRate > 0
    ? Math.round(subtotalAfterDiscount * (insuranceRate / 100) * 100) / 100
    : 0;

  const finalTotal = Math.max(0, cart.total - discountAmount + deliveryFee + insuranceFee);

  const handleApplyCoupon = async () => {
    if (!couponCode.trim() || !corretor) return;
    const cartItemsForCoupon = [
      ...cart.items.map((item) => ({
        product_id: item.id,
        subtotal: (item.applied_tier_price || item.discounted_price || item.price) * item.quantity,
      })),
      ...cart.distributions.map((dist) => ({
        product_id: dist.product.id,
        subtotal: dist.distribution.applied_tier_price * dist.distribution.total_quantity,
      })),
    ];
    const whatsapp = buyerAccount?.whatsapp || whatsappFallback;
    const result = await validateCoupon(corretor.id, couponCode, whatsapp, cart.total, cartItemsForCoupon);
    if (result) setAppliedCoupon(result);
  };

  const handleRemoveCoupon = () => {
    clearCoupon();
    clearAppliedCoupon();
    setCouponCode('');
  };

  // Doubles as both the order-creation payload (orderService.createOrder
  // whitelist-maps only the fields it knows, so the extra `id` here is
  // harmlessly dropped there) and the on-screen OrderItemRow[] for
  // OrderItemsSummary in the order-summary column — one mapping, no
  // parallel display-only copy to keep in sync.
  const buildOrderItems = () => [
    ...cart.distributions.flatMap((dist) =>
      dist.items.map((distItem) => ({
        id: `dist:${dist.distribution.id}:${distItem.id}`,
        product_id: dist.product.id,
        product_title: dist.product.title,
        product_image_url: dist.product.featured_image_url || '',
        quantity: distItem.quantity,
        unit_price: dist.distribution.applied_tier_price,
        selected_color: distItem.color || null,
        selected_size: distItem.size || null,
        selected_flavor: null,
        selected_variant_label: null,
        subtotal: dist.distribution.applied_tier_price * distItem.quantity,
      }))
    ),
    ...cart.items.map((item) => ({
      id: item.variantId || item.id,
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

  const validateAddress = (): boolean => {
    // Pickup has no shipping destination — nothing to validate here.
    if (!isPickupSelected) {
      if (showManualForm) {
        if (
          !manualAddress.street.trim() ||
          !manualAddress.number.trim() ||
          !manualAddress.city.trim() ||
          !manualAddress.state.trim() ||
          !manualAddress.zipCode.trim()
        ) {
          toast.error('Preencha o endereço de entrega completo');
          return false;
        }
      } else if (!selectedSavedAddress) {
        toast.error('Selecione um endereço de entrega');
        return false;
      }
    }

    if (checkoutSettings.requireDeliveryOption && allDeliveryOptions.length > 0 && !selectedDeliveryOption) {
      toast.error('Selecione uma opção de entrega');
      return false;
    }

    if (!buyerAccount?.whatsapp && !whatsappFallback.trim()) {
      toast.error('Informe um WhatsApp para contato');
      return false;
    }

    if (!isValidCpfCnpj(cpf)) {
      toast.error('Informe um CPF válido');
      return false;
    }

    return true;
  };

  const handleContinue = async () => {
    if (!corretor || !buyerAccount) return;
    if (!validateAddress()) return;

    setSubmitting(true);
    try {
      let finalAddress: ManualAddress = EMPTY_ADDRESS;

      if (!isPickupSelected) {
        if (showManualForm) {
          finalAddress = manualAddress;
          try {
            await createCustomerAddress(buyerAccount.id, {
              label: 'Endereço',
              street: manualAddress.street.trim(),
              number: manualAddress.number.trim(),
              complement: manualAddress.complement.trim() || null,
              neighborhood: manualAddress.neighborhood.trim(),
              city: manualAddress.city.trim(),
              state: manualAddress.state.trim(),
              zip_code: manualAddress.zipCode.trim(),
              is_default: savedAddresses.length === 0,
            });
          } catch (err) {
            console.error('Error saving address:', err);
          }
        } else {
          finalAddress = {
            street: selectedSavedAddress!.street,
            number: selectedSavedAddress!.number,
            complement: selectedSavedAddress!.complement || '',
            neighborhood: selectedSavedAddress!.neighborhood,
            city: selectedSavedAddress!.city,
            state: selectedSavedAddress!.state,
            zipCode: selectedSavedAddress!.zip_code,
          };
        }
      }

      const orderItems = buildOrderItems();

      if (inventoryEnabled) {
        const shortfalls = await findCartStockShortfalls([
          ...cart.distributions.flatMap((dist) =>
            dist.items.map((distItem) => ({
              key: `dist:${dist.distribution.id}:${distItem.id}`,
              productId: dist.product.id,
              title: dist.product.title,
              quantity: distItem.quantity,
              selectedColor: distItem.color,
              selectedSize: distItem.size,
            }))
          ),
          ...cart.items.map((item) => ({
            key: item.variantId || item.id,
            productId: item.id,
            title: item.title,
            quantity: item.quantity,
            selectedColor: item.selectedColor,
            selectedSize: item.selectedSize,
            selectedFlavor: item.selectedFlavor,
          })),
        ]);

        if (shortfalls.length > 0) {
          // Distribution (wholesale) shortfalls can't be safely auto-adjusted —
          // shrinking one color/size within a tiered bulk allocation would
          // throw off the applied tier price, so those still block with the
          // old message. Plain cart items get fixed automatically instead of
          // wiping the whole cart: the buyer only loses what's actually gone.
          const adjustable = shortfalls.filter((s) => !s.key.startsWith('dist:'));
          const blocking = shortfalls.filter((s) => s.key.startsWith('dist:'));

          for (const s of adjustable) {
            if (s.available > 0) {
              updateVariantQuantity(s.key, s.available);
            } else {
              removeCartVariant(s.key);
            }
          }

          if (adjustable.length > 0) {
            toast.error(`Seu carrinho foi ajustado por falta de estoque:\n${formatShortfallLines(adjustable)}\nRevise e envie o pedido novamente.`);
          }
          if (blocking.length > 0) {
            toast.error(formatShortfallMessage(blocking));
          }
          return;
        }
      }

      const affiliateId = await resolveAttributedAffiliateId(corretor.id);
      const cleanCpf = cpf.replace(/\D/g, '');
      saveCpf(cleanCpf);

      const order = await createOrder(
        {
          store_owner_id: corretor.id,
          customer_name: buyerAccount.full_name,
          customer_whatsapp: (buyerAccount.whatsapp || whatsappFallback).replace(/\D/g, ''),
          customer_country_code: buyerAccount.country_code || '55',
          order_type: 'ecommerce',
          subtotal: cart.total,
          total: finalTotal,
          source: 'cart',
          coupon_id: appliedCoupon?.couponId || null,
          coupon_code: appliedCoupon?.code || null,
          discount_amount: discountAmount,
          delivery_fee: deliveryFee,
          delivery_option: selectedDeliveryConfig?.name || null,
          delivery_scope: selectedDeliveryConfig ? (selectedDeliveryConfig.scope || 'national') : null,
          pickup_instructions: isPickupSelected ? buildPickupInstructionsSnapshot(selectedDeliveryConfig) : null,
          insurance_fee: insuranceFee,
          affiliate_id: affiliateId,
          buyer_id: buyerAccount.id,
          payment_status: 'pending',
          shipping_street: isPickupSelected ? null : finalAddress.street.trim(),
          shipping_number: isPickupSelected ? null : finalAddress.number.trim(),
          shipping_complement: isPickupSelected ? null : finalAddress.complement.trim() || null,
          shipping_neighborhood: isPickupSelected ? null : finalAddress.neighborhood.trim() || null,
          shipping_city: isPickupSelected ? null : finalAddress.city.trim(),
          shipping_state: isPickupSelected ? null : finalAddress.state.trim(),
          shipping_zip_code: isPickupSelected ? null : finalAddress.zipCode.trim(),
          customer_cpf: cleanCpf,
        },
        orderItems,
        // Sem baixa de estoque aqui: este pedido nasce com payment_status
        // 'pending' e o comprador ainda vai para a tela de pagamento. Baixar
        // agora significava que um PIX abandonado ou um cartao recusado
        // levavam o estoque embora sem venda e sem nada devolver. A baixa
        // passou para o webhook do Mercado Pago, na aprovacao do pagamento.
        undefined
      );

      if (!order?.id) {
        toast.error('Não foi possível criar o pedido. Tente novamente.');
        return;
      }

      clearCart();
      clearAppliedCoupon();
      navigate(`/${corretor.slug}/pedido/${order.id}/pagamento`);
    } catch (error) {
      console.error('Error creating order:', error);
      toast.error('Não foi possível criar o pedido. Tente novamente.');
    } finally {
      setSubmitting(false);
    }
  };

  if (corretorLoading || authLoading || !corretor || !buyerAccount) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="w-full px-4 sm:px-6 lg:px-8 py-6">
      <div className="max-w-6xl mx-auto space-y-6">
        <Button variant="ghost" size="sm" onClick={() => navigate(`/${slug}`)} className="text-muted-foreground">
          <ArrowLeft className="h-4 w-4 mr-1" />
          Voltar à loja
        </Button>

        <div className="grid grid-cols-1 lg:grid-cols-[420px_1fr] gap-6 items-start">
        {/* Coluna do formulário: no mobile fica em cima (ordem 1); no desktop
            passa para a direita, com o resumo assumindo a esquerda. */}
        <div className="order-1 lg:order-2 space-y-6">
        {(allDeliveryOptions.length > 0 || shippingQuotesLoading || shippingQuotesError) && (
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="text-lg flex items-center gap-2">
                <Truck className="h-5 w-5" />
                Entrega
              </CardTitle>
              <CardDescription>Como você quer receber seu pedido?</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {allDeliveryOptions.length > 0 && (
                <div className="space-y-2">
                  {allDeliveryOptions.map((option) => {
                    const subtotalForFreeCheck = Math.max(0, cart.total - discountAmount);
                    const isFreeDelivery = option.freeAbove && subtotalForFreeCheck >= option.freeAbove;
                    const displayFee = isFreeDelivery ? 0 : option.fee;
                    const isSelected = selectedDeliveryOption === option.id;
                    return (
                      <button
                        key={option.id}
                        type="button"
                        onClick={() => setSelectedDeliveryOption(option.id)}
                        className={cn(
                          'w-full text-left p-3 rounded-lg border-2 transition-colors',
                          isSelected ? 'border-primary bg-primary/5' : 'border-muted hover:border-muted-foreground/30'
                        )}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm font-medium">{option.name}</p>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <span className={cn('text-sm', displayFee === 0 ? 'text-green-600 dark:text-green-400' : 'text-muted-foreground')}>
                              {displayFee === 0 ? 'Grátis' : `+${formatCurrencyI18n(displayFee)}`}
                            </span>
                            {isSelected && <Check className="h-4 w-4 text-primary" />}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
              {shippingQuotesLoading && (
                <p className="text-xs text-muted-foreground">Calculando frete...</p>
              )}
              {shippingQuotesError && !shippingQuotesLoading && (
                <p className="text-xs text-muted-foreground">
                  Não foi possível calcular frete automático agora. Use as opções de entrega acima.
                </p>
              )}
            </CardContent>
          </Card>
        )}

        {hasNoMatchingLocalOption && (
          <Card>
            <CardContent className="pt-6 text-sm text-muted-foreground">
              Não há opções de entrega disponíveis para {currentCity}. Esta loja entrega localmente apenas em {corretor?.city}.
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-lg flex items-center gap-2">
              <MapPin className="h-5 w-5" />
              {isPickupSelected ? 'Retirada' : 'Endereço de entrega'}
            </CardTitle>
            <CardDescription>
              {isPickupSelected ? 'Você vai retirar seu pedido pessoalmente' : 'Para onde devemos enviar seu pedido?'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {addressesLoading ? (
              <div className="flex justify-center py-6">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : isPickupSelected ? (
              <div className="rounded-lg border p-3 text-sm space-y-1">
                <p className="font-medium">{selectedDeliveryConfig?.name}</p>
                {(corretor?.city || corretor?.state) && (
                  <p className="text-muted-foreground">
                    {[corretor?.city, corretor?.state].filter(Boolean).join(' - ')}
                  </p>
                )}
                {selectedDeliveryConfig?.pickupInstructions && (
                  <p className="text-muted-foreground whitespace-pre-line">
                    {selectedDeliveryConfig.pickupInstructions}
                  </p>
                )}
                {selectedDeliveryConfig?.pickupHours && (
                  <p className="text-muted-foreground flex items-center gap-1.5">
                    <Clock className="h-3.5 w-3.5 shrink-0" />
                    {selectedDeliveryConfig.pickupHours}
                  </p>
                )}
                {selectedDeliveryConfig?.pickupMapUrl && (
                  <a
                    href={selectedDeliveryConfig.pickupMapUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-primary hover:underline"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    Ver no mapa
                  </a>
                )}
              </div>
            ) : (
              <>
                {savedAddresses.length > 0 && !showManualForm && (
                  <div className="space-y-2">
                    {savedAddresses.map((address) => (
                      <button
                        key={address.id}
                        type="button"
                        onClick={() => setSelectedAddressId(address.id)}
                        className={cn(
                          'w-full text-left p-3 rounded-lg border-2 transition-colors',
                          selectedAddressId === address.id
                            ? 'border-primary bg-primary/5'
                            : 'border-muted hover:border-muted-foreground/30'
                        )}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="text-sm">
                            <p className="font-medium">{address.label}</p>
                            <p className="text-muted-foreground">
                              {address.street}, {address.number}
                              {address.complement ? ` - ${address.complement}` : ''}
                            </p>
                            <p className="text-muted-foreground">
                              {address.neighborhood ? `${address.neighborhood}, ` : ''}
                              {address.city} - {address.state}, {address.zip_code}
                            </p>
                          </div>
                          {selectedAddressId === address.id && (
                            <Check className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                          )}
                        </div>
                      </button>
                    ))}
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="w-full"
                      onClick={() => setShowManualForm(true)}
                    >
                      Usar outro endereço
                    </Button>
                  </div>
                )}

                {showManualForm && (
                  <div className="space-y-3">
                    {savedAddresses.length > 0 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="text-muted-foreground -ml-2"
                        onClick={() => setShowManualForm(false)}
                      >
                        <ArrowLeft className="h-3.5 w-3.5 mr-1" />
                        Usar endereço salvo
                      </Button>
                    )}
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">CEP</Label>
                      <div className="relative">
                        <Input
                          placeholder="00000-000"
                          value={manualAddress.zipCode}
                          onChange={(e) => setManualAddress((p) => ({ ...p, zipCode: e.target.value }))}
                        />
                        {cepLoading && (
                          <Loader2 className="h-4 w-4 animate-spin absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                        )}
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <Input
                        placeholder="Rua"
                        value={manualAddress.street}
                        onChange={(e) => setManualAddress((p) => ({ ...p, street: e.target.value }))}
                        className="col-span-2"
                      />
                      <Input
                        placeholder="Número"
                        value={manualAddress.number}
                        onChange={(e) => setManualAddress((p) => ({ ...p, number: e.target.value }))}
                      />
                    </div>
                    <Input
                      placeholder="Complemento (opcional)"
                      value={manualAddress.complement}
                      onChange={(e) => setManualAddress((p) => ({ ...p, complement: e.target.value }))}
                    />
                    <Input
                      placeholder="Bairro"
                      value={manualAddress.neighborhood}
                      onChange={(e) => setManualAddress((p) => ({ ...p, neighborhood: e.target.value }))}
                    />
                    <div className="grid grid-cols-3 gap-2">
                      <Input
                        placeholder="Cidade"
                        value={manualAddress.city}
                        onChange={(e) => setManualAddress((p) => ({ ...p, city: e.target.value }))}
                        className="col-span-2"
                      />
                      <Input
                        placeholder="UF"
                        maxLength={2}
                        value={manualAddress.state}
                        onChange={(e) => setManualAddress((p) => ({ ...p, state: e.target.value.toUpperCase() }))}
                      />
                    </div>
                  </div>
                )}
              </>
            )}
            {!addressesLoading && !buyerAccount.whatsapp && (
              <div className="space-y-1.5 pt-2">
                <Label className="text-xs text-muted-foreground">WhatsApp para contato</Label>
                <Input
                  placeholder="(00) 00000-0000"
                  value={whatsappFallback}
                  onChange={(e) => setWhatsappFallback(e.target.value)}
                />
              </div>
            )}
            {!addressesLoading && (
              <div className="space-y-1.5 pt-2">
                <Label className="text-xs text-muted-foreground">CPF</Label>
                <Input
                  placeholder="000.000.000-00"
                  value={cpf}
                  onChange={(e) => setCpf(formatCpfCnpj(e.target.value))}
                  maxLength={18}
                />
                <p className="text-xs text-muted-foreground">Necessário para emitir o pagamento.</p>
              </div>
            )}
          </CardContent>
        </Card>
        </div>

        {/* Coluna de resumo: no mobile fica embaixo do formulário (ordem 2);
            no desktop vira a esquerda e acompanha a rolagem (sticky). */}
        <div className="order-2 lg:order-1 lg:sticky lg:top-6">
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-lg">Resumo do pedido</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {appliedCoupon ? (
              <div className="flex items-center gap-2 h-9 px-3 rounded-md border border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950">
                <Ticket className="h-3.5 w-3.5 text-green-600 dark:text-green-400 flex-shrink-0" />
                <span className="text-xs font-medium text-green-700 dark:text-green-300 flex-1 truncate">
                  {appliedCoupon.code}
                  <span className="font-normal ml-1.5">-{formatCurrencyI18n(appliedCoupon.calculatedDiscount)}</span>
                </span>
                <button
                  type="button"
                  className="text-green-600 hover:text-red-500 dark:text-green-400 transition-colors p-0.5"
                  onClick={handleRemoveCoupon}
                >
                  ×
                </button>
              </div>
            ) : (
              <div className="flex gap-2">
                <Input
                  placeholder="Código do cupom"
                  value={couponCode}
                  onChange={(e) => {
                    setCouponCode(e.target.value.toUpperCase());
                    if (couponError) setCouponError(null);
                  }}
                  className="uppercase"
                  disabled={couponLoading}
                />
                <Button variant="outline" onClick={handleApplyCoupon} disabled={couponLoading || !couponCode.trim()}>
                  {couponLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Aplicar'}
                </Button>
              </div>
            )}
            {couponError && !appliedCoupon && <p className="text-xs text-destructive">{couponError}</p>}

            <Separator />

            {checkoutSettings.shippingInsurance?.enabled && insuranceRate > 0 && (
              <>
                <label className="flex items-start gap-2.5 rounded-lg border p-3 cursor-pointer">
                  <Checkbox
                    checked={insuranceOptIn}
                    onCheckedChange={(checked) => setInsuranceOptIn(checked === true)}
                    className="mt-0.5"
                  />
                  <span className="text-sm">
                    <span className="font-medium flex items-center gap-1.5">
                      <ShieldCheck className="h-3.5 w-3.5" />
                      Contratar seguro de frete
                    </span>
                    <span className="text-muted-foreground block">
                      Proteja sua compra por +{formatCurrencyI18n(subtotalAfterDiscount * (insuranceRate / 100))} ({insuranceRate}%)
                    </span>
                  </span>
                </label>
                <Separator />
              </>
            )}

            <OrderItemsSummary
              items={buildOrderItems()}
              totals={{
                subtotal: cart.total,
                delivery_fee: deliveryFee,
                insurance_fee: insuranceFee,
                discount_amount: discountAmount,
                total: finalTotal,
              }}
            />

            <Button onClick={handleContinue} disabled={submitting} className="w-full" size="lg">
              {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Continuar para pagamento
            </Button>
          </CardContent>
        </Card>
        </div>
        </div>
      </div>
    </div>
  );
}
