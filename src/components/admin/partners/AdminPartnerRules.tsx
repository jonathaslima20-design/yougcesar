import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Loader2, Plus, Trash2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { formatBRL, type PartnerCampaign, type PartnerLevel } from '@/lib/partners/partnerApi';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ToneBadge, formatDate } from '@/components/partners/PartnerUi';

type Settings = Record<string, string | number | boolean | null> & { id: string };

const NUMBER_FIELDS: { key: string; label: string; hint?: string }[] = [
  { key: 'holding_days', label: 'Carência da comissão (dias)' },
  { key: 'minimum_withdrawal_amount', label: 'Saque mínimo (R$)' },
  { key: 'max_pf_monthly_payout', label: 'Teto mensal para pessoa física (R$)' },
  { key: 'payout_day', label: 'Dia de pagamento dos saques' },
  { key: 'first_sale_bonus_amount', label: 'Bônus de primeira venda (R$)' },
  { key: 'first_sale_bonus_days', label: 'Prazo do bônus de primeira venda (dias)' },
  { key: 'recruit_override_percentage', label: 'Bônus por parceiro indicado (% da comissão dele)' },
  { key: 'recruit_override_months', label: 'Duração do bônus por indicado (meses)' },
  { key: 'inactivity_months', label: 'Meses sem venda até voltar à taxa base' },
  { key: 'level_downgrade_grace_months', label: 'Carência para descer de nível (meses)' },
  { key: 'attribution_window_days', label: 'Janela de atribuição do link (dias)' },
  { key: 'lead_protection_days', label: 'Proteção de oportunidades (dias)' },
  { key: 'store_trial_days', label: 'Teste das lojas criadas por parceiros (dias)' },
  { key: 'founder_slots', label: 'Vagas de Parceiros Fundadores' },
  { key: 'founder_bonus_pp', label: 'Bônus de fundador (pontos %)' },
  { key: 'founder_min_percentage', label: 'Taxa mínima dos fundadores migrados (%)' },
  { key: 'reversal_freeze_ratio', label: 'Proporção de estornos que congela saques (0 a 1)' },
];

const TEXT_FIELDS: { key: string; label: string; type?: string }[] = [
  { key: 'terms_version', label: 'Versão dos termos (mudar exige novo aceite)' },
  { key: 'demo_store_url', label: 'URL da loja demo' },
  { key: 'community_url', label: 'Link da comunidade' },
  { key: 'support_whatsapp', label: 'WhatsApp do suporte de parceiros' },
  { key: 'webinar_url', label: 'Link do próximo webinar' },
  { key: 'webinar_at', label: 'Data do próximo webinar', type: 'datetime-local' },
];

const BOOL_FIELDS: { key: string; label: string }[] = [
  { key: 'is_active', label: 'Programa ativo (desligar para de gerar comissões e aceitar inscrições)' },
  { key: 'renewal_commissions_enabled', label: 'Gerar comissões de assinaturas e renovações' },
  { key: 'annual_installments', label: 'Pagar comissão de planos anuais em 12 parcelas' },
  { key: 'self_referral_block', label: 'Bloquear autoindicação' },
];

