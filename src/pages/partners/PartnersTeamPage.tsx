import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Loader2, Plus, Trash2, UsersRound } from 'lucide-react';
import { usePartner } from '@/contexts/PartnerContext';
import { supabase } from '@/lib/supabase';
import { partnerApi } from '@/lib/partners/partnerApi';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { CopyButton, EmptyState, PageHeader, formatDate } from '@/components/partners/PartnerUi';

interface Member {
  id: string;
  user_id: string;
  team_role: 'manager' | 'operator';
  created_at: string;
  user?: { name: string; email: string; last_login_at: string | null; is_blocked: boolean };
}

const ROLE_INFO = {
  manager: { label: 'Gestor', description: 'Clientes, lojas, oportunidades e links. Não vê o financeiro.' },
  operator: { label: 'Operador', description: 'Vê os clientes e gerencia as lojas liberadas. Não cria lojas nem links.' },
};

interface AuditRow {
  id: string;
  action: string;
  created_at: string;
  actor_id: string | null;
  target_user_id: string | null;
}

const ACTION_LABELS: Record<string, string> = {
  store_created: 'criou uma loja',
  store_opened: 'abriu uma loja',
  invite_sent: 'enviou um convite',
  team_member_added: 'adicionou alguém à equipe',
  team_member_removed: 'removeu alguém da equipe',
  client_accepted_store: 'cliente assumiu a loja',
  store_access_granted: 'cliente liberou acesso',
  store_access_revoked: 'cliente revogou acesso',
  level_up: 'subiu de nível',
  level_down: 'mudou de nível',
  withdrawal_pay: 'saque pago',
  withdrawal_reject: 'saque recusado',
  client_reassigned: 'cliente transferido pelo suporte',
  partner_approved: 'parceria aprovada',
};

