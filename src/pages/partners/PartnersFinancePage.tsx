import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { AlertCircle, CheckCircle2, Clock, CreditCard, Download, FileUp, Hourglass, Loader2, Lock, Wallet } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { usePartner } from '@/contexts/PartnerContext';
import { supabase } from '@/lib/supabase';
import { formatPixKey } from '@/lib/referralUtils';
import {
  COMMISSION_STATUS_LABELS,
  COMMISSION_TYPE_LABELS,
  formatBRL,
  partnerApi,
  signedPartnerDocumentUrl,
  uploadPartnerDocument,
  type CommissionStatus,
  type PartnerCommission,
} from '@/lib/partners/partnerApi';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import PixKeyDialog from '@/components/referral/PixKeyDialog';
import { PageHeader, StatCard, ToneBadge, formatDate } from '@/components/partners/PartnerUi';
import type { UserPixKey, WithdrawalRequest } from '@/types';

const STATUS_TONE: Record<CommissionStatus, 'muted' | 'green' | 'amber' | 'blue' | 'red'> = {
  holding: 'amber',
  available: 'green',
  requested: 'blue',
  paid: 'muted',
  reversed: 'red',
};

type Withdrawal = WithdrawalRequest & { invoice_url?: string | null; receipt_url?: string | null; paid_at?: string | null };

