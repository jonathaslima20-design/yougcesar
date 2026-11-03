import { useEffect, useState } from 'react';
import { AlertTriangle, ClipboardList, Percent, TrendingUp, Users, Wallet } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { formatBRL } from '@/lib/partners/partnerApi';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { StatCard } from '@/components/partners/PartnerUi';

export interface ProgramStats {
  partners_total: number;
  partners_approved: number;
  partners_active_90d: number;
  partners_new_30d: number;
  activation_rate: number;
  mrr_total: number;
  mrr_partners: number;
  paying_partner_clients: number;
  paying_total: number;
  new_partner_clients_30d: number;
  commissions_month: number;
  liability_holding: number;
  liability_available: number;
  paid_total: number;
  applications_pending: number;
  withdrawals_pending: number;
  fraud_open: number;
  churn_partner_clients_90d: number;
  churn_organic_90d: number;
}

export default function AdminPartnersOverview({ onNavigate }: { onNavigate: (tab: string) => void }) {
  const [stats, setStats] = useState<ProgramStats | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    supabase.rpc('admin_partner_program_stats').then(({ data, error: e }) => {
      if (e) setError(e.message);
      else setStats(data as ProgramStats);
    });
  }, []);

  if (error) return <p className="text-sm text-destructive">{error}</p>;
  const loading = !stats;
  const share = stats && Number(stats.mrr_total) > 0 ? (Number(stats.mrr_partners) / Number(stats.mrr_total)) * 100 : 0;

  return (
    <div className="space-y-6">
      {stats && (stats.applications_pending > 0 || stats.withdrawals_pending > 0 || stats.fraud_open > 0) && (
        <div className="grid sm:grid-cols-3 gap-3">
          {stats.applications_pending > 0 && (
            <button onClick={() => onNavigate('applications')} className="rounded-xl border border-sky-500/30 bg-sky-500/5 p-4 text-left text-sm flex items-center gap-3">
              <ClipboardList className="h-5 w-5 text-sky-600" />{stats.applications_pending} inscrição(ões) aguardando análise
            </button>
          )}
          {stats.withdrawals_pending > 0 && (
            <button onClick={() => onNavigate('finance')} className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 text-left text-sm flex items-center gap-3">
              <Wallet className="h-5 w-5 text-amber-600" />{stats.withdrawals_pending} saque(s) para pagar
            </button>
          )}
          {stats.fraud_open > 0 && (
            <button onClick={() => onNavigate('fraud')} className="rounded-xl border border-red-500/30 bg-red-500/5 p-4 text-left text-sm flex items-center gap-3">
              <AlertTriangle className="h-5 w-5 text-red-600" />{stats.fraud_open} alerta(s) de fraude
            </button>
          )}
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Parceiros aprovados" value={stats?.partners_approved ?? 0} hint={`${stats?.partners_new_30d ?? 0} novos em 30 dias`} icon={Users} loading={loading} />
        <StatCard title="Parceiros ativos (90d)" value={stats?.partners_active_90d ?? 0} hint="com venda nos últimos 90 dias" icon={TrendingUp} loading={loading} />
        <StatCard title="Taxa de ativação" value={`${stats?.activation_rate ?? 0}%`} hint="1ª venda em até 30 dias" icon={Percent} loading={loading} accent="blue" />
        <StatCard title="MRR via parceiros" value={formatBRL(stats?.mrr_partners)} hint={`${share.toFixed(1)}% do MRR total (${formatBRL(stats?.mrr_total)})`} loading={loading} accent="green" />
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Clientes pagantes via parceiros" value={stats?.paying_partner_clients ?? 0} hint={`de ${stats?.paying_total ?? 0} pagantes no total`} loading={loading} />
        <StatCard title="Novos clientes (30d)" value={stats?.new_partner_clients_30d ?? 0} loading={loading} />
        <StatCard title="Comissões do mês" value={formatBRL(stats?.commissions_month)} loading={loading} />
        <StatCard title="Total já pago" value={formatBRL(stats?.paid_total)} loading={loading} />
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader><CardTitle className="text-base">Passivo de comissões</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">Em carência</span><span className="tabular-nums font-medium">{formatBRL(stats?.liability_holding)}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Disponível / solicitado</span><span className="tabular-nums font-medium">{formatBRL(stats?.liability_available)}</span></div>
            <p className="text-xs text-muted-foreground pt-2">Valores que o programa deve aos parceiros e ainda não foram pagos.</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base">Cancelamentos nos últimos 90 dias</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">Clientes de parceiros</span><span className="tabular-nums font-medium">{stats?.churn_partner_clients_90d ?? 0}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Clientes orgânicos</span><span className="tabular-nums font-medium">{stats?.churn_organic_90d ?? 0}</span></div>
            <p className="text-xs text-muted-foreground pt-2">Compare com o tamanho de cada base: o canal de parceiros deve reter melhor que o orgânico.</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