export default function PartnersTeamPage() {
  const { partnerId } = usePartner();
  const [members, setMembers] = useState<Member[] | null>(null);
  const [audit, setAudit] = useState<AuditRow[]>([]);
  const [names, setNames] = useState<Map<string, string>>(new Map());
  const [inviteOpen, setInviteOpen] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', team_role: 'operator' as 'manager' | 'operator' });
  const [saving, setSaving] = useState(false);
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!partnerId) return;
    const { data } = await supabase
      .from('partner_team_members')
      .select('id, user_id, team_role, created_at, user:users!partner_team_members_user_id_fkey(name, email, last_login_at, is_blocked)')
      .eq('partner_id', partnerId)
      .order('created_at');
    setMembers((data as unknown as Member[]) ?? []);
    const { data: log } = await supabase.from('partner_audit_log').select('id, action, created_at, actor_id, target_user_id').eq('partner_id', partnerId).order('created_at', { ascending: false }).limit(30);
    setAudit((log as AuditRow[]) ?? []);
    const ids = [...new Set((log ?? []).flatMap((r) => [r.actor_id, r.target_user_id]).filter(Boolean))] as string[];
    if (ids.length) {
      const { data: u } = await supabase.from('users').select('id, name').in('id', ids);
      setNames(new Map((u ?? []).map((x) => [x.id, x.name])));
    }
  }, [partnerId]);

  useEffect(() => {
    load();
  }, [load]);

  const invite = async () => {
    setSaving(true);
    try {
      const res = await partnerApi.inviteTeamMember(form);
      setInviteUrl(res.invite_url);
      setForm({ name: '', email: '', team_role: 'operator' });
      await load();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const changeRole = async (m: Member, role: 'manager' | 'operator') => {
    const { error } = await supabase.from('partner_team_members').update({ team_role: role }).eq('id', m.id);
    if (error) toast.error(error.message);
    else load();
  };

  const remove = async (m: Member) => {
    if (!confirm(`Remover ${m.user?.name ?? 'esta pessoa'} da equipe? O acesso dela será bloqueado.`)) return;
    try {
      await partnerApi.removeTeamMember(m.user_id);
      toast.success('Pessoa removida');
      load();
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  return (
    <div className="container mx-auto p-4 sm:p-6 space-y-6 max-w-5xl">
      <PageHeader
        title="Equipe"
        description="Dê acesso à sua equipe para operar as lojas da carteira. O financeiro continua só com você."
        actions={<Button onClick={() => { setInviteOpen(true); setInviteUrl(null); }}><Plus className="h-4 w-4 mr-2" />Convidar pessoa</Button>}
      />

      <div className="grid sm:grid-cols-2 gap-4">
        {Object.entries(ROLE_INFO).map(([key, info]) => (
          <Card key={key}><CardContent className="pt-5"><p className="font-medium">{info.label}</p><p className="text-sm text-muted-foreground mt-1">{info.description}</p></CardContent></Card>
        ))}
      </div>

      <Card>
        <CardContent className="p-0">
          {members === null ? (
            <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : members.length === 0 ? (
            <EmptyState icon={UsersRound} title="Só você por enquanto" description="Convide gestores e operadores para dividir o trabalho nas lojas." />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Pessoa</TableHead>
                    <TableHead>Papel</TableHead>
                    <TableHead>Último acesso</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {members.map((m) => (
                    <TableRow key={m.id}>
                      <TableCell>
                        <p className="font-medium">{m.user?.name}</p>
                        <p className="text-xs text-muted-foreground">{m.user?.email}</p>
                      </TableCell>
                      <TableCell>
                        <Select value={m.team_role} onValueChange={(v) => changeRole(m, v as Member['team_role'])}>
                          <SelectTrigger className="w-[140px] h-8"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="manager">Gestor</SelectItem>
                            <SelectItem value="operator">Operador</SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell className="text-sm">{m.user?.last_login_at ? formatDate(m.user.last_login_at) : 'Convite pendente'}</TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="sm" className="text-destructive" onClick={() => remove(m)} aria-label="Remover"><Trash2 className="h-4 w-4" /></Button>
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
        <CardHeader><CardTitle className="text-base">Histórico de ações</CardTitle></CardHeader>
        <CardContent>
          {audit.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma ação registrada ainda.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {audit.map((a) => (
                <li key={a.id} className="flex flex-wrap gap-x-2 border-b pb-2 last:border-0">
                  <span className="text-muted-foreground tabular-nums">{formatDate(a.created_at, { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</span>
                  <span className="font-medium">{a.actor_id ? names.get(a.actor_id) ?? 'Alguém' : 'Sistema'}</span>
                  <span>{ACTION_LABELS[a.action] ?? a.action}</span>
                  {a.target_user_id && a.target_user_id !== a.actor_id && <span className="text-muted-foreground">· {names.get(a.target_user_id) ?? ''}</span>}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{inviteUrl ? 'Convite criado' : 'Convidar pessoa'}</DialogTitle>
            <DialogDescription>{inviteUrl ? 'Envie este link para a pessoa definir a senha. Ele vale por 7 dias.' : 'A pessoa recebe um link para criar a senha e entrar no painel Partners.'}</DialogDescription>
          </DialogHeader>
          {inviteUrl ? (
            <div className="flex gap-2"><Input readOnly value={inviteUrl} className="font-mono text-xs" /><CopyButton value={inviteUrl} /></div>
          ) : (
            <div className="space-y-3">
              <div className="space-y-1.5"><Label>Nome</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
              <div className="space-y-1.5"><Label>E-mail</Label><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
              <div className="space-y-1.5">
                <Label>Papel</Label>
                <Select value={form.team_role} onValueChange={(v) => setForm({ ...form, team_role: v as 'manager' | 'operator' })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="manager">Gestor</SelectItem>
                    <SelectItem value="operator">Operador</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
          <DialogFooter>
            {inviteUrl ? (
              <Button onClick={() => setInviteOpen(false)}>Concluir</Button>
            ) : (
              <Button onClick={invite} disabled={saving || !form.name.trim() || !form.email.trim()}>{saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Criar convite</Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
