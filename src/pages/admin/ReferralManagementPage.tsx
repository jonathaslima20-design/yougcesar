import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Gift, DollarSign, Clock, CircleCheck as CheckCircle, Loader as Loader2, Settings, RefreshCw, Users, Wallet } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { formatCurrencyI18n } from '@/lib/i18n';
import { formatPixKey } from '@/lib/referralUtils';

interface ReferralSettings {
  id: string;
  commission_trimestral: number;
  commission_semestral: number;
  commission_anual: number;
  commission_type: string;
  commission_percentage: number;
  discount_percentage: number;
  allow_free_users: boolean;
  minimum_withdrawal_amount: number;
  is_active: boolean;
  share_message_whatsapp: string;
  share_message_telegram: string;
}

interface Commission {
  id: string;
  referrer_id: string;
  referred_user_id: string;
  plan_type: string;
  amount: number;
  status: string;
  created_at: string;
  paid_at: string | null;
  referrer_name: string;
  referrer_email: string;
  referred_name: string;
  referred_email: string;
  discount_applied: number | null;
  discount_percentage: number | null;
  original_plan_value: number | null;
  commission_percentage: number | null;
}

interface WithdrawalRequest {
  id: string;
  user_id: string;
  amount: number;
  pix_key: string;
  pix_key_type: string;
  status: string;
  admin_notes: string | null;
  created_at: string;
  processed_at: string | null;
  user_name: string;
  user_email: string;
}

