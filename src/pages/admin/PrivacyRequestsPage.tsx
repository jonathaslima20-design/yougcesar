import { useEffect, useState, useCallback } from 'react';
import { UserX, RefreshCw, Loader as Loader2, Search, ChevronDown, CircleCheck as CheckCircle2, Clock, TriangleAlert as AlertTriangle, Circle as XCircle, Eye } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';

// ── Types ──────────────────────────────────────────────────────────────────────

interface PrivacyRequest {
  id: string;
  name: string;
  email: string;
  request_type: string;
  message: string | null;
  status: string;
  created_at: string;
  updated_at: string;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const REQUEST_TYPE_LABELS: Record<string, string> = {
  delete_account: 'Excluir conta',
  correct_data: 'Corrigir dados',
  data_copy: 'Cópia dos dados',
  revoke_consent: 'Revogar consentimento',
  other: 'Outro',
};

const STATUS_CONFIG: Record<string, { label: string; variant: 'default' | 'secondary' | 'outline' | 'destructive'; icon: React.ReactNode }> = {
  pending:   { label: 'Pendente',    variant: 'secondary',    icon: <Clock className="h-3 w-3" /> },
  in_review: { label: 'Em análise',  variant: 'default',      icon: <Eye className="h-3 w-3" /> },
  completed: { label: 'Concluída',   variant: 'outline',      icon: <CheckCircle2 className="h-3 w-3" /> },
  rejected:  { label: 'Rejeitada',   variant: 'destructive',  icon: <XCircle className="h-3 w-3" /> },
};

const STATUS_OPTIONS = ['all', 'pending', 'in_review', 'completed', 'rejected'];

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.pending;
  return (
    <Badge variant={cfg.variant} className="gap-1 text-[11px]">
      {cfg.icon}
      {cfg.label}
    </Badge>
  );
}

// ── Detail Dialog ─────────────────────────────────────────────────────────────

interface DetailDialogProps {
  request: PrivacyRequest | null;
  onClose: () => void;
  onStatusChange: (id: string, status: string) => Promise<void>;
  updating: boolean;
}

