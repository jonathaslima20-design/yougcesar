import { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/lib/supabase';
import type { OfferFormData } from '@/types/offers';
import type { SubscriptionPlan } from '@/types/index';

interface Props {
  form: OfferFormData;
  updateForm: (updates: Partial<OfferFormData>) => void;
}

export function OfferEditorDiscount({ form, updateForm }: Props) {
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);

  useEffect(() => {
    const loadPlans = async () => {
      const { data } = await supabase
        .from('subscription_plans')
        .select('*')
        .eq('is_active', true)
        .order('display_order');
      setPlans(data || []);
    };
    loadPlans();
  }, []);

  const discountType = form.desconto_percentual > 0 ? 'percentual' : form.desconto_valor_fixo > 0 ? 'fixo' : 'nenhum';

  const handleDiscountTypeChange = (type: string) => {
    if (type === 'percentual') {
      updateForm({ desconto_percentual: 10, desconto_valor_fixo: 0 });
    } else if (type === 'fixo') {
      updateForm({ desconto_percentual: 0, desconto_valor_fixo: 10 });
    } else {
      updateForm({ desconto_percentual: 0, desconto_valor_fixo: 0 });
    }
  };

  return (
    <div className="space-y-5 rounded-xl border bg-card p-6">
      <h3 className="font-semibold text-base">Desconto e Plano Alvo</h3>

      <div className="space-y-2">
        <Label>Tipo de Desconto</Label>
        <Select value={discountType} onValueChange={handleDiscountTypeChange}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="nenhum">Sem desconto</SelectItem>
            <SelectItem value="percentual">Percentual (%)</SelectItem>
            <SelectItem value="fixo">Valor Fixo (R$)</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {discountType === 'percentual' && (
        <div className="space-y-2">
          <Label htmlFor="desconto_pct">Percentual de Desconto</Label>
          <div className="flex items-center gap-2">
            <Input
              id="desconto_pct"
              type="number"
              min={1}
              max={100}
              value={form.desconto_percentual}
              onChange={(e) => updateForm({ desconto_percentual: Number(e.target.value) })}
            />
            <span className="text-muted-foreground font-medium">%</span>
          </div>
        </div>
      )}

      {discountType === 'fixo' && (
        <div className="space-y-2">
          <Label htmlFor="desconto_fixo">Valor do Desconto</Label>
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground font-medium">R$</span>
            <Input
              id="desconto_fixo"
              type="number"
              min={1}
              value={form.desconto_valor_fixo}
              onChange={(e) => updateForm({ desconto_valor_fixo: Number(e.target.value) })}
            />
          </div>
        </div>
      )}

      <div className="space-y-2">
        <Label>Plano Alvo (para ofertas de upgrade/renovacao)</Label>
        <Select
          value={form.plano_alvo_id || 'none'}
          onValueChange={(v) => updateForm({ plano_alvo_id: v === 'none' ? null : v })}
        >
          <SelectTrigger>
            <SelectValue placeholder="Selecione um plano (opcional)" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">Nenhum plano especifico</SelectItem>
            {plans.map((plan) => (
              <SelectItem key={plan.id} value={plan.id}>
                {plan.name} - {plan.duration} (R${plan.price})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">
          Se selecionado, o CTA direcionara o usuario para o checkout deste plano.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="data_inicio">Data de Inicio</Label>
          <Input
            id="data_inicio"
            type="date"
            value={form.data_inicio || ''}
            onChange={(e) => updateForm({ data_inicio: e.target.value })}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="data_fim">Data de Fim (opcional)</Label>
          <Input
            id="data_fim"
            type="date"
            value={form.data_fim || ''}
            onChange={(e) => updateForm({ data_fim: e.target.value || null })}
          />
        </div>
      </div>

      <div className="flex items-center justify-between p-4 rounded-lg border bg-muted/30">
        <div className="space-y-0.5">
          <Label className="text-sm font-medium">Contador Regressivo</Label>
          <p className="text-xs text-muted-foreground">
            {form.data_fim
              ? 'Exibir contagem regressiva ate o fim da oferta'
              : 'Defina uma data de fim para habilitar o contador'}
          </p>
        </div>
        <Switch
          checked={form.mostrar_contador}
          onCheckedChange={(v) => updateForm({ mostrar_contador: v })}
          disabled={!form.data_fim}
        />
      </div>
    </div>
  );
}
