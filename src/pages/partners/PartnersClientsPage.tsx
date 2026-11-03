import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Download, Loader2, Search, Store, Users } from 'lucide-react';
import { usePartner } from '@/contexts/PartnerContext';
import { formatBRL, HEALTH_LABELS, partnerApi, type ClientHealth, type PartnerClient } from '@/lib/partners/partnerApi';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import PlanStatusBadge from '@/components/subscription/PlanStatusBadge';
import { EmptyState, PageHeader, ToneBadge, formatDate } from '@/components/partners/PartnerUi';
import type { PlanStatus } from '@/types';

const ORIGIN_LABELS: Record<string, string> = {
  link: 'Link',
  coupon: 'Cupom',
  lead: 'Oportunidade',
  created: 'Criada por você',
  manual: 'Ajuste do suporte',
  legacy: 'Programa anterior',
  directory: 'Diretório',
};

function toCsv(rows: PartnerClient[], includeCommission: boolean) {
  const header = ['Loja', 'Responsável', 'E-mail', 'WhatsApp', 'Status', 'Plano', 'Valor mensal', 'Próxima cobrança', 'Produtos', 'Pedidos 30d', 'Saúde', 'Origem', 'Desde'];
  if (includeCommission) header.push('Comissão total');
  const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const lines = rows.map((c) => {
    const line = [
      c.name, c.owner_name, c.email, c.whatsapp, c.plan_status, c.plan_name, c.monthly_value ?? '', c.next_payment_date ?? '',
      c.products_count, c.orders_30d, HEALTH_LABELS[c.health].label, ORIGIN_LABELS[c.origin] ?? c.origin, c.created_at.slice(0, 10),
    ];
    if (includeCommission) line.push(c.commission_total ?? 0);
    return line.map(esc).join(';');
  });
  return [header.map(esc).join(';'), ...lines].join('\n');
}

export default function PartnersClientsPage() {
  const { isOwner, canManage } = usePartner();
  const [clients, setClients] = useState<PartnerClient[] | null>(null);
  const [search, setSearch] = useState('');
  const [health, setHealth] = useState<'all' | ClientHealth>('all');
  const [status, setStatus] = useState('all');
  const [origin, setOrigin] = useState('all');

  useEffect(() => {
    partnerApi.clients().then(setClients).catch(() => setClients([]));
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (clients ?? []).filter((c) => {
      if (health !== 'all' && c.health !== health) return false;
      if (status !== 'all' && c.plan_status !== status) return false;
      if (origin !== 'all' && c.origin !== origin) return false;
      if (q && ![c.name, c.owner_name, c.email, c.whatsapp, c.slug].join(' ').toLowerCase().includes(q)) return false;
      return true;
    });
  }, [clients, search, health, status, origin]);

  const exportCsv = () => {
    const blob = new Blob(['﻿' + toCsv(filtered, isOwner)], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `clientes-vitrineturbo-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="container mx-auto p-4 sm:p-6 space-y-6">
      <PageHeader
        title="Clientes"
        description="Todos os lojistas da sua carteira, com a saúde de cada loja."
        actions={
          <>
            <Button variant="outline" onClick={exportCsv} disabled={!filtered.length}>
              <Download className="h-4 w-4 mr-2" />Exportar
            </Button>
            {canManage && (
              <Button asChild>
                <Link to="/partners/new-store"><Store className="h-4 w-4 mr-2" />Nova loja</Link>
              </Button>
            )}
          </>
        }
      />

      <div className="flex flex-col lg:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-9" placeholder="Buscar por loja, nome, e-mail ou WhatsApp" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <div className="grid grid-cols-3 gap-2 lg:w-[540px]">
          <Select value={health} onValueChange={(v) => setHealth(v as typeof health)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Toda saúde</SelectItem>
              {Object.entries(HEALTH_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todo status</SelectItem>
              <SelectItem value="active">Ativo</SelectItem>
              <SelectItem value="trial">Em teste</SelectItem>
              <SelectItem value="trial_expired">Teste encerrado</SelectItem>
              <SelectItem value="expired">Vencido</SelectItem>
              <SelectItem value="inactive">Sem plano</SelectItem>
            </SelectContent>
          </Select>
          <Select value={origin} onValueChange={setOrigin}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Toda origem</SelectItem>
              {Object.entries(ORIGIN_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          {clients === null ? (
            <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : filtered.length === 0 ? (
            <EmptyState
              icon={Users}
              title={clients.length ? 'Nenhum cliente com esses filtros' : 'Sua carteira ainda está vazia'}
              description={clients.length ? undefined : 'Crie a primeira loja para um cliente ou compartilhe seu link.'}
              action={!clients.length && canManage ? <Button asChild><Link to="/partners/new-store">Criar primeira loja</Link></Button> : undefined}
            />
          ) : (
            <>
              <div className="hidden md:block overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Loja</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Saúde</TableHead>
                      <TableHead className="text-right">Valor mensal</TableHead>
                      <TableHead className="text-right">Produtos</TableHead>
                      <TableHead className="text-right">Pedidos 30d</TableHead>
                      {isOwner && <TableHead className="text-right">Comissão total</TableHead>}
                      <TableHead>Origem</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((c) => (
                      <TableRow key={c.id} className="cursor-pointer">
                        <TableCell>
                          <Link to={`/partners/clients/${c.id}`} className="block">
                            <p className="font-medium">{c.name}</p>
                            <p className="text-xs text-muted-foreground">{c.email}</p>
                          </Link>
                        </TableCell>
                        <TableCell><PlanStatusBadge status={c.plan_status as PlanStatus} /></TableCell>
                        <TableCell><ToneBadge tone={HEALTH_LABELS[c.health].tone}>{HEALTH_LABELS[c.health].label}</ToneBadge></TableCell>
                        <TableCell className="text-right tabular-nums">{c.monthly_value ? formatBRL(c.monthly_value) : '—'}</TableCell>
                        <TableCell className="text-right tabular-nums">{c.products_count}</TableCell>
                        <TableCell className="text-right tabular-nums">{c.orders_30d}</TableCell>
                        {isOwner && <TableCell className="text-right tabular-nums">{formatBRL(c.commission_total)}</TableCell>}
                        <TableCell className="text-xs text-muted-foreground">{ORIGIN_LABELS[c.origin] ?? c.origin}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <ul className="md:hidden divide-y">
                {filtered.map((c) => (
                  <li key={c.id}>
                    <Link to={`/partners/clients/${c.id}`} className="block p-4 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="font-medium truncate">{c.name}</p>
                          <p className="text-xs text-muted-foreground truncate">{c.email}</p>
                        </div>
                        <PlanStatusBadge status={c.plan_status as PlanStatus} />
                      </div>
                      <div className="flex flex-wrap gap-2 items-center text-xs text-muted-foreground">
                        <ToneBadge tone={HEALTH_LABELS[c.health].tone}>{HEALTH_LABELS[c.health].label}</ToneBadge>
                        <span>{c.products_count} produtos</span>
                        <span>{c.orders_30d} pedidos/30d</span>
                        <span>desde {formatDate(c.created_at)}</span>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