function DetailDialog({ request, onClose, onStatusChange, updating }: DetailDialogProps) {
  if (!request) return null;

  return (
    <Dialog open onOpenChange={() => onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Solicitação de privacidade</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 text-sm">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-xs text-muted-foreground mb-0.5">Nome</p>
              <p className="font-medium text-foreground">{request.name}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-0.5">E-mail</p>
              <p className="font-medium text-foreground break-all">{request.email}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-0.5">Tipo</p>
              <p className="font-medium text-foreground">
                {REQUEST_TYPE_LABELS[request.request_type] ?? request.request_type}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-0.5">Recebida em</p>
              <p className="font-medium text-foreground">{formatDate(request.created_at)}</p>
            </div>
          </div>

          {request.message && (
            <div>
              <p className="text-xs text-muted-foreground mb-0.5">Mensagem</p>
              <p className="text-foreground whitespace-pre-wrap leading-relaxed border border-border rounded-lg px-3 py-2.5 bg-muted/30">
                {request.message}
              </p>
            </div>
          )}

          <div>
            <p className="text-xs text-muted-foreground mb-1.5">Atualizar status</p>
            <div className="flex flex-wrap gap-2">
              {['pending', 'in_review', 'completed', 'rejected'].map((s) => (
                <Button
                  key={s}
                  size="sm"
                  variant={request.status === s ? 'default' : 'outline'}
                  disabled={updating || request.status === s}
                  onClick={() => onStatusChange(request.id, s)}
                  className="h-8 text-xs"
                >
                  {updating && request.status !== s ? (
                    <Loader2 className="h-3 w-3 animate-spin mr-1" />
                  ) : null}
                  {STATUS_CONFIG[s]?.label ?? s}
                </Button>
              ))}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Fechar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function PrivacyRequestsPage() {
  const [requests, setRequests] = useState<PrivacyRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selected, setSelected] = useState<PrivacyRequest | null>(null);
  const [updating, setUpdating] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('privacy_requests')
      .select('*')
      .order('created_at', { ascending: false });
    setRequests(data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = requests.filter((r) => {
    const matchesStatus = statusFilter === 'all' || r.status === statusFilter;
    const q = search.toLowerCase();
    const matchesSearch =
      !q ||
      r.name.toLowerCase().includes(q) ||
      r.email.toLowerCase().includes(q) ||
      (REQUEST_TYPE_LABELS[r.request_type] ?? '').toLowerCase().includes(q);
    return matchesStatus && matchesSearch;
  });

  async function handleStatusChange(id: string, newStatus: string) {
    setUpdating(true);
    const { error } = await supabase
      .from('privacy_requests')
      .update({ status: newStatus, updated_at: new Date().toISOString() })
      .eq('id', id);

    if (error) {
      toast.error('Erro ao atualizar status');
    } else {
      toast.success('Status atualizado');
      setRequests((prev) =>
        prev.map((r) =>
          r.id === id ? { ...r, status: newStatus, updated_at: new Date().toISOString() } : r
        )
      );
      if (selected?.id === id) {
        setSelected((s) => s ? { ...s, status: newStatus } : s);
      }
    }
    setUpdating(false);
  }

  const counts = {
    total: requests.length,
    pending: requests.filter((r) => r.status === 'pending').length,
    in_review: requests.filter((r) => r.status === 'in_review').length,
    completed: requests.filter((r) => r.status === 'completed').length,
  };

  return (
    <div className="container mx-auto p-6 max-w-5xl space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl md:text-3xl page-title">Solicitações de privacidade</h1>
          <p className="text-muted-foreground mt-1">
            Gerencie as solicitações LGPD enviadas pelos usuários
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={load} disabled={loading} className="gap-2 shrink-0">
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Atualizar
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total', value: counts.total },
          { label: 'Pendentes', value: counts.pending, highlight: counts.pending > 0 },
          { label: 'Em análise', value: counts.in_review },
          { label: 'Concluídas', value: counts.completed },
        ].map((stat) => (
          <div
            key={stat.label}
            className={`rounded-xl border px-4 py-3 ${stat.highlight ? 'border-amber-300 bg-amber-50 dark:bg-amber-950/30' : 'border-border bg-muted/30'}`}
          >
            <p className={`text-2xl font-bold tracking-tight ${stat.highlight ? 'text-amber-700 dark:text-amber-400' : 'text-foreground'}`}>
              {loading ? '—' : stat.value}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome ou e-mail..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s === 'all' ? 'Todos os status' : (STATUS_CONFIG[s]?.label ?? s)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center gap-2 py-12 justify-center text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
              <span className="text-sm">Carregando solicitações...</span>
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center py-12 text-center gap-2">
              <UserX className="h-8 w-8 text-muted-foreground/50" />
              <p className="text-sm font-medium text-foreground">Nenhuma solicitação encontrada</p>
              <p className="text-xs text-muted-foreground">
                {requests.length > 0 ? 'Tente ajustar os filtros.' : 'Ainda não há solicitações registradas.'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome / E-mail</TableHead>
                    <TableHead className="hidden sm:table-cell">Tipo</TableHead>
                    <TableHead className="hidden md:table-cell">Recebida</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-16" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((req) => (
                    <TableRow key={req.id} className="cursor-pointer hover:bg-muted/30" onClick={() => setSelected(req)}>
                      <TableCell>
                        <p className="font-medium text-foreground text-sm">{req.name}</p>
                        <p className="text-xs text-muted-foreground">{req.email}</p>
                      </TableCell>
                      <TableCell className="hidden sm:table-cell text-sm text-muted-foreground">
                        {REQUEST_TYPE_LABELS[req.request_type] ?? req.request_type}
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-sm text-muted-foreground">
                        {formatDate(req.created_at)}
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={req.status} />
                      </TableCell>
                      <TableCell>
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                          <Eye className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {selected && (
        <DetailDialog
          request={selected}
          onClose={() => setSelected(null)}
          onStatusChange={handleStatusChange}
          updating={updating}
        />
      )}
    </div>
  );
}
