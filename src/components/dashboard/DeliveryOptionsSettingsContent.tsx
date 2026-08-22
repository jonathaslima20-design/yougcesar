import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Loader as Loader2, Truck, Plus, Trash2, MapPin, Info, AlertTriangle, Store, Navigation, Globe, ShieldCheck, Percent, Settings } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { CurrencyInput } from '@/components/ui/currency-input';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useCheckoutSettings } from '@/hooks/useCheckoutSettings';
import { useAuth } from '@/contexts/AuthContext';
import { fetchAddressByCep } from '@/lib/viaCep';
import type { CheckoutSettings, DeliveryOption, DeliveryScope, ShippingCalculationType } from '@/types';
import { v4 as uuidv4 } from 'uuid';

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

const BR_STATES = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG',
  'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO',
];

const NEW_OPTION_TYPES: { value: DeliveryScope; label: string; icon: typeof Globe }[] = [
  { value: 'national', label: 'Nacional', icon: Globe },
  { value: 'local', label: 'Local', icon: Navigation },
  { value: 'pickup', label: 'Retirada', icon: Store },
];

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

export default function DeliveryOptionsSettingsContent() {
  const { settings, loading, saving, updateSettings, insuranceGateEnabled } = useCheckoutSettings();
  const { user, updateUser } = useAuth();
  const [newDeliveryName, setNewDeliveryName] = useState('');
  const [newDeliveryFee, setNewDeliveryFee] = useState(0);
  const [newDeliveryType, setNewDeliveryType] = useState<DeliveryScope>('national');
  const [storeZipCode, setStoreZipCode] = useState('');
  const [storeCepLoading, setStoreCepLoading] = useState(false);
  const hasMerchantCity = !!user?.city?.trim();

  useEffect(() => {
    setStoreZipCode(user?.store_zip_code || '');
  }, [user?.id, user?.store_zip_code]);

  const save = async (newSettings: CheckoutSettings) => {
    try {
      await updateSettings(newSettings);
      toast.success('Configurações de entrega salvas');
    } catch {
      toast.error('Erro ao salvar configurações');
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

  const toggleDeliveryOption = (id: string, enabled: boolean) => {
    save({ ...settings, deliveryOptions: settings.deliveryOptions.map(d => d.id === id ? { ...d, enabled } : d) });
  };

  const updateDeliveryFeeAndFreeAbove = (id: string, fee: number, freeAbove: number | null) => {
    save({ ...settings, deliveryOptions: settings.deliveryOptions.map(d => d.id === id ? { ...d, fee, freeAbove } : d) });
  };

  const updateDeliveryCalculationType = (id: string, calculationType: ShippingCalculationType) => {
    save({ ...settings, deliveryOptions: settings.deliveryOptions.map(d => d.id === id ? { ...d, calculationType } : d) });
  };

  const updateDeliveryRegions = (id: string, regions: string[]) => {
    save({ ...settings, deliveryOptions: settings.deliveryOptions.map(d => d.id === id ? { ...d, regions } : d) });
  };

  const updateDeliveryQuoteOnRequest = (id: string, quoteOnRequest: boolean) => {
    save({ ...settings, deliveryOptions: settings.deliveryOptions.map(d => d.id === id ? { ...d, quoteOnRequest } : d) });
  };

  const updateDeliveryPickupInstructions = (id: string, pickupInstructions: string) => {
    save({ ...settings, deliveryOptions: settings.deliveryOptions.map(d => d.id === id ? { ...d, pickupInstructions: pickupInstructions || null } : d) });
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

  const toggleRequireDelivery = (checked: boolean) => save({ ...settings, requireDeliveryOption: checked });
  const toggleRequireDeliveryCep = (checked: boolean) => save({ ...settings, requireDeliveryCep: checked });

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

  const addDeliveryOption = () => {
    const name = newDeliveryName.trim();
    if (!name) return;
    if (newDeliveryType === 'local' && !hasMerchantCity) {
      toast.error('Defina o CEP da sua loja acima antes de criar uma opção de entrega local');
      return;
    }

    const newOption: DeliveryOption = {
      id: uuidv4(),
      name,
      fee: newDeliveryFee,
      enabled: true,
      scope: newDeliveryType,
      ...(newDeliveryType === 'local' ? { calculationType: 'flat' as ShippingCalculationType } : {}),
    };

    save({ ...settings, deliveryOptions: [...settings.deliveryOptions, newOption] });
    setNewDeliveryName('');
    setNewDeliveryFee(0);
    setNewDeliveryType('national');
  };

  const removeDeliveryOption = (id: string) => {
    save({ ...settings, deliveryOptions: settings.deliveryOptions.filter(d => d.id !== id) });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const enabledDeliveryOptionsForHint = settings.deliveryOptions.filter((d) => d.enabled);
  const suggestSkippingCep =
    settings.requireDeliveryCep !== false &&
    enabledDeliveryOptionsForHint.length > 0 &&
    enabledDeliveryOptionsForHint.every((d) => d.scope === 'local' || d.scope === 'pickup');

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Settings className="h-5 w-5 text-muted-foreground" />
            <CardTitle>Configurações gerais</CardTitle>
          </div>
          <CardDescription>Regras que valem tanto pro pedido via WhatsApp quanto pro pagamento online.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="store-zip-code" className="flex items-center gap-1.5">
              CEP da sua loja
              <Hint text="Usado para comparar com o CEP do comprador e liberar a entrega local. Diferente do CEP de origem da SuperFrete, configurado abaixo em Transportadoras." />
            </Label>
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
            {hasMerchantCity && (
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <MapPin className="h-3 w-3" /> Cidade cadastrada: {user?.city} - {user?.state}
              </p>
            )}
          </div>

          <Separator />

          <div className="flex flex-row items-center justify-between rounded-lg border p-4">
            <div className="space-y-0.5 pr-2">
              <p className="text-sm font-medium">Exigir opção de entrega</p>
              <p className="text-xs text-muted-foreground">O cliente deve escolher uma entrega antes de enviar o pedido.</p>
            </div>
            <Switch checked={settings.requireDeliveryOption} onCheckedChange={toggleRequireDelivery} disabled={saving} />
          </div>

          <div className="flex flex-row items-center justify-between rounded-lg border p-4">
            <div className="space-y-0.5 pr-2">
              <p className="text-sm font-medium flex items-center gap-1.5">
                Pedir CEP do comprador
                <Hint text={settings.requireDeliveryCep === false
                  ? 'Desativado: o comprador vê todas as opções habilitadas, sem checar a cidade dele. Vale pro pedido via WhatsApp e pro pagamento online.'
                  : 'O comprador informa o CEP e só vê opções compatíveis com a cidade dele. Opções de retirada aparecem sempre. Vale pro pedido via WhatsApp e pro pagamento online.'} />
              </p>
            </div>
            <Switch checked={settings.requireDeliveryCep !== false} onCheckedChange={toggleRequireDeliveryCep} disabled={saving} />
          </div>

          {suggestSkippingCep && (
            <div className="flex items-start gap-2 rounded-lg border border-blue-300 bg-blue-50 dark:bg-blue-950/30 dark:border-blue-800 p-3 text-blue-800 dark:text-blue-300">
              <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
              <p className="text-xs">
                Suas opções ativas já não dependem de CEP (local ou retirada) — pode desativar "Pedir CEP do comprador" acima.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Truck className="h-5 w-5 text-muted-foreground" />
            <CardTitle>Opções de entrega manual</CardTitle>
          </div>
          <CardDescription>Local, retirada e taxa fixa nacional — definidas por você, sem depender de uma transportadora.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!hasMerchantCity && settings.deliveryOptions.some(d => d.scope === 'local') && (
            <div className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-800 p-3 text-amber-800 dark:text-amber-300">
              <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
              <p className="text-xs">Você tem entrega local, mas não definiu o CEP da loja acima — ela não vai aparecer para compradores.</p>
            </div>
          )}

          {settings.deliveryOptions.length === 0 ? (
            <div className="text-center py-6 text-muted-foreground">
              <Truck className="h-8 w-8 mx-auto mb-2 opacity-40" />
              <p className="text-sm">Nenhuma opção de entrega configurada</p>
            </div>
          ) : (
            <div className="space-y-3">
              {settings.deliveryOptions.map((option) => (
                <DeliveryOptionRow
                  key={option.id}
                  option={option}
                  saving={saving}
                  onToggle={(enabled) => toggleDeliveryOption(option.id, enabled)}
                  onUpdatePrice={(fee, freeAbove) => updateDeliveryFeeAndFreeAbove(option.id, fee, freeAbove)}
                  onUpdateCalculationType={(type) => updateDeliveryCalculationType(option.id, type)}
                  onUpdateRegions={(regions) => updateDeliveryRegions(option.id, regions)}
                  onUpdateScope={(scope) => updateDeliveryScope(option.id, scope)}
                  onUpdateQuoteOnRequest={(val) => updateDeliveryQuoteOnRequest(option.id, val)}
                  onUpdatePickupInstructions={(val) => updateDeliveryPickupInstructions(option.id, val)}
                  onRemove={() => removeDeliveryOption(option.id)}
                />
              ))}
            </div>
          )}

          <Separator />

          <div className="space-y-2">
            <Label className="text-sm font-medium">Adicionar opção de entrega</Label>
            <div className="flex gap-1 text-xs bg-muted/40 rounded-lg p-1 max-w-sm">
              {NEW_OPTION_TYPES.map(({ value, label, icon: Icon }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setNewDeliveryType(value)}
                  className={`flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-md font-medium transition-colors ${newDeliveryType === value ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground'}`}
                >
                  <Icon className="h-3.5 w-3.5" /> {label}
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              <Input
                placeholder="Nome (ex: Centro, Zona Norte, Sedex...)"
                value={newDeliveryName}
                onChange={(e) => setNewDeliveryName(e.target.value)}
                className="flex-1"
              />
              <CurrencyInput placeholder="Taxa" value={newDeliveryFee} onChange={setNewDeliveryFee} className="w-32" />
              <Button variant="outline" size="sm" onClick={addDeliveryOption} disabled={!newDeliveryName.trim() || saving}>
                <Plus className="h-4 w-4 mr-1" /> Adicionar
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
            <CardDescription>Oferece um seguro opcional, cobrado só se o cliente marcar no checkout.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-row items-center justify-between rounded-lg border p-4">
              <div className="space-y-0.5">
                <Label htmlFor="shipping-insurance-enabled">Oferecer seguro de frete</Label>
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
                <Label htmlFor="shipping-insurance-rate" className="flex items-center gap-1.5">
                  Percentual do seguro
                  <Hint text="Calculado sobre o subtotal do pedido após o desconto do cupom (sem o frete)." />
                </Label>
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
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

interface DeliveryOptionRowProps {
  option: DeliveryOption;
  saving: boolean;
  onToggle: (enabled: boolean) => void;
  onUpdatePrice: (fee: number, freeAbove: number | null) => void;
  onUpdateCalculationType: (type: ShippingCalculationType) => void;
  onUpdateRegions: (regions: string[]) => void;
  onUpdateScope: (scope: DeliveryScope) => void;
  onUpdateQuoteOnRequest: (quoteOnRequest: boolean) => void;
  onUpdatePickupInstructions: (pickupInstructions: string) => void;
  onRemove: () => void;
}

function DeliveryOptionRow({ option, saving, onToggle, onUpdatePrice, onUpdateCalculationType, onUpdateRegions, onUpdateScope, onUpdateQuoteOnRequest, onUpdatePickupInstructions, onRemove }: DeliveryOptionRowProps) {
  const [editingPrice, setEditingPrice] = useState(false);
  const [feeValue, setFeeValue] = useState(option.fee);
  const [freeAboveValue, setFreeAboveValue] = useState(option.freeAbove || 0);
  const [pickupInstructionsValue, setPickupInstructionsValue] = useState(option.pickupInstructions || '');
  const calculationType = option.calculationType || 'flat';
  const selectedRegions = option.regions || [];
  const scope: DeliveryScope = option.scope === 'local' ? 'local' : option.scope === 'pickup' ? 'pickup' : 'national';

  const toggleRegion = (uf: string) => {
    onUpdateRegions(selectedRegions.includes(uf) ? selectedRegions.filter((r) => r !== uf) : [...selectedRegions, uf]);
  };

  const handleSavePrice = () => {
    onUpdatePrice(feeValue, freeAboveValue > 0 ? freeAboveValue : null);
    setEditingPrice(false);
  };

  return (
    <div className="rounded-lg border p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Switch checked={option.enabled} onCheckedChange={onToggle} disabled={saving} />
          <div>
            <span className="text-sm font-medium">{option.name}</span>
            {option.quoteOnRequest ? (
              <span className="text-xs text-amber-600 dark:text-amber-400 ml-2">A Consultar</span>
            ) : (
              <>
                <span className="text-xs text-muted-foreground ml-2">{option.fee === 0 ? 'Grátis' : formatCurrency(option.fee)}</span>
                {option.freeAbove && option.freeAbove > 0 && (
                  <span className="text-xs text-green-600 dark:text-green-400 ml-2">Grátis acima de {formatCurrency(option.freeAbove)}</span>
                )}
              </>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1">
          {option.enabled && !option.quoteOnRequest && (
            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setEditingPrice(!editingPrice)}>
              Editar preço
            </Button>
          )}
          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={onRemove}>
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {editingPrice && option.enabled && (
        <div className="flex items-end gap-2 pt-1 flex-wrap">
          <div className="space-y-1">
            <Label className="text-xs">Taxa de entrega</Label>
            <CurrencyInput value={feeValue} onChange={setFeeValue} className="w-32 h-8 text-xs" />
          </div>
          {scope !== 'pickup' && (
            <div className="space-y-1">
              <Label className="text-xs">Grátis acima de</Label>
              <CurrencyInput value={freeAboveValue} onChange={setFreeAboveValue} className="w-32 h-8 text-xs" />
            </div>
          )}
          <Button size="sm" className="h-8 text-xs" onClick={handleSavePrice}>Salvar</Button>
          <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={() => setEditingPrice(false)}>Cancelar</Button>
        </div>
      )}

      {option.enabled && (
        <div className="space-y-2 pt-1">
          <Label className="text-xs flex items-center gap-1.5">
            Abrangência
            <Hint text={
              scope === 'local'
                ? 'Só aparece para compradores cujo CEP resolver para a mesma cidade cadastrada acima.'
                : scope === 'pickup'
                  ? 'Sempre aparece pro comprador, não depende do CEP dele nem da cidade da loja.'
                  : 'Aparece pra qualquer comprador do Brasil.'
            } />
          </Label>
          <Select value={scope} onValueChange={(v) => onUpdateScope(v as DeliveryScope)}>
            <SelectTrigger className="h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="national">Todo o Brasil</SelectItem>
              <SelectItem value="local">Só na minha cidade</SelectItem>
              <SelectItem value="pickup">Retirada no local</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}

      {option.enabled && scope === 'pickup' && (
        <div className="space-y-1 pt-1">
          <Label htmlFor={`pickup-instructions-${option.id}`} className="text-xs flex items-center gap-1.5">
            Instruções de retirada (opcional)
            <Hint text="Mostrado ao comprador no lugar do formulário de endereço. A cidade/UF da loja já aparece automaticamente." />
          </Label>
          <Textarea
            id={`pickup-instructions-${option.id}`}
            placeholder="Ex: Rua Exemplo, 123 - Centro. Seg a sex, 9h às 18h."
            value={pickupInstructionsValue}
            onChange={(e) => setPickupInstructionsValue(e.target.value)}
            onBlur={() => onUpdatePickupInstructions(pickupInstructionsValue)}
            className="text-xs min-h-16"
            disabled={saving}
          />
        </div>
      )}

      {option.enabled && scope !== 'pickup' && (
        <div className="flex flex-row items-center justify-between rounded-lg border p-3 mt-1">
          <Label htmlFor={`quote-${option.id}`} className="text-xs flex items-center gap-1.5">
            Frete a Consultar
            <Hint text={`Não mostra valor — o cliente combina o frete direto com você. Só aparece em pedidos via WhatsApp${scope === 'national' ? ' (troque a abrangência para "Só na minha cidade" pra ela poder aparecer)' : ''}.`} />
          </Label>
          <Switch id={`quote-${option.id}`} checked={option.quoteOnRequest ?? false} onCheckedChange={onUpdateQuoteOnRequest} disabled={saving} />
        </div>
      )}

      {option.enabled && !option.quoteOnRequest && scope === 'national' && (
        <div className="space-y-2 pt-1">
          <Label className="text-xs flex items-center gap-1.5">
            Como calcular o frete
            <Hint text="Taxa fixa/por região definida por você. Se preferir cálculo automático por transportadora, ative a SuperFrete em Transportadoras, mais abaixo — as duas formas podem coexistir." />
          </Label>
          <Select value={calculationType} onValueChange={(v) => onUpdateCalculationType(v as ShippingCalculationType)}>
            <SelectTrigger className="h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="flat">Frete fixo</SelectItem>
              <SelectItem value="free_above">Grátis acima de valor</SelectItem>
              <SelectItem value="region">Por região</SelectItem>
              <SelectItem value="carrier" disabled>Cálculo automático por transportadora (em breve)</SelectItem>
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
                    className={`text-xs px-2 py-1 rounded-md border transition-colors ${selectedRegions.includes(uf) ? 'bg-primary text-primary-foreground border-primary' : 'bg-background text-muted-foreground border-border hover:border-primary/50'}`}
                  >
                    {uf}
                  </button>
                ))}
              </div>
              {selectedRegions.length === 0 && <p className="text-xs text-muted-foreground">Nenhum estado selecionado ainda</p>}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
