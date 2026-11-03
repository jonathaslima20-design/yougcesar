import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { CalendarClock, Loader2, MessageCircle, Pencil, Plus, ShieldCheck, Store, Target, Trash2 } from 'lucide-react';
import { usePartner } from '@/contexts/PartnerContext';
import { LEAD_STAGE_LABELS, formatBRL, partnerApi, whatsappShareUrl, type LeadStage, type PartnerLead } from '@/lib/partners/partnerApi';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { EmptyState, PageHeader, StatCard, ToneBadge, daysUntil, formatDate } from '@/components/partners/PartnerUi';

const STAGES: LeadStage[] = ['contact', 'proposal', 'trial', 'won', 'lost'];
const STAGE_TONE: Record<LeadStage, 'muted' | 'blue' | 'amber' | 'green' | 'red'> = {
  contact: 'muted',
  proposal: 'blue',
  trial: 'amber',
  won: 'green',
  lost: 'red',
};

type Draft = Partial<PartnerLead> & { name: string };
const EMPTY: Draft = { name: '', email: '', whatsapp: '', company: '', niche: '', estimated_value: null, stage: 'contact', notes: '', next_action_at: null };

export default function PartnersLeadsPage() {
  const { partnerId, settings } = usePartner();
  const [leads, setLeads] = useState<PartnerLead[] | null>(null);
  const [stage, setStage] = useState<'open' | LeadStage | 'all'>('open');
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);

  const load = () => partnerApi.leads().then(setLeads).catch(() => setLeads([]));
  useEffect(() => {
    load();
  }, []);

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const l of leads ?? []) c[l.stage] = (c[l.stage] ?? 0) + 1;
    return c;
  }, [leads]);

  const visible = (leads ?? []).filter((l) => (stage === 'all' ? true : stage === 'open' ? !['won', 'lost'].includes(l.stage) : l.stage === stage));
  const pipelineValue = (leads ?? []).filter((l) => !['won', 'lost'].includes(l.stage)).reduce((s, l) => s + Number(l.estimated_value ?? 0), 0);
  const dueToday = (leads ?? []).filter((l) => l.next_action_at && new Date(l.next_action_at).getTime() <= Date.now() + 86400000 && !['won', 'lost'].includes(l.stage)).length;

  const save = async () => {
    if (!draft || !partnerId) return;
    if (!draft.email && !draft.whatsapp) {
      toast.error('Informe e-mail ou WhatsApp do contato.');
      return;
    }
    setSaving(true);
    try {
      const payload: Partial<PartnerLead> & { partner_id: string } = {
        id: draft.id,
        partner_id: partnerId,
        name: draft.name.trim(),
        email: draft.email?.trim() || null,
        whatsapp: draft.whatsapp?.trim() || null,
        company: draft.company?.trim() || null,
        niche: draft.niche?.trim() || null,
        estimated_value: draft.estimated_value ? Number(draft.estimated_value) : null,
        stage: draft.stage ?? 'contact',
        notes: draft.notes?.trim() || null,
        next_action_at: draft.next_action_at || null,
      };
      if (!payload.id) delete payload.id;
      await partnerApi.saveLead(payload);
      toast.success(draft.id ? 'Oportunidade atualizada' : `Contato registrado e protegido por ${settings?.lead_protection_days ?? 60} dias`);
      setDraft(null);
      await load();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const moveStage = async (lead: PartnerLead, next: LeadStage) => {
    try {
      await partnerApi.saveLead({ id: lead.id, partner_id: lead.partner_id, stage: next });
      await load();
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const remove = async (lead: PartnerLead) => {
    if (!confirm(`Remover ${lead.name}? A proteção deste contato também deixa de valer.`)) return;
    try {
      await partnerApi.deleteLead(lead.id);
      await load();
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  return (
    <div className="container mx-auto p-4 sm:p-6 space-y-6">
      <PageHeader
        title="Oportunidades"
        description={`Registre seus contatos: cada um fica protegido por ${settings?.lead_protection_days ?? 60} dias. Se ele assinar nesse prazo, o cliente é seu.`}
        actions={<Button onClick={() => setDraft({ ...EMPTY })}><Plus className="h-4 w-4 mr-2" />Novo contato</Button>}
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Em andamento" value={(leads ?? []).filter((l) => !['won', 'lost'].includes(l.stage)).length} icon={Target} />
        <StatCard title="Valor em negociação" value={formatBRL(pipelineValue)} hint="estimado por mês" />
        <StatCard title="Fechados" value={counts.won ?? 0} accent="green" />
        <StatCard title="Ações para hoje" value={dueToday} icon={CalendarClock} accent={dueToday ? 'amber' : undefined} />
      </div>

      <div className="flex flex-wrap gap-2">
        {(['open', ...STAGES, 'all'] as const).map((s) => (
          <Button key={s} size="sm" variant={stage === s ? 'default' : 'outline'} onClick={() => setStage(s)}>
            {s === 'open' ? 'Em aberto' : s === 'all' ? 'Todos' : LEAD_STAGE_LABELS[s]}
            {s !== 'open' && s !== 'all' && counts[s] ? <span className="ml-1.5 opacity-70">{counts[s]}</span> : null}
          </Button>
        ))}
      </div>

      {leads === null ? (
        <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : visible.length === 0 ? (
        <Card><EmptyState icon={Target} title="Nenhuma oportunidade aqui" description="Registre os lojistas com quem você está conversando para não perder nenhum e garantir a proteção." /></Card>
      ) : (
        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
          {visible.map((lead) => {
            const protectedDays = daysUntil(lead.protected_until);
            return (
              <Card key={lead.id}>
                <CardContent className="pt-5 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-semibold truncate">{lead.name}</p>
                      <p className="text-xs text-muted-foreground truncate">{[lead.company, lead.niche].filter(Boolean).join(' · ') || lead.email || lead.whatsapp}</p>
                    </div>
                    <ToneBadge tone={STAGE_TONE[lead.stage]}>{LEAD_STAGE_LABELS[lead.stage]}</ToneBadge>
                  </div>
                  <div className="flex flex-wrap gap-2 text-xs">
                    {lead.source === 'directory' && <ToneBadge tone="blue">Diretório</ToneBadge>}
                    {protectedDays !== null && protectedDays > 0 && !['won', 'lost'].includes(lead.stage) && (
                      <ToneBadge tone="green"><ShieldCheck className="h-3 w-3" />Protegido por {protectedDays}d</ToneBadge>
                    )}
                    {lead.estimated_value ? <span className="text-muted-foreground">{formatBRL(lead.estimated_value)}/mês</span> : null}
                    {lead.next_action_at && <span className="text-muted-foreground flex items-center gap-1"><CalendarClock className="h-3 w-3" />{formatDate(lead.next_action_at)}</span>}
                  </div>
                  {lead.notes && <p className="text-sm text-muted-foreground line-clamp-3 whitespace-pre-line">{lead.notes}</p>}
                  <div className="flex flex-wrap gap-2 pt-1">
                    <Select value={lead.stage} onValueChange={(v) => moveStage(lead, v as LeadStage)}>
                      <SelectTrigger className="h-8 w-[130px] text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>{STAGES.map((s) => <SelectItem key={s} value={s}>{LEAD_STAGE_LABELS[s]}</SelectItem>)}</SelectContent>
                    </Select>
                    {lead.whatsapp && (
                      <Button size="sm" variant="outline" className="h-8" asChild>
                        <a href={whatsappShareUrl(`Oi, ${lead.name}!`, lead.whatsapp)} target="_blank" rel="noopener noreferrer"><MessageCircle className="h-3.5 w-3.5" /></a>
                      </Button>
                    )}
                    {!lead.converted_user_id && !['won', 'lost'].includes(lead.stage) && (
                      <Button size="sm" variant="outline" className="h-8" asChild>
                        <Link to={`/partners/new-store?lead=${lead.id}`}><Store className="h-3.5 w-3.5 mr-1" />Criar loja</Link>
                      </Button>
                    )}
                    {lead.converted_user_id && (
                      <Button size="sm" variant="outline" className="h-8" asChild>
                        <Link to={`/partners/clients/${lead.converted_user_id}`}>Ver cliente</Link>
                      </Button>
                    )}
                    <Button size="sm" variant="ghost" className="h-8" onClick={() => setDraft({ ...lead })} aria-label="Editar"><Pencil className="h-3.5 w-3.5" /></Button>
                    <Button size="sm" variant="ghost" className="h-8 text-destructive" onClick={() => remove(lead)} aria-label="Remover"><Trash2 className="h-3.5 w-3.5" /></Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={!!draft} onOpenChange={(o) => !o && setDraft(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{draft?.id ? 'Editar oportunidade' : 'Novo contato'}</DialogTitle>
            {!draft?.id && <DialogDescription>O contato fica protegido para você por {settings?.lead_protection_days ?? 60} dias a partir de hoje.</DialogDescription>}
          </DialogHeader>
          {draft && (
            <div className="grid sm:grid-cols-2 gap-3">
              <div className="space-y-1.5 sm:col-span-2"><Label>Nome *</Label><Input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} /></div>
              <div className="space-y-1.5"><Label>E-mail</Label><Input type="email" value={draft.email ?? ''} onChange={(e) => setDraft({ ...draft, email: e.target.value })} disabled={!!draft.id} /></div>
              <div className="space-y-1.5"><Label>WhatsApp</Label><Input value={draft.whatsapp ?? ''} onChange={(e) => setDraft({ ...draft, whatsapp: e.target.value })} disabled={!!draft.id} /></div>
              <div className="space-y-1.5"><Label>Empresa / loja</Label><Input value={draft.company ?? ''} onChange={(e) => setDraft({ ...draft, company: e.target.value })} /></div>
              <div className="space-y-1.5"><Label>Nicho</Label><Input value={draft.niche ?? ''} onChange={(e) => setDraft({ ...draft, niche: e.target.value })} /></div>
              <div className="space-y-1.5"><Label>Valor estimado (R$/mês)</Label><Input type="number" min={0} step="0.01" value={draft.estimated_value ?? ''} onChange={(e) => setDraft({ ...draft, estimated_value: e.target.value ? Number(e.target.value) : null })} /></div>
              <div className="space-y-1.5"><Label>Próxima ação</Label><Input type="date" value={draft.next_action_at?.slice(0, 10) ?? ''} onChange={(e) => setDraft({ ...draft, next_action_at: e.target.value ? new Date(`${e.target.value}T12:00:00`).toISOString() : null })} /></div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label>Etapa</Label>
                <Select value={draft.stage ?? 'contact'} onValueChange={(v) => setDraft({ ...draft, stage: v as LeadStage })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{STAGES.map((s) => <SelectItem key={s} value={s}>{LEAD_STAGE_LABELS[s]}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5 sm:col-span-2"><Label>Anotações</Label><Textarea value={draft.notes ?? ''} onChange={(e) => setDraft({ ...draft, notes: e.target.value })} rows={3} /></div>
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDraft(null)}>Cancelar</Button>
            <Button onClick={save} disabled={saving || !draft?.name.trim()}>{saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
