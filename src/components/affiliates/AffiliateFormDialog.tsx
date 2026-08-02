import { useState, useEffect } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import type { Affiliate, AffiliateCommissionRule, CreateAffiliateInput } from '@/hooks/useAffiliates';

interface AffiliateFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  affiliate: Affiliate | null;
  existingRules: AffiliateCommissionRule[];
  onCreate: (input: CreateAffiliateInput) => Promise<unknown>;
  onUpdate: (id: string, updates: Partial<Pick<Affiliate, 'name' | 'whatsapp' | 'default_commission_percentage' | 'commission_trigger' | 'attribution_window_days' | 'payment_frequency' | 'whatsapp_contact_mode'>>) => Promise<void>;
  onSaveRules: (affiliateId: string, rules: { category_name: string; commission_percentage: number }[]) => Promise<void>;
}

interface RuleRow {
  category_name: string;
  commission_percentage: string;
}

export default function AffiliateFormDialog({
  open, onOpenChange, affiliate, existingRules, onCreate, onUpdate, onSaveRules,
}: AffiliateFormDialogProps) {
  const { user } = useAuth();
  const isEditing = !!affiliate;

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [defaultRate, setDefaultRate] = useState('10');
  const [commissionTrigger, setCommissionTrigger] = useState<'confirmed' | 'delivered'>('delivered');
  const [attributionWindowDays, setAttributionWindowDays] = useState('30');
  const [paymentFrequency, setPaymentFrequency] = useState<'weekly' | 'biweekly' | 'monthly'>('monthly');
  const [whatsappContactMode, setWhatsappContactMode] = useState<'store_default' | 'own_whatsapp'>('store_default');
  const [rules, setRules] = useState<RuleRow[]>([]);
  const [categoryOptions, setCategoryOptions] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setEmail(affiliate?.email || '');
    setPassword('');
    setName(affiliate?.name || '');
    setWhatsapp(affiliate?.whatsapp || '');
    setDefaultRate(affiliate ? String(affiliate.default_commission_percentage) : '10');
    setCommissionTrigger(affiliate?.commission_trigger || 'delivered');
    setAttributionWindowDays(String(affiliate?.attribution_window_days || 30));
    setPaymentFrequency(affiliate?.payment_frequency || 'monthly');
    setWhatsappContactMode(affiliate?.whatsapp_contact_mode || 'store_default');
    setRules(existingRules.map(r => ({ category_name: r.category_name || '', commission_percentage: String(r.commission_percentage) })));
  }, [open, affiliate, existingRules]);

  useEffect(() => {
    if (!open || !user?.id) return;
    supabase
      .from('user_product_categories')
      .select('name')
      .eq('user_id', user.id)
      .order('name', { ascending: true })
      .then(({ data }) => setCategoryOptions((data || []).map(c => c.name)));
  }, [open, user?.id]);

  const addRuleRow = () => {
    const unused = categoryOptions.find(c => !rules.some(r => r.category_name === c));
    if (!unused) {
      toast.info('Todas as categorias já têm uma regra definida');
      return;
    }
    setRules([...rules, { category_name: unused, commission_percentage: defaultRate }]);
  };

  const removeRuleRow = (index: number) => {
    setRules(rules.filter((_, i) => i !== index));
  };

  const updateRuleRow = (index: number, patch: Partial<RuleRow>) => {
    setRules(rules.map((r, i) => (i === index ? { ...r, ...patch } : r)));
  };

  const handleSubmit = async () => {
    const rate = Number(defaultRate);
    if (Number.isNaN(rate) || rate < 0 || rate > 100) {
      toast.error('Comissão geral deve ser um número entre 0 e 100');
      return;
    }

    if (whatsappContactMode === 'own_whatsapp' && !whatsapp.trim()) {
      toast.error('Informe o WhatsApp do afiliado para usar o número dele na vitrine');
      return;
    }

    const parsedRules: { category_name: string; commission_percentage: number }[] = [];
    for (const r of rules) {
      const pct = Number(r.commission_percentage);
      if (!r.category_name || Number.isNaN(pct) || pct < 0 || pct > 100) {
        toast.error('Revise as regras por categoria: percentuais devem estar entre 0 e 100');
        return;
      }
      parsedRules.push({ category_name: r.category_name, commission_percentage: pct });
    }
    const seenCategories = new Set(parsedRules.map(r => r.category_name));
    if (seenCategories.size !== parsedRules.length) {
      toast.error('Não é possível repetir a mesma categoria em mais de uma regra');
      return;
    }

    setSaving(true);
    try {
      if (isEditing && affiliate) {
        await onUpdate(affiliate.id, {
          name,
          whatsapp: whatsapp || null,
          default_commission_percentage: rate,
          commission_trigger: commissionTrigger,
          attribution_window_days: Number(attributionWindowDays) as 7 | 15 | 30,
          payment_frequency: paymentFrequency,
          whatsapp_contact_mode: whatsappContactMode,
        });
        await onSaveRules(affiliate.id, parsedRules);
        toast.success('Afiliado atualizado');
      } else {
        if (!email || !password || !name) {
          toast.error('Preencha e-mail, senha e nome');
          setSaving(false);
          return;
        }
        if (password.length < 6) {
          toast.error('A senha deve ter pelo menos 6 caracteres');
          setSaving(false);
          return;
        }
        const result = await onCreate({
          email, password, name, whatsapp: whatsapp || undefined, default_commission_percentage: rate,
          commission_trigger: commissionTrigger,
          attribution_window_days: Number(attributionWindowDays) as 7 | 15 | 30,
          payment_frequency: paymentFrequency,
          whatsapp_contact_mode: whatsappContactMode,
        }) as { affiliateId: string };
        if (parsedRules.length > 0 && result?.affiliateId) {
          await onSaveRules(result.affiliateId, parsedRules);
        }
        toast.success('Afiliado criado com sucesso', {
          description: `Login em ${window.location.origin}/afiliado/entrar (não é a mesma tela de login do lojista)`,
          duration: 8000,
        });
      }
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err.message || 'Erro ao salvar afiliado');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Editar afiliado' : 'Novo afiliado'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {!isEditing && (
            <>
              <div className="space-y-1.5">
                <Label htmlFor="aff-email">E-mail</Label>
                <Input id="aff-email" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="afiliado@exemplo.com" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="aff-password">Senha</Label>
                <Input id="aff-password" type="text" value={password} onChange={e => setPassword(e.target.value)} placeholder="Mínimo 6 caracteres" />
                <p className="text-xs text-muted-foreground">Compartilhe essa senha com o afiliado — ele poderá trocá-la depois no próprio painel.</p>
              </div>
            </>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="aff-name">Nome</Label>
            <Input id="aff-name" value={name} onChange={e => setName(e.target.value)} placeholder="Nome do afiliado" />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="aff-whatsapp">
              WhatsApp {whatsappContactMode === 'own_whatsapp' ? '(obrigatório)' : '(opcional)'}
            </Label>
            <Input id="aff-whatsapp" value={whatsapp} onChange={e => setWhatsapp(e.target.value)} placeholder="11999999999" />
          </div>

          <div className="space-y-1.5">
            <Label>WhatsApp exibido na vitrine para visitantes deste afiliado</Label>
            <Select value={whatsappContactMode} onValueChange={(v) => setWhatsappContactMode(v as 'store_default' | 'own_whatsapp')}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="store_default">Padrão da loja</SelectItem>
                <SelectItem value="own_whatsapp">Próprio do afiliado (número acima)</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Quando alguém acessa a loja pelo link deste afiliado, o botão "Falar no WhatsApp" pode abrir uma conversa com o número dele em vez do número padrão da loja.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="aff-rate">Comissão geral (%)</Label>
            <Input id="aff-rate" type="number" min={0} max={100} step="0.1" value={defaultRate} onChange={e => setDefaultRate(e.target.value)} />
            <p className="text-xs text-muted-foreground">Aplicada sempre que nenhuma regra de categoria abaixo for mais específica.</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Gatilho de comissão (pedidos por WhatsApp)</Label>
              <Select value={commissionTrigger} onValueChange={(v) => setCommissionTrigger(v as 'confirmed' | 'delivered')}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="confirmed">Na confirmação do pedido</SelectItem>
                  <SelectItem value="delivered">Na entrega do pedido</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Janela de atribuição do link</Label>
              <Select value={attributionWindowDays} onValueChange={setAttributionWindowDays}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="7">7 dias</SelectItem>
                  <SelectItem value="15">15 dias</SelectItem>
                  <SelectItem value="30">30 dias</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <p className="text-xs text-muted-foreground -mt-2">
            Pedidos com pagamento online sempre geram comissão na confirmação do pagamento, independente do gatilho acima.
          </p>

          <div className="space-y-1.5">
            <Label>Frequência de pagamento</Label>
            <Select value={paymentFrequency} onValueChange={(v) => setPaymentFrequency(v as 'weekly' | 'biweekly' | 'monthly')}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="weekly">Semanal</SelectItem>
                <SelectItem value="biweekly">Quinzenal</SelectItem>
                <SelectItem value="monthly">Mensal</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Só informativo — o pagamento continua manual, feito por você em "Registrar pagamento".
            </p>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Comissões por categoria (opcional)</Label>
              <Button type="button" variant="outline" size="sm" onClick={addRuleRow}>
                <Plus className="h-3.5 w-3.5 mr-1" /> Adicionar
              </Button>
            </div>
            {rules.length === 0 && (
              <p className="text-xs text-muted-foreground">Sem overrides — todas as categorias usam a comissão geral.</p>
            )}
            {rules.map((rule, index) => (
              <div key={index} className="flex items-center gap-2">
                <Select value={rule.category_name} onValueChange={(v) => updateRuleRow(index, { category_name: v })}>
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder="Categoria" />
                  </SelectTrigger>
                  <SelectContent>
                    {categoryOptions.map(c => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  type="number"
                  min={0}
                  max={100}
                  step="0.1"
                  className="w-24"
                  value={rule.commission_percentage}
                  onChange={e => updateRuleRow(index, { commission_percentage: e.target.value })}
                />
                <Button type="button" variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => removeRuleRow(index)}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            ))}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={saving}>
            {saving ? 'Salvando...' : isEditing ? 'Salvar alterações' : 'Criar afiliado'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