export default function PartnersFinancePage() {
  const { user } = useAuth();
  const { overview, profile, settings, partnerId, refresh } = usePartner();
  const [commissions, setCommissions] = useState<PartnerCommission[] | null>(null);
  const [names, setNames] = useState<Map<string, string>>(new Map());
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([]);
  const [pixKeys, setPixKeys] = useState<UserPixKey[]>([]);
  const [statusFilter, setStatusFilter] = useState<'all' | CommissionStatus>('all');
  const [pixDialog, setPixDialog] = useState(false);
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const [selectedKey, setSelectedKey] = useState('');
  const [invoice, setInvoice] = useState<File | null>(null);
  const [requesting, setRequesting] = useState(false);

  const load = useCallback(async () => {
    if (!partnerId || !user?.id) return;
    const [list, wr, keys] = await Promise.all([
      partnerApi.commissions(partnerId).catch(() => []),
      supabase.from('withdrawal_requests').select('*').eq('user_id', user.id).eq('source', 'partner').order('created_at', { ascending: false }),
      supabase.from('user_pix_keys').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
    ]);
    setCommissions(list);
    setWithdrawals((wr.data as Withdrawal[]) ?? []);
    setPixKeys((keys.data as UserPixKey[]) ?? []);
    if (keys.data?.[0]) setSelectedKey((k) => k || keys.data[0].id);
    const ids = [...new Set(list.map((c) => c.managed_user_id).filter(Boolean))] as string[];
    if (ids.length) {
      const { data } = await supabase.from('users').select('id, name').in('id', ids);
      setNames(new Map((data ?? []).map((u) => [u.id, u.name])));
    }
  }, [partnerId, user?.id]);

  useEffect(() => {
    load();
  }, [load]);

  const balance = overview?.balance;
  const available = Number(balance?.available ?? 0);
  const minimum = Number(settings?.minimum_withdrawal_amount ?? 50);
  const hasPending = withdrawals.some((w) => w.status === 'pending');
  const isCompany = profile?.document_type === 'cnpj';

  const forecast = useMemo(() => {
    const buckets = new Map<string, number>();
    for (const c of commissions ?? []) {
      if (c.status !== 'holding' || !c.available_at) continue;
      const d = new Date(c.available_at);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      buckets.set(key, (buckets.get(key) ?? 0) + Number(c.amount));
    }
    return [...buckets.entries()].sort(([a], [b]) => a.localeCompare(b)).slice(0, 6);
  }, [commissions]);

  const visible = (commissions ?? []).filter((c) => statusFilter === 'all' || c.status === statusFilter);

  const requestWithdrawal = async () => {
    if (!selectedKey || !user?.id) return;
    setRequesting(true);
    try {
      let invoicePath: string | null = null;
      if (invoice) invoicePath = await uploadPartnerDocument(user.id, invoice, 'nota-fiscal');
      await partnerApi.requestWithdrawal(selectedKey, invoicePath);
      toast.success('Saque solicitado! Você será avisado quando o PIX for feito.');
      setWithdrawOpen(false);
      setInvoice(null);
      await Promise.all([load(), refresh()]);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setRequesting(false);
    }
  };

  const openDocument = async (path: string) => {
    try {
      window.open(path.startsWith('http') ? path : await signedPartnerDocumentUrl(path), '_blank', 'noopener');
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const exportCsv = () => {
    const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const rows = [
      ['Data', 'Cliente', 'Tipo', 'Parcela', 'Status', 'Liberação', 'Valor'].map(esc).join(';'),
      ...visible.map((c) =>
        [
          c.created_at.slice(0, 10),
          c.managed_user_id ? names.get(c.managed_user_id) : c.description,
          COMMISSION_TYPE_LABELS[c.type],
          c.installment_total > 1 ? `${c.installment_number}/${c.installment_total}` : '',
          COMMISSION_STATUS_LABELS[c.status],
          c.available_at?.slice(0, 10),
          String(c.amount).replace('.', ','),
        ].map(esc).join(';'),
      ),
    ].join('\n');
    const url = URL.createObjectURL(new Blob(['﻿' + rows], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `extrato-parceiro-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="container mx-auto p-4 sm:p-6 space-y-6 max-w-6xl">
      <PageHeader
        title="Financeiro"
        description={`Comissões ficam ${settings?.holding_days ?? 30} dias em carência e depois ficam disponíveis para saque via PIX.`}
        actions={
          <Button onClick={() => setWithdrawOpen(true)} disabled={available < minimum || hasPending || overview?.payouts_frozen || pixKeys.length === 0}>
            <Wallet className="h-4 w-4 mr-2" />Solicitar saque
          </Button>
        }
      />

      {overview?.payouts_frozen && (
        <Alert variant="destructive"><Lock className="h-4 w-4" /><AlertDescription>Seus saques estão temporariamente em revisão. Fale com o suporte de parceiros.</AlertDescription></Alert>
      )}
      {pixKeys.length === 0 && (
        <Alert><AlertCircle className="h-4 w-4" /><AlertDescription>Cadastre uma chave PIX para poder sacar.</AlertDescription></Alert>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Disponível" value={formatBRL(available)} hint={`Mínimo para saque: ${formatBRL(minimum)}`} icon={Wallet} accent="green" />
        <StatCard title="Em carência" value={formatBRL(balance?.holding)} hint="liberação automática" icon={Hourglass} accent="amber" />
        <StatCard title="Saque em análise" value={formatBRL(balance?.requested)} icon={Clock} accent="blue" />
        <StatCard title="Total recebido" value={formatBRL(balance?.paid)} icon={CheckCircle2} />
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2"><CreditCard className="h-4 w-4" />Recebimento</CardTitle>
            <Button variant="outline" size="sm" onClick={() => setPixDialog(true)}>{pixKeys.length ? 'Editar PIX' : 'Cadastrar PIX'}</Button>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {pixKeys[0] ? (
              <div>
                <p className="font-medium">{pixKeys[0].holder_name}</p>
                <p className="text-xs text-muted-foreground">{pixKeys[0].pix_key_type.toUpperCase()}: {formatPixKey(pixKeys[0].pix_key, pixKeys[0].pix_key_type)}</p>
              </div>
            ) : (
              <p className="text-muted-foreground">Nenhuma chave cadastrada.</p>
            )}
            <p className="text-xs text-muted-foreground">
              {isCompany
                ? 'Como você recebe por CNPJ, anexe a nota fiscal de serviço a cada saque.'
                : `Como pessoa física, você recebe até ${formatBRL(settings?.max_pf_monthly_payout)} por mês. Acima disso, cadastre um CNPJ (MEI serve) em Perfil público.`}
            </p>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader><CardTitle className="text-base">Previsão de liberação</CardTitle></CardHeader>
          <CardContent>
            {forecast.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhuma comissão em carência.</p>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {forecast.map(([month, value]) => {
                  const [y, m] = month.split('-');
                  return (
                    <div key={month} className="rounded-lg border p-3">
                      <p className="text-xs text-muted-foreground">{new Date(Number(y), Number(m) - 1, 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}</p>
                      <p className="font-semibold tabular-nums mt-1">{formatBRL(value)}</p>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <CardTitle className="text-base">Extrato</CardTitle>
          <div className="flex gap-2">
            <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as typeof statusFilter)}>
              <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os status</SelectItem>
                {Object.entries(COMMISSION_STATUS_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button variant="outline" size="icon" onClick={exportCsv} aria-label="Exportar extrato"><Download className="h-4 w-4" /></Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {commissions === null ? (
            <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : visible.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-10">Nenhum lançamento.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Cliente / descrição</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Liberação</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {visible.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell className="whitespace-nowrap">{formatDate(c.created_at)}</TableCell>
                      <TableCell>
                        <p>{c.managed_user_id ? names.get(c.managed_user_id) ?? 'Cliente' : c.description === 'first_sale' ? 'Bônus de primeira venda' : c.description}</p>
                        {c.plan_name && <p className="text-xs text-muted-foreground">{c.plan_name}{c.commission_percentage ? ` · ${Number(c.commission_percentage)}%` : ''}</p>}
                        {c.reversal_reason && <p className="text-xs text-destructive">Estornada: {c.reversal_reason === 'chargeback' ? 'contestação' : 'reembolso'}</p>}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">{COMMISSION_TYPE_LABELS[c.type]}{c.installment_total > 1 ? ` ${c.installment_number}/${c.installment_total}` : ''}</TableCell>
                      <TableCell><ToneBadge tone={STATUS_TONE[c.status]}>{COMMISSION_STATUS_LABELS[c.status]}</ToneBadge></TableCell>
                      <TableCell className="whitespace-nowrap">{formatDate(c.available_at)}</TableCell>
                      <TableCell className={`text-right tabular-nums ${Number(c.amount) < 0 ? 'text-destructive' : ''}`}>{formatBRL(c.amount)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Saques</CardTitle></CardHeader>
        <CardContent className="p-0">
          {withdrawals.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">Nenhum saque ainda.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Solicitado em</TableHead>
                    <TableHead>Valor</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Pago em</TableHead>
                    <TableHead>Documentos</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {withdrawals.map((w) => (
                    <TableRow key={w.id}>
                      <TableCell>{formatDate(w.created_at)}</TableCell>
                      <TableCell className="tabular-nums">{formatBRL(w.amount)}</TableCell>
                      <TableCell>
                        <ToneBadge tone={w.status === 'approved' ? 'green' : w.status === 'rejected' ? 'red' : 'amber'}>
                          {w.status === 'approved' ? 'Pago' : w.status === 'rejected' ? 'Recusado' : 'Em análise'}
                        </ToneBadge>
                        {w.status === 'rejected' && w.admin_notes && <p className="text-xs text-muted-foreground mt-1">{w.admin_notes}</p>}
                      </TableCell>
                      <TableCell>{formatDate(w.paid_at ?? (w.status === 'approved' ? w.processed_at : null))}</TableCell>
                      <TableCell className="space-x-2">
                        {w.invoice_url && <Button variant="link" size="sm" className="px-0" onClick={() => openDocument(w.invoice_url!)}>Nota fiscal</Button>}
                        {w.receipt_url && <Button variant="link" size="sm" className="px-0" onClick={() => openDocument(w.receipt_url!)}>Comprovante</Button>}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={withdrawOpen} onOpenChange={setWithdrawOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Solicitar saque de {formatBRL(available)}</DialogTitle>
            <DialogDescription>O saque inclui todo o saldo disponível. Pagamos via PIX, normalmente até o dia {settings?.payout_day ?? 10} do mês.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Chave PIX</Label>
              <Select value={selectedKey} onValueChange={setSelectedKey}>
                <SelectTrigger><SelectValue placeholder="Escolha a chave" /></SelectTrigger>
                <SelectContent>
                  {pixKeys.map((k) => <SelectItem key={k.id} value={k.id}>{k.pix_key_type.toUpperCase()}: {formatPixKey(k.pix_key, k.pix_key_type)}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {isCompany && (
              <div className="space-y-1.5">
                <Label className="flex items-center gap-2"><FileUp className="h-4 w-4" />Nota fiscal de serviço (PDF ou XML) *</Label>
                <Input type="file" accept=".pdf,.xml,image/*" onChange={(e) => setInvoice(e.target.files?.[0] ?? null)} />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setWithdrawOpen(false)}>Cancelar</Button>
            <Button onClick={requestWithdrawal} disabled={requesting || !selectedKey || (isCompany && !invoice)}>
              {requesting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Confirmar saque
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <PixKeyDialog
        open={pixDialog}
        onOpenChange={setPixDialog}
        existingKey={pixKeys[0] ?? null}
        onSuccess={() => load()}
      />
    </div>
  );
}
