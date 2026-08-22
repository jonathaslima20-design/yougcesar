import { useState } from 'react';
import { toast } from 'sonner';
import { Loader as Loader2, CreditCard, Plus, Trash2, Percent, ShoppingCart, Minimize2, Wallet, AlertTriangle, Info } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CurrencyInput } from '@/components/ui/currency-input';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useCheckoutSettings } from '@/hooks/useCheckoutSettings';
import { usePlatformPaymentsEnabled } from '@/hooks/usePlatformPaymentsEnabled';
import { useMerchantPaymentActive } from '@/hooks/useMerchantPaymentActive';
import { useAuth } from '@/contexts/AuthContext';
import type { CheckoutSettings, PaymentMethodConfig, PaymentMethodDiscountType } from '@/types';
import { v4 as uuidv4 } from 'uuid';

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

function Hint({ text }: { text: string }) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger type="button" className="inline-flex align-middle text-muted-foreground">
          <Info className="h-3 w-3" />
        </TooltipTrigger>
        <TooltipContent className="max-w-64">
          <p>{text}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export default function CheckoutSettingsContent() {
  const { settings, loading, saving, updateSettings } = useCheckoutSettings();
  const { user } = useAuth();
  const { enabled: platformPaymentsEnabled } = usePlatformPaymentsEnabled(user?.id);
  const { active: merchantPaymentActive } = useMerchantPaymentActive(user?.id);
  const [newMethodName, setNewMethodName] = useState('');
  const hasMerchantCity = !!user?.city?.trim();

  const save = async (newSettings: CheckoutSettings) => {
    try {
      await updateSettings(newSettings);
      toast.success('Configurações de checkout salvas');
    } catch {
      toast.error('Erro ao salvar configuracoes');
    }
  };

  const toggleOnlinePayment = (enabled: boolean) => {
    save({ ...settings, onlinePaymentEnabled: enabled });
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

  const toggleRequirePayment = (checked: boolean) => {
    save({ ...settings, requirePaymentMethod: checked });
  };

  const toggleCartEnabled = (checked: boolean) => {
    save({ ...settings, cartEnabled: checked });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const isDefaultMethod = (id: string) => ['pix', 'credit_card'].includes(id);

  const onlinePaymentEnabled = settings.onlinePaymentEnabled ?? false;
  const hasLocalDeliveryOption = settings.deliveryOptions.some((d) => d.enabled && d.scope === 'local');
  const hasPickupOption = settings.deliveryOptions.some((d) => d.enabled && d.scope === 'pickup');
  const hasNationalDeliveryOption =
    settings.deliveryOptions.some((d) => d.enabled && d.scope !== 'local' && d.scope !== 'pickup') ||
    (!!settings.superFrete?.enabled && (settings.superFrete?.serviceIds?.length ?? 0) > 0);
  const hasLocalOrPickup = hasPickupOption || (hasMerchantCity && hasLocalDeliveryOption);

  const onlinePaymentAllowed = platformPaymentsEnabled && onlinePaymentEnabled;
  // Turning the switch ON requires both gates; turning it back OFF never gets
  // blocked by a missing gate, so a merchant who deactivates their MP
  // credentials later isn't locked into an online routing they can't undo.
  const switchDisabled = saving || !platformPaymentsEnabled || (!onlinePaymentEnabled && !merchantPaymentActive);
  const needsCredentials = platformPaymentsEnabled && !onlinePaymentEnabled && !merchantPaymentActive;

  // Single conditional alert instead of a permanent status grid — only shows
  // up when something is actually missing for the mode currently in use.
  const missingSetupMessage = onlinePaymentAllowed
    ? (!hasLocalOrPickup && !hasNationalDeliveryOption
        ? 'Configure ao menos uma opção de entrega elegível (local, retirada ou nacional) na aba Frete para o pagamento online funcionar.'
        : null)
    : (!hasLocalOrPickup
        ? 'Configure entrega local ou retirada na aba Frete para poder vender por WhatsApp.'
        : null);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Wallet className="h-5 w-5 text-muted-foreground" />
            <CardTitle>Como você vende</CardTitle>
          </div>
          <CardDescription>Ative o pagamento online ou venda só por WhatsApp.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!platformPaymentsEnabled && (
            <div className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-800 p-3 text-amber-800 dark:text-amber-300">
              <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
              <p className="text-xs">
                Pagamento online está temporariamente desativado para todas as lojas. Sua loja vende só
                por WhatsApp até isso ser liberado.
              </p>
            </div>
          )}

          <div className="flex flex-row items-center justify-between rounded-lg border p-4">
            <div className="space-y-0.5 pr-2">
              <p className="text-sm font-medium">Ativar pagamento online</p>
              <p className="text-xs text-muted-foreground">
                Ligado: PIX/cartão na hora, sem opção de WhatsApp. Desligado: pedido só por WhatsApp.
              </p>
              {needsCredentials && (
                <p className="text-xs text-amber-700 dark:text-amber-400">
                  Configure e ative suas credenciais na aba Pagamento antes de ligar isso.
                </p>
              )}
            </div>
            <Switch
              checked={onlinePaymentEnabled}
              onCheckedChange={toggleOnlinePayment}
              disabled={switchDisabled}
            />
          </div>

          {missingSetupMessage && (
            <div className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-800 p-3 text-amber-800 dark:text-amber-300">
              <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
              <p className="text-xs">{missingSetupMessage}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Cart Enable/Disable */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <ShoppingCart className="h-5 w-5 text-muted-foreground" />
            <CardTitle>Carrinho de Compras</CardTitle>
          </div>
          <CardDescription>Desative se sua loja não precisa de carrinho — imóveis, veículos, consultorias.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-row items-center justify-between rounded-lg border p-4">
            <div className="space-y-0.5">
              <p className="text-sm font-medium flex items-center gap-1.5">
                Ativar carrinho de compras
                <Hint text='Quando desativado, o botão dos produtos mostra "Exibir detalhes" e leva para a página do produto.' />
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
          <CardDescription>Exija um valor ou quantidade mínima para liberar a finalização do pedido.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-row items-center justify-between rounded-lg border p-4">
            <div className="space-y-0.5">
              <Label htmlFor="min-purchase-enabled">Ativar compra mínima</Label>
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
                    onChange={(value) =>
                      save({
                        ...settings,
                        minimumPurchase: {
                          ...(settings.minimumPurchase ?? { enabled: true, type: 'value' }),
                          value,
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

      {/* Payment Methods — only used to build the WhatsApp message, so it's
          irrelevant once online payment is active (Mercado Pago handles that). */}
      {!onlinePaymentAllowed && (
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <CreditCard className="h-5 w-5 text-muted-foreground" />
            <CardTitle>Formas de Pagamento</CardTitle>
          </div>
          <CardDescription>Formas de pagamento que aparecem na mensagem de WhatsApp do pedido.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-row items-center justify-between rounded-lg border p-4">
            <div className="space-y-0.5">
              <p className="text-sm font-medium">Exigir forma de pagamento</p>
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
