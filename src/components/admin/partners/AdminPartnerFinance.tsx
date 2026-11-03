import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Check, Loader2, Undo2, X } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { formatPixKey } from '@/lib/referralUtils';
import {
  COMMISSION_STATUS_LABELS,
  COMMISSION_TYPE_LABELS,
  formatBRL,
  partnerAdminApi,
  signedPartnerDocumentUrl,
  uploadPartnerDocument,
  type CommissionStatus,
  type PartnerCommission,
} from '@/lib/partners/partnerApi';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ToneBadge, formatDate } from '@/components/partners/PartnerUi';

interface Withdrawal {
  id: string;
  user_id: string;
  amount: number;
  pix_key: string;
  pix_key_type: string;
  status: 'pending' | 'approved' | 'rejected';
  admin_notes: string | null;
  invoice_url: string | null;
  receipt_url: string | null;
  created_at: string;
  paid_at: string | null;
}

export default function AdminPartnerFinance() {
  const { user } = useAuth();
  const [withdrawals, setWithdrawals] = useState<Withdrawal[] | null>(null);
  const [commissions, setCommissions] = useState<PartnerCommission[]>([]);
  const [names, setNames] = useState<Map<string, string>>(new Map());
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [action, setAction] = useState<{ w: Withdrawal; kind: 'pay' | 'reject' } | null>(null);
  const [notes, setNotes] = useState('');
  const [receipt, setReceipt] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [statusFilter, setStatusFilter] = useState<'all' | CommissionStatus>('all');

  const load = useCallback(async () => {
    const [{ data: w }, { data: c }] = await Promise.all([
      supabase.from('withdrawal_requests').select('*').eq('source', 'partner').order('created_at', { ascending: false }).limit(200),
      supabase.from('partner_commissions').select('*').order('created_at', { ascending: false }).limit(300),
    ]);
    const list = (w as Withdrawal[]) ?? [];
    const comm = (c as PartnerCommission[]) ?? [];
    setWithdrawals(list);
    setCommissions(comm);
    const ids = [...new Set([...list.map((x) => x.user_id), ...comm.map((x) => x.partner_id), ...comm.map((x) => x.managed_user_id)].filter(Boolean))] as string[];
    if (ids.length) {
      const { data } = await supabase.from('users').select('id, name').in('id', ids);
      setNames(new Map((data ?? []).map((u) => [u.id, u.name])));
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const pending = (withdrawals ?? []).filter((w) => w.status === 'pending');
  const selectedTotal = pending.filter((w) => selected.has(w.id)).reduce((s, w) => s + Number(w.amount), 0);

  const openDoc = async (path: string) => {
    try {
      window.open(path.startsWith('http') ? path : await signedPartnerDocumentUrl(path), '_blank', 'noopener');
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const confirmAction = async () => {
    if (!action || !user?.id) return;
    setBusy(true);
    try {
      let receiptPath: string | null = null;
      if (action.kind === 'pay' && receipt) receiptPath = await uploadPartnerDocument(action.w.user_id, receipt, 'comprovante');
      await partnerAdminApi.processWithdrawal(action.w.id, action.kind, notes, receiptPath);
      toast.success(action.kind === 'pay' ? 'Saque marcado como pago' : 'Saque recusado');
      setAction(null);
      setNotes('');
      setReceipt(null);
      await load();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const payBatch = async () => {
    if (!confirm(`Marcar ${selected.size} saque(s) como pagos (total ${formatBRL(selectedTotal)})? Faça os PIX antes de confirmar.`)) return;
    setBusy(true);
    let ok = 0;
    for (const id of selected) {
      try {
        await partnerAdminApi.processWithdrawal(id, 'pay', 'Pago em lote');
        ok += 1;
      } catch (e) {
        toast.error((e as Error).message);
      }
    }
    setBusy(false);
    setSelected(new Set());
    toast.success(`${ok} saque(s) pagos`);
    load();
  };

  const reverse = async (c: PartnerCommission) => {
    const reason = prompt('Motivo do estorno (visível no extrato do parceiro):');
    if (!reason) return;
    const { error } = await supabase.rpc('admin_partner_reverse_commission', { p_commission_id: c.id, p_reason: reason });
    if (error) toast.error(error.message);
    else {
      toast.success('Comissão estornada');
      load();
    }
  };

  const visibleCommissions = commissions.filter((c) => statusFilter === 'all' || c.status === statusFilter);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <CardTitle className="text-base">Saques pendentes · {pending.length}</CardTitle>
          {selected.size > 0 && (
            <Button onClick={payBatch} disabled={busy}>{busy && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Pagar {selected.size} selecionado(s) · {formatBRL(selectedTotal)}</Button>
          )}
        </CardHeader>
        <CardContent className="p-0">
          {withdrawals === null ? (
            <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : pending.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">Nenhum saque pendente.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-8">
                      <Checkbox
                        checked={selected.size === pending.length}
                        onCheckedChange={(v) => setSelected(v ? new Set(pending.map((w) => w.id)) : new Set())}
                        aria-label="Selecionar todos"
                      />
                    </TableHead>
                    <TableHead>Parceiro</TableHead>
                    <TableHead>Valor</TableHead>
                    <TableHead>PIX</TableHead>
                    <TableHead>Nota fiscal</TableHead>
                    <TableHead>Solicitado</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pending.map((w) => (
                    <TableRow key={w.id}>
                      <TableCell>
                        <Checkbox
                          checked={selected.has(w.id)}
                          onCheckedChange={(v) => {
                            const next = new Set(selected);
                            if (v) next.add(w.id);
                            else next.delete(w.id);
                            setSelected(next);
                          }}
                          aria-label="Selecionar saque"
                        />
                      </TableCell>
                      <TableCell className="font-medium">{names.get(w.user_id) ?? '—'}</TableCell>
                      <TableCell className="tabular-nums">{formatBRL(w.amount)}</TableCell>
                      <TableCell className="text-xs">{w.pix_key_type.toUpperCase()}: {formatPixKey(w.pix_key, w.pix_key_type)}</TableCell>
                      <TableCell>{w.invoice_url ? <Button variant="link" size="sm" className="px-0" onClick={() => openDoc(w.invoice_url!)}>Abrir</Button> : '—'}</TableCell>
                      <TableCell>{formatDate(w.created_at)}</TableCell>
                      <TableCell className="text-right whitespace-nowrap">
                        <Button size="sm" variant="outline" className="mr-2" onClick={() => setAction({ w, kind: 'reject' })}><X className="h-3.5 w-3.5" /></Button>
                        <Button size="sm" onClick={() => setAction({ w, kind: 'pay' })}><Check className="h-3.5 w-3.5 mr-1" />Pago</Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <CardTitle className="text-base">Lançamentos recentes</CardTitle>
          <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as typeof statusFilter)}>
            <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              {Object.entries(COMMISSION_STATUS_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
            </SelectContent>
          </Select>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Parceiro</TableHead>
                  <TableHead>Cliente / descrição</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {visibleCommissions.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="whitespace-nowrap">{formatDate(c.created_at)}</TableCell>
                    <TableCell>{names.get(c.partner_id) ?? '—'}</TableCell>
                    <TableCell>{c.managed_user_id ? names.get(c.managed_user_id) ?? '—' : c.description === 'first_sale' ? 'Bônus de primeira venda' : c.description}</TableCell>
                    <TableCell className="whitespace-nowrap">{COMMISSION_TYPE_LABELS[c.type]}{c.installment_total > 1 ? ` ${c.installment_number}/${c.installment_total}` : ''}</TableCell>
                    <TableCell>{COMMISSION_STATUS_LABELS[c.status]}</TableCell>
                    <TableCell className={`text-right tabular-nums ${Number(c.amount) < 0 ? 'text-destructive' : ''}`}>{formatBRL(c.amount)}</TableCell>
                    <TableCell className="text-right">
                      {c.status !== 'reversed' && c.type !== 'clawback' && (
                        <Button size="sm" variant="ghost" onClick={() => reverse(c)} aria-label="Estornar"><Undo2 className="h-3.5 w-3.5" /></Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Histórico de saques</CardTitle></CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Parceiro</TableHead>
                  <TableHead>Valor</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead>Documentos</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(withdrawals ?? []).filter((w) => w.status !== 'pending').map((w) => (
                  <TableRow key={w.id}>
                    <TableCell>{names.get(w.user_id) ?? '—'}</TableCell>
                    <TableCell className="tabular-nums">{formatBRL(w.amount)}</TableCell>
                    <TableCell><ToneBadge tone={w.status === 'approved' ? 'green' : 'red'}>{w.status === 'approved' ? 'Pago' : 'Recusado'}</ToneBadge></TableCell>
                    <TableCell>{formatDate(w.paid_at ?? w.created_at)}</TableCell>
                    <TableCell className="space-x-2">
                      {w.invoice_url && <Button variant="link" size="sm" className="px-0" onClick={() => openDoc(w.invoice_url!)}>NF</Button>}
                      {w.receipt_url && <Button variant="link" size="sm" className="px-0" onClick={() => openDoc(w.receipt_url!)}>Comprovante</Button>}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={!!action} onOpenChange={(o) => !o && setAction(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{action?.kind === 'pay' ? 'Confirmar pagamento' : 'Recusar saque'}</DialogTitle>
            <DialogDescription>
              {action && `${names.get(action.w.user_id) ?? 'Parceiro'} · ${formatBRL(action.w.amount)} · ${action.w.pix_key_type.toUpperCase()}: ${formatPixKey(action.w.pix_key, action.w.pix_key_type)}`}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            {action?.kind === 'pay' && (
              <div className="space-y-1.5"><Label>Comprovante do PIX (opcional)</Label><Input type="file" accept=".pdf,image/*" onChange={(e) => setReceipt(e.target.files?.[0] ?? null)} /></div>
            )}
            <div className="space-y-1.5">
              <Label>{action?.kind === 'reject' ? 'Motivo (o parceiro verá)' : 'Observação'}</Label>
              <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>
            {action?.kind === 'reject' && <p className="text-xs text-muted-foreground">O valor volta para o saldo disponível do parceiro.</p>}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setAction(null)}>Cancelar</Button>
            <Button variant={action?.kind === 'reject' ? 'destructive' : 'default'} onClick={confirmAction} disabled={busy || (action?.kind === 'reject' && !notes.trim())}>
              {busy && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}{action?.kind === 'pay' ? 'Marcar como pago' : 'Recusar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
