import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Loader as Loader2, Truck, Plus, Trash2, MapPin, Info, AlertTriangle, Store, Bike, Globe, Package, ShieldCheck, Percent, Settings, Handshake, Clock, Link as LinkIcon, ArrowLeft } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { CurrencyInput } from '@/components/ui/currency-input';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useCheckoutSettings } from '@/hooks/useCheckoutSettings';
import { useAuth } from '@/contexts/AuthContext';
import { fetchAddressByCep } from '@/lib/viaCep';
import { geocodeCep } from '@/lib/geocoding';
import type { CheckoutSettings, DeliveryOption, DistanceTier, WeightTier } from '@/types';
import { v4 as uuidv4 } from 'uuid';

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

const BR_STATES = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG',
  'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO',
];

// The full list of delivery-option "types" a merchant can create. Each one
// already carries its own fixed scope/calculationType — there is no more
// free-standing "Abrangência" dropdown to combine with a name however the
// merchant likes (that's what let "Moto Entrega" end up scoped to all of
// Brazil). Once created, an option's type never changes; to switch type the
// merchant deletes and creates a new one.
type NewOptionKind = 'pickup' | 'local_distance' | 'national_flat' | 'national_weight' | 'national_region' | 'quote';

const NEW_OPTION_KINDS: { kind: NewOptionKind; label: string; icon: typeof Store; description: string }[] = [
  { kind: 'pickup', label: 'Retirada no Local', icon: Store, description: 'Cliente busca o pedido na sua loja' },
  { kind: 'local_distance', label: 'Entrega Local por Distância', icon: Bike, description: 'Preço por faixa de km, calculado a partir do CEP da loja e do comprador' },
  { kind: 'national_flat', label: 'Frete Nacional — Valor Fixo', icon: Globe, description: 'Uma taxa única pra qualquer lugar do Brasil' },
  { kind: 'national_weight', label: 'Frete Nacional por Peso', icon: Package, description: 'Preço por faixa de peso total do pedido' },
  { kind: 'national_region', label: 'Frete por Região/UF', icon: MapPin, description: 'Mesmo valor, mas só aparece pros estados escolhidos' },
  { kind: 'quote', label: 'Frete a Combinar', icon: Handshake, description: 'Valor combinado com o cliente depois — só em pedidos via WhatsApp' },
];

