import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Loader as Loader2, ArrowLeft, MapPin, Ticket, Truck, Check, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useCorretorData } from '@/hooks/useCorretorData';
import { useCart } from '@/contexts/CartContext';
import { useBuyerAuth } from '@/contexts/BuyerAuthContext';
import { useCheckoutSettingsForStore } from '@/hooks/useCheckoutSettings';
import { useInventoryEnabledForStore } from '@/hooks/useInventoryEnabled';
import { useCouponValidation } from '@/hooks/useCouponValidation';
import { fetchCustomerAddresses, createCustomerAddress, type CustomerAddress } from '@/lib/customerAddressService';
import { fetchAddressByCep } from '@/lib/viaCep';
import { createOrder } from '@/lib/orderService';
import { findCartStockShortfalls, formatShortfallMessage } from '@/lib/stockAvailabilityService';
import { resolveAttributedAffiliateId } from '@/lib/affiliateUtils';
import { formatCurrencyI18n } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import { getShippingQuote } from '@/lib/merchantShipping';
import { fetchProductShippingDims, fetchVariantShippingWeights, buildSuperFreteProducts } from '@/lib/shippingUtils';
import type { ShippingQuote } from '@/types';
import { normalizeCityName, filterEligibleDeliveryOptions, hasNoMatchingLocalOption as computeHasNoMatchingLocalOption } from '@/lib/localDelivery';

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
  const { cart, clearCart, appliedCoupon, setAppliedCoupon, clearAppliedCoupon } = useCart();
  const { customer: buyerAccount, loading: authLoading } = useBuyerAuth();
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

  const handleCepBlur = async () => {
    if (manualAddress.zipCode.replace(/\D/g, '').length !== 8) return;
    setCepLoading(true);
    try {
      const result = await fetchAddressByCep(manualAddress.zipCode);
      if (result) {
        setManualAddress((prev) => ({
          ...prev,
          street: result.street || prev.street,
          neighborhood: result.neighborhood || prev.neighborhood,
          city: result.city || prev.city,
          state: result.state || prev.state,
        }));
      }
    } finally {
      setCepLoading(false);
    }
  };

  const selectedSavedAddress = savedAddresses.find((a) => a.id === selectedAddressId) || null;

  const currentState = showManualForm ? manualAddress.state : (selectedSavedAddress?.state || '');
  const currentCity = showManualForm ? manualAddress.city : (selectedSavedAddress?.city || '');
  const currentZip = showManualForm ? manualAddress.zipCode : (selectedSavedAddress?.zip_code || '');

  const buyerCity = currentCity ? normalizeCityName(currentCity) : null;

  const enabledDeliveryOptions = useMemo(
    () =>
      filterEligibleDeliveryOptions(checkoutSettings.deliveryOptions, {
        merchantCity: corretor?.city,
        buyerCity: currentCity,
        buyerState: currentState,
      }),
    [checkoutSettings.deliveryOptions, currentState, currentCity, corretor?.city]
  );

  const hasNoMatchingLocalOption = computeHasNoMatchingLocalOption(
    enabledDeliveryOptions.length,
    buyerCity,
    checkoutSettings.deliveryOptions
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
  // options are unaffected: they're a separate scope decided by city match,
  // not by carrier availability.
  const nationalDeliveryOptions = superFreteOptions.length > 0
    ? superFreteOptions
    : enabledDeliveryOptions.filter((d) => d.scope !== 'local');
  const localDeliveryOptions = enabledDeliveryOptions.filter((d) => d.scope === 'local');
  const allDeliveryOptions = [...localDeliveryOptions, ...nationalDeliveryOptions];

  const selectedDeliveryConfig = allDeliveryOptions.find((d) => d.id === selectedDeliveryOption);

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

  const buildOrderItems = () => [
    ...cart.distributions.flatMap((dist) =>
      dist.items.map((distItem) => ({
        product_id: dist.product.id,
        product_title: dist.product.title,
        product_image_url: dist.product.featured_image_url || '',
        quantity: distItem.quantity,
        unit_price: dist.distribution.applied_tier_price,
        selected_color: distItem.color || null,
        selected_size: distItem.size || null,
        subtotal: dist.distribution.applied_tier_price * distItem.quantity,
      }))
    ),
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

  const validateAddress = (): boolean => {
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

    if (checkoutSettings.requireDeliveryOption && allDeliveryOptions.length > 0 && !selectedDeliveryOption) {
      toast.error('Selecione uma opção de entrega');
      return false;
    }

    if (!buyerAccount?.whatsapp && !whatsappFallback.trim()) {
      toast.error('Informe um WhatsApp para contato');
      return false;
    }

    return true;
  };

  const handleContinue = async () => {
    if (!corretor || !buyerAccount) return;
    if (!validateAddress()) return;

    setSubmitting(true);
    try {
      let finalAddress: ManualAddress;

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

      const orderItems = buildOrderItems();

      if (inventoryEnabled) {
        const shortfalls = await findCartStockShortfalls(
          orderItems.map((item) => ({
            productId: item.product_id,
            title: item.product_title,
            quantity: item.quantity,
            selectedColor: item.selected_color,
            selectedSize: item.selected_size,
            selectedFlavor: (item as { selected_flavor?: string | null }).selected_flavor,
          }))
        );

        if (shortfalls.length > 0) {
          toast.error(formatShortfallMessage(shortfalls));
          return;
        }
      }

      const affiliateId = await resolveAttributedAffiliateId(corretor.id);

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
          delivery_scope: selectedDeliveryConfig ? (selectedDeliveryConfig.scope === 'local' ? 'local' : 'national') : null,
          insurance_fee: insuranceFee,
          affiliate_id: affiliateId,
          buyer_id: buyerAccount.id,
          payment_status: 'pending',
          shipping_street: finalAddress.street.trim(),
          shipping_number: finalAddress.number.trim(),
          shipping_complement: finalAddress.complement.trim() || null,
          shipping_neighborhood: finalAddress.neighborhood.trim() || null,
          shipping_city: finalAddress.city.trim(),
          shipping_state: finalAddress.state.trim(),
          shipping_zip_code: finalAddress.zipCode.trim(),
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
      <div className="max-w-lg mx-auto space-y-6">
        <Button variant="ghost" size="sm" onClick={() => navigate(`/${slug}`)} className="text-muted-foreground">
          <ArrowLeft className="h-4 w-4 mr-1" />
          Voltar à loja
        </Button>

        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-lg flex items-center gap-2">
              <MapPin className="h-5 w-5" />
              Endereço de entrega
            </CardTitle>
            <CardDescription>Para onde devemos enviar seu pedido?</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {addressesLoading ? (
              <div className="flex justify-center py-6">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
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
                          onBlur={handleCepBlur}
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

                {!buyerAccount.whatsapp && (
                  <div className="space-y-1.5 pt-2">
                    <Label className="text-xs text-muted-foreground">WhatsApp para contato</Label>
                    <Input
                      placeholder="(00) 00000-0000"
                      value={whatsappFallback}
                      onChange={(e) => setWhatsappFallback(e.target.value)}
                    />
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>

        {hasNoMatchingLocalOption && (
          <Card>
            <CardContent className="pt-6 text-sm text-muted-foreground">
              Não há opções de entrega disponíveis para {currentCity}. Esta loja entrega localmente apenas em {corretor?.city}.
            </CardContent>
          </Card>
        )}

        {(allDeliveryOptions.length > 0 || shippingQuotesLoading || shippingQuotesError) && (
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="text-lg flex items-center gap-2">
                <Truck className="h-5 w-5" />
                Entrega
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {allDeliveryOptions.length > 0 && (
                <Select
                  value={selectedDeliveryOption || ''}
                  onValueChange={(value) => setSelectedDeliveryOption(value || null)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione a opção de entrega" />
                  </SelectTrigger>
                  <SelectContent>
                    {allDeliveryOptions.map((option) => {
                      const subtotalForFreeCheck = Math.max(0, cart.total - discountAmount);
                      const isFreeDelivery = option.freeAbove && subtotalForFreeCheck >= option.freeAbove;
                      const displayFee = isFreeDelivery ? 0 : option.fee;
                      return (
                        <SelectItem key={option.id} value={option.id}>
                          <div className="flex items-center gap-1.5">
                            <span>{option.name}</span>
                            <span className={displayFee === 0 ? 'text-green-600 dark:text-green-400' : 'text-muted-foreground'}>
                              {displayFee === 0 ? 'Grátis' : `+${formatCurrencyI18n(displayFee)}`}
                            </span>
                          </div>
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
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

            <div className="space-y-1.5 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Subtotal ({cart.itemCount} {cart.itemCount === 1 ? 'item' : 'itens'})</span>
                <span>{formatCurrencyI18n(cart.total)}</span>
              </div>
              {discountAmount > 0 && (
                <div className="flex justify-between text-green-600 dark:text-green-400">
                  <span>Cupom</span>
                  <span>-{formatCurrencyI18n(discountAmount)}</span>
                </div>
              )}
              {selectedDeliveryConfig && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{selectedDeliveryConfig.name}</span>
                  <span className={deliveryFee === 0 ? 'text-green-600 dark:text-green-400' : ''}>
                    {deliveryFee === 0 ? 'Grátis' : `+${formatCurrencyI18n(deliveryFee)}`}
                  </span>
                </div>
              )}
              {insuranceFee > 0 && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground flex items-center gap-1.5">
                    <ShieldCheck className="h-3.5 w-3.5" />
                    Seguro de frete
                  </span>
                  <span>+{formatCurrencyI18n(insuranceFee)}</span>
                </div>
              )}
            </div>

            <Separator />

            <div className="flex justify-between items-center">
              <span className="font-semibold">Total</span>
              <span className="text-lg font-bold text-primary">{formatCurrencyI18n(finalTotal)}</span>
            </div>

            <Button onClick={handleContinue} disabled={submitting} className="w-full" size="lg">
              {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Continuar para pagamento
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