export default function ReferralManagementPage() {
  const [settings, setSettings] = useState<ReferralSettings | null>(null);
  const [commissions, setCommissions] = useState<Commission[]>([]);
  const [withdrawals, setWithdrawals] = useState<WithdrawalRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [statusFilter, setStatusFilter] = useState('all');
  const [withdrawalFilter, setWithdrawalFilter] = useState('all');
  const [processDialog, setProcessDialog] = useState<{ open: boolean; withdrawal: WithdrawalRequest | null; action: 'approve' | 'reject' }>({ open: false, withdrawal: null, action: 'approve' });
  const [adminNotes, setAdminNotes] = useState('');

  const [summaryStats, setSummaryStats] = useState({
    totalReferrals: 0,
    pendingCommissions: 0,
    paidCommissions: 0,
    pendingWithdrawals: 0,
  });

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [settingsRes, commissionsRes, withdrawalsRes] = await Promise.all([
        supabase.from('referral_settings').select('*').limit(1).maybeSingle(),
        supabase.from('referral_commissions').select('*').order('created_at', { ascending: false }),
        supabase.from('withdrawal_requests').select('*').order('created_at', { ascending: false }),
      ]);

      if (settingsRes.data) setSettings(settingsRes.data);

      const commissionsData = commissionsRes.data || [];
      const withdrawalsData = withdrawalsRes.data || [];

      const referrerIds = [...new Set(commissionsData.map(c => c.referrer_id))];
      const referredIds = [...new Set(commissionsData.map(c => c.referred_user_id))];
      const withdrawalUserIds = [...new Set(withdrawalsData.map(w => w.user_id))];
      const allUserIds = [...new Set([...referrerIds, ...referredIds, ...withdrawalUserIds])];

      let usersMap = new Map<string, { name: string; email: string }>();
      if (allUserIds.length > 0) {
        const { data: usersData } = await supabase
          .from('users')
          .select('id, name, email')
          .in('id', allUserIds);
        for (const u of usersData || []) {
          usersMap.set(u.id, { name: u.name, email: u.email });
        }
      }

      const enrichedCommissions: Commission[] = commissionsData.map(c => ({
        ...c,
        referrer_name: usersMap.get(c.referrer_id)?.name || 'Desconhecido',
        referrer_email: usersMap.get(c.referrer_id)?.email || '',
        referred_name: usersMap.get(c.referred_user_id)?.name || 'Desconhecido',
        referred_email: usersMap.get(c.referred_user_id)?.email || '',
      }));

      const enrichedWithdrawals: WithdrawalRequest[] = withdrawalsData.map(w => ({
        ...w,
        user_name: usersMap.get(w.user_id)?.name || 'Desconhecido',
        user_email: usersMap.get(w.user_id)?.email || '',
      }));

      setCommissions(enrichedCommissions);
      setWithdrawals(enrichedWithdrawals);

      const totalPending = enrichedCommissions.filter(c => c.status === 'pending').reduce((s, c) => s + c.amount, 0);
      const totalPaid = enrichedCommissions.filter(c => c.status === 'paid').reduce((s, c) => s + c.amount, 0);
      const totalPendingWithdrawals = enrichedWithdrawals.filter(w => w.status === 'pending').reduce((s, w) => s + w.amount, 0);

      setSummaryStats({
        totalReferrals: enrichedCommissions.length,
        pendingCommissions: totalPending,
        paidCommissions: totalPaid,
        pendingWithdrawals: totalPendingWithdrawals,
      });
    } catch (error) {
      console.error('Error fetching referral data:', error);
      toast.error('Erro ao carregar dados de indicações');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const handleSaveSettings = async () => {
    if (!settings) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from('referral_settings')
        .update({
          commission_trimestral: settings.commission_trimestral,
          commission_semestral: settings.commission_semestral,
          commission_anual: settings.commission_anual,
          commission_type: settings.commission_type,
          commission_percentage: settings.commission_percentage,
          discount_percentage: settings.discount_percentage,
          allow_free_users: settings.allow_free_users,
          minimum_withdrawal_amount: settings.minimum_withdrawal_amount,
          is_active: settings.is_active,
          share_message_whatsapp: settings.share_message_whatsapp,
          share_message_telegram: settings.share_message_telegram,
          updated_at: new Date().toISOString(),
        })
        .eq('id', settings.id);
      if (error) throw error;
      toast.success('Configurações salvas com sucesso');
    } catch (error) {
      console.error('Error saving settings:', error);
      toast.error('Erro ao salvar configurações');
    } finally {
      setSaving(false);
    }
  };

  const handleProcessWithdrawal = async () => {
    const { withdrawal, action } = processDialog;
    if (!withdrawal) return;

    try {
      const { error } = await supabase
        .from('withdrawal_requests')
        .update({
          status: action === 'approve' ? 'approved' : 'rejected',
          admin_notes: adminNotes || null,
          processed_at: new Date().toISOString(),
        })
        .eq('id', withdrawal.id);
      if (error) throw error;

      toast.success(action === 'approve' ? 'Saque aprovado com sucesso' : 'Saque rejeitado');
      setProcessDialog({ open: false, withdrawal: null, action: 'approve' });
      setAdminNotes('');
      fetchAll();
    } catch (error) {
      console.error('Error processing withdrawal:', error);
      toast.error('Erro ao processar saque');
    }
  };

  const filteredCommissions = statusFilter === 'all'
    ? commissions
    : commissions.filter(c => c.status === statusFilter);

  const filteredWithdrawals = withdrawalFilter === 'all'
    ? withdrawals
    : withdrawals.filter(w => w.status === withdrawalFilter);

  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl page-title">Gestão de Indicações</h1>
          <p className="text-muted-foreground">Gerencie o programa de indicações e recompensas</p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchAll} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Atualizar
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        <SummaryCard title="Total de Indicações" value={summaryStats.totalReferrals} icon={Users} loading={loading} />
        <SummaryCard title="Comissões Pendentes" value={formatCurrencyI18n(summaryStats.pendingCommissions, 'BRL', 'pt-BR')} icon={Clock} loading={loading} accent="amber" />
        <SummaryCard title="Comissões Pagas" value={formatCurrencyI18n(summaryStats.paidCommissions, 'BRL', 'pt-BR')} icon={CheckCircle} loading={loading} accent="green" />
        <SummaryCard title="Saques Pendentes" value={formatCurrencyI18n(summaryStats.pendingWithdrawals, 'BRL', 'pt-BR')} icon={Wallet} loading={loading} accent={summaryStats.pendingWithdrawals > 0 ? 'amber' : undefined} />
      </div>

      <Tabs defaultValue="settings" className="space-y-4">
        <TabsList>
          <TabsTrigger value="settings" className="gap-2"><Settings className="h-4 w-4" /> Configurações</TabsTrigger>
          <TabsTrigger value="commissions" className="gap-2"><Gift className="h-4 w-4" /> Indicações</TabsTrigger>
          <TabsTrigger value="withdrawals" className="gap-2"><DollarSign className="h-4 w-4" /> Saques</TabsTrigger>
        </TabsList>

        {/* Settings Tab */}
        <TabsContent value="settings">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Configurações do Programa</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {loading || !settings ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between p-4 border rounded-lg">
                    <div>
                      <Label className="text-base font-medium">Programa Ativo</Label>
                      <p className="text-sm text-muted-foreground">Habilitar/desabilitar o programa de indicações</p>
                    </div>
                    <Switch
                      checked={settings.is_active}
                      onCheckedChange={(checked) => setSettings({ ...settings, is_active: checked })}
                    />
                  </div>

                  <div className="flex items-center justify-between p-4 border rounded-lg">
                    <div>
                      <Label className="text-base font-medium">Permitir Usuários Free</Label>
                      <p className="text-sm text-muted-foreground">Usuários sem plano ativo podem participar do programa</p>
                    </div>
                    <Switch
                      checked={settings.allow_free_users}
                      onCheckedChange={(checked) => setSettings({ ...settings, allow_free_users: checked })}
                    />
                  </div>

                  <div className="border rounded-lg p-4 space-y-4">
                    <div>
                      <Label className="text-base font-medium">Tipo de Comissão</Label>
                      <p className="text-sm text-muted-foreground mt-1">Escolha entre comissão fixa por plano ou percentual do valor</p>
                    </div>
                    <Select
                      value={settings.commission_type}
                      onValueChange={(v) => setSettings({ ...settings, commission_type: v })}
                    >
                      <SelectTrigger className="w-[240px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="fixed">Valor Fixo por Plano</SelectItem>
                        <SelectItem value="percentage">Percentual do Valor</SelectItem>
                      </SelectContent>
                    </Select>

                    {settings.commission_type === 'fixed' ? (
                      <div className="grid gap-4 md:grid-cols-3">
                        <div className="space-y-2">
                          <Label>Comissão Trimestral (R$)</Label>
                          <Input
                            type="number"
                            step="0.01"
                            value={settings.commission_trimestral}
                            onChange={(e) => setSettings({ ...settings, commission_trimestral: parseFloat(e.target.value) || 0 })}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Comissão Semestral (R$)</Label>
                          <Input
                            type="number"
                            step="0.01"
                            value={settings.commission_semestral}
                            onChange={(e) => setSettings({ ...settings, commission_semestral: parseFloat(e.target.value) || 0 })}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Comissão Anual (R$)</Label>
                          <Input
                            type="number"
                            step="0.01"
                            value={settings.commission_anual}
                            onChange={(e) => setSettings({ ...settings, commission_anual: parseFloat(e.target.value) || 0 })}
                          />
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        <div className="space-y-2 max-w-xs">
                          <Label>Percentual de Comissão (%)</Label>
                          <Input
                            type="number"
                            step="1"
                            min="1"
                            max="100"
                            value={settings.commission_percentage}
                            onChange={(e) => setSettings({ ...settings, commission_percentage: parseFloat(e.target.value) || 0 })}
                          />
                          <p className="text-xs text-muted-foreground">Mínimo de R$44,70 por comissão é aplicado automaticamente</p>
                        </div>
                        <div className="bg-muted/50 rounded-lg p-3 space-y-1">
                          <p className="text-xs font-medium text-muted-foreground">Previsão com {settings.commission_percentage}%:</p>
                          <div className="grid grid-cols-3 gap-2 text-xs">
                            <span>Trimestral (R$149): <strong>{formatCurrencyI18n(Math.max(149 * settings.commission_percentage / 100, 44.70), 'BRL', 'pt-BR')}</strong></span>
                            <span>Semestral (R$229): <strong>{formatCurrencyI18n(Math.max(229 * settings.commission_percentage / 100, 44.70), 'BRL', 'pt-BR')}</strong></span>
                            <span>Anual (R$336): <strong>{formatCurrencyI18n(Math.max(336 * settings.commission_percentage / 100, 44.70), 'BRL', 'pt-BR')}</strong></span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="border rounded-lg p-4 space-y-3">
                    <div>
                      <Label className="text-base font-medium">Desconto para Indicados</Label>
                      <p className="text-sm text-muted-foreground mt-1">Percentual de desconto que o usuário indicado recebe na compra</p>
                    </div>
                    <div className="space-y-2 max-w-xs">
                      <Label>Desconto (%)</Label>
                      <Input
                        type="number"
                        step="1"
                        min="0"
                        max="100"
                        value={settings.discount_percentage}
                        onChange={(e) => setSettings({ ...settings, discount_percentage: parseFloat(e.target.value) || 0 })}
                      />
                      <p className="text-xs text-muted-foreground">A comissão é calculada sobre o valor original, não sobre o valor com desconto</p>
                    </div>
                  </div>

                  <div className="space-y-2 max-w-xs">
                    <Label>Valor Mínimo para Saque (R$)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={settings.minimum_withdrawal_amount}
                      onChange={(e) => setSettings({ ...settings, minimum_withdrawal_amount: parseFloat(e.target.value) || 0 })}
                    />
                  </div>

                  <div className="border-t pt-6 space-y-4">
                    <div>
                      <Label className="text-base font-medium">Mensagens de Compartilhamento</Label>
                      <p className="text-sm text-muted-foreground mt-1">
                        Personalize as mensagens enviadas quando os usuarios compartilham o link de indicacao. Use <code className="bg-muted px-1 py-0.5 rounded text-xs">{'{link}'}</code> para inserir o link e <code className="bg-muted px-1 py-0.5 rounded text-xs">{'{codigo}'}</code> para o cupom.
                      </p>
                    </div>

                    <div className="space-y-2">
                      <Label>Mensagem para WhatsApp</Label>
                      <Textarea
                        value={settings.share_message_whatsapp}
                        onChange={(e) => setSettings({ ...settings, share_message_whatsapp: e.target.value })}
                        placeholder="Ex: Crie sua vitrine online no VitrineTurbo! Cadastre-se aqui: {link}"
                        rows={3}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Mensagem para Telegram</Label>
                      <Textarea
                        value={settings.share_message_telegram}
                        onChange={(e) => setSettings({ ...settings, share_message_telegram: e.target.value })}
                        placeholder="Ex: Crie sua vitrine online no VitrineTurbo! Cadastre-se aqui: {link}"
                        rows={3}
                      />
                    </div>
                  </div>

                  <Button onClick={handleSaveSettings} disabled={saving}>
                    {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    Salvar Configurações
                  </Button>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Commissions Tab */}
        <TabsContent value="commissions">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">Indicações Realizadas</CardTitle>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[160px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os status</SelectItem>
                  <SelectItem value="pending">Pendente</SelectItem>
                  <SelectItem value="paid">Pago</SelectItem>
                </SelectContent>
              </Select>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : filteredCommissions.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-12">Nenhuma indicação encontrada</p>
              ) : (
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Quem Indicou</TableHead>
                        <TableHead>Indicado</TableHead>
                        <TableHead>Plano</TableHead>
                        <TableHead>Valor</TableHead>
                        <TableHead>Desconto</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Data</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredCommissions.map(c => (
                        <TableRow key={c.id}>
                          <TableCell>
                            <div>
                              <p className="text-sm font-medium">{c.referrer_name}</p>
                              <p className="text-xs text-muted-foreground">{c.referrer_email}</p>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div>
                              <p className="text-sm font-medium">{c.referred_name}</p>
                              <p className="text-xs text-muted-foreground">{c.referred_email}</p>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-xs">{c.plan_type}</Badge>
                          </TableCell>
                          <TableCell className="font-medium">
                            <div>
                              <span>{formatCurrencyI18n(c.amount, 'BRL', 'pt-BR')}</span>
                              {c.commission_percentage && (
                                <p className="text-xs text-muted-foreground">{c.commission_percentage}%</p>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            {c.discount_applied ? (
                              <div>
                                <span className="text-sm">{formatCurrencyI18n(c.discount_applied, 'BRL', 'pt-BR')}</span>
                                {c.discount_percentage && (
                                  <p className="text-xs text-muted-foreground">{c.discount_percentage}%</p>
                                )}
                              </div>
                            ) : (
                              <span className="text-xs text-muted-foreground">-</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <CommissionStatusBadge status={c.status} />
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {format(new Date(c.created_at), 'dd/MM/yy', { locale: ptBR })}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Withdrawals Tab */}
        <TabsContent value="withdrawals">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">Solicitações de Saque</CardTitle>
              <Select value={withdrawalFilter} onValueChange={setWithdrawalFilter}>
                <SelectTrigger className="w-[160px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os status</SelectItem>
                  <SelectItem value="pending">Pendente</SelectItem>
                  <SelectItem value="approved">Aprovado</SelectItem>
                  <SelectItem value="rejected">Rejeitado</SelectItem>
                </SelectContent>
              </Select>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : filteredWithdrawals.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-12">Nenhuma solicitação de saque encontrada</p>
              ) : (
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Usuário</TableHead>
                        <TableHead>Valor</TableHead>
                        <TableHead>Chave Pix</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Data</TableHead>
                        <TableHead className="text-right">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredWithdrawals.map(w => (
                        <TableRow key={w.id}>
                          <TableCell>
                            <div>
                              <p className="text-sm font-medium">{w.user_name}</p>
                              <p className="text-xs text-muted-foreground">{w.user_email}</p>
                            </div>
                          </TableCell>
                          <TableCell className="font-medium">
                            {formatCurrencyI18n(w.amount, 'BRL', 'pt-BR')}
                          </TableCell>
                          <TableCell>
                            <div>
                              <p className="text-sm font-mono">{formatPixKey(w.pix_key, w.pix_key_type)}</p>
                              <p className="text-xs text-muted-foreground capitalize">{w.pix_key_type}</p>
                            </div>
                          </TableCell>
                          <TableCell>
                            <WithdrawalStatusBadge status={w.status} />
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {format(new Date(w.created_at), 'dd/MM/yy', { locale: ptBR })}
                          </TableCell>
                          <TableCell className="text-right">
                            {w.status === 'pending' && (
                              <div className="flex justify-end gap-1">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="text-green-600 border-green-300 hover:bg-green-50"
                                  onClick={() => { setProcessDialog({ open: true, withdrawal: w, action: 'approve' }); setAdminNotes(''); }}
                                >
                                  Aprovar
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="text-red-600 border-red-300 hover:bg-red-50"
                                  onClick={() => { setProcessDialog({ open: true, withdrawal: w, action: 'reject' }); setAdminNotes(''); }}
                                >
                                  Rejeitar
                                </Button>
                              </div>
                            )}
                            {w.admin_notes && (
                              <p className="text-xs text-muted-foreground mt-1 max-w-[200px] truncate" title={w.admin_notes}>
                                {w.admin_notes}
                              </p>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Process Withdrawal Dialog */}
      <AlertDialog open={processDialog.open} onOpenChange={(open) => !open && setProcessDialog({ open: false, withdrawal: null, action: 'approve' })}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {processDialog.action === 'approve' ? 'Aprovar Saque' : 'Rejeitar Saque'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {processDialog.action === 'approve'
                ? `Confirma a aprovação do saque de ${processDialog.withdrawal ? formatCurrencyI18n(processDialog.withdrawal.amount, 'BRL', 'pt-BR') : ''} para ${processDialog.withdrawal?.user_name}?`
                : `Confirma a rejeição do saque de ${processDialog.withdrawal ? formatCurrencyI18n(processDialog.withdrawal.amount, 'BRL', 'pt-BR') : ''} para ${processDialog.withdrawal?.user_name}?`
              }
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2 py-2">
            <Label>Observações (opcional)</Label>
            <Textarea
              value={adminNotes}
              onChange={(e) => setAdminNotes(e.target.value)}
              placeholder="Adicione uma observação sobre esta decisão..."
              rows={3}
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleProcessWithdrawal}
              className={processDialog.action === 'reject' ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90' : ''}
            >
              {processDialog.action === 'approve' ? 'Aprovar' : 'Rejeitar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function SummaryCard({ title, value, icon: Icon, loading, accent }: {
  title: string; value: React.ReactNode; icon: React.ComponentType<{ className?: string }>; loading: boolean; accent?: 'green' | 'amber';
}) {
  const accentColor = accent === 'green' ? 'text-green-600' : accent === 'amber' ? 'text-amber-600' : 'text-muted-foreground';
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-4">
        <CardTitle className="text-xs font-medium text-muted-foreground">{title}</CardTitle>
        <Icon className={`h-4 w-4 ${accentColor}`} />
      </CardHeader>
      <CardContent className="pt-0 px-4 pb-4">
        {loading ? <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /> : (
          <div className={`text-xl font-bold ${accent ? accentColor : ''}`}>{value}</div>
        )}
      </CardContent>
    </Card>
  );
}

function CommissionStatusBadge({ status }: { status: string }) {
  switch (status) {
    case 'pending': return <Badge variant="outline" className="text-xs border-amber-300 text-amber-600">Pendente</Badge>;
    case 'paid': return <Badge className="bg-green-500 text-xs">Pago</Badge>;
    default: return <Badge variant="outline" className="text-xs">{status}</Badge>;
  }
}

function WithdrawalStatusBadge({ status }: { status: string }) {
  switch (status) {
    case 'pending': return <Badge variant="outline" className="text-xs border-amber-300 text-amber-600">Pendente</Badge>;
    case 'approved': return <Badge className="bg-green-500 text-xs">Aprovado</Badge>;
    case 'rejected': return <Badge variant="destructive" className="text-xs">Rejeitado</Badge>;
    default: return <Badge variant="outline" className="text-xs">{status}</Badge>;
  }
}
