import { useState, useEffect, useCallback } from 'react';
import { Bell, Send, History, Search } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  fetchBroadcasts,
  createBroadcast,
  sendBroadcastNow,
  cancelBroadcast,
  estimateRecipients,
  searchUsersForBroadcast,
} from '@/lib/adminNotificationService';
import type {
  NotificationBroadcast,
  NotificationType,
  TargetAudience,
} from '@/types';

const NOTIFICATION_TYPES: { value: NotificationType; label: string }[] = [
  { value: 'subscription_expiring', label: 'Assinatura expirando' },
  { value: 'subscription_expired', label: 'Assinatura expirada' },
  { value: 'referral_signup', label: 'Indicacao - Cadastro' },
  { value: 'referral_upgrade', label: 'Indicacao - Upgrade' },
  { value: 'promotional_offer', label: 'Oferta promocional' },
  { value: 'novidades', label: 'Novidades' },
  { value: 'system', label: 'Sistema' },
];

const AUDIENCE_LABELS: Record<TargetAudience, string> = {
  all: 'Todos os usuarios',
  active: 'Plano ativo',
  expired: 'Plano expirado',
  free: 'Plano gratuito',
  specific: 'Usuarios especificos',
};

export default function NotificationSettingsPage() {
  return (
    <div className="container mx-auto p-4 md:p-6 space-y-6 max-w-6xl">
      <div className="flex items-center gap-3">
        <Bell className="h-6 w-6" />
        <div>
          <h1 className="text-2xl font-bold">Central de Notificacoes</h1>
          <p className="text-sm text-muted-foreground">Envie notificacoes manuais e acompanhe o historico de envios</p>
        </div>
      </div>

      <Tabs defaultValue="broadcast" className="space-y-6">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="broadcast" className="gap-1.5">
            <Send className="h-4 w-4" />
            <span className="hidden sm:inline">Enviar</span>
          </TabsTrigger>
          <TabsTrigger value="history" className="gap-1.5">
            <History className="h-4 w-4" />
            <span className="hidden sm:inline">Historico</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="broadcast">
          <BroadcastTab />
        </TabsContent>
        <TabsContent value="history">
          <HistoryTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ============= BROADCAST TAB =============
function BroadcastTab() {
  const { user } = useAuth();
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [notificationType, setNotificationType] = useState<NotificationType>('system');
  const [ctaLabel, setCtaLabel] = useState('');
  const [ctaUrl, setCtaUrl] = useState('');
  const [targetAudience, setTargetAudience] = useState<TargetAudience>('all');
  const [recipientEstimate, setRecipientEstimate] = useState(0);
  const [sending, setSending] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<{ id: string; name: string; email: string }[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<{ id: string; name: string; email: string }[]>([]);
  const [showConfirm, setShowConfirm] = useState(false);

  useEffect(() => {
    const loadEstimate = async () => {
      const count = await estimateRecipients(
        targetAudience,
        targetAudience === 'specific' ? selectedUsers.map(u => u.id) : undefined
      );
      setRecipientEstimate(count);
    };
    loadEstimate();
  }, [targetAudience, selectedUsers]);

  const handleSearch = async (q: string) => {
    setSearchQuery(q);
    if (q.length < 2) { setSearchResults([]); return; }
    try {
      const results = await searchUsersForBroadcast(q);
      setSearchResults(results.filter(r => !selectedUsers.some(s => s.id === r.id)));
    } catch { /* ignore */ }
  };

  const handleSend = async () => {
    if (!title.trim() || !message.trim()) { toast.error('Titulo e mensagem sao obrigatorios'); return; }
    setSending(true);
    try {
      const broadcast = await createBroadcast({
        title: title.trim(),
        message: message.trim(),
        notification_type: notificationType,
        cta_label: ctaLabel || null,
        cta_url: ctaUrl || null,
        target_audience: targetAudience,
        target_user_ids: targetAudience === 'specific' ? selectedUsers.map(u => u.id) : null,
        scheduled_at: null,
        status: 'draft',
        sent_by: user?.id,
      });

      const count = await sendBroadcastNow(broadcast.id);
      toast.success(`Notificacao enviada para ${count} usuario(s)`);

      setTitle('');
      setMessage('');
      setCtaLabel('');
      setCtaUrl('');
      setSelectedUsers([]);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Erro ao enviar');
    } finally {
      setSending(false);
      setShowConfirm(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-base">Enviar Notificacao</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-4">
              <div>
                <Label>Titulo</Label>
                <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="Titulo da notificacao" />
              </div>
              <div>
                <Label>Mensagem</Label>
                <Textarea value={message} onChange={e => setMessage(e.target.value)} placeholder="Corpo da mensagem..." rows={4} />
              </div>
              <div>
                <Label>Tipo</Label>
                <Select value={notificationType} onValueChange={(v) => setNotificationType(v as NotificationType)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {NOTIFICATION_TYPES.map(t => (
                      <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>CTA Label</Label>
                  <Input value={ctaLabel} onChange={e => setCtaLabel(e.target.value)} placeholder="Ex: Ver mais" />
                </div>
                <div>
                  <Label>CTA URL</Label>
                  <Input value={ctaUrl} onChange={e => setCtaUrl(e.target.value)} placeholder="Ex: /dashboard" />
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <Label>Audiencia</Label>
                <Select value={targetAudience} onValueChange={(v) => setTargetAudience(v as TargetAudience)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(Object.entries(AUDIENCE_LABELS) as [TargetAudience, string][]).map(([value, label]) => (
                      <SelectItem key={value} value={value}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground mt-1">
                  Estimativa: <span className="font-medium">{recipientEstimate}</span> destinatario(s)
                </p>
              </div>

              {targetAudience === 'specific' && (
                <div>
                  <Label>Buscar usuarios</Label>
                  <div className="relative">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      className="pl-9"
                      value={searchQuery}
                      onChange={e => handleSearch(e.target.value)}
                      placeholder="Nome ou email..."
                    />
                  </div>
                  {searchResults.length > 0 && (
                    <div className="mt-1 rounded-md border max-h-32 overflow-y-auto">
                      {searchResults.map(u => (
                        <button
                          key={u.id}
                          className="w-full px-3 py-1.5 text-left text-sm hover:bg-muted flex justify-between"
                          onClick={() => { setSelectedUsers(prev => [...prev, u]); setSearchResults([]); setSearchQuery(''); }}
                        >
                          <span>{u.name || u.email}</span>
                          <span className="text-muted-foreground text-xs">{u.email}</span>
                        </button>
                      ))}
                    </div>
                  )}
                  {selectedUsers.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {selectedUsers.map(u => (
                        <Badge key={u.id} variant="secondary" className="text-xs gap-1">
                          {u.name || u.email}
                          <button onClick={() => setSelectedUsers(prev => prev.filter(p => p.id !== u.id))} className="ml-0.5 hover:text-destructive">&times;</button>
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {title && message && (
                <div className="rounded-lg border p-3 bg-muted/30">
                  <p className="text-[11px] font-medium text-muted-foreground mb-1">Preview:</p>
                  <p className="text-sm font-medium">{title}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{message}</p>
                  {ctaLabel && (
                    <span className="inline-block mt-1.5 text-[11px] border rounded px-1.5 py-0.5">{ctaLabel}</span>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t">
            <Button
              onClick={() => setShowConfirm(true)}
              disabled={!title.trim() || !message.trim() || sending || recipientEstimate === 0}
            >
              <Send className="h-4 w-4 mr-1.5" />
              Enviar agora
            </Button>
          </div>
        </CardContent>
      </Card>

      <AlertDialog open={showConfirm} onOpenChange={setShowConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar envio</AlertDialogTitle>
            <AlertDialogDescription>
              Deseja enviar esta notificacao para {recipientEstimate} usuario(s) agora?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleSend} disabled={sending}>
              {sending ? 'Enviando...' : 'Confirmar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ============= HISTORY TAB =============
function HistoryTab() {
  const [broadcasts, setBroadcasts] = useState<NotificationBroadcast[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);

  const loadBroadcasts = useCallback(async () => {
    try {
      setLoading(true);
      const { data, count } = await fetchBroadcasts(page);
      setBroadcasts(data);
      setTotal(count);
    } catch {
      toast.error('Erro ao carregar historico');
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => { loadBroadcasts(); }, [loadBroadcasts]);

  const handleCancel = async (id: string) => {
    try {
      await cancelBroadcast(id);
      loadBroadcasts();
      toast.success('Agendamento cancelado');
    } catch {
      toast.error('Erro ao cancelar');
    }
  };

  const statusBadge = (status: string) => {
    const map: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
      draft: { label: 'Rascunho', variant: 'secondary' },
      scheduled: { label: 'Agendado', variant: 'outline' },
      sending: { label: 'Enviando', variant: 'default' },
      sent: { label: 'Enviado', variant: 'default' },
      failed: { label: 'Falhou', variant: 'destructive' },
    };
    const config = map[status] || map.draft;
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  if (loading) {
    return <div className="space-y-4">{[1,2,3].map(i => <Skeleton key={i} className="h-12 rounded-lg" />)}</div>;
  }

  return (
    <div className="space-y-4">
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Data</TableHead>
              <TableHead>Titulo</TableHead>
              <TableHead>Audiencia</TableHead>
              <TableHead>Enviados</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-[80px]">Acao</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {broadcasts.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                  Nenhum envio registrado
                </TableCell>
              </TableRow>
            ) : (
              broadcasts.map(b => (
                <TableRow key={b.id}>
                  <TableCell className="text-sm">
                    {new Date(b.sent_at || b.scheduled_at || b.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                  </TableCell>
                  <TableCell className="font-medium text-sm max-w-[200px] truncate">{b.title}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-xs">{AUDIENCE_LABELS[b.target_audience]}</Badge>
                  </TableCell>
                  <TableCell className="text-sm">{b.recipients_count}</TableCell>
                  <TableCell>{statusBadge(b.status)}</TableCell>
                  <TableCell>
                    {b.status === 'scheduled' && (
                      <Button variant="ghost" size="sm" className="text-xs h-7" onClick={() => handleCancel(b.id)}>
                        Cancelar
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {total > 20 && (
        <div className="flex justify-center gap-2">
          <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(p => p - 1)}>
            Anterior
          </Button>
          <Button variant="outline" size="sm" disabled={(page + 1) * 20 >= total} onClick={() => setPage(p => p + 1)}>
            Proximo
          </Button>
        </div>
      )}
    </div>
  );
}