export default function AdminPartnerRules() {
  const [levels, setLevels] = useState<PartnerLevel[]>([]);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [campaigns, setCampaigns] = useState<PartnerCampaign[]>([]);
  const [saving, setSaving] = useState<string | null>(null);
  const [campaign, setCampaign] = useState<Partial<PartnerCampaign> | null>(null);

  const load = useCallback(async () => {
    const [l, s, c] = await Promise.all([
      supabase.from('partner_levels').select('*').order('sort_order'),
      supabase.from('partner_settings').select('*').limit(1).maybeSingle(),
      supabase.from('partner_campaigns').select('*').order('starts_at', { ascending: false }),
    ]);
    setLevels((l.data as PartnerLevel[]) ?? []);
    setSettings((s.data as Settings) ?? null);
    setCampaigns((c.data as PartnerCampaign[]) ?? []);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const saveLevel = async (level: PartnerLevel) => {
    setSaving(level.id);
    const { error } = await supabase
      .from('partner_levels')
      .update({
        name: level.name,
        commission_percentage: Number(level.commission_percentage),
        min_mrr: Number(level.min_mrr),
        min_active_clients: Number(level.min_active_clients),
        benefits: level.benefits,
        requires_certification: level.requires_certification,
        color: level.color,
        is_active: level.is_active,
        updated_at: new Date().toISOString(),
      })
      .eq('id', level.id);
    setSaving(null);
    if (error) toast.error(error.message);
    else toast.success(`Nível ${level.name} salvo. Vale para as próximas comissões.`);
  };

  const saveSettings = async () => {
    if (!settings) return;
    setSaving('settings');
    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
    for (const f of NUMBER_FIELDS) patch[f.key] = Number(settings[f.key] ?? 0);
    for (const f of TEXT_FIELDS) {
      const v = settings[f.key];
      patch[f.key] = v === '' || v === undefined ? null : f.type === 'datetime-local' && v ? new Date(String(v)).toISOString() : v;
    }
    for (const f of BOOL_FIELDS) patch[f.key] = !!settings[f.key];
    if (!patch.terms_version) {
      toast.error('A versão dos termos é obrigatória.');
      setSaving(null);
      return;
    }
    const { error } = await supabase.from('partner_settings').update(patch).eq('id', settings.id);
    setSaving(null);
    if (error) toast.error(error.message);
    else toast.success('Configurações salvas');
  };

  const saveCampaign = async () => {
    if (!campaign) return;
    const payload = {
      name: campaign.name,
      description: campaign.description || null,
      kind: campaign.kind,
      starts_at: campaign.starts_at ? new Date(campaign.starts_at).toISOString() : null,
      ends_at: campaign.ends_at ? new Date(campaign.ends_at).toISOString() : null,
      multiplier: campaign.kind === 'multiplier' ? Number(campaign.multiplier) : null,
      goal_new_clients: campaign.kind === 'goal' ? Number(campaign.goal_new_clients) : null,
      goal_bonus_amount: campaign.kind === 'goal' ? Number(campaign.goal_bonus_amount) : null,
      is_active: campaign.is_active ?? true,
    };
    const { error } = campaign.id
      ? await supabase.from('partner_campaigns').update(payload).eq('id', campaign.id)
      : await supabase.from('partner_campaigns').insert(payload);
    if (error) {
      toast.error(error.message);
      return;
    }
    setCampaign(null);
    load();
  };

  const removeCampaign = async (c: PartnerCampaign) => {
    if (!confirm(`Excluir a campanha ${c.name}?`)) return;
    const { error } = await supabase.from('partner_campaigns').delete().eq('id', c.id);
    if (error) toast.error(error.message.includes('foreign') ? 'A campanha já gerou bônus; desative em vez de excluir.' : error.message);
    else load();
  };

  const updateLevel = (id: string, patch: Partial<PartnerLevel>) => setLevels((ls) => ls.map((l) => (l.id === id ? { ...l, ...patch } : l)));
  const toLocal = (iso?: string | null) => (iso ? new Date(new Date(iso).getTime() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16) : '');

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Níveis</CardTitle>
          <CardDescription>O parceiro atinge o nível pelo MRR da carteira OU pelo número de clientes ativos. Mudanças valem para as próximas comissões.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {levels.map((l) => (
            <div key={l.id} className="rounded-lg border p-4 grid sm:grid-cols-6 gap-3 items-end">
              <div className="space-y-1.5 sm:col-span-2"><Label>Nome</Label><Input value={l.name} onChange={(e) => updateLevel(l.id, { name: e.target.value })} /></div>
              <div className="space-y-1.5"><Label>Comissão %</Label><Input type="number" value={l.commission_percentage} onChange={(e) => updateLevel(l.id, { commission_percentage: Number(e.target.value) })} /></div>
              <div className="space-y-1.5"><Label>MRR mínimo</Label><Input type="number" value={l.min_mrr} onChange={(e) => updateLevel(l.id, { min_mrr: Number(e.target.value) })} /></div>
              <div className="space-y-1.5"><Label>Clientes mín.</Label><Input type="number" value={l.min_active_clients} onChange={(e) => updateLevel(l.id, { min_active_clients: Number(e.target.value) })} /></div>
              <div className="space-y-1.5"><Label>Cor</Label><Input type="color" value={l.color ?? '#999999'} onChange={(e) => updateLevel(l.id, { color: e.target.value })} className="h-10 p-1" /></div>
              <div className="space-y-1.5 sm:col-span-4"><Label>Benefícios (um por linha)</Label><Textarea rows={3} value={l.benefits.join('\n')} onChange={(e) => updateLevel(l.id, { benefits: e.target.value.split('\n').filter((b) => b.trim()) })} /></div>
              <div className="sm:col-span-2 space-y-2">
                <label className="flex items-center gap-2 text-sm"><Switch checked={l.requires_certification} onCheckedChange={(v) => updateLevel(l.id, { requires_certification: v })} />Exige certificação</label>
                <label className="flex items-center gap-2 text-sm"><Switch checked={l.is_active} onCheckedChange={(v) => updateLevel(l.id, { is_active: v })} />Ativo</label>
                <Button size="sm" onClick={() => saveLevel(l)} disabled={saving === l.id}>{saving === l.id && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}Salvar nível</Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base">Campanhas</CardTitle>
            <CardDescription>Multiplicador de comissão em novas assinaturas ou bônus por meta de clientes novos.</CardDescription>
          </div>
          <Button size="sm" onClick={() => setCampaign({ kind: 'multiplier', multiplier: 2, is_active: true })}><Plus className="h-4 w-4 mr-1.5" />Nova</Button>
        </CardHeader>
        <CardContent>
          {campaigns.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma campanha.</p>
          ) : (
            <ul className="divide-y">
              {campaigns.map((c) => {
                const live = c.is_active && new Date(c.starts_at) <= new Date() && new Date(c.ends_at) >= new Date();
                return (
                  <li key={c.id} className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <p className="font-medium text-sm flex items-center gap-2">{c.name}{live && <ToneBadge tone="green">No ar</ToneBadge>}{!c.is_active && <ToneBadge tone="muted">Inativa</ToneBadge>}</p>
                      <p className="text-xs text-muted-foreground">
                        {c.kind === 'multiplier' ? `${Number(c.multiplier)}x em novas assinaturas` : `${c.goal_new_clients} clientes → ${formatBRL(c.goal_bonus_amount)}`} · {formatDate(c.starts_at)} a {formatDate(c.ends_at)}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" onClick={() => setCampaign({ ...c, starts_at: toLocal(c.starts_at), ends_at: toLocal(c.ends_at) })}>Editar</Button>
                      <Button size="sm" variant="ghost" className="text-destructive" onClick={() => removeCampaign(c)} aria-label="Excluir"><Trash2 className="h-4 w-4" /></Button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      {settings && (
        <Card>
          <CardHeader><CardTitle className="text-base">Configurações do programa</CardTitle></CardHeader>
          <CardContent className="space-y-5">
            <div className="space-y-3">
              {BOOL_FIELDS.map((f) => (
                <label key={f.key} className="flex items-center gap-3 text-sm"><Switch checked={!!settings[f.key]} onCheckedChange={(v) => setSettings({ ...settings, [f.key]: v })} />{f.label}</label>
              ))}
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {NUMBER_FIELDS.map((f) => (
                <div key={f.key} className="space-y-1.5">
                  <Label className="text-xs">{f.label}</Label>
                  <Input type="number" step="any" value={String(settings[f.key] ?? '')} onChange={(e) => setSettings({ ...settings, [f.key]: e.target.value })} />
                </div>
              ))}
            </div>
            <div className="grid sm:grid-cols-2 gap-3">
              {TEXT_FIELDS.map((f) => (
                <div key={f.key} className="space-y-1.5">
                  <Label className="text-xs">{f.label}</Label>
                  <Input
                    type={f.type ?? 'text'}
                    value={f.type === 'datetime-local' ? toLocal(settings[f.key] as string | null) : String(settings[f.key] ?? '')}
                    onChange={(e) => setSettings({ ...settings, [f.key]: e.target.value })}
                  />
                </div>
              ))}
            </div>
            <Button onClick={saveSettings} disabled={saving === 'settings'}>{saving === 'settings' && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Salvar configurações</Button>
          </CardContent>
        </Card>
      )}

      <Dialog open={!!campaign} onOpenChange={(o) => !o && setCampaign(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{campaign?.id ? 'Editar campanha' : 'Nova campanha'}</DialogTitle></DialogHeader>
          {campaign && (
            <div className="grid sm:grid-cols-2 gap-3">
              <div className="space-y-1.5 sm:col-span-2"><Label>Nome</Label><Input value={campaign.name ?? ''} onChange={(e) => setCampaign({ ...campaign, name: e.target.value })} /></div>
              <div className="space-y-1.5 sm:col-span-2"><Label>Descrição (aparece para o parceiro)</Label><Input value={campaign.description ?? ''} onChange={(e) => setCampaign({ ...campaign, description: e.target.value })} /></div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label>Tipo</Label>
                <Select value={campaign.kind} onValueChange={(v) => setCampaign({ ...campaign, kind: v as PartnerCampaign['kind'] })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="multiplier">Multiplicador em novas assinaturas</SelectItem>
                    <SelectItem value="goal">Meta de clientes novos</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {campaign.kind === 'multiplier' ? (
                <div className="space-y-1.5"><Label>Multiplicador</Label><Input type="number" min={1} max={5} step="0.1" value={campaign.multiplier ?? 2} onChange={(e) => setCampaign({ ...campaign, multiplier: Number(e.target.value) })} /></div>
              ) : (
                <>
                  <div className="space-y-1.5"><Label>Clientes novos</Label><Input type="number" min={1} value={campaign.goal_new_clients ?? ''} onChange={(e) => setCampaign({ ...campaign, goal_new_clients: Number(e.target.value) })} /></div>
                  <div className="space-y-1.5"><Label>Bônus (R$)</Label><Input type="number" min={0} value={campaign.goal_bonus_amount ?? ''} onChange={(e) => setCampaign({ ...campaign, goal_bonus_amount: Number(e.target.value) })} /></div>
                </>
              )}
              <div className="space-y-1.5"><Label>Início</Label><Input type="datetime-local" value={campaign.starts_at ?? ''} onChange={(e) => setCampaign({ ...campaign, starts_at: e.target.value })} /></div>
              <div className="space-y-1.5"><Label>Fim</Label><Input type="datetime-local" value={campaign.ends_at ?? ''} onChange={(e) => setCampaign({ ...campaign, ends_at: e.target.value })} /></div>
              <label className="flex items-center gap-2 text-sm sm:col-span-2"><Switch checked={campaign.is_active ?? true} onCheckedChange={(v) => setCampaign({ ...campaign, is_active: v })} />Ativa</label>
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setCampaign(null)}>Cancelar</Button>
            <Button onClick={saveCampaign} disabled={!campaign?.name || !campaign?.starts_at || !campaign?.ends_at}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
