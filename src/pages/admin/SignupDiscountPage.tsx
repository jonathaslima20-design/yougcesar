import { useState, useEffect } from 'react';
import { Tag, Loader } from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/lib/supabase';
import { fetchSignupDiscountSettings, saveSignupDiscountSettings, type SignupDiscountSettings } from '@/lib/signupDiscountService';
import type { SubscriptionPlan } from '@/types';

export default function SignupDiscountPage() {
  const [settings, setSettings] = useState<SignupDiscountSettings | null>(null);
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    Promise.all([
      fetchSignupDiscountSettings(),
      supabase.from('subscription_plans').select('*').eq('is_active', true).order('display_order').then(r => r.data || []),
    ]).then(([settingsData, plansData]) => {
      setSettings(settingsData);
      setPlans(plansData);
      setLoading(false);
    });
  }, []);

  const update = (updates: Partial<SignupDiscountSettings>) => {
    setSettings(prev => prev ? { ...prev, ...updates } : prev);
  };

  const handleSave = async () => {
    if (!settings) return;
    if (settings.discount_value <= 0) {
      toast.error('Informe um valor de desconto maior que zero');
      return;
    }
    try {
      setSaving(true);
      await saveSignupDiscountSettings(settings);
      const fresh = await fetchSignupDiscountSettings();
      setSettings(fresh);
      toast.success('Configuracao salva');
    } catch (err) {
      console.error(err);
      toast.error('Erro ao salvar configuracao');
    } finally {
      setSaving(false);
    }
  };

  if (loading || !settings) {
    return (
      <div className="container mx-auto p-4 md:p-6 max-w-3xl flex items-center justify-center py-24">
        <Loader className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const allPlansSelected = settings.plan_ids.length === 0;

  return (
    <div className="container mx-auto p-4 md:p-6 space-y-6 max-w-3xl">
      <div className="flex items-center gap-3">
        <Tag className="h-6 w-6" />
        <div>
          <h1 className="text-2xl font-bold">Desconto de Boas-vindas</h1>
          <p className="text-sm text-muted-foreground">
            Desconto com contador regressivo exibido na tela obrigatoria de escolha de plano, logo apos o cadastro.
          </p>
        </div>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle className="text-base">Ativar</CardTitle>
            <CardDescription>Quando desligado, a tela de planos aparece normal, sem desconto.</CardDescription>
          </div>
          <Switch checked={settings.is_active} onCheckedChange={(v) => update({ is_active: v })} />
        </CardHeader>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Desconto</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Tipo</Label>
              <Select value={settings.discount_type} onValueChange={(v) => update({ discount_type: v as 'percent' | 'fixed' })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="percent">Percentual (%)</SelectItem>
                  <SelectItem value="fixed">Valor Fixo (R$)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="discount_value">Valor</Label>
              <Input
                id="discount_value"
                type="number"
                min={1}
                value={settings.discount_value}
                onChange={(e) => update({ discount_value: Number(e.target.value) })}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="hours">Duracao do desconto (horas apos o cadastro)</Label>
            <Input
              id="hours"
              type="number"
              min={1}
              value={settings.hours_after_signup}
              onChange={(e) => update({ hours_after_signup: Number(e.target.value) })}
            />
            <p className="text-xs text-muted-foreground">
              Cada usuario ve seu proprio contador, contado a partir do momento em que criou a conta — ex.: 24 = expira
              24h depois do cadastro dele, nao numa data fixa igual para todos.
            </p>
          </div>

          <div className="space-y-2">
            <Label>Planos com desconto</Label>
            <div className="rounded-lg border divide-y">
              {plans.map((plan) => {
                const checked = allPlansSelected || settings.plan_ids.includes(plan.id);
                return (
                  <label key={plan.id} className="flex items-center gap-3 px-3 py-2 cursor-pointer">
                    <Checkbox
                      checked={checked}
                      onCheckedChange={(v) => {
                        const current = allPlansSelected ? plans.map(p => p.id) : settings.plan_ids;
                        const next = v ? [...current, plan.id] : current.filter(id => id !== plan.id);
                        update({ plan_ids: next.length === plans.length ? [] : next });
                      }}
                    />
                    <span className="text-sm">{plan.name} - {plan.duration} (R${plan.price})</span>
                  </label>
                );
              })}
            </div>
            <p className="text-xs text-muted-foreground">
              Todos marcados = desconto vale em qualquer plano. Desmarque algum para restringir so aos planos
              selecionados — os demais aparecem a preco cheio na mesma tela.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Textos e cores do banner</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">Titulo</Label>
            <Input id="title" value={settings.title} onChange={(e) => update({ title: e.target.value })} maxLength={80} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="subtitle">Subtitulo</Label>
            <Input id="subtitle" value={settings.subtitle} onChange={(e) => update({ subtitle: e.target.value })} maxLength={120} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Cor de destaque</Label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={settings.highlight_color}
                  onChange={(e) => update({ highlight_color: e.target.value })}
                  className="w-10 h-10 rounded-lg border cursor-pointer"
                />
                <Input value={settings.highlight_color} onChange={(e) => update({ highlight_color: e.target.value })} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Cor de fundo</Label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={settings.background_color}
                  onChange={(e) => update({ background_color: e.target.value })}
                  className="w-10 h-10 rounded-lg border cursor-pointer"
                />
                <Input value={settings.background_color} onChange={(e) => update({ background_color: e.target.value })} />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving}>
          {saving ? <Loader className="h-4 w-4 mr-2 animate-spin" /> : null}
          Salvar
        </Button>
      </div>
    </div>
  );
}
