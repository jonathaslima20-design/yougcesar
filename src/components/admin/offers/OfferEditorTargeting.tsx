import { useState, useEffect } from 'react';
import { Plus, Trash2, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { countEligibleUsers } from '@/lib/offerService';
import type { OfferTargetingRule, TargetingRuleType, TargetingOperator, OfferDisplayConfigFormData } from '@/types/offers';

interface Props {
  rules: Omit<OfferTargetingRule, 'id' | 'offer_id' | 'created_at'>[];
  setRules: (rules: Omit<OfferTargetingRule, 'id' | 'offer_id' | 'created_at'>[]) => void;
  displayConfig: OfferDisplayConfigFormData;
}

const RULE_TYPE_OPTIONS: { value: TargetingRuleType; label: string }[] = [
  { value: 'plan_status', label: 'Status do Plano' },
  { value: 'dias_cadastro', label: 'Dias desde o Cadastro' },
  { value: 'qtd_produtos', label: 'Qtd. de Produtos' },
  { value: 'billing_cycle', label: 'Ciclo de Cobranca' },
  { value: 'dias_ate_vencimento', label: 'Dias ate Vencimento' },
  { value: 'atividade_recente', label: 'Dias desde Ultima Atividade' },
  { value: 'plano_especifico', label: 'Plano Especifico' },
];

const OPERATOR_OPTIONS: { value: TargetingOperator; label: string }[] = [
  { value: 'igual', label: 'Igual a' },
  { value: 'diferente', label: 'Diferente de' },
  { value: 'maior_que', label: 'Maior que' },
  { value: 'menor_que', label: 'Menor que' },
  { value: 'entre', label: 'Entre' },
  { value: 'contem', label: 'Contem' },
];

const QUICK_TEMPLATES = [
  {
    label: 'Usuarios Free com +5 produtos',
    rules: [
      { grupo_logico: 1, tipo_regra: 'plan_status' as TargetingRuleType, operador: 'igual' as TargetingOperator, valor: 'free', valor_secundario: '' },
      { grupo_logico: 1, tipo_regra: 'qtd_produtos' as TargetingRuleType, operador: 'maior_que' as TargetingOperator, valor: '5', valor_secundario: '' },
    ],
  },
  {
    label: 'Assinaturas vencendo em 7 dias',
    rules: [
      { grupo_logico: 1, tipo_regra: 'dias_ate_vencimento' as TargetingRuleType, operador: 'menor_que' as TargetingOperator, valor: '7', valor_secundario: '' },
      { grupo_logico: 1, tipo_regra: 'plan_status' as TargetingRuleType, operador: 'igual' as TargetingOperator, valor: 'active', valor_secundario: '' },
    ],
  },
  {
    label: 'Usuarios inativos ha 14+ dias',
    rules: [
      { grupo_logico: 1, tipo_regra: 'atividade_recente' as TargetingRuleType, operador: 'maior_que' as TargetingOperator, valor: '14', valor_secundario: '' },
    ],
  },
  {
    label: 'Plano mensal (oferecer anual)',
    rules: [
      { grupo_logico: 1, tipo_regra: 'billing_cycle' as TargetingRuleType, operador: 'igual' as TargetingOperator, valor: 'monthly', valor_secundario: '' },
      { grupo_logico: 1, tipo_regra: 'plan_status' as TargetingRuleType, operador: 'igual' as TargetingOperator, valor: 'active', valor_secundario: '' },
    ],
  },
];

function getOperatorsForType(type: TargetingRuleType): TargetingOperator[] {
  switch (type) {
    case 'plan_status':
    case 'billing_cycle':
    case 'plano_especifico':
      return ['igual', 'diferente', 'contem'];
    case 'dias_cadastro':
    case 'qtd_produtos':
    case 'dias_ate_vencimento':
    case 'atividade_recente':
      return ['igual', 'diferente', 'maior_que', 'menor_que', 'entre'];
    default:
      return ['igual', 'diferente', 'maior_que', 'menor_que', 'entre', 'contem'];
  }
}

export function OfferEditorTargeting({ rules, setRules, displayConfig }: Props) {
  const [eligibleCount, setEligibleCount] = useState<number | null>(null);
  const [counting, setCounting] = useState(false);

  useEffect(() => {
    const timer = setTimeout(async () => {
      setCounting(true);
      try {
        const count = await countEligibleUsers(rules);
        setEligibleCount(count);
      } catch {
        setEligibleCount(null);
      } finally {
        setCounting(false);
      }
    }, 800);
    return () => clearTimeout(timer);
  }, [rules]);

  const addRule = (grupoLogico?: number) => {
    const grupo = grupoLogico ?? (rules.length > 0 ? rules[rules.length - 1].grupo_logico : 1);
    setRules([...rules, { grupo_logico: grupo, tipo_regra: 'plan_status', operador: 'igual', valor: '', valor_secundario: '' }]);
  };

  const addGroup = () => {
    const maxGroup = rules.reduce((max, r) => Math.max(max, r.grupo_logico), 0);
    setRules([...rules, { grupo_logico: maxGroup + 1, tipo_regra: 'plan_status', operador: 'igual', valor: '', valor_secundario: '' }]);
  };

  const updateRule = (index: number, updates: Partial<Omit<OfferTargetingRule, 'id' | 'offer_id' | 'created_at'>>) => {
    setRules(rules.map((r, i) => i === index ? { ...r, ...updates } : r));
  };

  const removeRule = (index: number) => {
    setRules(rules.filter((_, i) => i !== index));
  };

  const applyTemplate = (template: typeof QUICK_TEMPLATES[0]) => {
    setRules(template.rules);
  };

  const groups = rules.reduce((acc, rule) => {
    const existing = acc.get(rule.grupo_logico) || [];
    existing.push(rule);
    acc.set(rule.grupo_logico, existing);
    return acc;
  }, new Map<number, typeof rules>());

  const isManualOnly = displayConfig.gatilho_acao === 'manual_apenas';

  return (
    <div className="space-y-5 rounded-xl border bg-card p-6">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-base">Segmentacao Automatica</h3>
        {eligibleCount !== null && (
          <Badge variant="secondary" className="gap-1.5">
            <Users className="w-3.5 h-3.5" />
            {counting ? '...' : `${eligibleCount} usuarios elegíveis`}
          </Badge>
        )}
      </div>

      {isManualOnly && (
        <div className="p-4 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
          <p className="text-sm text-amber-800 dark:text-amber-200">
            O gatilho desta oferta esta configurado como "Apenas Manual". As regras abaixo serao usadas apenas para estimar o publico-alvo, mas a exibicao depende de atribuicao manual.
          </p>
        </div>
      )}

      {/* Quick Templates */}
      <div className="space-y-2">
        <Label className="text-xs text-muted-foreground uppercase tracking-wider">Templates Rapidos</Label>
        <div className="flex flex-wrap gap-2">
          {QUICK_TEMPLATES.map((template, i) => (
            <Button
              key={i}
              variant="outline"
              size="sm"
              className="text-xs"
              onClick={() => applyTemplate(template)}
            >
              {template.label}
            </Button>
          ))}
        </div>
      </div>

      {/* Rules Builder */}
      <div className="space-y-4">
        {Array.from(groups.entries()).map(([groupNum, groupRules], groupIndex) => (
          <div key={groupNum} className="space-y-2">
            {groupIndex > 0 && (
              <div className="flex items-center gap-2 py-2">
                <div className="flex-1 h-px bg-border" />
                <Badge variant="outline" className="text-xs">OU</Badge>
                <div className="flex-1 h-px bg-border" />
              </div>
            )}

            <div className="space-y-2 pl-3 border-l-2 border-primary/30">
              {groupRules.map((rule) => {
                const ruleIndex = rules.indexOf(rule);
                const availableOps = getOperatorsForType(rule.tipo_regra);
                return (
                  <div key={ruleIndex} className="flex items-center gap-2 flex-wrap">
                    {groupRules.indexOf(rule) > 0 && (
                      <span className="text-xs text-muted-foreground font-medium w-6">E</span>
                    )}
                    {groupRules.indexOf(rule) === 0 && <span className="w-6" />}

                    <Select
                      value={rule.tipo_regra}
                      onValueChange={(v) => updateRule(ruleIndex, { tipo_regra: v as TargetingRuleType })}
                    >
                      <SelectTrigger className="w-44">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {RULE_TYPE_OPTIONS.map(opt => (
                          <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    <Select
                      value={rule.operador}
                      onValueChange={(v) => updateRule(ruleIndex, { operador: v as TargetingOperator })}
                    >
                      <SelectTrigger className="w-32">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {availableOps.map(op => {
                          const opt = OPERATOR_OPTIONS.find(o => o.value === op)!;
                          return <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>;
                        })}
                      </SelectContent>
                    </Select>

                    <Input
                      value={rule.valor}
                      onChange={(e) => updateRule(ruleIndex, { valor: e.target.value })}
                      placeholder="Valor"
                      className="w-28"
                    />

                    {rule.operador === 'entre' && (
                      <>
                        <span className="text-xs text-muted-foreground">e</span>
                        <Input
                          value={rule.valor_secundario}
                          onChange={(e) => updateRule(ruleIndex, { valor_secundario: e.target.value })}
                          placeholder="Valor 2"
                          className="w-28"
                        />
                      </>
                    )}

                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 shrink-0 text-destructive"
                      onClick={() => removeRule(ruleIndex)}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                );
              })}
              <Button
                variant="ghost"
                size="sm"
                className="text-xs ml-6"
                onClick={() => addRule(groupNum)}
              >
                <Plus className="w-3 h-3 mr-1" />
                Adicionar condicao (E)
              </Button>
            </div>
          </div>
        ))}
      </div>

      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={() => addRule()} className="gap-1.5">
          <Plus className="w-3.5 h-3.5" />
          Adicionar Regra
        </Button>
        <Button variant="outline" size="sm" onClick={addGroup} className="gap-1.5">
          <Plus className="w-3.5 h-3.5" />
          Adicionar Grupo (OU)
        </Button>
      </div>
    </div>
  );
}
