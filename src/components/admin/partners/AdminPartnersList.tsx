import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { BadgeCheck, ExternalLink, Loader2, Lock, Search, Star } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { formatBRL, partnerAdminApi, PARTNER_TYPE_LABELS, type PartnerLevel, type PartnerType } from '@/lib/partners/partnerApi';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { CopyButton, ToneBadge, formatDate } from '@/components/partners/PartnerUi';

export interface AdminPartnerRow {
  user_id: string;
  name: string;
  email: string;
  whatsapp: string | null;
  company_name: string | null;
  partner_type: PartnerType;
  status: 'approved' | 'suspended' | 'terminated';
  level_id: string | null;
  level_name: string | null;
  rate: number;
  is_founder: boolean;
  payouts_frozen: boolean;
  certified: boolean;
  commission_override: number | null;
  min_commission_percentage: number | null;
  founder_bonus_pp: number;
  public_slug: string | null;
  approved_at: string;
  last_sale_at: string | null;
  clients_total: number;
  clients_active: number;
  mrr: number;
  earned_total: number;
  balance_available: number;
  team_size: number;
  open_flags: number;
  admin_notes: string | null;
}

const STATUS_TONE = { approved: 'green', suspended: 'amber', terminated: 'red' } as const;
const STATUS_LABEL = { approved: 'Ativo', suspended: 'Suspenso', terminated: 'Encerrado' };

