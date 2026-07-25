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
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Award, DollarSign, Clock, CircleCheck as CheckCircle, Loader as Loader2, Settings, RefreshCw, Users, Wallet, Plus, Trash2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { formatCurrencyI18n } from '@/lib/i18n';
import { formatPixKey } from '@/lib/referralUtils';

interface PartnerSettings {
  id: string;
  is_active: boolean;
  renewal_commissions_enabled: boolean;
  minimum_withdrawal_amount: number;
  grace_period_days: number;
  self_referral_block: boolean;
}

interface CommissionTier {
  id: string;
  min_active_users: number;
  commission_percentage: number;
  label: string | null;
  is_active: boolean;
}

interface PartnerCommission {
  id: string;
  partner_id: string;
  managed_user_id: string;
  plan_name: string | null;
  amount: number;
  type: string;
  status: string;
  created_at: string;
  partner_name: string;
  partner_email: string;
  managed_user_name: string;
}

interface PartnerWithdrawal {
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

export default function PartnerManagementPage() {
  const [settings, setSettings] = useState<PartnerSettings | null>(null);
  const [tiers, setTiers] = useState<CommissionTier[]>([]);
  const [commissions, setCommissions] = useState<PartnerCommission[]>([]);
  const [withdrawals, setWithdrawals] = useState<PartnerWithdrawal[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingTiers, setSavingTiers] = useState(false);
  const [statusFilter, setStatusFilter] = useState('all');
  const [withdrawalFilter, setWithdrawalFilter] = useState('all');
  const [processDialog, setProcessDialog] = useState<{ open: boolean; withdrawal: PartnerWithdrawal | null; action: 'approve' | 'reject' }>({ open: false, withdrawal: null, action: 'approve' });
  const [adminNotes, setAdminNotes] = useState('');

  const [summaryStats, setSummaryStats] = useState({
    activePartners: 0,
    pendingCommissions: 0,
    paidCommissions: 0,
    pendingWithdrawals: 0,
  });

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [settingsRes, tiersRes, commissionsRes, withdrawalsRes, partnersRes] = await Promise.all([
        supabase.from('partner_settings').select('*').limit(1).maybeSingle(),
        supabase.from('partner_commission_tiers').select('*').order('min_active_users', { ascending: true }),
        supabase.from('partner_commissions').select('*').order('created_at', { ascending: false }),
        supabase.from('withdrawal_requests').select('*').eq('source', 'partner').order('created_at', { ascending: false }),
        supabase.from('users').select('id', { count: 'exact', head: true }).eq('role', 'partner').eq('is_blocked', false),
      ]);

      if (settingsRes.data) setSettings(settingsRes.data);
      setTiers(tiersRes.data || []);

      const commissionsData = commissionsRes.data || [];
      const withdrawalsData = withdrawalsRes.data || [];

      const partnerIds = [...new Set(commissionsData.map((c) => c.partner_id))];
      const managedIds = [...new Set(commissionsData.map((c) => c.managed_user_id))];
      const withdrawalUserIds = [...new Set(withdrawalsData.map((w) => w.user_id))];
      const allUserIds = [...new Set([...partnerIds, ...managedIds, ...withdrawalUserIds])];

      let usersMap = new Map<string, { name: string; email: string }>();
      if (allUserIds.length > 0) {
        const { data: usersData } = await supabase.from('users').select('id, name, email').in('id', allUserIds);
        for (const u of usersData || []) usersMap.set(u.id, { name: u.name, email: u.email });
      }

      const enrichedCommissions: PartnerCommission[] = commissionsData.map((c) => ({
        ...c,
        partner_name: usersMap.get(c.partner_id)?.name || 'Desconhecido',
        partner_email: usersMap.get(c.partner_id)?.email || '',
        managed_user_name: usersMap.get(c.managed_user_id)?.name || 'Desconhecido',
      }));

      const enrichedWithdrawals: PartnerWithdrawal[] = withdrawalsData.map((w) => ({
        ...w,
        user_name: usersMap.get(w.user_id)?.name || 'Desconhecido',
        user_email: usersMap.get(w.user_id)?.email || '',
      }));

      setCommissions(enrichedCommissions);
      setWithdrawals(enrichedWithdrawals);

      const totalPending = enrichedCommissions.filter((c) => c.status === 'pending').reduce((s, c) => s + Number(c.amount), 0);
      const totalPaid = enrichedCommissions.filter((c) => c.status === 'paid').reduce((s, c) => s + Number(c.amount), 0);
      const totalPendingWithdrawals = enrichedWithdrawals.filter((w) => w.status === 'pending').reduce((s, w) => s + Number(w.amount), 0);

      setSummaryStats({
        activePartners: partnersRes.count || 0,
        pendingCommissions: totalPending,
        paidCommissions: totalPaid,
        pendingWithdrawals: totalPendingWithdrawals,
      });
    } catch (error) {
      console.error('Error fetching partner data:', error);
      toast.error('Erro ao carregar dados de parceiros');
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
        .from('partner_settings')
        .update({
          is_active: settings.is_active,
          renewal_commissions_enabled: settings.renewal_commissions_enabled,
          minimum_withdrawal_amount: settings.minimum_withdrawal_amount,
          grace_period_days: settings.grace_period_days,
          self_referral_block: settings.self_referral_block,
          updated_at: new Date().toISOString(),
        })
        .eq('id', settings.id);
      if (error) throw error;
      toast.success('Configurações salvas com sucesso');
    } catch (error) {
      console.error('Error saving partner settings:', error);
      toast.error('Erro ao salvar configurações');
    } finally {
      setSaving(false);
    }
  };

  const handleAddTier = () => {
    setTiers((prev) => [
      ...prev,
      { id: `new-${Date.now()}`, min_active_users: 0, commission_percentage: 0, label: '', is_active: true },
    ]);
  };

  const handleTierChange = (id: string, field: keyof CommissionTier, value: string | number) => {
    setTiers((prev) => prev.map((t) => (t.id === id ? { ...t, [field]: value } : t)));
  };

  const handleSaveTiers = async () => {
    setSavingTiers(true);
    try {
      for (const tier of tiers) {
        if (tier.id.startsWith('new-')) {
          const { error } = await supabase.from('partner_commission_tiers').insert({
            min_active_users: tier.min_active_users,
            commission_percentage: tier.commission_percentage,
            label: tier.label || null,
            is_active: true,
          });
          if (error) throw error;
        } else {
          const { error } = await supabase
            .from('partner_commission_tiers')
            .update({
              min_active_users: tier.min_active_users,
              commission_percentage: tier.commission_percentage,
              label: tier.label || null,
              updated_at: new Date().toISOString(),
            })
            .eq('id', tier.id);
          if (error) throw error;
        }
      }
      toast.success('Tiers salvos com sucesso');
      fetchAll();
    } catch (error: any) {
      console.error('Error saving tiers:', error);
      toast.error(error.message || 'Erro ao salvar tiers');
    } finally {
      setSavingTiers(false);
    }
  };

  const handleRemoveTier = async (id: string) => {
    if (id.startsWith('new-')) {
      setTiers((prev) => prev.filter((t) => t.id !== id));
      return;
    }
    try {
      const { error } = await supabase.from('partner_commission_tiers').update({ is_active: false }).eq('id', id);
      if (error) throw error;
      toast.success('Tier removido');
      fetchAll();
    } catch (error) {
      console.error('Error removing tier:', error);
      toast.error('Erro ao remover tier');
    }
  };

  const handleMarkCommissionPaid = async (id: string) => {
    try {
      const { error } = await supabase
        .from('partner_commissions')
        .update({ status: 'paid', paid_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
      toast.success('Comissão marcada como paga');
      fetchAll();
    } catch (error) {
      console.error('Error marking commission paid:', error);
      toast.error('Erro ao atualizar comissão');
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

  const filteredCommissions = statusFilter === 'all' ? commissions : commissions.filter((c) => c.status === statusFilter);
  const filteredWithdrawals = withdrawalFilter === 'all' ? withdrawals : withdrawals.filter((w) => w.status === withdrawalFilter);

  const sortedTiers = [...tiers].sort((a, b) => a.min_active_users - b.min_active_users);

  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl page-title">Gestão de Partners</h1>
          <p className="text-muted-foreground">Gerencie o programa de parceiros e comissões recorrentes</p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchAll} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Atualizar
        </Button>
      </div>

      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        <SummaryCard title="Partners Ativos" value={summaryStats.activePartners} icon={Users} loading={loading} />
        <SummaryCard title="Comissões Pendentes" value={formatCurrencyI18n(summaryStats.pendingCommissions, 'BRL', 'pt-BR')} icon={Clock} loading={loading} accent="amber" />
        <SummaryCard title="Comissões Pagas" value={formatCurrencyI18n(summaryStats.paidCommissions, 'BRL', 'pt-BR')} icon={CheckCircle} loading={loading} accent="green" />
        <SummaryCard title="Saques Pendentes" value={formatCurrencyI18n(summaryStats.pendingWithdrawals, 'BRL', 'pt-BR')} icon={Wallet} loading={loading} accent={summaryStats.pendingWithdrawals > 0 ? 'amber' : undefined} />
      </div>

      <Tabs defaultValue="settings" className="space-y-4">
        <TabsList>
          <TabsTrigger value="settings" className="gap-2"><Settings className="h-4 w-4" /> Configurações</TabsTrigger>
          <TabsTrigger value="tiers" className="gap-2"><Award className="h-4 w-4" /> Tiers</TabsTrigger>
          <TabsTrigger value="commissions" className="gap-2"><DollarSign className="h-4 w-4" /> Comissões</TabsTrigger>
          <TabsTrigger value="withdrawals" className="gap-2"><Wallet className="h-4 w-4" /> Saques</TabsTrigger>
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
                      <p className="text-sm text-muted-foreground">Habilitar/desabilitar o programa de partners</p>
                    </div>
                    <Switch
                      checked={settings.is_active}
                      onCheckedChange={(checked) => setSettings({ ...settings, is_active: checked })}
                    />
                  </div>

                  <div className="flex items-center justify-between p-4 border rounded-lg">
                    <div>
                      <Label className="text-base font-medium">Comissões de Renovação</Label>
                      <p className="text-sm text-muted-foreground">Gerar comissão a cada renovação de assinatura (não só na primeira contratação)</p>
                    </div>
                    <Switch
                      checked={settings.renewal_commissions_enabled}
                      onCheckedChange={(checked) => setSettings({ ...settings, renewal_commissions_enabled: checked })}
                    />
                  </div>

                  <div className="flex items-center justify-between p-4 border rounded-lg">
                    <div>
                      <Label className="text-base font-medium">Bloquear Auto-indicação</Label>
                      <p className="text-sm text-muted-foreground">Impede que um parceiro receba comissão sobre a própria assinatura</p>
                    </div>
                    <Switch
                      checked={settings.self_referral_block}
                      onCheckedChange={(checked) => setSettings({ ...settings, self_referral_block: checked })}
                    />
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Valor Mínimo para Saque (R$)</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={settings.minimum_withdrawal_amount}
                        onChange={(e) => setSettings({ ...settings, minimum_withdrawal_amount: parseFloat(e.target.value) || 0 })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Período de Carência (dias)</Label>
                      <Input
                        type="number"
                        step="1"
                        min="0"
                        value={settings.grace_period_days}
                        onChange={(e) => setSettings({ ...settings, grace_period_days: parseInt(e.target.value) || 0 })}
                      />
                      <p className="text-xs text-muted-foreground">
                        Dias que um usuário com plano vencido ainda conta como "ativo" para o tier do parceiro
                      </p>
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

        {/* Tiers Tab */}
        <TabsContent value="tiers">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-base">Tiers de Comissão</CardTitle>
                <p className="text-sm text-muted-foreground mt-1">Quanto mais usuários ativos um parceiro tem, maior a taxa de comissão</p>
              </div>
              <Button variant="outline" size="sm" onClick={handleAddTier}>
                <Plus className="h-4 w-4 mr-2" />
                Adicionar Tier
              </Button>
            </CardHeader>
            <CardContent className="space-y-4">
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <>
                  {sortedTiers.length > 0 && (
                    <div className="bg-muted/50 rounded-lg p-3 text-xs text-muted-foreground">
                      {sortedTiers.map((t, i) => (
                        <span key={t.id}>
                          {i > 0 && ' · '}
                          {t.min_active_users}+ usuários → <strong>{t.commission_percentage}%</strong>
                        </span>
                      ))}
                    </div>
                  )}
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Rótulo</TableHead>
                        <TableHead>Mínimo de Usuários Ativos</TableHead>
                        <TableHead>Comissão (%)</TableHead>
                        <TableHead className="text-right">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sortedTiers.map((tier) => (
                        <TableRow key={tier.id}>
                          <TableCell>
                            <Input
                              value={tier.label || ''}
                              onChange={(e) => handleTierChange(tier.id, 'label', e.target.value)}
                              placeholder="Ex: Elite"
                              className="max-w-[160px]"
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              min="0"
                              value={tier.min_active_users}
                              onChange={(e) => handleTierChange(tier.id, 'min_active_users', parseInt(e.target.value) || 0)}
                              className="max-w-[120px]"
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              min="0"
                              max="100"
                              value={tier.commission_percentage}
                              onChange={(e) => handleTierChange(tier.id, 'commission_percentage', parseFloat(e.target.value) || 0)}
                              className="max-w-[120px]"
                            />
                          </TableCell>
                          <TableCell className="text-right">
                            <Button variant="ghost" size="icon" onClick={() => handleRemoveTier(tier.id)}>
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  <Button onClick={handleSaveTiers} disabled={savingTiers}>
                    {savingTiers && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    Salvar Tiers
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
              <CardTitle className="text-base">Comissões de Parceiros</CardTitle>
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
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : filteredCommissions.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-12">Nenhuma comissão encontrada</p>
              ) : (
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Parceiro</TableHead>
                        <TableHead>Usuário Gerenciado</TableHead>
                        <TableHead>Tipo</TableHead>
                        <TableHead>Valor</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Data</TableHead>
                        <TableHead className="text-right">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredCommissions.map((c) => (
                        <TableRow key={c.id}>
                          <TableCell>
                            <div>
                              <p className="text-sm font-medium">{c.partner_name}</p>
                              <p className="text-xs text-muted-foreground">{c.partner_email}</p>
                            </div>
                          </TableCell>
                          <TableCell className="text-sm">{c.managed_user_name}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-xs">{c.type === 'renewal' ? 'Renovação' : 'Nova'}</Badge>
                          </TableCell>
                          <TableCell className="font-medium">{formatCurrencyI18n(c.amount, 'BRL', 'pt-BR')}</TableCell>
                          <TableCell>
                            <CommissionStatusBadge status={c.status} />
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {format(new Date(c.created_at), 'dd/MM/yy', { locale: ptBR })}
                          </TableCell>
                          <TableCell className="text-right">
                            {c.status === 'pending' && (
                              <Button variant="outline" size="sm" onClick={() => handleMarkCommissionPaid(c.id)}>
                                Marcar como paga
                              </Button>
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
                        <TableHead>Parceiro</TableHead>
                        <TableHead>Valor</TableHead>
                        <TableHead>Chave Pix</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Data</TableHead>
                        <TableHead className="text-right">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredWithdrawals.map((w) => (
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
    case 'reversed': return <Badge variant="destructive" className="text-xs">Revertido</Badge>;
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
