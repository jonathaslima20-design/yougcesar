import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Loader2, ArrowUp, ArrowDown, Trash2, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/contexts/AuthContext';
import { useStorefrontBenefits, type StorefrontBenefit } from '@/hooks/useStorefrontBenefits';
import { useStorefrontAppearance } from '@/hooks/useStorefrontAppearance';
import { BENEFIT_ICON_OPTIONS, DEFAULT_BENEFITS, getBenefitIcon } from '@/lib/storefrontBenefitsDefaults';

function IconSelect({ value, onChange, disabled }: { value: string; onChange: (v: string) => void; disabled?: boolean }) {
  return (
    <Select value={value} onValueChange={onChange} disabled={disabled}>
      <SelectTrigger className="w-[130px] shrink-0">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {BENEFIT_ICON_OPTIONS.map(({ key, label, icon: Icon }) => (
          <SelectItem key={key} value={key}>
            <span className="flex items-center gap-2">
              <Icon className="h-4 w-4" /> {label}
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function StorefrontBenefitsManager() {
  const { user } = useAuth();
  const { benefits, loading, create, createMany, update, remove, move } = useStorefrontBenefits(user?.id);
  const { appearance, loading: appearanceLoading, save: saveAppearance } = useStorefrontAppearance(user?.id, 'eletronicos');

  const [draftIcon, setDraftIcon] = useState('credit-card');
  const [draftTitle, setDraftTitle] = useState('');
  const [draftSubtitle, setDraftSubtitle] = useState('');
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const autoSeedTriggered = useRef(false);

  // A store that never opened this section yet has zero rows here — seed the
  // same 5 defaults the public page already shows as a fallback, so the merchant
  // finds them here pre-loaded and ready to edit instead of an empty list.
  useEffect(() => {
    if (loading || !user?.id || benefits.length > 0 || autoSeedTriggered.current) return;
    autoSeedTriggered.current = true;
    createMany(user.id, DEFAULT_BENEFITS);
  }, [loading, user?.id, benefits.length, createMany]);

  const handleAdd = async () => {
    if (!user?.id || !draftTitle.trim()) return;
    setSaving(true);
    const success = await create(user.id, {
      icon: draftIcon,
      title: draftTitle.trim(),
      subtitle: draftSubtitle.trim(),
    });
    setSaving(false);
    if (success) {
      setDraftIcon('credit-card');
      setDraftTitle('');
      setDraftSubtitle('');
      toast.success('Item adicionado');
    } else {
      toast.error('Erro ao salvar item');
    }
  };

  const handleDelete = async (benefit: StorefrontBenefit) => {
    setBusyId(benefit.id);
    const success = await remove(benefit.id);
    setBusyId(null);
    if (success) toast.success('Item removido');
    else toast.error('Erro ao remover item');
  };

  const handleToggleActive = async (benefit: StorefrontBenefit) => {
    setBusyId(benefit.id);
    await update(benefit.id, { is_active: !benefit.is_active });
    setBusyId(null);
  };

  const handleFieldBlur = async (benefit: StorefrontBenefit, field: 'title' | 'subtitle', value: string) => {
    if (value === benefit[field]) return;
    await update(benefit.id, { [field]: value });
  };

  const handleIconChange = async (benefit: StorefrontBenefit, icon: string) => {
    await update(benefit.id, { icon });
  };

  const handleToggleEnabled = async () => {
    await saveAppearance({ benefits_bar_enabled: !appearance.benefits_bar_enabled });
  };

  if (loading || appearanceLoading) {
    return (
      <div className="flex items-center justify-center py-10">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Switch checked={appearance.benefits_bar_enabled} onCheckedChange={handleToggleEnabled} />
        <span className="text-sm">{appearance.benefits_bar_enabled ? 'Seção visível na loja' : 'Seção oculta na loja'}</span>
      </div>

      {!appearance.benefits_bar_enabled ? null : (
      <>
      {benefits.length === 0 && (
        <div className="flex items-center justify-center py-6 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
        </div>
      )}

      <div className="space-y-3">
        {benefits.map((benefit, index) => {
          const Icon = getBenefitIcon(benefit.icon);
          return (
            <Card key={benefit.id}>
              <CardContent className="flex flex-col sm:flex-row sm:items-center gap-3 p-4">
                <div className="flex items-center justify-center h-10 w-10 rounded-md border shrink-0">
                  <Icon className="h-5 w-5 text-foreground" strokeWidth={1.5} />
                </div>
                <IconSelect
                  value={benefit.icon}
                  onChange={(v) => handleIconChange(benefit, v)}
                  disabled={busyId === benefit.id}
                />
                <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div>
                    <Label className="text-xs text-muted-foreground">Título</Label>
                    <Input
                      defaultValue={benefit.title}
                      onBlur={(e) => handleFieldBlur(benefit, 'title', e.target.value)}
                      disabled={busyId === benefit.id}
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Subtítulo</Label>
                    <Input
                      defaultValue={benefit.subtitle}
                      onBlur={(e) => handleFieldBlur(benefit, 'subtitle', e.target.value)}
                      disabled={busyId === benefit.id}
                    />
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <div className="flex items-center gap-1.5 mr-2">
                    <Switch
                      checked={benefit.is_active}
                      onCheckedChange={() => handleToggleActive(benefit)}
                      disabled={busyId === benefit.id}
                    />
                    <span className="text-xs text-muted-foreground">{benefit.is_active ? 'Ativo' : 'Inativo'}</span>
                  </div>
                  <Button variant="outline" size="icon" disabled={index === 0 || busyId === benefit.id} onClick={() => move(benefit.id, 'up')}>
                    <ArrowUp className="h-4 w-4" />
                  </Button>
                  <Button variant="outline" size="icon" disabled={index === benefits.length - 1 || busyId === benefit.id} onClick={() => move(benefit.id, 'down')}>
                    <ArrowDown className="h-4 w-4" />
                  </Button>
                  <Button variant="destructive" size="icon" disabled={busyId === benefit.id} onClick={() => handleDelete(benefit)}>
                    {busyId === benefit.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card className="border-dashed">
        <CardContent className="p-4 space-y-4">
          <h3 className="font-medium">Adicionar item</h3>
          <div className="flex flex-col sm:flex-row gap-3">
            <IconSelect value={draftIcon} onChange={setDraftIcon} />
            <Input
              value={draftTitle}
              onChange={(e) => setDraftTitle(e.target.value)}
              placeholder="Título (ex: Envios)"
            />
            <Input
              value={draftSubtitle}
              onChange={(e) => setDraftSubtitle(e.target.value)}
              placeholder="Subtítulo (ex: Para todo o Brasil)"
            />
          </div>
          <Button onClick={handleAdd} disabled={!draftTitle.trim() || saving} size="sm">
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
            Adicionar item
          </Button>
        </CardContent>
      </Card>
      </>
      )}
    </div>
  );
}