export default function AdminPartnersList() {
  const [rows, setRows] = useState<AdminPartnerRow[] | null>(null);
  const [levels, setLevels] = useState<PartnerLevel[]>([]);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<AdminPartnerRow | null>(null);
  const [draft, setDraft] = useState<Partial<AdminPartnerRow>>({});
  const [saving, setSaving] = useState(false);
  const [adjust, setAdjust] = useState({ amount: '', description: '' });
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [{ data, error }, lv] = await Promise.all([
      supabase.rpc('admin_partner_list'),
      supabase.from('partner_levels').select('*').order('sort_order'),
    ]);
    if (error) toast.error(error.message);
    setRows((data as AdminPartnerRow[]) ?? []);
    setLevels((lv.data as PartnerLevel[]) ?? []);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (rows ?? []).filter((r) => !q || [r.name, r.email, r.company_name, r.public_slug].join(' ').toLowerCase().includes(q));
  }, [rows, search]);

  const open = (r: AdminPartnerRow) => {
    setSelected(r);
    setDraft({
      status: r.status,
      level_id: r.level_id,
      commission_override: r.commission_override,
      min_commission_percentage: r.min_commission_percentage,
      is_founder: r.is_founder,
      founder_bonus_pp: r.founder_bonus_pp,
      payouts_frozen: r.payouts_frozen,
      admin_notes: r.admin_notes,
    });
    setAdjust({ amount: '', description: '' });
    setInviteUrl(null);
  };

  const save = async () => {
    if (!selected) return;
    setSaving(true);
    const { error } = await supabase
      .from('partner_profiles')
      .update({
        status: draft.status,
        level_id: draft.level_id,
        commission_override: draft.commission_override === null || draft.commission_override === undefined || String(draft.commission_override) === '' ? null : Number(draft.commission_override),
        min_commission_percentage: draft.min_commission_percentage === null || String(draft.min_commission_percentage) === '' ? null : Number(draft.min_commission_percentage),
        is_founder: draft.is_founder,
        founder_bonus_pp: Number(draft.founder_bonus_pp ?? 0),
        payouts_frozen: draft.payouts_frozen,
        admin_notes: draft.admin_notes || null,
      })
      .eq('user_id', selected.user_id);
    if (!error && draft.status !== selected.status) {
      // Suspended/terminated partners can't log in to the panel actions that need an approved profile;
      // block the login itself only on termination.
      await supabase.from('users').update({ is_blocked: draft.status === 'terminated' }).eq('id', selected.user_id);
    }
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success('Parceiro atualizado');
    setSelected(null);
    load();
  };

  const addAdjustment = async () => {
    if (!selected) return;
    const amount = Number(adjust.amount.replace(',', '.'));
    const { error } = await supabase.rpc('admin_partner_adjustment', { p_partner_id: selected.user_id, p_amount: amount, p_description: adjust.description, p_available: true });
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success('Ajuste lançado');
    setAdjust({ amount: '', description: '' });
    load();
  };

  const regenerate = async () => {
    if (!selected) return;
    try {
      const res = await partnerAdminApi.regenerateInvite(selected.user_id);
      setInviteUrl(res.invite_url);
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  return (
    <div className="space-y-4">
      <div className="relative max-w-md">
        <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input className="pl-9" placeholder="Buscar parceiro" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>
      <Card>
        <CardContent className="p-0">
          {rows === null ? (
            <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Parceiro</TableHead>
                    <TableHead>Nível</TableHead>
                    <TableHead className="text-right">Clientes</TableHead>
                    <TableHead className="text-right">MRR</TableHead>
                    <TableHead className="text-right">Ganho total</TableHead>
                    <TableHead>Última venda</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {visible.map((r) => (
                    <TableRow key={r.user_id} className="cursor-pointer" onClick={() => open(r)}>
                      <TableCell>
                        <p className="font-medium flex items-center gap-1.5">
                          {r.company_name || r.name}
                          {r.is_founder && <Star className="h-3.5 w-3.5 text-amber-500" aria-label="Fundador" />}
                          {r.certified && <BadgeCheck className="h-3.5 w-3.5 text-emerald-500" aria-label="Certificado" />}
                        </p>
                        <p className="text-xs text-muted-foreground">{r.email}</p>
                      </TableCell>
                      <TableCell className="whitespace-nowrap">{r.level_name ?? '—'} · {Number(r.rate)}%</TableCell>
                      <TableCell className="text-right tabular-nums">{r.clients_active}/{r.clients_total}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatBRL(r.mrr)}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatBRL(r.earned_total)}</TableCell>
                      <TableCell>{formatDate(r.last_sale_at)}</TableCell>
                      <TableCell>
                        <div className="flex gap-1.5 flex-wrap">
                          <ToneBadge tone={STATUS_TONE[r.status]}>{STATUS_LABEL[r.status]}</ToneBadge>
                          {r.payouts_frozen && <ToneBadge tone="red"><Lock className="h-3 w-3" />Saques</ToneBadge>}
                          {r.open_flags > 0 && <ToneBadge tone="red">{r.open_flags} alerta(s)</ToneBadge>}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          {selected && (
            <>
              <DialogHeader>
                <DialogTitle>{selected.company_name || selected.name}</DialogTitle>
                <DialogDescription>
                  {PARTNER_TYPE_LABELS[selected.partner_type]} · desde {formatDate(selected.approved_at)} · {selected.team_size} pessoa(s) na equipe · saldo disponível {formatBRL(selected.balance_available)}
                </DialogDescription>
              </DialogHeader>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" asChild><Link to={`/admin/users/${selected.user_id}`}><ExternalLink className="h-3.5 w-3.5 mr-1.5" />Ficha do usuário</Link></Button>
                {selected.public_slug && <Button size="sm" variant="outline" asChild><a href={`/especialistas/${selected.public_slug}`} target="_blank" rel="noopener noreferrer">Perfil público</a></Button>}
                <Button size="sm" variant="outline" onClick={regenerate}>Novo link de ativação</Button>
              </div>
              {inviteUrl && <div className="flex gap-2"><Input readOnly value={inviteUrl} className="font-mono text-xs" /><CopyButton value={inviteUrl} /></div>}

              <div className="grid sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Status</Label>
                  <Select value={draft.status} onValueChange={(v) => setDraft({ ...draft, status: v as AdminPartnerRow['status'] })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="approved">Ativo</SelectItem>
                      <SelectItem value="suspended">Suspenso</SelectItem>
                      <SelectItem value="terminated">Encerrado (bloqueia o login)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Nível</Label>
                  <Select value={draft.level_id ?? ''} onValueChange={(v) => setDraft({ ...draft, level_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>{levels.map((l) => <SelectItem key={l.id} value={l.id}>{l.name} · {Number(l.commission_percentage)}%</SelectItem>)}</SelectContent>
                  </Select>
                  <p className="text-[11px] text-muted-foreground">O recálculo diário ainda pode subir o nível; descidas respeitam a carência.</p>
                </div>
                <div className="space-y-1.5"><Label>Taxa fixa (override, %)</Label><Input type="number" min={0} max={100} value={draft.commission_override ?? ''} onChange={(e) => setDraft({ ...draft, commission_override: e.target.value === '' ? null : Number(e.target.value) })} placeholder="Usar a do nível" /></div>
                <div className="space-y-1.5"><Label>Taxa mínima garantida (%)</Label><Input type="number" min={0} max={100} value={draft.min_commission_percentage ?? ''} onChange={(e) => setDraft({ ...draft, min_commission_percentage: e.target.value === '' ? null : Number(e.target.value) })} /></div>
                <label className="flex items-center gap-3 text-sm"><Switch checked={!!draft.is_founder} onCheckedChange={(v) => setDraft({ ...draft, is_founder: v })} />Fundador</label>
                <div className="space-y-1.5"><Label>Bônus de fundador (pontos %)</Label><Input type="number" min={0} max={20} value={draft.founder_bonus_pp ?? 0} onChange={(e) => setDraft({ ...draft, founder_bonus_pp: Number(e.target.value) })} /></div>
                <label className="flex items-center gap-3 text-sm sm:col-span-2"><Switch checked={!!draft.payouts_frozen} onCheckedChange={(v) => setDraft({ ...draft, payouts_frozen: v })} />Congelar saques (revisão)</label>
                <div className="space-y-1.5 sm:col-span-2"><Label>Notas internas</Label><Textarea rows={2} value={draft.admin_notes ?? ''} onChange={(e) => setDraft({ ...draft, admin_notes: e.target.value })} /></div>
              </div>

              <div className="rounded-lg border p-3 space-y-2">
                <p className="text-sm font-medium">Ajuste manual no extrato</p>
                <div className="grid sm:grid-cols-[120px_1fr_auto] gap-2">
                  <Input placeholder="Valor (±)" value={adjust.amount} onChange={(e) => setAdjust({ ...adjust, amount: e.target.value })} />
                  <Input placeholder="Motivo (visível ao parceiro)" value={adjust.description} onChange={(e) => setAdjust({ ...adjust, description: e.target.value })} />
                  <Button variant="outline" onClick={addAdjustment} disabled={!adjust.amount || !adjust.description}>Lançar</Button>
                </div>
              </div>

              <DialogFooter>
                <Button variant="ghost" onClick={() => setSelected(null)}>Cancelar</Button>
                <Button onClick={save} disabled={saving}>{saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Salvar</Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
