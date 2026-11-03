import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Check, Loader2, MessageCircle, X } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { PARTNER_TYPE_LABELS, partnerAdminApi, whatsappShareUrl, type PartnerType } from '@/lib/partners/partnerApi';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { CopyButton, EmptyState, ToneBadge, formatDate } from '@/components/partners/PartnerUi';
import { ClipboardList } from 'lucide-react';

interface Application {
  id: string;
  name: string;
  email: string;
  whatsapp: string;
  partner_type: PartnerType;
  company_name: string | null;
  document: string | null;
  website: string | null;
  instagram: string | null;
  city: string | null;
  state: string | null;
  client_count: string | null;
  niches: string[];
  how_will_sell: string | null;
  recruited_by_partner_id: string | null;
  utm: Record<string, string>;
  status: 'pending' | 'approved' | 'rejected' | 'needs_info';
  admin_notes: string | null;
  created_at: string;
}

const STATUS = {
  pending: { label: 'Pendente', tone: 'amber' as const },
  needs_info: { label: 'Aguardando info', tone: 'blue' as const },
  approved: { label: 'Aprovada', tone: 'green' as const },
  rejected: { label: 'Recusada', tone: 'red' as const },
};

export default function AdminPartnerApplications({ onChanged }: { onChanged?: () => void }) {
  const { user } = useAuth();
  const [apps, setApps] = useState<Application[] | null>(null);
  const [filter, setFilter] = useState<'open' | Application['status'] | 'all'>('open');
  const [selected, setSelected] = useState<Application | null>(null);
  const [notes, setNotes] = useState('');
  const [founder, setFounder] = useState(true);
  const [busy, setBusy] = useState(false);
  const [approved, setApproved] = useState<{ invite_url: string; whatsapp: string; name: string } | null>(null);

  const load = useCallback(async () => {
    const { data } = await supabase.from('partner_applications').select('*').order('created_at', { ascending: false });
    setApps((data as Application[]) ?? []);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const visible = (apps ?? []).filter((a) => (filter === 'all' ? true : filter === 'open' ? a.status === 'pending' || a.status === 'needs_info' : a.status === filter));

  const approve = async () => {
    if (!selected) return;
    setBusy(true);
    try {
      const res = await partnerAdminApi.approveApplication(selected.id, { founder });
      setApproved(res);
      setSelected(null);
      toast.success('Parceiro aprovado');
      await load();
      onChanged?.();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const setStatus = async (status: 'rejected' | 'needs_info') => {
    if (!selected) return;
    setBusy(true);
    const { error } = await supabase
      .from('partner_applications')
      .update({ status, admin_notes: notes || null, reviewed_by: user?.id, reviewed_at: new Date().toISOString() })
      .eq('id', selected.id);
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setSelected(null);
    await load();
    onChanged?.();
  };

  const activationMessage = approved
    ? `Olá, ${approved.name.split(' ')[0]}! Sua inscrição no VitrineTurbo Partners foi aprovada. 🎉 Ative seu painel por este link (vale 7 dias): ${approved.invite_url}`
    : '';

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {(['open', 'pending', 'needs_info', 'approved', 'rejected', 'all'] as const).map((f) => (
          <Button key={f} size="sm" variant={filter === f ? 'default' : 'outline'} onClick={() => setFilter(f)}>
            {f === 'open' ? 'Em aberto' : f === 'all' ? 'Todas' : STATUS[f].label}
          </Button>
        ))}
      </div>

      <Card>
        <CardContent className="p-0">
          {apps === null ? (
            <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : visible.length === 0 ? (
            <EmptyState icon={ClipboardList} title="Nenhuma inscrição aqui" />
          ) : (
            <ul className="divide-y">
              {visible.map((a) => (
                <li key={a.id}>
                  <button className="w-full text-left p-4 hover:bg-muted/40 flex flex-col sm:flex-row sm:items-center gap-2 justify-between" onClick={() => { setSelected(a); setNotes(a.admin_notes ?? ''); setFounder(true); }}>
                    <div className="min-w-0">
                      <p className="font-medium">{a.name}{a.company_name ? ` · ${a.company_name}` : ''}</p>
                      <p className="text-xs text-muted-foreground">{PARTNER_TYPE_LABELS[a.partner_type]} · {[a.city, a.state].filter(Boolean).join('/') || 'sem cidade'} · clientes: {a.client_count ?? '—'}</p>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      {a.recruited_by_partner_id && <ToneBadge tone="blue">Indicado por parceiro</ToneBadge>}
                      <ToneBadge tone={STATUS[a.status].tone}>{STATUS[a.status].label}</ToneBadge>
                      <span>{formatDate(a.created_at)}</span>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          {selected && (
            <>
              <DialogHeader>
                <DialogTitle>{selected.name}</DialogTitle>
                <DialogDescription>{PARTNER_TYPE_LABELS[selected.partner_type]} · inscrito em {formatDate(selected.created_at)}</DialogDescription>
              </DialogHeader>
              <div className="grid sm:grid-cols-2 gap-3 text-sm">
                <Field label="E-mail" value={selected.email} />
                <Field label="WhatsApp" value={selected.whatsapp} />
                <Field label="Empresa" value={selected.company_name} />
                <Field label="Documento" value={selected.document} />
                <Field label="Instagram" value={selected.instagram} />
                <Field label="Site" value={selected.website} />
                <Field label="Cidade" value={[selected.city, selected.state].filter(Boolean).join(' / ')} />
                <Field label="Clientes atendidos" value={selected.client_count} />
                <Field label="Nichos" value={selected.niches.join(', ')} />
                <Field label="Origem" value={Object.values(selected.utm ?? {}).join(' · ')} />
                <div className="sm:col-span-2"><Field label="Como pretende vender" value={selected.how_will_sell} /></div>
              </div>
              {selected.status !== 'approved' && (
                <div className="space-y-3 border-t pt-4">
                  <label className="flex items-center gap-3 text-sm"><Switch checked={founder} onCheckedChange={setFounder} />Parceiro Fundador (se houver vagas)</label>
                  <div className="space-y-1.5"><Label>Observações (visíveis só para o admin)</Label><Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} /></div>
                </div>
              )}
              <DialogFooter className="gap-2">
                <Button variant="outline" asChild>
                  <a href={whatsappShareUrl(`Olá, ${selected.name.split(' ')[0]}! Aqui é do VitrineTurbo Partners, sobre a sua inscrição.`, selected.whatsapp)} target="_blank" rel="noopener noreferrer"><MessageCircle className="h-4 w-4 mr-2" />WhatsApp</a>
                </Button>
                {selected.status !== 'approved' && (
                  <>
                    <Button variant="outline" onClick={() => setStatus('needs_info')} disabled={busy}>Pedir informações</Button>
                    <Button variant="destructive" onClick={() => setStatus('rejected')} disabled={busy}><X className="h-4 w-4 mr-1" />Recusar</Button>
                    <Button onClick={approve} disabled={busy}>{busy ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Check className="h-4 w-4 mr-1" />}Aprovar</Button>
                  </>
                )}
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!approved} onOpenChange={(o) => !o && setApproved(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Parceiro aprovado</DialogTitle>
            <DialogDescription>Envie o link de ativação para {approved?.name}. Ele vale por 7 dias.</DialogDescription>
          </DialogHeader>
          {approved && (
            <>
              <div className="flex gap-2"><Input readOnly value={approved.invite_url} className="font-mono text-xs" /><CopyButton value={approved.invite_url} /></div>
              <DialogFooter>
                <Button asChild><a href={whatsappShareUrl(activationMessage, approved.whatsapp)} target="_blank" rel="noopener noreferrer"><MessageCircle className="h-4 w-4 mr-2" />Enviar no WhatsApp</a></Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="break-words whitespace-pre-line">{value || '—'}</p>
    </div>
  );
}
