import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Loader as Loader2, CreditCard, Truck, Plus, Trash2, Percent, ShoppingCart, Minimize2, ShieldCheck, AlertTriangle, MessageCircle, Wallet, MapPin, CheckCircle2 } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CurrencyInput } from '@/components/ui/currency-input';
import { useCheckoutSettings } from '@/hooks/useCheckoutSettings';
import { usePlatformPaymentsEnabled } from '@/hooks/usePlatformPaymentsEnabled';
import { useAuth } from '@/contexts/AuthContext';
import { fetchAddressByCep } from '@/lib/viaCep';
import type { CheckoutSettings, PaymentMethodConfig, DeliveryOption, DeliveryScope, PaymentMethodDiscountType, ShippingCalculationType, CheckoutMode } from '@/types';
import { v4 as uuidv4 } from 'uuid';

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

const BR_STATES = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG',
  'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO',
];

export default function CheckoutSettingsContent() {
  const { settings, loading, saving, updateSettings, insuranceGateEnabled } = useCheckoutSettings();
  const { user, updateUser } = useAuth();
  const { enabled: platformPaymentsEnabled } = usePlatformPaymentsEnabled(user?.id);
  const [newMethodName, setNewMethodName] = useState('');
  const [newDeliveryName, setNewDeliveryName] = useState('');
  const [newDeliveryFee, setNewDeliveryFee] = useState(0);
  const [storeZipCode, setStoreZipCode] = useState('');
  const [storeCepLoading, setStoreCepLoading] = useState(false);
  const hasMerchantCity = !!user?.city?.trim();

  useEffect(() => {
    setStoreZipCode(user?.store_zip_code || '');
  }, [user?.id, user?.store_zip_code]);

  const save = async (newSettings: CheckoutSettings) => {
    try {
      await updateSettings(newSettings);
      toast.success('Configurações de checkout salvas');
    } catch {
      toast.error('Erro ao salvar configuracoes');
    }
  };

  const handleStoreCepBlur = async () => {
    const digits = storeZipCode.replace(/\D/g, '');
    if (digits.length !== 8) return;
    setStoreCepLoading(true);
    try {
      const result = await fetchAddressByCep(storeZipCode);
      if (!result || !result.city) {
        toast.error('CEP não encontrado');
        return;
      }
      const { error } = await updateUser({ store_zip_code: digits, city: result.city, state: result.state });
      if (error) {
        toast.error('Erro ao salvar CEP da loja');
      } else {
        toast.success(`Cidade da loja definida como ${result.city} - ${result.state}`);
      }
    } finally {
      setStoreCepLoading(false);
    }
  };

  const updateCheckoutMode = (mode: CheckoutMode) => {
    save({ ...settings, checkoutMode: mode });
  };

  const togglePaymentMethod = (id: string, enabled: boolean) => {
    const updated = settings.paymentMethods.map(m =>
      m.id === id ? { ...m, enabled } : m
    );
    save({ ...settings, paymentMethods: updated });
  };

  const updatePaymentMethodDiscount = (id: string, discountType: PaymentMethodDiscountType, discountValue: number) => {
    const updated = settings.paymentMethods.map(m =>
      m.id === id ? { ...m, discountType, discountValue } : m
    );
    save({ ...settings, paymentMethods: updated });
  };

  const clearPaymentMethodDiscount = (id: string) => {
    const updated = settings.paymentMethods.map(m =>
      m.id === id ? { ...m, discountType: undefined, discountValue: undefined } : m
    );
    save({ ...settings, paymentMethods: updated });
  };

  const addCustomPaymentMethod = () => {
    const name = newMethodName.trim();
    if (!name) return;

    const newMethod: PaymentMethodConfig = {
      id: uuidv4(),
      name,
      enabled: true,
    };

    save({
      ...settings,
      paymentMethods: [...settings.paymentMethods, newMethod],
    });
    setNewMethodName('');
  };

  const removePaymentMethod = (id: string) => {
    save({
      ...settings,
      paymentMethods: settings.paymentMethods.filter(m => m.id !== id),
    });
  };

  const toggleDeliveryOption = (id: string, enabled: boolean) => {
    const updated = settings.deliveryOptions.map(d =>
      d.id === id ? { ...d, enabled } : d
    );
    save({ ...settings, deliveryOptions: updated });
  };

  const updateDeliveryFee = (id: string, fee: number) => {
    const updated = settings.deliveryOptions.map(d =>
      d.id === id ? { ...d, fee } : d
    );
    save({ ...settings, deliveryOptions: updated });
  };

  const updateDeliveryFreeAbove = (id: string, freeAbove: number | null) => {
    const updated = settings.deliveryOptions.map(d =>
      d.id === id ? { ...d, freeAbove } : d
    );
    save({ ...settings, deliveryOptions: updated });
  };

  const updateDeliveryCalculationType = (id: string, calculationType: ShippingCalculationType) => {
    const updated = settings.deliveryOptions.map(d =>
      d.id === id ? { ...d, calculationType } : d
    );
    save({ ...settings, deliveryOptions: updated });
  };

  const updateDeliveryRegions = (id: string, regions: string[]) => {
    const updated = settings.deliveryOptions.map(d =>
      d.id === id ? { ...d, regions } : d
    );
    save({ ...settings, deliveryOptions: updated });
  };

  const updateDeliveryQuoteOnRequest = (id: string, quoteOnRequest: boolean) => {
    const updated = settings.deliveryOptions.map(d =>
      d.id === id ? { ...d, quoteOnRequest } : d
    );
    save({ ...settings, deliveryOptions: updated });
  };

  const updateDeliveryScope = (id: string, scope: DeliveryScope) => {
    if (scope === 'local' && !hasMerchantCity) {
      toast.error('Defina o CEP da sua loja acima antes de criar uma opção de entrega local');
      return;
    }
    const updated = settings.deliveryOptions.map(d =>
      // A 'local' option has no notion of UF regions — force flat fee calculation.
      d.id === id ? { ...d, scope, ...(scope === 'local' ? { calculationType: 'flat' as ShippingCalculationType } : {}) } : d
    );
    save({ ...settings, deliveryOptions: updated });
  };

  const addDeliveryOption = () => {
    const name = newDeliveryName.trim();
    if (!name) return;

    const newOption: DeliveryOption = {
      id: uuidv4(),
      name,
      fee: newDeliveryFee,
      enabled: true,
      scope: 'national',
    };

    save({
      ...settings,
      deliveryOptions: [...settings.deliveryOptions, newOption],
    });
    setNewDeliveryName('');
    setNewDeliveryFee(0);
  };

  const removeDeliveryOption = (id: string) => {
    save({
      ...settings,
      deliveryOptions: settings.deliveryOptions.filter(d => d.id !== id),
    });
  };

  const toggleRequirePayment = (checked: boolean) => {
    save({ ...settings, requirePaymentMethod: checked });
  };

  const toggleRequireDelivery = (checked: boolean) => {
    save({ ...settings, requireDeliveryOption: checked });
  };

  const toggleRequireDeliveryCep = (checked: boolean) => {
    save({ ...settings, requireDeliveryCep: checked });
  };

  const toggleCartEnabled = (checked: boolean) => {
    save({ ...settings, cartEnabled: checked });
  };

  const toggleShippingInsurance = (enabled: boolean) => {
    save({
      ...settings,
      shippingInsurance: {
        ...(settings.shippingInsurance ?? { percentageRate: 0 }),
        enabled,
      },
    });
  };

  const updateShippingInsuranceRate = (percentageRate: number) => {
    save({
      ...settings,
      shippingInsurance: {
        ...(settings.shippingInsurance ?? { enabled: false }),
        percentageRate,
      },
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const hasAnyPaymentEnabled = settings.paymentMethods.some(m => m.enabled);
  const hasAnyDeliveryEnabled = settings.deliveryOptions.some(d => d.enabled);
  const isDefaultMethod = (id: string) => ['pix', 'credit_card', 'debit_card', 'cash', 'bank_transfer'].includes(id);

  const checkoutMode = settings.checkoutMode || 'whatsapp';
  const hasLocalDeliveryOption = settings.deliveryOptions.some((d) => d.enabled && d.scope === 'local');
  const hasNationalDeliveryOption =
    settings.deliveryOptions.some((d) => d.enabled && d.scope !== 'local') ||
    // superFrete.enabled alone isn't enough: checkout only fetches quotes
    // when at least one service is selected too (see CheckoutAddressPage.tsx).
    (!!settings.superFrete?.enabled && (settings.superFrete?.serviceIds?.length ?? 0) > 0);
  const onlinePaymentAllowed = platformPaymentsEnabled && checkoutMode !== 'whatsapp';
  const whatsappAllowed = checkoutMode !== 'ecommerce_only';

  const flow1Active = onlinePaymentAllowed && hasMerchantCity && hasLocalDeliveryOption;
  const flow2Active = onlinePaymentAllowed && hasNationalDeliveryOption;
  const flow3Active = whatsappAllowed && hasMerchantCity && hasLocalDeliveryOption;

  return (
    <div className="space-y-6">
      {/* How you sell: checkoutMode + store CEP + the 3 order flows explained together */}
      <Card>
        <CardHeader>
          <CardTitle>Como você vende</CardTitle>
          <CardDescription>
            Defina o CEP da sua loja e como o cliente finaliza o pedido. Isso controla os 3 fluxos de venda abaixo.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {!platformPaymentsEnabled && (
            <div className="flex items-start gap-2 rounded-md bg-amber-500/10 border border-amber-500/20 px-4 py-3 text-sm text-amber-700 dark:text-amber-400">
              <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
              <span>
                Pagamento online está temporariamente desativado para todas as lojas. Enquanto isso, sua loja
                vende só por WhatsApp — configure as credenciais em Pagamento a qualquer momento.
              </span>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="store-zip-code">CEP da sua loja</Label>
            <div className="flex items-center gap-2 max-w-xs">
              <Input
                id="store-zip-code"
                placeholder="00000-000"
                value={storeZipCode}
                onChange={(e) => setStoreZipCode(e.target.value)}
                onBlur={handleStoreCepBlur}
                disabled={storeCepLoading}
              />
              {storeCepLoading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
            </div>
            {hasMerchantCity ? (
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <MapPin className="h-3 w-3" /> Cidade cadastrada: {user?.city} - {user?.state}
              </p>
            ) : (
              <p className="text-xs text-muted-foreground">
                Usado para comparar com o CEP do comprador e liberar a entrega local.
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label>Como o cliente finaliza o pedido</Label>
            <Select
              value={checkoutMode}
              onValueChange={(v) => updateCheckoutMode(v as CheckoutMode)}
              disabled={saving || !platformPaymentsEnabled}
            >
              <SelectTrigger className="max-w-md">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="whatsapp">Só WhatsApp</SelectItem>
                <SelectItem value="ecommerce_optional">WhatsApp e Pagamento Online (cliente escolhe)</SelectItem>
                <SelectItem value="ecommerce_only">Só Pagamento Online</SelectItem>
              </SelectContent>
            </Select>
            {!platformPaymentsEnabled && (
              <p className="text-xs text-muted-foreground">
                Trava em "Só WhatsApp" até o pagamento online ser liberado para sua loja.
              </p>
            )}
          </div>

          <Separator />

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <FlowStatusCard
              icon={<Wallet className="h-4 w-4" />}
              title="Pagamento online + local"
              description="Cliente cria conta, paga na hora. Só aparece se o CEP dele coincidir com a cidade da sua loja."
              active={flow1Active}
              missing={
                !onlinePaymentAllowed
                  ? 'Ative "Pagamento Online" acima'
                  : !hasMerchantCity
                    ? 'Defina o CEP da loja'
                    : !hasLocalDeliveryOption
                      ? 'Crie uma opção de entrega local'
                      : undefined
              }
            />
            <FlowStatusCard
              icon={<Truck className="h-4 w-4" />}
              title="Pagamento online + nacional"
              description="Cliente cria conta, paga na hora. Frete calculado pelo CEP via suas integrações de frete ativas."
              active={flow2Active}
              missing={
                !onlinePaymentAllowed
                  ? 'Ative "Pagamento Online" acima'
                  : !hasNationalDeliveryOption
                    ? 'Crie uma opção nacional ou ative uma integração de frete'
                    : undefined
              }
            />
            <FlowStatusCard
              icon={<MessageCircle className="h-4 w-4" />}
              title="Pedido via WhatsApp + local"
              description="Sem necessidade de conta. Só aparece se o CEP do comprador coincidir com a cidade da loja. Não oferece frete nacional."
              active={flow3Active}
              missing={
                !whatsappAllowed
                  ? 'Ative o WhatsApp acima'
                  : !hasMerchantCity
                    ? 'Defina o CEP da loja'
                    : !hasLocalDeliveryOption
                      ? 'Crie uma opção de entrega local'
                      : undefined
              }
            />
          </div>
        </CardContent>
      </Card>

      {/* Cart Enable/Disable */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <ShoppingCart className="h-5 w-5 text-muted-foreground" />
            <CardTitle>Carrinho de Compras</CardTitle>
          </div>
          <CardDescription>
            Ative o carrinho para que seus clientes possam adicionar produtos e fazer pedidos. Desative se você não precisa de carrinho — ideal para imóveis, veículos e consultorias.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-row items-center justify-between rounded-lg border p-4">
            <div className="space-y-0.5">
              <p className="text-sm font-medium">Ativar carrinho de compras</p>
              <p className="text-xs text-muted-foreground">
                Quando desativado, o botão dos produtos mostrará "Exibir detalhes" e direcionará para a página do produto
              </p>
            </div>
            <Switch
              checked={settings.cartEnabled ?? true}
              onCheckedChange={toggleCartEnabled}
              disabled={saving}
            />
          </div>
        </CardContent>
      </Card>

      {/* Minimum Purchase */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Minimize2 className="h-5 w-5 text-muted-foreground" />
            <CardTitle>Compra Mínima</CardTitle>
          </div>
          <CardDescription>
            Defina um valor ou quantidade mínima para que o cliente possa avançar para a finalização do pedido.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-row items-center justify-between rounded-lg border p-4">
            <div className="space-y-0.5">
              <Label htmlFor="min-purchase-enabled">Ativar compra mínima</Label>
              <p className="text-xs text-muted-foreground">
                O cliente só avançará para a finalização quando o mínimo for atingido.
              </p>
            </div>
            <Switch
              id="min-purchase-enabled"
              checked={settings.minimumPurchase?.enabled ?? false}
              onCheckedChange={(checked) =>
                save({
                  ...settings,
                  minimumPurchase: {
                    ...(settings.minimumPurchase ?? { type: 'value', value: 0 }),
                    enabled: checked,
                  },
                })
              }
              disabled={saving}
            />
          </div>

          {(settings.minimumPurchase?.enabled ?? false) && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Tipo de mínimo</Label>
                <Select
                  value={settings.minimumPurchase?.type ?? 'value'}
                  onValueChange={(val: 'value' | 'quantity') =>
                    save({
                      ...settings,
                      minimumPurchase: {
                        ...(settings.minimumPurchase ?? { enabled: true, value: 0 }),
                        type: val,
                        value: 0,
                      },
                    })
                  }
                  disabled={saving}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="value">Valor mínimo (R$)</SelectItem>
                    <SelectItem value="quantity">Quantidade mínima de itens</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="min-purchase-value">
                  {settings.minimumPurchase?.type === 'quantity'
                    ? 'Quantidade mínima'
                    : 'Valor mínimo'}
                </Label>
                {settings.minimumPurchase?.type === 'quantity' ? (
                  <Input
                    id="min-purchase-value"
                    type="number"
                    min={1}
                    step={1}
                    value={settings.minimumPurchase?.value ?? 0}
                    onChange={(e) =>
                      save({
                        ...settings,
                        minimumPurchase: {
                          ...(settings.minimumPurchase ?? { enabled: true, type: 'quantity' }),
                          value: Math.max(1, parseInt(e.target.value) || 1),
                        },
                      })
                    }
                    disabled={saving}
                  />
                ) : (
                  <CurrencyInput
                    id="min-purchase-value"
                    value={settings.minimumPurchase?.value ?? 0}
                    onValueChange={(vals) =>
                      save({
                        ...settings,
                        minimumPurchase: {
                          ...(settings.minimumPurchase ?? { enabled: true, type: 'value' }),
                          value: vals.floatValue ?? 0,
                        },
                      })
                    }
                    disabled={saving}
                  />
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Payment Methods */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <CreditCard className="h-5 w-5 text-muted-foreground" />
            <CardTitle>Formas de Pagamento</CardTitle>
          </div>
          <CardDescription>
            Configure quais formas de pagamento seus clientes podem escolher no checkout. Ative pelo menos uma opção para que o campo apareça.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-row items-center justify-between rounded-lg border p-4">
            <div className="space-y-0.5">
              <p className="text-sm font-medium">Exigir forma de pagamento</p>
              <p className="text-xs text-muted-foreground">
                O cliente deve selecionar como vai pagar antes de enviar o pedido
              </p>
            </div>
            <Switch
              checked={settings.requirePaymentMethod}
              onCheckedChange={toggleRequirePayment}
              disabled={saving}
            />
          </div>

          <Separator />

          <div className="space-y-3">
            {settings.paymentMethods.map((method) => (
              <PaymentMethodRow
                key={method.id}
                method={method}
                saving={saving}
                isDefault={isDefaultMethod(method.id)}
                onToggle={(enabled) => togglePaymentMethod(method.id, enabled)}
                onUpdateDiscount={(type, value) => updatePaymentMethodDiscount(method.id, type, value)}
                onClearDiscount={() => clearPaymentMethodDiscount(method.id)}
                onRemove={() => removePaymentMethod(method.id)}
              />
            ))}
          </div>

          <Separator />

          <div className="flex gap-2">
            <Input
              placeholder="Nome do método personalizado..."
              value={newMethodName}
              onChange={(e) => setNewMethodName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addCustomPaymentMethod()}
              className="flex-1"
            />
            <Button
              variant="outline"
              size="sm"
              onClick={addCustomPaymentMethod}
              disabled={!newMethodName.trim() || saving}
            >
              <Plus className="h-4 w-4 mr-1" />
              Adicionar
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Delivery Options */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Truck className="h-5 w-5 text-muted-foreground" />
            <CardTitle>Opções de Entrega</CardTitle>
          </div>
          <CardDescription>
            Configure as opções de entrega e suas taxas. Adicione opções como "Retirada na loja", "Centro", "Zona Norte", etc.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-row items-center justify-between rounded-lg border p-4">
            <div className="space-y-0.5">
              <p className="text-sm font-medium">Exigir opção de entrega</p>
              <p className="text-xs text-muted-foreground">
                O cliente deve selecionar uma opção de entrega antes de enviar o pedido
              </p>
            </div>
            <Switch
              checked={settings.requireDeliveryOption}
              onCheckedChange={toggleRequireDelivery}
              disabled={saving}
            />
          </div>

          <div className="flex flex-row items-center justify-between rounded-lg border p-4">
            <div className="space-y-0.5">
              <p className="text-sm font-medium">Pedir CEP do comprador</p>
              <p className="text-xs text-muted-foreground">
                {settings.requireDeliveryCep === false
                  ? 'Desativado: o comprador não precisa informar CEP e vê todas as opções de entrega habilitadas abaixo, sem checar a cidade dele. Use se você vende para todo o Brasil e não tem opções restritas à sua cidade.'
                  : 'O comprador informa o CEP e só vê as opções de entrega compatíveis com a cidade dele (abrangência "Só na minha cidade" ou "Todo o Brasil" configurada em cada opção abaixo).'}
              </p>
            </div>
            <Switch
              checked={settings.requireDeliveryCep !== false}
              onCheckedChange={toggleRequireDeliveryCep}
              disabled={saving}
            />
          </div>

          <Separator />

          {!hasMerchantCity && settings.deliveryOptions.some(d => d.scope === 'local') && (
            <div className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-800 p-3 text-amber-800 dark:text-amber-300">
              <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
              <p className="text-xs">
                Você tem opções de entrega local, mas ainda não definiu o CEP da sua loja acima — elas não aparecerão para os compradores até que isso seja corrigido.
              </p>
            </div>
          )}

          {settings.deliveryOptions.length === 0 ? (
            <div className="text-center py-6 text-muted-foreground">
              <Truck className="h-8 w-8 mx-auto mb-2 opacity-40" />
              <p className="text-sm">Nenhuma opção de entrega configurada</p>
              <p className="text-xs mt-1">Adicione opções abaixo</p>
            </div>
          ) : (
            <div className="space-y-3">
              {settings.deliveryOptions.map((option) => (
                <DeliveryOptionRow
                  key={option.id}
                  option={option}
                  saving={saving}
                  onToggle={(enabled) => toggleDeliveryOption(option.id, enabled)}
                  onUpdateFee={(fee) => updateDeliveryFee(option.id, fee)}
                  onUpdateFreeAbove={(val) => updateDeliveryFreeAbove(option.id, val)}
                  onUpdateCalculationType={(type) => updateDeliveryCalculationType(option.id, type)}
                  onUpdateRegions={(regions) => updateDeliveryRegions(option.id, regions)}
                  onUpdateScope={(scope) => updateDeliveryScope(option.id, scope)}
                  onUpdateQuoteOnRequest={(val) => updateDeliveryQuoteOnRequest(option.id, val)}
                  onRemove={() => removeDeliveryOption(option.id)}
                />
              ))}
            </div>
          )}

          <Separator />

          <div className="space-y-2">
            <Label className="text-sm font-medium">Adicionar opção de entrega</Label>
            <div className="flex gap-2">
              <Input
                placeholder="Nome (ex: Centro, Zona Norte...)"
                value={newDeliveryName}
                onChange={(e) => setNewDeliveryName(e.target.value)}
                className="flex-1"
              />
              <CurrencyInput
                placeholder="Taxa"
                value={newDeliveryFee}
                onChange={setNewDeliveryFee}
                className="w-32"
              />
              <Button
                variant="outline"
                size="sm"
                onClick={addDeliveryOption}
                disabled={!newDeliveryName.trim() || saving}
              >
                <Plus className="h-4 w-4 mr-1" />
                Adicionar
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Shipping Insurance — only visible when admin has granted this merchant access */}
      {insuranceGateEnabled && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-muted-foreground" />
              <CardTitle>Seguro de Frete</CardTitle>
            </div>
            <CardDescription>
              Ofereça um seguro opcional para o cliente proteger a compra. A taxa é calculada sobre o subtotal do pedido, após o desconto de cupom e sem contar o frete, e só é cobrada se o cliente marcar a opção no checkout.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-row items-center justify-between rounded-lg border p-4">
              <div className="space-y-0.5">
                <Label htmlFor="shipping-insurance-enabled">Oferecer seguro de frete</Label>
                <p className="text-xs text-muted-foreground">
                  Quando ativado, o cliente verá a opção de contratar o seguro na finalização da compra.
                </p>
              </div>
              <Switch
                id="shipping-insurance-enabled"
                checked={settings.shippingInsurance?.enabled ?? false}
                onCheckedChange={toggleShippingInsurance}
                disabled={saving}
              />
            </div>

            {(settings.shippingInsurance?.enabled ?? false) && (
              <div className="space-y-2">
                <Label htmlFor="shipping-insurance-rate">Percentual do seguro</Label>
                <div className="relative w-40">
                  <Input
                    id="shipping-insurance-rate"
                    type="number"
                    min={0}
                    max={100}
                    step={0.1}
                    value={settings.shippingInsurance?.percentageRate ?? 0}
                    onChange={(e) =>
                      updateShippingInsuranceRate(Math.max(0, Math.min(100, Number(e.target.value) || 0)))
                    }
                    className="pr-7"
                    disabled={saving}
                  />
                  <Percent className="absolute right-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                </div>
                <p className="text-xs text-muted-foreground">
                  Calculado sobre o subtotal do pedido após o desconto do cupom (sem o frete).
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

interface FlowStatusCardProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  active: boolean;
  missing?: string;
}

function FlowStatusCard({ icon, title, description, active, missing }: FlowStatusCardProps) {
  return (
    <div className={`rounded-lg border p-3 space-y-2 ${active ? 'border-green-500/30 bg-green-500/5' : 'border-border'}`}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 text-sm font-medium">
          {icon}
          {title}
        </div>
        <Badge variant={active ? 'default' : 'outline'} className="shrink-0">
          {active ? (
            <span className="flex items-center gap-1"><CheckCircle2 className="h-3 w-3" /> Ativo</span>
          ) : (
            'Inativo'
          )}
        </Badge>
      </div>
      <p className="text-xs text-muted-foreground">{description}</p>
      {!active && missing && (
        <p className="text-xs text-amber-700 dark:text-amber-400">{missing}</p>
      )}
    </div>
  );
}

interface PaymentMethodRowProps {
  method: PaymentMethodConfig;
  saving: boolean;
  isDefault: boolean;
  onToggle: (enabled: boolean) => void;
  onUpdateDiscount: (type: PaymentMethodDiscountType, value: number) => void;
  onClearDiscount: () => void;
  onRemove: () => void;
}

function PaymentMethodRow({ method, saving, isDefault, onToggle, onUpdateDiscount, onClearDiscount, onRemove }: PaymentMethodRowProps) {
  const [editingDiscount, setEditingDiscount] = useState(false);
  const [discountType, setDiscountType] = useState<PaymentMethodDiscountType>(method.discountType || 'percentage');
  const [discountValue, setDiscountValue] = useState(method.discountValue || 0);

  const hasDiscount = method.discountType && method.discountValue && method.discountValue > 0;

  const handleSaveDiscount = () => {
    if (discountValue > 0) {
      onUpdateDiscount(discountType, discountValue);
    } else {
      onClearDiscount();
    }
    setEditingDiscount(false);
  };

  const handleCancelDiscount = () => {
    setDiscountType(method.discountType || 'percentage');
    setDiscountValue(method.discountValue || 0);
    setEditingDiscount(false);
  };

  return (
    <div className="rounded-lg border p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Switch
            checked={method.enabled}
            onCheckedChange={onToggle}
            disabled={saving}
          />
          <span className="text-sm font-medium">{method.name}</span>
          {hasDiscount && !editingDiscount && (
            <span className="text-xs text-green-600 dark:text-green-400 font-medium">
              {method.discountType === 'percentage'
                ? `${method.discountValue}% de desconto`
                : `${formatCurrency(method.discountValue!)} de desconto`
              }
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          {method.enabled && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs"
              onClick={() => setEditingDiscount(!editingDiscount)}
            >
              {hasDiscount ? 'Editar desconto' : 'Desconto'}
            </Button>
          )}
          {!isDefault && (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-destructive hover:text-destructive"
              onClick={onRemove}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      </div>

      {editingDiscount && method.enabled && (
        <div className="flex items-end gap-2 pt-1">
          <div className="space-y-1">
            <Label className="text-xs">Tipo</Label>
            <Select value={discountType} onValueChange={(v) => setDiscountType(v as PaymentMethodDiscountType)}>
              <SelectTrigger className="w-36 h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="percentage">Porcentagem (%)</SelectItem>
                <SelectItem value="fixed_amount">Valor fixo (R$)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Valor</Label>
            {discountType === 'percentage' ? (
              <div className="relative">
                <Input
                  type="number"
                  min={0}
                  max={100}
                  step={0.5}
                  value={discountValue || ''}
                  onChange={(e) => setDiscountValue(Number(e.target.value))}
                  className="w-24 h-8 text-xs pr-7"
                />
                <Percent className="absolute right-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
              </div>
            ) : (
              <CurrencyInput
                value={discountValue}
                onChange={setDiscountValue}
                className="w-28 h-8 text-xs"
              />
            )}
          </div>
          <Button size="sm" className="h-8 text-xs" onClick={handleSaveDiscount}>
            Salvar
          </Button>
          <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={handleCancelDiscount}>
            Cancelar
          </Button>
          {hasDiscount && (
            <Button
              size="sm"
              variant="ghost"
              className="h-8 text-xs text-destructive hover:text-destructive"
              onClick={() => { onClearDiscount(); setEditingDiscount(false); setDiscountValue(0); }}
            >
              Remover
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

interface DeliveryOptionRowProps {
  option: DeliveryOption;
  saving: boolean;
  onToggle: (enabled: boolean) => void;
  onUpdateFee: (fee: number) => void;
  onUpdateFreeAbove: (val: number | null) => void;
  onUpdateCalculationType: (type: ShippingCalculationType) => void;
  onUpdateRegions: (regions: string[]) => void;
  onUpdateScope: (scope: DeliveryScope) => void;
  onUpdateQuoteOnRequest: (quoteOnRequest: boolean) => void;
  onRemove: () => void;
}

function DeliveryOptionRow({ option, saving, onToggle, onUpdateFee, onUpdateFreeAbove, onUpdateCalculationType, onUpdateRegions, onUpdateScope, onUpdateQuoteOnRequest, onRemove }: DeliveryOptionRowProps) {
  const [editingFee, setEditingFee] = useState(false);
  const [feeValue, setFeeValue] = useState(option.fee);
  const [editingFreeAbove, setEditingFreeAbove] = useState(false);
  const [freeAboveValue, setFreeAboveValue] = useState(option.freeAbove || 0);
  const calculationType = option.calculationType || 'flat';
  const selectedRegions = option.regions || [];
  const scope: DeliveryScope = option.scope === 'local' ? 'local' : 'national';

  const toggleRegion = (uf: string) => {
    if (selectedRegions.includes(uf)) {
      onUpdateRegions(selectedRegions.filter((r) => r !== uf));
    } else {
      onUpdateRegions([...selectedRegions, uf]);
    }
  };

  const handleSaveFee = () => {
    onUpdateFee(feeValue);
    setEditingFee(false);
  };

  const handleSaveFreeAbove = () => {
    onUpdateFreeAbove(freeAboveValue > 0 ? freeAboveValue : null);
    setEditingFreeAbove(false);
  };

  return (
    <div className="rounded-lg border p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Switch
            checked={option.enabled}
            onCheckedChange={onToggle}
            disabled={saving}
          />
          <div>
            <span className="text-sm font-medium">{option.name}</span>
            {option.quoteOnRequest ? (
              <span className="text-xs text-amber-600 dark:text-amber-400 ml-2">A Consultar</span>
            ) : (
              <>
                <span className="text-xs text-muted-foreground ml-2">
                  {option.fee === 0 ? 'Grátis' : formatCurrency(option.fee)}
                </span>
                {option.freeAbove && option.freeAbove > 0 && (
                  <span className="text-xs text-green-600 dark:text-green-400 ml-2">
                    Grátis acima de {formatCurrency(option.freeAbove)}
                  </span>
                )}
              </>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1">
          {option.enabled && !option.quoteOnRequest && (
            <>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs"
                onClick={() => { setEditingFee(!editingFee); setEditingFreeAbove(false); }}
              >
                Taxa
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs"
                onClick={() => { setEditingFreeAbove(!editingFreeAbove); setEditingFee(false); }}
              >
                Frete grátis
              </Button>
            </>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-destructive hover:text-destructive"
            onClick={onRemove}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {editingFee && option.enabled && (
        <div className="flex items-end gap-2 pt-1">
          <div className="space-y-1">
            <Label className="text-xs">Taxa de entrega</Label>
            <CurrencyInput
              value={feeValue}
              onChange={setFeeValue}
              className="w-32 h-8 text-xs"
            />
          </div>
          <Button size="sm" className="h-8 text-xs" onClick={handleSaveFee}>
            Salvar
          </Button>
          <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={() => setEditingFee(false)}>
            Cancelar
          </Button>
        </div>
      )}

      {editingFreeAbove && option.enabled && (
        <div className="flex items-end gap-2 pt-1">
          <div className="space-y-1">
            <Label className="text-xs">Frete grátis para pedidos acima de</Label>
            <CurrencyInput
              value={freeAboveValue}
              onChange={setFreeAboveValue}
              className="w-32 h-8 text-xs"
            />
          </div>
          <Button size="sm" className="h-8 text-xs" onClick={handleSaveFreeAbove}>
            Salvar
          </Button>
          {option.freeAbove && (
            <Button
              size="sm"
              variant="ghost"
              className="h-8 text-xs text-destructive hover:text-destructive"
              onClick={() => { onUpdateFreeAbove(null); setEditingFreeAbove(false); setFreeAboveValue(0); }}
            >
              Remover
            </Button>
          )}
          <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={() => setEditingFreeAbove(false)}>
            Cancelar
          </Button>
        </div>
      )}

      {option.enabled && (
        <div className="space-y-2 pt-1">
          <Label className="text-xs">Abrangência</Label>
          <Select value={scope} onValueChange={(v) => onUpdateScope(v as DeliveryScope)}>
            <SelectTrigger className="h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="national">Todo o Brasil</SelectItem>
              <SelectItem value="local">Só na minha cidade</SelectItem>
            </SelectContent>
          </Select>
          {scope === 'local' && (
            <p className="text-xs text-muted-foreground">
              Só aparece para compradores cujo CEP resolver para a mesma cidade cadastrada acima em "Como você vende".
            </p>
          )}
        </div>
      )}

      {option.enabled && (
        <div className="flex flex-row items-center justify-between rounded-lg border p-3 mt-1">
          <div className="space-y-0.5 pr-2">
            <Label htmlFor={`quote-${option.id}`} className="text-xs">Frete a Consultar</Label>
            <p className="text-[11px] text-muted-foreground">
              Não mostra nenhum valor — o cliente combina o frete direto com você. Só aparece em pedidos via WhatsApp
              {scope === 'national' && ' (troque a abrangência para "Só na minha cidade" para ela poder aparecer)'}.
            </p>
          </div>
          <Switch
            id={`quote-${option.id}`}
            checked={option.quoteOnRequest ?? false}
            onCheckedChange={onUpdateQuoteOnRequest}
            disabled={saving}
          />
        </div>
      )}

      {option.enabled && !option.quoteOnRequest && scope === 'national' && (
        <div className="space-y-2 pt-1">
          <Label className="text-xs">Como calcular o frete</Label>
          <Select value={calculationType} onValueChange={(v) => onUpdateCalculationType(v as ShippingCalculationType)}>
            <SelectTrigger className="h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="flat">Frete fixo</SelectItem>
              <SelectItem value="free_above">Grátis acima de valor</SelectItem>
              <SelectItem value="region">Por região</SelectItem>
              <SelectItem value="carrier" disabled>
                Cálculo automático por transportadora (em breve)
              </SelectItem>
            </SelectContent>
          </Select>

          {calculationType === 'region' && (
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Estados atendidos por esta opção</Label>
              <div className="flex flex-wrap gap-1.5">
                {BR_STATES.map((uf) => (
                  <button
                    key={uf}
                    type="button"
                    onClick={() => toggleRegion(uf)}
                    className={`text-xs px-2 py-1 rounded-md border transition-colors ${
                      selectedRegions.includes(uf)
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'bg-background text-muted-foreground border-border hover:border-primary/50'
                    }`}
                  >
                    {uf}
                  </button>
                ))}
              </div>
              {selectedRegions.length === 0 && (
                <p className="text-xs text-muted-foreground">Nenhum estado selecionado ainda</p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
