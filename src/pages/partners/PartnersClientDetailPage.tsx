import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import {
  ArrowLeft,
  ExternalLink,
  Globe,
  KeyRound,
  Loader2,
  MessageCircle,
  Package,
  Send,
  ShieldAlert,
  ShieldCheck,
  ShoppingBag,
  Store,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { usePartner } from '@/contexts/PartnerContext';
import { supabase } from '@/lib/supabase';
import {
  COMMISSION_STATUS_LABELS,
  COMMISSION_TYPE_LABELS,
  HEALTH_LABELS,
  formatBRL,
  openClientStore,
  partnerApi,
  whatsappShareUrl,
  type PartnerClient,
  type PartnerCommission,
} from '@/lib/partners/partnerApi';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import PlanStatusBadge from '@/components/subscription/PlanStatusBadge';
import { CopyButton, PageHeader, ToneBadge, formatDate } from '@/components/partners/PartnerUi';
import type { BillingCycle, PlanStatus } from '@/types';

export function InviteLinkDialog({
  open,
  onOpenChange,
  url,
  clientName,
  whatsapp,
  partnerName,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  url: string;
  clientName: string;
  whatsapp?: string | null;
  partnerName?: string | null;
}) {
  const message = `Oi, ${clientName}! Sua loja no VitrineTurbo está pronta. Acesse este link para definir sua senha e assumir a conta (vale por 7 dias): ${url}${partnerName ? `\n\n${partnerName}` : ''}`;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Convite para o cliente</DialogTitle>
          <DialogDescription>Envie este link para {clientName}. Ele vale por 7 dias e só pode ser usado uma vez.</DialogDescription>
        </DialogHeader>
        <div className="flex gap-2">
          <Input readOnly value={url} className="font-mono text-xs" />
          <CopyButton value={url} />
        </div>
        <DialogFooter className="gap-2 sm:gap-0">
          <CopyButton value={message} label="Copiar mensagem" />
          <Button asChild>
            <a href={whatsappShareUrl(message, whatsapp)} target="_blank" rel="noopener noreferrer">
              <MessageCircle className="h-4 w-4 mr-2" />Enviar no WhatsApp
            </a>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function PartnersClientDetailPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const { isOwner, canManage, partnerId, profile } = usePartner();
  const [client, setClient] = useState<PartnerClient | null | undefined>(undefined);
  const [commissions, setCommissions] = useState<PartnerCommission[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ name: '', owner_name: '', whatsapp: '' });

  const load = useCallback(async () => {
    const all = await partnerApi.clients().catch(() => []);
    const found = all.find((c) => c.id === id) ?? null;
    setClient(found);
    if (found) setForm({ name: found.name, owner_name: found.owner_name ?? '', whatsapp: found.whatsapp ?? '' });
    if (isOwner && partnerId && found) {
      const list = await partnerApi.commissions(partnerId).catch(() => []);
      setCommissions(list.filter((c) => c.managed_user_id === found.id));
    }
  }, [id, isOwner, partnerId]);

  useEffect(() => {
    load();
  }, [load]);

  if (client === undefined) {
    return <div className="flex justify-center py-24"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }
  if (client === null) {
    return (
      <div className="container mx-auto p-6 text-center space-y-3">
        <p className="text-muted-foreground">Cliente não encontrado na sua carteira.</p>
        <Button asChild variant="outline"><Link to="/partners/clients">Voltar</Link></Button>
      </div>
    );
  }

  const run = async (key: string, fn: () => Promise<void>) => {
    setBusy(key);
    try {
      await fn();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const openStore = () => run('open', () => openClientStore(client.id, user?.email));
  const sendInvite = () =>
    run('invite', async () => {
      const { invite_url } = await partnerApi.sendInvite(client.id);
      setInviteUrl(invite_url);
    });
  const toggleBlock = () =>
    run('block', async () => {
      const { error } = await supabase.from('users').update({ is_blocked: !client.is_blocked }).eq('id', client.id);
      if (error) throw new Error(error.message.includes('support') ? 'Esta loja foi bloqueada pelo suporte VitrineTurbo e só ele pode desbloquear.' : error.message);
      toast.success(client.is_blocked ? 'Loja desbloqueada' : 'Loja bloqueada');
      await load();
    });
  const saveContact = () =>
    run('save', async () => {
      const { error } = await supabase
        .from('users')
        .update({ name: form.name.trim(), owner_name: form.owner_name.trim() || null, whatsapp: form.whatsapp.replace(/\D/g, '') || null })
        .eq('id', client.id);
      if (error) throw new Error(error.message);
      toast.success('Dados atualizados');
      setEditing(false);
      await load();
    });

  const health = HEALTH_LABELS[client.health];
  const storeUrl = client.slug ? `/${client.slug}` : null;

  return (
    <div className="container mx-auto p-4 sm:p-6 space-y-6 max-w-5xl">
      <Link to="/partners/clients" className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
        <ArrowLeft className="h-4 w-4" />Clientes
      </Link>
      <PageHeader
        title={client.name}
        description={[client.owner_name, client.email].filter(Boolean).join(' · ')}
        actions={
          <>
            {storeUrl && (
              <Button variant="outline" asChild>
                <a href={storeUrl} target="_blank" rel="noopener noreferrer"><ExternalLink className="h-4 w-4 mr-2" />Ver vitrine</a>
              </Button>
            )}
            {client.access_granted && !client.is_blocked && (
              <Button onClick={openStore} disabled={busy === 'open'}>
                {busy === 'open' ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Store className="h-4 w-4 mr-2" />}
                Gerenciar loja
              </Button>
            )}
          </>
        }
      />

      <div className="flex flex-wrap gap-2 items-center">
        <PlanStatusBadge status={client.plan_status as PlanStatus} billingCycle={(client.billing_cycle ?? undefined) as BillingCycle | undefined} trialEndsAt={client.trial_ends_at} />
        <ToneBadge tone={health.tone}>{health.label}</ToneBadge>
        {client.is_blocked && <ToneBadge tone="red">Bloqueada</ToneBadge>}
        {client.access_granted ? <ToneBadge tone="green"><ShieldCheck className="h-3.5 w-3.5" />Acesso de gestor liberado</ToneBadge> : <ToneBadge tone="muted"><ShieldAlert className="h-3.5 w-3.5" />Sem acesso de gestor</ToneBadge>}
      </div>

      {!client.client_accepted && canManage && (
        <Card className="border-sky-500/30 bg-sky-500/5">
          <CardContent className="pt-6 flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
            <div className="flex items-start gap-3">
              <KeyRound className="h-5 w-5 text-sky-600 shrink-0 mt-0.5" />
              <p className="text-sm">O cliente ainda não assumiu a loja. Quando a loja estiver pronta, envie o convite para ele definir a senha.</p>
            </div>
            <Button onClick={sendInvite} disabled={busy === 'invite'} variant="outline">
              {busy === 'invite' ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}Gerar convite
            </Button>
          </CardContent>
        </Card>
      )}
      {!client.access_granted && client.client_accepted && (
        <p className="text-sm text-muted-foreground">
          Para gerenciar esta loja, peça ao cliente para liberar o acesso de gestor em <em>Configurações da conta</em> no painel dele.
        </p>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Info icon={ShoppingBag} label="Plano" value={client.plan_name ?? '—'} hint={client.monthly_value ? `${formatBRL(client.monthly_value)}/mês` : undefined} />
        <Info icon={KeyRound} label={client.plan_status === 'trial' ? 'Fim do teste' : 'Próxima cobrança'} value={formatDate(client.plan_status === 'trial' ? client.trial_ends_at : client.next_payment_date)} />
        <Info icon={Package} label="Produtos" value={String(client.products_count)} hint={`${client.orders_30d} pedidos em 30 dias`} />
        <Info icon={Globe} label="Domínio próprio" value={client.has_custom_domain ? 'Ativo' : 'Não'} hint={`Último acesso: ${formatDate(client.last_login_at)}`} />
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Contato</CardTitle>
          {canManage && !editing && <Button variant="outline" size="sm" onClick={() => setEditing(true)}>Editar</Button>}
        </CardHeader>
        <CardContent>
          {editing ? (
            <div className="grid sm:grid-cols-3 gap-4">
              <div className="space-y-1.5"><Label>Nome da loja</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
              <div className="space-y-1.5"><Label>Responsável</Label><Input value={form.owner_name} onChange={(e) => setForm({ ...form, owner_name: e.target.value })} /></div>
              <div className="space-y-1.5"><Label>WhatsApp</Label><Input value={form.whatsapp} onChange={(e) => setForm({ ...form, whatsapp: e.target.value })} /></div>
              <div className="sm:col-span-3 flex gap-2">
                <Button onClick={saveContact} disabled={busy === 'save' || !form.name.trim()}>{busy === 'save' && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Salvar</Button>
                <Button variant="ghost" onClick={() => setEditing(false)}>Cancelar</Button>
              </div>
            </div>
          ) : (
            <div className="grid sm:grid-cols-3 gap-4 text-sm">
              <div><p className="text-muted-foreground">E-mail</p><p className="font-medium break-all">{client.email}</p></div>
              <div><p className="text-muted-foreground">WhatsApp</p><p className="font-medium">{client.whatsapp || '—'}</p></div>
              <div><p className="text-muted-foreground">Cliente desde</p><p className="font-medium">{formatDate(client.created_at)}</p></div>
            </div>
          )}
          {client.whatsapp && (
            <Button asChild variant="link" className="px-0 mt-2">
              <a href={whatsappShareUrl(`Oi, ${client.owner_name || client.name}!`, client.whatsapp)} target="_blank" rel="noopener noreferrer">
                <MessageCircle className="h-4 w-4 mr-1.5" />Conversar no WhatsApp
              </a>
            </Button>
          )}
        </CardContent>
      </Card>

      {isOwner && (
        <Card>
          <CardHeader><CardTitle className="text-base">Comissões deste cliente · {formatBRL(client.commission_total)}</CardTitle></CardHeader>
          <CardContent className="p-0">
            {commissions.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">Nenhuma comissão gerada ainda.</p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Liberação</TableHead>
                      <TableHead className="text-right">Valor</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {commissions.map((c) => (
                      <TableRow key={c.id}>
                        <TableCell>{formatDate(c.created_at)}</TableCell>
                        <TableCell>{COMMISSION_TYPE_LABELS[c.type]}{c.installment_total > 1 ? ` (${c.installment_number}/${c.installment_total})` : ''}</TableCell>
                        <TableCell>{COMMISSION_STATUS_LABELS[c.status]}</TableCell>
                        <TableCell>{formatDate(c.available_at)}</TableCell>
                        <TableCell className="text-right tabular-nums">{formatBRL(c.amount)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {canManage && (
        <Card>
          <CardHeader><CardTitle className="text-base">Zona de atenção</CardTitle></CardHeader>
          <CardContent className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">
              {client.is_blocked ? 'A loja está bloqueada: o cliente não consegue entrar e a vitrine fica indisponível.' : 'Bloquear impede o acesso do cliente ao painel até você desbloquear.'}
            </p>
            <Button variant={client.is_blocked ? 'default' : 'destructive'} onClick={toggleBlock} disabled={busy === 'block'}>
              {busy === 'block' && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {client.is_blocked ? 'Desbloquear loja' : 'Bloquear loja'}
            </Button>
          </CardContent>
        </Card>
      )}

      {inviteUrl && (
        <InviteLinkDialog
          open={!!inviteUrl}
          onOpenChange={(o) => !o && setInviteUrl(null)}
          url={inviteUrl}
          clientName={client.owner_name || client.name}
          whatsapp={client.whatsapp}
          partnerName={profile?.company_name}
        />
      )}
    </div>
  );
}

function Info({ icon: Icon, label, value, hint }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string; hint?: string }) {
  return (
    <Card>
      <CardContent className="pt-5">
        <Icon className="h-4 w-4 text-muted-foreground" />
        <p className="text-xs text-muted-foreground mt-2">{label}</p>
        <p className="font-semibold mt-0.5">{value}</p>
        {hint && <p className="text-xs text-muted-foreground mt-0.5">{hint}</p>}
      </CardContent>
    </Card>
  );
}
