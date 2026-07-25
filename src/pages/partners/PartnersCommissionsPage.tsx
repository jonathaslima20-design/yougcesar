import { useState, useEffect, useCallback } from 'react';
import { Loader, DollarSign, Clock, CircleCheck as CheckCircle, Plus } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { formatCurrencyI18n } from '@/lib/i18n';
import WithdrawalDialog from '@/components/referral/WithdrawalDialog';
import PixKeyDialog from '@/components/referral/PixKeyDialog';
import type { UserPixKey, WithdrawalRequest } from '@/types';

interface PartnerCommission {
  id: string;
  managed_user_id: string;
  plan_name: string | null;
  amount: number;
  type: string;
  status: string;
  created_at: string;
  managed_user_name?: string;
}

export default function PartnersCommissionsPage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [commissions, setCommissions] = useState<PartnerCommission[]>([]);
  const [withdrawals, setWithdrawals] = useState<WithdrawalRequest[]>([]);
  const [pixKeys, setPixKeys] = useState<UserPixKey[]>([]);
  const [minimumWithdrawalAmount, setMinimumWithdrawalAmount] = useState(50);
  const [statusFilter, setStatusFilter] = useState('all');
  const [withdrawalDialogOpen, setWithdrawalDialogOpen] = useState(false);
  const [pixKeyDialogOpen, setPixKeyDialogOpen] = useState(false);

  const fetchData = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const [commissionsRes, withdrawalsRes, pixKeysRes, settingsRes] = await Promise.all([
        supabase
          .from('partner_commissions')
          .select('id, managed_user_id, plan_name, amount, type, status, created_at')
          .eq('partner_id', user.id)
          .order('created_at', { ascending: false }),
        supabase
          .from('withdrawal_requests')
          .select('*')
          .eq('user_id', user.id)
          .eq('source', 'partner')
          .order('created_at', { ascending: false }),
        supabase.from('user_pix_keys').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
        supabase.from('partner_settings').select('minimum_withdrawal_amount').limit(1).maybeSingle(),
      ]);

      const commissionsData = commissionsRes.data || [];
      const managedUserIds = [...new Set(commissionsData.map((c) => c.managed_user_id))];
      let usersMap = new Map<string, string>();
      if (managedUserIds.length > 0) {
        const { data: usersData } = await supabase.from('users').select('id, name').in('id', managedUserIds);
        for (const u of usersData || []) usersMap.set(u.id, u.name);
      }

      setCommissions(commissionsData.map((c) => ({ ...c, managed_user_name: usersMap.get(c.managed_user_id) || 'Desconhecido' })));
      setWithdrawals(withdrawalsRes.data || []);
      setPixKeys(pixKeysRes.data || []);
      setMinimumWithdrawalAmount(settingsRes.data?.minimum_withdrawal_amount ?? 50);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const pendingAmount = commissions.filter((c) => c.status === 'pending').reduce((s, c) => s + Number(c.amount), 0);
  const paidAmount = commissions.filter((c) => c.status === 'paid').reduce((s, c) => s + Number(c.amount), 0);
  const totalEarned = pendingAmount + paidAmount;

  const filteredCommissions = statusFilter === 'all' ? commissions : commissions.filter((c) => c.status === statusFilter);

  return (
    <div className="container mx-auto p-6 max-w-5xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Minhas Comissões</h1>
          <p className="text-sm text-muted-foreground mt-1">Acompanhe suas comissões e solicite saques via PIX.</p>
        </div>
        <Button onClick={() => setWithdrawalDialogOpen(true)} disabled={pendingAmount < minimumWithdrawalAmount}>
          <Plus className="h-4 w-4 mr-2" />
          Solicitar Saque
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <SummaryCard title="Total Ganho" value={formatCurrencyI18n(totalEarned, 'BRL', 'pt-BR')} icon={DollarSign} loading={loading} />
        <SummaryCard title="Pendente" value={formatCurrencyI18n(pendingAmount, 'BRL', 'pt-BR')} icon={Clock} loading={loading} accent="amber" />
        <SummaryCard title="Pago" value={formatCurrencyI18n(paidAmount, 'BRL', 'pt-BR')} icon={CheckCircle} loading={loading} accent="green" />
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Histórico de Comissões</CardTitle>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[160px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os status</SelectItem>
              <SelectItem value="pending">Pendente</SelectItem>
              <SelectItem value="paid">Pago</SelectItem>
              <SelectItem value="reversed">Revertido</SelectItem>
            </SelectContent>
          </Select>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : filteredCommissions.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-12">Nenhuma comissão encontrada</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Usuário</TableHead>
                  <TableHead>Plano</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Valor</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Data</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredCommissions.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="text-sm font-medium">{c.managed_user_name}</TableCell>
                    <TableCell className="text-sm">{c.plan_name || '-'}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">{c.type === 'renewal' ? 'Renovação' : 'Nova assinatura'}</Badge>
                    </TableCell>
                    <TableCell className="font-medium">{formatCurrencyI18n(c.amount, 'BRL', 'pt-BR')}</TableCell>
                    <TableCell>
                      <CommissionStatusBadge status={c.status} />
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {new Date(c.created_at).toLocaleDateString('pt-BR')}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {withdrawals.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Solicitações de Saque</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Valor</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Data</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {withdrawals.map((w) => (
                  <TableRow key={w.id}>
                    <TableCell className="font-medium">{formatCurrencyI18n(w.amount, 'BRL', 'pt-BR')}</TableCell>
                    <TableCell>
                      <WithdrawalStatusBadge status={w.status} />
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {new Date(w.created_at).toLocaleDateString('pt-BR')}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <WithdrawalDialog
        open={withdrawalDialogOpen}
        onOpenChange={setWithdrawalDialogOpen}
        onSuccess={fetchData}
        availableAmount={pendingAmount}
        pixKeys={pixKeys}
        onConfigurePixKey={() => setPixKeyDialogOpen(true)}
        source="partner"
        minimumAmount={minimumWithdrawalAmount}
      />

      <PixKeyDialog
        open={pixKeyDialogOpen}
        onOpenChange={setPixKeyDialogOpen}
        onSuccess={fetchData}
      />
    </div>
  );
}

function SummaryCard({ title, value, icon: Icon, loading, accent }: {
  title: string; value: string; icon: React.ComponentType<{ className?: string }>; loading: boolean; accent?: 'green' | 'amber';
}) {
  const accentColor = accent === 'green' ? 'text-green-600' : accent === 'amber' ? 'text-amber-600' : 'text-muted-foreground';
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <Icon className={`h-4 w-4 ${accentColor}`} />
      </CardHeader>
      <CardContent>
        {loading ? <Loader className="h-6 w-6 animate-spin text-muted-foreground" /> : <div className={`text-2xl font-bold ${accent ? accentColor : ''}`}>{value}</div>}
      </CardContent>
    </Card>
  );
}

function CommissionStatusBadge({ status }: { status: string }) {
  switch (status) {
    case 'pending': return <Badge variant="outline" className="text-xs border-amber-300 text-amber-600">Pendente</Badge>;
    case 'paid': return <Badge className="bg-green-500 text-xs">Pago</Badge>;
    case 'reversed': return <Badge variant="destructive" className="text-xs">Revertido</Badge>;
    default: return <Badge variant="outline" className="text-xs">{status}</Badge>;
  }
}

function WithdrawalStatusBadge({ status }: { status: string }) {
  switch (status) {
    case 'pending': return <Badge variant="outline" className="text-xs border-amber-300 text-amber-600">Pendente</Badge>;
    case 'approved': return <Badge className="bg-green-500 text-xs">Aprovado</Badge>;
    case 'rejected': return <Badge variant="destructive" className="text-xs">Rejeitado</Badge>;
    case 'paid': return <Badge className="bg-green-500 text-xs">Pago</Badge>;
    default: return <Badge variant="outline" className="text-xs">{status}</Badge>;
  }
}
