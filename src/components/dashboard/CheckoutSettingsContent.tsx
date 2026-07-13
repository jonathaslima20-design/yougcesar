import { useState } from 'react';
import { toast } from 'sonner';
import { Loader as Loader2, CreditCard, Truck, Plus, Trash2, Percent, ShoppingCart } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CurrencyInput } from '@/components/ui/currency-input';
import { useCheckoutSettings } from '@/hooks/useCheckoutSettings';
import type { CheckoutSettings, PaymentMethodConfig, DeliveryOption, PaymentMethodDiscountType } from '@/types';
import { v4 as uuidv4 } from 'uuid';

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

export default function CheckoutSettingsContent() {
  const { settings, loading, saving, updateSettings } = useCheckoutSettings();
  const [newMethodName, setNewMethodName] = useState('');
  const [newDeliveryName, setNewDeliveryName] = useState('');
  const [newDeliveryFee, setNewDeliveryFee] = useState(0);

  const save = async (newSettings: CheckoutSettings) => {
    try {
      await updateSettings(newSettings);
      toast.success('Configurações de checkout salvas');
    } catch {
      toast.error('Erro ao salvar configuracoes');
    }
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

  const addDeliveryOption = () => {
    const name = newDeliveryName.trim();
    if (!name) return;

    const newOption: DeliveryOption = {
      id: uuidv4(),
      name,
      fee: newDeliveryFee,
      enabled: true,
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

  const hasAnyPaymentEnabled = settings.paymentMethods.some(m => m.enabled);
  const hasAnyDeliveryEnabled = settings.deliveryOptions.some(d => d.enabled);
  const isDefaultMethod = (id: string) => ['pix', 'credit_card', 'debit_card', 'cash', 'bank_transfer'].includes(id);

  return (
    <div className="space-y-6">
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

          <Separator />

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
  onRemove: () => void;
}

function DeliveryOptionRow({ option, saving, onToggle, onUpdateFee, onUpdateFreeAbove, onRemove }: DeliveryOptionRowProps) {
  const [editingFee, setEditingFee] = useState(false);
  const [feeValue, setFeeValue] = useState(option.fee);
  const [editingFreeAbove, setEditingFreeAbove] = useState(false);
  const [freeAboveValue, setFreeAboveValue] = useState(option.freeAbove || 0);

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
            <span className="text-xs text-muted-foreground ml-2">
              {option.fee === 0 ? 'Grátis' : formatCurrency(option.fee)}
            </span>
            {option.freeAbove && option.freeAbove > 0 && (
              <span className="text-xs text-green-600 dark:text-green-400 ml-2">
                Grátis acima de {formatCurrency(option.freeAbove)}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1">
          {option.enabled && (
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
    </div>
  );
}
