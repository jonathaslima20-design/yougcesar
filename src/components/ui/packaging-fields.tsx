import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useProductPackagingPresets } from '@/hooks/useProductPackagingPresets';
import { toast } from 'sonner';

export type PackageType = 'envelope' | 'box' | 'cylinder';

export interface PackagingFieldsValue {
  package_type: PackageType;
  weight_kg?: number;
  height_cm?: number;
  width_cm?: number;
  length_cm?: number;
  diameter_cm?: number;
  package_preset_id?: string | null;
}

interface PackagingFieldsProps {
  value: PackagingFieldsValue;
  onChange: (value: PackagingFieldsValue) => void;
  userId?: string;
}

const PACKAGE_TYPE_LABELS: Record<PackageType, string> = {
  envelope: 'Envelope',
  box: 'Pacote / Caixa',
  cylinder: 'Rolo / Cilindro',
};

type DimensionKey = 'weight_kg' | 'height_cm' | 'width_cm' | 'length_cm' | 'diameter_cm';

interface FieldDef {
  key: DimensionKey;
  label: string;
  placeholder: string;
  step: number;
}

// Cada formato usa um subconjunto diferente de medidas, na mesma ordem que
// a Correios/SuperFrete pedem: caixa mede altura+largura+comprimento,
// envelope so largura+comprimento, rolo/cilindro so comprimento+diametro.
const FIELDS_BY_TYPE: Record<PackageType, FieldDef[]> = {
  box: [
    { key: 'weight_kg', label: 'Peso (kg)', placeholder: '0.3', step: 0.01 },
    { key: 'height_cm', label: 'Altura (cm)', placeholder: '2', step: 1 },
    { key: 'width_cm', label: 'Largura (cm)', placeholder: '11', step: 1 },
    { key: 'length_cm', label: 'Comprimento (cm)', placeholder: '16', step: 1 },
  ],
  envelope: [
    { key: 'weight_kg', label: 'Peso (kg)', placeholder: '0.3', step: 0.01 },
    { key: 'width_cm', label: 'Largura (cm)', placeholder: '24', step: 1 },
    { key: 'length_cm', label: 'Comprimento (cm)', placeholder: '16', step: 1 },
  ],
  cylinder: [
    { key: 'weight_kg', label: 'Peso (kg)', placeholder: '0.3', step: 0.01 },
    { key: 'length_cm', label: 'Comprimento (cm)', placeholder: '90', step: 1 },
    { key: 'diameter_cm', label: 'Diâmetro (cm)', placeholder: '8', step: 1 },
  ],
};

const CUSTOM_OPTION = '__custom__';
const NEW_PRESET_OPTION = '__new__';

// Sugestao inicial pra quem ainda nao salvou nenhuma embalagem — reaproveita
// o mesmo fallback ja usado em shippingUtils.ts (FALLBACK_DIMENSIONS), so
// como ponto de partida editavel. Nao e uma medida oficial dos Correios.
const STARTER_SUGGESTION = {
  label: 'Pacote pequeno (0,3kg, 2×11×16cm)',
  values: { weight_kg: 0.3, height_cm: 2, width_cm: 11, length_cm: 16 } as Partial<PackagingFieldsValue>,
};