function describeOptionKind(option: DeliveryOption): string {
  if (option.scope === 'pickup') return 'Retirada no Local';
  if (option.quoteOnRequest) return 'Frete a Combinar';
  if (option.calculationType === 'distance_tier') return 'Entrega Local por Distância';
  if (option.calculationType === 'weight_tier') return 'Frete Nacional por Peso';
  if (option.calculationType === 'region') return 'Frete por Região/UF';
  if (option.scope === 'local') return 'Entrega Local';
  return 'Frete Nacional';
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

function nextTierId() {
  return uuidv4();
}

function DistanceTierEditor({
  tiers,
  onChange,
  fallbackFee,
  onFallbackFeeChange,
}: {
  tiers: DistanceTier[];
  onChange: (tiers: DistanceTier[]) => void;
  fallbackFee: number;
  onFallbackFeeChange: (fee: number) => void;
}) {
  const addTier = () => {
    const last = tiers[tiers.length - 1];
    onChange([...tiers, { id: nextTierId(), maxDistanceKm: (last?.maxDistanceKm ?? 0) + 2, fee: 0 }]);
  };
  const removeTier = (id: string) => onChange(tiers.filter((t) => t.id !== id));
  const updateTier = (id: string, patch: Partial<DistanceTier>) =>
    onChange(tiers.map((t) => (t.id === id ? { ...t, ...patch } : t)));

  return (
    <div className="space-y-2">
      {tiers.map((t) => (
        <div key={t.id} className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground shrink-0">Até</span>
          <Input
            type="number"
            min={0.1}
            step={0.5}
            value={t.maxDistanceKm}
            onChange={(e) => updateTier(t.id, { maxDistanceKm: Math.max(0.1, Number(e.target.value) || 0) })}
            className="h-8 w-20 text-xs"
          />
          <span className="text-xs text-muted-foreground shrink-0">km:</span>
          <CurrencyInput value={t.fee} onChange={(fee) => updateTier(t.id, { fee })} className="h-8 w-28 text-xs" />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-destructive hover:text-destructive shrink-0"
            onClick={() => removeTier(t.id)}
            disabled={tiers.length <= 1}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      ))}
      <Button type="button" variant="outline" size="sm" className="h-7 text-xs" onClick={addTier}>
        <Plus className="h-3.5 w-3.5 mr-1" /> Adicionar faixa
      </Button>
      <div className="pt-1 space-y-1">
        <Label className="text-xs flex items-center gap-1.5">
          Preço padrão (sem distância calculada)
          <Hint text="Usado quando não conseguimos calcular a distância exata pro CEP da loja ou do comprador — nunca deixa a entrega sem preço definido." />
        </Label>
        <CurrencyInput value={fallbackFee} onChange={onFallbackFeeChange} className="h-8 w-32 text-xs" />
      </div>
    </div>
  );
}

function WeightTierEditor({ tiers, onChange }: { tiers: WeightTier[]; onChange: (tiers: WeightTier[]) => void }) {
  const addTier = () => {
    const last = tiers[tiers.length - 1];
    onChange([...tiers, { id: nextTierId(), maxWeightKg: (last?.maxWeightKg ?? 0) + 1, fee: 0 }]);
  };
  const removeTier = (id: string) => onChange(tiers.filter((t) => t.id !== id));
  const updateTier = (id: string, patch: Partial<WeightTier>) =>
    onChange(tiers.map((t) => (t.id === id ? { ...t, ...patch } : t)));

  return (
    <div className="space-y-2">
      {tiers.map((t) => (
        <div key={t.id} className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground shrink-0">Até</span>
          <Input
            type="number"
            min={0.1}
            step={0.5}
            value={t.maxWeightKg}
            onChange={(e) => updateTier(t.id, { maxWeightKg: Math.max(0.1, Number(e.target.value) || 0) })}
            className="h-8 w-20 text-xs"
          />
          <span className="text-xs text-muted-foreground shrink-0">kg:</span>
          <CurrencyInput value={t.fee} onChange={(fee) => updateTier(t.id, { fee })} className="h-8 w-28 text-xs" />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-destructive hover:text-destructive shrink-0"
            onClick={() => removeTier(t.id)}
            disabled={tiers.length <= 1}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      ))}
      <Button type="button" variant="outline" size="sm" className="h-7 text-xs" onClick={addTier}>
        <Plus className="h-3.5 w-3.5 mr-1" /> Adicionar faixa
      </Button>
      <p className="text-xs text-muted-foreground pt-1">
        Pedidos mais pesados que a última faixa pagam o valor dela mesmo assim.
      </p>
    </div>
  );
}

export default function DeliveryOptionsSettingsContent() {
  const { settings, loading, saving, updateSettings, insuranceGateEnabled } = useCheckoutSettings();
  const { user, updateUser } = useAuth();
  const [storeZipCode, setStoreZipCode] = useState('');
  const [storeCepLoading, setStoreCepLoading] = useState(false);
  const hasMerchantCity = !!user?.city?.trim();
  const hasStoreCoordinates = user?.store_latitude != null && user?.store_longitude != null;

  const [newOptionKind, setNewOptionKind] = useState<NewOptionKind | null>(null);
  const [newName, setNewName] = useState('');
  const [newFee, setNewFee] = useState(0);
  const [newRegions, setNewRegions] = useState<string[]>([]);
  const [newDistanceTiers, setNewDistanceTiers] = useState<DistanceTier[]>([{ id: nextTierId(), maxDistanceKm: 3, fee: 0 }]);
  const [newLocalFallbackFee, setNewLocalFallbackFee] = useState(0);
  const [newWeightTiers, setNewWeightTiers] = useState<WeightTier[]>([{ id: nextTierId(), maxWeightKg: 1, fee: 0 }]);

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
      const coords = await geocodeCep(storeZipCode);
      const { error } = await updateUser({
        store_zip_code: digits,
        city: result.city,
        state: result.state,
        store_latitude: coords?.latitude ?? null,
        store_longitude: coords?.longitude ?? null,
      });
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

  const updateDeliveryRegions = (id: string, regions: string[]) => {
    save({ ...settings, deliveryOptions: settings.deliveryOptions.map(d => d.id === id ? { ...d, regions } : d) });
  };

  const updateDeliveryQuoteOnRequest = (id: string, quoteOnRequest: boolean) => {
    save({ ...settings, deliveryOptions: settings.deliveryOptions.map(d => d.id === id ? { ...d, quoteOnRequest } : d) });
  };

  const updateDeliveryPickupInstructions = (id: string, pickupInstructions: string) => {
    save({ ...settings, deliveryOptions: settings.deliveryOptions.map(d => d.id === id ? { ...d, pickupInstructions: pickupInstructions || null } : d) });
  };

  const updateDeliveryPickupHours = (id: string, pickupHours: string) => {
    save({ ...settings, deliveryOptions: settings.deliveryOptions.map(d => d.id === id ? { ...d, pickupHours: pickupHours || null } : d) });
  };

  const updateDeliveryPickupMapUrl = (id: string, pickupMapUrl: string) => {
    save({ ...settings, deliveryOptions: settings.deliveryOptions.map(d => d.id === id ? { ...d, pickupMapUrl: pickupMapUrl || null } : d) });
  };

  const updateDeliveryDistanceTiers = (id: string, distanceTiers: DistanceTier[], localFallbackFee: number) => {
    save({
      ...settings,
      deliveryOptions: settings.deliveryOptions.map(d =>
        d.id === id ? { ...d, distanceTiers, localFallbackFee, fee: localFallbackFee } : d
      ),
    });
  };

  const updateDeliveryWeightTiers = (id: string, weightTiers: WeightTier[]) => {
    const lastFee = weightTiers[weightTiers.length - 1]?.fee ?? 0;
    save({
      ...settings,
      deliveryOptions: settings.deliveryOptions.map(d => (d.id === id ? { ...d, weightTiers, fee: lastFee } : d)),
    });
  };

  const toggleRequireDelivery = (checked: boolean) => save({ ...settings, requireDeliveryOption: checked });

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

  const resetDraft = () => {
    setNewOptionKind(null);
    setNewName('');
    setNewFee(0);
    setNewRegions([]);
    setNewDistanceTiers([{ id: nextTierId(), maxDistanceKm: 3, fee: 0 }]);
    setNewLocalFallbackFee(0);
    setNewWeightTiers([{ id: nextTierId(), maxWeightKg: 1, fee: 0 }]);
  };

  const handleCreateOption = () => {
    const name = newName.trim();
    if (!name) {
      toast.error('Dê um nome pra essa opção');
      return;
    }
    if (newOptionKind === 'local_distance' && !hasMerchantCity) {
      toast.error('Defina o CEP da sua loja acima antes de criar uma opção de entrega local');
      return;
    }

    let option: DeliveryOption;
    switch (newOptionKind) {
      case 'pickup':
        option = { id: uuidv4(), name, fee: 0, enabled: true, scope: 'pickup' };
        break;
      case 'quote':
        option = { id: uuidv4(), name, fee: 0, enabled: true, scope: 'local', calculationType: 'flat', quoteOnRequest: true };
        break;
      case 'national_flat':
        option = { id: uuidv4(), name, fee: newFee, enabled: true, scope: 'national', calculationType: 'flat' };
        break;
      case 'national_region': {
        if (newRegions.length === 0) {
          toast.error('Escolha pelo menos um estado atendido');
          return;
        }
        option = { id: uuidv4(), name, fee: newFee, enabled: true, scope: 'national', calculationType: 'region', regions: newRegions };
        break;
      }
      case 'local_distance': {
        const tiers = [...newDistanceTiers].sort((a, b) => a.maxDistanceKm - b.maxDistanceKm);
        option = {
          id: uuidv4(),
          name,
          fee: newLocalFallbackFee,
          enabled: true,
          scope: 'local',
          calculationType: 'distance_tier',
          distanceTiers: tiers,
          localFallbackFee: newLocalFallbackFee,
        };
        break;
      }
      case 'national_weight': {
        const tiers = [...newWeightTiers].sort((a, b) => a.maxWeightKg - b.maxWeightKg);
        option = {
          id: uuidv4(),
          name,
          fee: tiers[tiers.length - 1]?.fee ?? 0,
          enabled: true,
          scope: 'national',
          calculationType: 'weight_tier',
          weightTiers: tiers,
        };
        break;
      }
      default:
        return;
    }

    save({ ...settings, deliveryOptions: [...settings.deliveryOptions, option] });
    resetDraft();
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
              <Hint text="Usado para comparar com o CEP do comprador, liberar a entrega local e calcular a distância real das opções por km. Diferente do CEP de origem da SuperFrete, configurado abaixo em Transportadoras." />
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
            {hasMerchantCity && !hasStoreCoordinates && (
              <div className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-800 p-3 text-amber-800 dark:text-amber-300">
                <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                <p className="text-xs">
                  Não conseguimos calcular a distância exata pro seu CEP — a Entrega Local por
                  Distância vai sempre usar o preço padrão em vez das faixas por km.
                </p>
              </div>
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
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Truck className="h-5 w-5 text-muted-foreground" />
            <CardTitle>Opções de entrega manual</CardTitle>
          </div>
          <CardDescription>Local, retirada e frete nacional definidos por você, sem depender de uma transportadora.</CardDescription>
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
                  onUpdateRegions={(regions) => updateDeliveryRegions(option.id, regions)}
                  onUpdateQuoteOnRequest={(val) => updateDeliveryQuoteOnRequest(option.id, val)}
                  onUpdatePickupInstructions={(val) => updateDeliveryPickupInstructions(option.id, val)}
                  onUpdatePickupHours={(val) => updateDeliveryPickupHours(option.id, val)}
                  onUpdatePickupMapUrl={(val) => updateDeliveryPickupMapUrl(option.id, val)}
                  onUpdateDistanceTiers={(tiers, fallbackFee) => updateDeliveryDistanceTiers(option.id, tiers, fallbackFee)}
                  onUpdateWeightTiers={(tiers) => updateDeliveryWeightTiers(option.id, tiers)}
                  onRemove={() => removeDeliveryOption(option.id)}
                />
              ))}
            </div>
          )}

          <Separator />

          {newOptionKind === null ? (
            <div className="space-y-2">
              <Label className="text-sm font-medium">Adicionar opção de entrega</Label>
              <p className="text-xs text-muted-foreground">Escolha o tipo — cada um já vem com as regras certas, sem chance de combinação sem sentido.</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {NEW_OPTION_KINDS.map(({ kind, label, icon: Icon, description }) => (
                  <button
                    key={kind}
                    type="button"
                    onClick={() => setNewOptionKind(kind)}
                    disabled={saving}
                    className="flex items-start gap-2.5 rounded-lg border p-3 text-left hover:border-primary/50 hover:bg-muted/40 transition-colors disabled:opacity-50"
                  >
                    <Icon className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
                    <span>
                      <span className="text-sm font-medium block">{label}</span>
                      <span className="text-xs text-muted-foreground">{description}</span>
                    </span>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-3 rounded-lg border p-4">
              <button
                type="button"
                onClick={resetDraft}
                className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
              >
                <ArrowLeft className="h-3.5 w-3.5" /> Escolher outro tipo
              </button>

              <p className="text-sm font-medium">{NEW_OPTION_KINDS.find((k) => k.kind === newOptionKind)?.label}</p>

              <Input
                placeholder="Nome (ex: Centro, Zona Norte, Sedex...)"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
              />

              {(newOptionKind === 'national_flat' || newOptionKind === 'national_region') && (
                <div className="space-y-1 max-w-[140px]">
                  <Label className="text-xs">Taxa de entrega</Label>
                  <CurrencyInput value={newFee} onChange={setNewFee} />
                </div>
              )}

              {newOptionKind === 'national_region' && (
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Estados atendidos por esta opção</Label>
                  <div className="flex flex-wrap gap-1.5">
                    {BR_STATES.map((uf) => (
                      <button
                        key={uf}
                        type="button"
                        onClick={() => setNewRegions((prev) => (prev.includes(uf) ? prev.filter((r) => r !== uf) : [...prev, uf]))}
                        className={`text-xs px-2 py-1 rounded-md border transition-colors ${newRegions.includes(uf) ? 'bg-primary text-primary-foreground border-primary' : 'bg-background text-muted-foreground border-border hover:border-primary/50'}`}
                      >
                        {uf}
                      </button>
                    ))}
                  </div>
                  {newRegions.length === 0 && <p className="text-xs text-muted-foreground">Nenhum estado selecionado ainda</p>}
                </div>
              )}

              {newOptionKind === 'local_distance' && (
                <DistanceTierEditor
                  tiers={newDistanceTiers}
                  onChange={setNewDistanceTiers}
                  fallbackFee={newLocalFallbackFee}
                  onFallbackFeeChange={setNewLocalFallbackFee}
                />
              )}

              {newOptionKind === 'national_weight' && (
                <WeightTierEditor tiers={newWeightTiers} onChange={setNewWeightTiers} />
              )}

              <div className="flex gap-2 pt-1">
                <Button size="sm" onClick={handleCreateOption} disabled={!newName.trim() || saving}>
                  <Plus className="h-4 w-4 mr-1" /> Criar opção
                </Button>
                <Button size="sm" variant="ghost" onClick={resetDraft}>Cancelar</Button>
              </div>
            </div>
          )}
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
  onUpdateRegions: (regions: string[]) => void;
  onUpdateQuoteOnRequest: (quoteOnRequest: boolean) => void;
  onUpdatePickupInstructions: (pickupInstructions: string) => void;
  onUpdatePickupHours: (pickupHours: string) => void;
  onUpdatePickupMapUrl: (pickupMapUrl: string) => void;
  onUpdateDistanceTiers: (tiers: DistanceTier[], fallbackFee: number) => void;
  onUpdateWeightTiers: (tiers: WeightTier[]) => void;
  onRemove: () => void;
}

function DeliveryOptionRow({
  option,
  saving,
  onToggle,
  onUpdatePrice,
  onUpdateRegions,
  onUpdateQuoteOnRequest,
  onUpdatePickupInstructions,
  onUpdatePickupHours,
  onUpdatePickupMapUrl,
  onUpdateDistanceTiers,
  onUpdateWeightTiers,
  onRemove,
}: DeliveryOptionRowProps) {
  const [editingPrice, setEditingPrice] = useState(false);
  const [feeValue, setFeeValue] = useState(option.fee);
  const [freeAboveValue, setFreeAboveValue] = useState(option.freeAbove || 0);
  const [pickupInstructionsValue, setPickupInstructionsValue] = useState(option.pickupInstructions || '');
  const [pickupHoursValue, setPickupHoursValue] = useState(option.pickupHours || '');
  const [pickupMapUrlValue, setPickupMapUrlValue] = useState(option.pickupMapUrl || '');
  const [distanceTiersValue, setDistanceTiersValue] = useState<DistanceTier[]>(option.distanceTiers || []);
  const [localFallbackFeeValue, setLocalFallbackFeeValue] = useState(option.localFallbackFee ?? option.fee ?? 0);
  const [weightTiersValue, setWeightTiersValue] = useState<WeightTier[]>(option.weightTiers || []);
  const calculationType = option.calculationType || 'flat';
  const selectedRegions = option.regions || [];
  const scope = option.scope === 'local' ? 'local' : option.scope === 'pickup' ? 'pickup' : 'national';
  const isDistanceTier = calculationType === 'distance_tier';
  const isWeightTier = calculationType === 'weight_tier';

  const toggleRegion = (uf: string) => {
    onUpdateRegions(selectedRegions.includes(uf) ? selectedRegions.filter((r) => r !== uf) : [...selectedRegions, uf]);
  };

  const handleSavePrice = () => {
    if (isDistanceTier) {
      onUpdateDistanceTiers([...distanceTiersValue].sort((a, b) => a.maxDistanceKm - b.maxDistanceKm), localFallbackFeeValue);
    } else if (isWeightTier) {
      onUpdateWeightTiers([...weightTiersValue].sort((a, b) => a.maxWeightKg - b.maxWeightKg));
    } else {
      onUpdatePrice(feeValue, freeAboveValue > 0 ? freeAboveValue : null);
    }
    setEditingPrice(false);
  };

  const sortedDistanceTiers = [...(option.distanceTiers || [])].sort((a, b) => a.maxDistanceKm - b.maxDistanceKm);
  const sortedWeightTiers = [...(option.weightTiers || [])].sort((a, b) => a.maxWeightKg - b.maxWeightKg);

  return (
    <div className="rounded-lg border p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Switch checked={option.enabled} onCheckedChange={onToggle} disabled={saving} />
          <div>
            <span className="text-sm font-medium">{option.name}</span>
            <span className="text-xs text-muted-foreground ml-2">{describeOptionKind(option)}</span>
            <br />
            {option.quoteOnRequest ? (
              <span className="text-xs text-amber-600 dark:text-amber-400">A Consultar</span>
            ) : isDistanceTier ? (
              sortedDistanceTiers.length > 0 ? (
                <span className="text-xs text-muted-foreground">
                  {formatCurrency(sortedDistanceTiers[0].fee)} até {formatCurrency(sortedDistanceTiers[sortedDistanceTiers.length - 1].fee)} · até {sortedDistanceTiers[sortedDistanceTiers.length - 1].maxDistanceKm}km
                </span>
              ) : (
                <span className="text-xs text-muted-foreground">Sem faixas configuradas</span>
              )
            ) : isWeightTier ? (
              sortedWeightTiers.length > 0 ? (
                <span className="text-xs text-muted-foreground">
                  {formatCurrency(sortedWeightTiers[0].fee)} até {formatCurrency(sortedWeightTiers[sortedWeightTiers.length - 1].fee)} · por peso
                </span>
              ) : (
                <span className="text-xs text-muted-foreground">Sem faixas configuradas</span>
              )
            ) : (
              <>
                <span className="text-xs text-muted-foreground">{option.fee === 0 ? 'Grátis' : formatCurrency(option.fee)}</span>
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
        <div className="pt-1">
          {isDistanceTier ? (
            <div className="space-y-2">
              <DistanceTierEditor
                tiers={distanceTiersValue}
                onChange={setDistanceTiersValue}
                fallbackFee={localFallbackFeeValue}
                onFallbackFeeChange={setLocalFallbackFeeValue}
              />
              <div className="flex gap-2">
                <Button size="sm" className="h-8 text-xs" onClick={handleSavePrice}>Salvar</Button>
                <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={() => setEditingPrice(false)}>Cancelar</Button>
              </div>
            </div>
          ) : isWeightTier ? (
            <div className="space-y-2">
              <WeightTierEditor tiers={weightTiersValue} onChange={setWeightTiersValue} />
              <div className="flex gap-2">
                <Button size="sm" className="h-8 text-xs" onClick={handleSavePrice}>Salvar</Button>
                <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={() => setEditingPrice(false)}>Cancelar</Button>
              </div>
            </div>
          ) : (
            <div className="flex items-end gap-2 flex-wrap">
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
        </div>
      )}

      {option.enabled && calculationType === 'region' && (
        <div className="space-y-1.5 pt-1">
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

      {option.enabled && scope === 'pickup' && (
        <div className="space-y-1 pt-1">
          <Label htmlFor={`pickup-instructions-${option.id}`} className="text-xs flex items-center gap-1.5">
            Instruções de retirada (opcional)
            <Hint text="Mostrado ao comprador no lugar do formulário de endereço. A cidade/UF da loja já aparece automaticamente." />
          </Label>
          <Textarea
            id={`pickup-instructions-${option.id}`}
            placeholder="Ex: Rua Exemplo, 123 - Centro. Toque a campainha do portão azul."
            value={pickupInstructionsValue}
            onChange={(e) => setPickupInstructionsValue(e.target.value)}
            onBlur={() => onUpdatePickupInstructions(pickupInstructionsValue)}
            className="text-xs min-h-16"
            disabled={saving}
          />
        </div>
      )}

      {option.enabled && scope === 'pickup' && (
        <div className="space-y-1 pt-1">
          <Label htmlFor={`pickup-hours-${option.id}`} className="text-xs flex items-center gap-1.5">
            <Clock className="h-3 w-3" /> Horários de retirada (opcional)
          </Label>
          <Input
            id={`pickup-hours-${option.id}`}
            placeholder="Ex: Seg a Sex, 9h às 18h"
            value={pickupHoursValue}
            onChange={(e) => setPickupHoursValue(e.target.value)}
            onBlur={() => onUpdatePickupHours(pickupHoursValue)}
            className="text-xs h-8"
            disabled={saving}
          />
        </div>
      )}

      {option.enabled && scope === 'pickup' && (
        <div className="space-y-1 pt-1">
          <Label htmlFor={`pickup-map-${option.id}`} className="text-xs flex items-center gap-1.5">
            <LinkIcon className="h-3 w-3" /> Link do Google Maps (opcional)
            <Hint text="Cole o link de compartilhamento do Google Maps da loja. O comprador verá um botão para abrir a localização." />
          </Label>
          <Input
            id={`pickup-map-${option.id}`}
            type="url"
            placeholder="https://maps.google.com/..."
            value={pickupMapUrlValue}
            onChange={(e) => setPickupMapUrlValue(e.target.value)}
            onBlur={() => onUpdatePickupMapUrl(pickupMapUrlValue)}
            className="text-xs h-8"
            disabled={saving}
          />
        </div>
      )}

      {option.enabled && scope !== 'pickup' && !isDistanceTier && !isWeightTier && (
        <div className="flex flex-row items-center justify-between rounded-lg border p-3 mt-1">
          <Label htmlFor={`quote-${option.id}`} className="text-xs flex items-center gap-1.5">
            Frete a Consultar
            <Hint text="Não mostra valor — o cliente combina o frete direto com você. Só aparece em pedidos via WhatsApp." />
          </Label>
          <Switch id={`quote-${option.id}`} checked={option.quoteOnRequest ?? false} onCheckedChange={onUpdateQuoteOnRequest} disabled={saving} />
        </div>
      )}
    </div>
  );
}