export function PackagingFields({ value, onChange, userId }: PackagingFieldsProps) {
  const { presets, loading, addPreset, removePreset } = useProductPackagingPresets(userId);
  const [isCreating, setIsCreating] = useState(false);
  const [newPresetName, setNewPresetName] = useState('');
  const [saving, setSaving] = useState(false);

  const packageType = value.package_type || 'box';
  const presetsForType = presets.filter((p) => p.package_type === packageType);
  const activePreset = value.package_preset_id
    ? presetsForType.find((p) => p.id === value.package_preset_id)
    : undefined;

  function handleTypeChange(nextType: PackageType) {
    setIsCreating(false);
    // Troca de tipo so esconde os campos que ficaram irrelevantes — os
    // numeros digitados continuam la se o lojista voltar pro tipo anterior.
    onChange({ ...value, package_type: nextType, package_preset_id: null });
  }

  function handlePresetSelect(selected: string) {
    if (selected === NEW_PRESET_OPTION) {
      setIsCreating(true);
      return;
    }
    setIsCreating(false);
    if (selected === CUSTOM_OPTION) {
      onChange({ ...value, package_preset_id: null });
      return;
    }
    const preset = presetsForType.find((p) => p.id === selected);
    if (!preset) return;
    onChange({
      ...value,
      package_preset_id: preset.id,
      weight_kg: preset.weight_kg ?? undefined,
      height_cm: preset.height_cm ?? undefined,
      width_cm: preset.width_cm ?? undefined,
      length_cm: preset.length_cm ?? undefined,
      diameter_cm: preset.diameter_cm ?? undefined,
    });
  }

  async function handleSaveNewPreset() {
    const name = newPresetName.trim();
    if (!name) {
      toast.error('Digite um nome para a embalagem');
      return;
    }
    setSaving(true);
    const created = await addPreset({
      preset_name: name,
      package_type: packageType,
      weight_kg: value.weight_kg ?? null,
      height_cm: value.height_cm ?? null,
      width_cm: value.width_cm ?? null,
      length_cm: value.length_cm ?? null,
      diameter_cm: value.diameter_cm ?? null,
    });
    setSaving(false);
    if (!created) {
      toast.error('Erro ao salvar embalagem');
      return;
    }
    toast.success('Embalagem salva para reutilizar em outros produtos');
    setNewPresetName('');
    setIsCreating(false);
    onChange({ ...value, package_preset_id: created.id });
  }

  async function handleDeletePreset() {
    if (!activePreset) return;
    const success = await removePreset(activePreset.id);
    if (!success) {
      toast.error('Erro ao excluir embalagem');
      return;
    }
    toast.success('Embalagem excluída');
    onChange({ ...value, package_preset_id: null });
  }

  function handleFieldChange(key: DimensionKey, raw: string) {
    onChange({
      ...value,
      [key]: raw === '' ? undefined : Number(raw),
      package_preset_id: null,
    });
  }

  function handleSuggestionClick() {
    onChange({ ...value, package_preset_id: null, ...STARTER_SUGGESTION.values });
  }

  const fields = FIELDS_BY_TYPE[packageType];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Tipo de embalagem</Label>
          <Select value={packageType} onValueChange={(v) => handleTypeChange(v as PackageType)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(PACKAGE_TYPE_LABELS) as PackageType[]).map((type) => (
                <SelectItem key={type} value={type}>
                  {PACKAGE_TYPE_LABELS[type]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Embalagem</Label>
          <Select value={value.package_preset_id || CUSTOM_OPTION} onValueChange={handlePresetSelect} disabled={loading}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={CUSTOM_OPTION}>Embalagem customizada</SelectItem>
              {presetsForType.map((preset) => (
                <SelectItem key={preset.id} value={preset.id}>
                  {preset.preset_name}
                </SelectItem>
              ))}
              <SelectItem value={NEW_PRESET_OPTION}>+ Criar nova embalagem...</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {isCreating && (
        <div className="flex gap-2 items-end p-3 bg-muted/40 rounded-lg border">
          <div className="flex-1 space-y-1">
            <Label className="text-xs">Nome da embalagem</Label>
            <Input
              value={newPresetName}
              onChange={(e) => setNewPresetName(e.target.value)}
              placeholder="Ex: Caixa Média"
              autoFocus
            />
          </div>
          <Button type="button" size="sm" onClick={handleSaveNewPreset} disabled={saving}>
            Salvar
          </Button>
          <Button type="button" size="sm" variant="ghost" onClick={() => setIsCreating(false)}>
            Cancelar
          </Button>
        </div>
      )}

      {activePreset && !isCreating && (
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="h-7 text-xs text-destructive hover:text-destructive px-2"
          onClick={handleDeletePreset}
        >
          <Trash2 className="h-3 w-3 mr-1" />
          Excluir esta embalagem salva
        </Button>
      )}

      <div className={`grid gap-4 ${fields.length === 4 ? 'grid-cols-4' : 'grid-cols-3'}`}>
        {fields.map((field) => (
          <div key={field.key} className="space-y-2">
            <Label>{field.label}</Label>
            <Input
              type="number"
              min={0}
              step={field.step}
              placeholder={field.placeholder}
              value={value[field.key] ?? ''}
              onChange={(e) => handleFieldChange(field.key, e.target.value)}
            />
          </div>
        ))}
      </div>

      {presets.length === 0 && !loading && packageType === 'box' && (
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" className="h-8 text-xs" onClick={handleSuggestionClick}>
            {STARTER_SUGGESTION.label}
          </Button>
        </div>
      )}
    </div>
  );
}
