import { useState, useMemo } from 'react';
import {
  Handshake, Plus, Copy, Pencil, Wallet, TrendingUp, Users, KeyRound, Lock,
  ChevronDown, ChevronUp, MousePointerClick, ShoppingBag, Percent, Award, FileText, ExternalLink, CreditCard,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useAffiliates, type Affiliate, type AffiliateCommissionRule } from '@/hooks/useAffiliates';
import { generateAffiliateLink } from '@/lib/affiliateUtils';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import AffiliateFormDialog from '@/components/affiliates/AffiliateFormDialog';
import ResetAffiliatePasswordDialog from '@/components/affiliates/ResetAffiliatePasswordDialog';
import RecordAffiliatePaymentDialog from '@/components/affiliates/RecordAffiliatePaymentDialog';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

const PAYMENT_FREQUENCY_LABELS: Record<Affiliate['payment_frequency'], string> = {
  weekly: 'Semanal',
  biweekly: 'Quinzenal',
  monthly: 'Mensal',
};

const PIX_KEY_TYPE_LABELS: Record<string, string> = {
  cpf: 'CPF',
  cnpj: 'CNPJ',
  email: 'E-mail',
  phone: 'Telefone',
  random: 'Aleatória',
};

interface AffiliateStats {
  clicks: number;
  orders: number;
}

export default function AffiliatesPage() {
  const { user } = useAuth();
  const {
    affiliates, commissions, payments, loading,
    createAffiliate, updateAffiliate, resetAffiliatePassword, toggleAffiliateStatus,
    fetchCommissionRules, saveCommissionRules, fetchAffiliateStats, recordAffiliatePayment,
  } = useAffiliates();

  const [formOpen, setFormOpen] = useState(false);
  const [editingAffiliate, setEditingAffiliate] = useState<Affiliate | null>(null);
  const [editingRules, setEditingRules] = useState<AffiliateCommissionRule[]>([]);
  const [resetPasswordAffiliate, setResetPasswordAffiliate] = useState<Affiliate | null>(null);
  const [payingAffiliate, setPayingAffiliate] = useState<Affiliate | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [statsById, setStatsById] = useState<Record<string, AffiliateStats>>({});
  const [loadingStatsId, setLoadingStatsId] = useState<string | null>(null);

  const affiliateNameById = useMemo(() => {
    const map = new Map<string, string>();
    affiliates.forEach(a => map.set(a.id, a.name));
    return map;
  }, [affiliates]);

  const commissionTotalByAffiliate = useMemo(() => {
    const map = new Map<string, number>();
    commissions
      .filter(c => c.status !== 'reversed')
      .forEach(c => map.set(c.affiliate_id || '', (map.get(c.affiliate_id || '') || 0) + Number(c.commission_amount)));
    return map;
  }, [commissions]);

  const ranking = useMemo(() => {
    return [...affiliates]
      .map(a => ({ affiliate: a, total: commissionTotalByAffiliate.get(a.id) || 0 }))
      .filter(r => r.total > 0)
      .sort((a, b) => b.total - a.total)
      .slice(0, 5);
  }, [affiliates, commissionTotalByAffiliate]);

  const stats = useMemo(() => {
    const activeCount = affiliates.filter(a => a.status === 'active').length;
    const pending = commissions.filter(c => c.status === 'pending').reduce((sum, c) => sum + Number(c.commission_amount), 0);
    const paid = commissions.filter(c => c.status === 'paid').reduce((sum, c) => sum + Number(c.commission_amount), 0);
    return { activeCount, pending, paid };
  }, [affiliates, commissions]);

  if (!user?.affiliate_program_enabled) {
    return (
      <div className="w-full px-4 sm:px-6 lg:px-8 xl:px-12 2xl:px-16 py-12">
        <div className="text-center max-w-md mx-auto">
          <div className="mx-auto w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-4">
            <Handshake className="h-8 w-8 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-semibold mb-1">Programa de afiliados indisponível</h3>
          <p className="text-muted-foreground text-sm">
            Esse módulo ainda não foi liberado para sua conta. Fale com o suporte do VitrineTurbo para habilitar.
          </p>
        </div>
      </div>
    );
  }

  const handleCreate = () => {
    setEditingAffiliate(null);
    setEditingRules([]);
    setFormOpen(true);
  };

  const handleEdit = async (affiliate: Affiliate) => {
    const rules = await fetchCommissionRules(affiliate.id);
    setEditingAffiliate(affiliate);
    setEditingRules(rules);
    setFormOpen(true);
  };

  const handleCopyLink = (affiliate: Affiliate) => {
    if (!user?.slug) return;
    navigator.clipboard.writeText(generateAffiliateLink(user.slug, affiliate.affiliate_code));
    toast.success('Link copiado');
  };

  const handleToggleStatus = async (affiliate: Affiliate, checked: boolean) => {
    try {
      await toggleAffiliateStatus(affiliate.id, checked ? 'active' : 'inactive');
      toast.success(checked ? 'Afiliado ativado' : 'Afiliado desativado');
    } catch (err: any) {
      toast.error(err.message || 'Erro ao atualizar status');
    }
  };

  const handleToggleExpand = async (affiliate: Affiliate) => {
    if (expandedId === affiliate.id) {
      setExpandedId(null);
      return;
    }
    setExpandedId(affiliate.id);
    if (!statsById[affiliate.id]) {
      setLoadingStatsId(affiliate.id);
      try {
        const stats = await fetchAffiliateStats(affiliate.id);
        setStatsById(prev => ({ ...prev, [affiliate.id]: stats }));
      } catch (err) {
        console.error('Error fetching affiliate stats:', err);
      } finally {
        setLoadingStatsId(null);
      }
    }
  };

  return (
    <div className="w-full px-4 sm:px-6 lg:px-8 xl:px-12 2xl:px-16 py-6 space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Afiliados</h1>
          <p className="text-muted-foreground text-sm mt-1">Cadastre afiliados e acompanhe comissões de vendas</p>
        </div>
        <Button onClick={handleCreate}>
          <Plus className="h-4 w-4 mr-2" />
          Novo afiliado
        </Button>
      </div>

      <Card className="border-primary/30 bg-primary/5">
        <CardContent className="pt-4 pb-4">
          <div className="flex items-start sm:items-center gap-3 flex-col sm:flex-row sm:justify-between">
            <div className="flex items-start gap-2">
              <KeyRound className="h-4 w-4 text-primary mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-medium">Onde o afiliado faz login</p>
                <p className="text-xs text-muted-foreground">
                  Envie este link para cada afiliado — é uma área separada do login do lojista.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <code className="text-xs bg-background px-2 py-1.5 rounded border">
                {window.location.origin}/afiliado/entrar
              </code>
              <Button
                size="icon"
                variant="outline"
                className="h-8 w-8 shrink-0"
                onClick={() => {
                  navigator.clipboard.writeText(`${window.location.origin}/afiliado/entrar`);
                  toast.success('Link copiado');
                }}
              >
                <Copy className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg"><Users className="h-5 w-5 text-primary" /></div>
              <div>
                <p className="text-2xl font-bold">{stats.activeCount}</p>
                <p className="text-xs text-muted-foreground">Afiliados ativos</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg"><Wallet className="h-5 w-5 text-primary" /></div>
              <div>
                <p className="text-2xl font-bold">{formatCurrency(stats.pending)}</p>
                <p className="text-xs text-muted-foreground">Comissão pendente</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg"><TrendingUp className="h-5 w-5 text-primary" /></div>
              <div>
                <p className="text-2xl font-bold">{formatCurrency(stats.paid)}</p>
                <p className="text-xs text-muted-foreground">Comissão já paga</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {ranking.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Award className="h-4 w-4" /> Ranking de afiliados
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {ranking.map((r, i) => (
              <div key={r.affiliate.id} className="flex items-center gap-3 py-1.5">
                <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${i === 0 ? 'bg-amber-400/90 text-amber-950' : 'bg-muted text-muted-foreground'}`}>
                  {i + 1}
                </span>
                <span className="flex-1 text-sm font-medium truncate">{r.affiliate.name}</span>
                <span className="text-sm font-semibold">{formatCurrency(r.total)}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-foreground" />
        </div>
      ) : affiliates.length === 0 ? (
        <div className="text-center py-16">
          <div className="mx-auto w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-4">
            <Handshake className="h-8 w-8 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-semibold mb-1">Nenhum afiliado cadastrado</h3>
          <p className="text-muted-foreground text-sm mb-4">Cadastre o primeiro afiliado para gerar o link de indicação dele</p>
          <Button onClick={handleCreate}><Plus className="h-4 w-4 mr-2" />Novo afiliado</Button>
        </div>
      ) : (
        <div className="space-y-3">
          {affiliates.map((affiliate) => {
            const affiliatePendingCommissions = commissions.filter(c => c.affiliate_id === affiliate.id && c.status === 'pending');
            const affiliatePending = affiliatePendingCommissions.reduce((sum, c) => sum + Number(c.commission_amount), 0);
            const isExpanded = expandedId === affiliate.id;
            const affStats = statsById[affiliate.id];
            const conversionRate = affStats && affStats.clicks > 0 ? (affStats.orders / affStats.clicks) * 100 : 0;

            return (
              <Card key={affiliate.id}>
                <CardContent className="p-4">
                  <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className="font-semibold">{affiliate.name}</span>
                        <Badge variant={affiliate.status === 'active' ? 'default' : 'secondary'} className="text-xs">
                          {affiliate.status === 'active' ? 'Ativo' : 'Inativo'}
                        </Badge>
                        <span className="font-mono text-xs text-muted-foreground">{affiliate.affiliate_code}</span>
                      </div>
                      <p className="text-sm text-muted-foreground truncate">{affiliate.email}</p>
                      <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground flex-wrap">
                        <span>Comissão geral: {affiliate.default_commission_percentage}%</span>
                        <span>Pendente: {formatCurrency(affiliatePending)}</span>
                        <span>Pagamento: {PAYMENT_FREQUENCY_LABELS[affiliate.payment_frequency]}</span>
                        <span>Desde {format(new Date(affiliate.created_at), "dd/MM/yyyy", { locale: ptBR })}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0 flex-wrap">
                      <Switch checked={affiliate.status === 'active'} onCheckedChange={(v) => handleToggleStatus(affiliate, v)} title={affiliate.status === 'active' ? 'Desativar' : 'Ativar'} />
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleCopyLink(affiliate)} title="Copiar link">
                        <Copy className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleEdit(affiliate)} title="Editar">
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setResetPasswordAffiliate(affiliate)} title="Redefinir senha">
                        <Lock className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleToggleExpand(affiliate)} title="Ver detalhes">
                        {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                      </Button>
                      {affiliatePending > 0 && (
                        <Button variant="outline" size="sm" onClick={() => setPayingAffiliate(affiliate)}>
                          Registrar pagamento
                        </Button>
                      )}
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="mt-4 pt-4 border-t grid grid-cols-2 sm:grid-cols-4 gap-3">
                      {loadingStatsId === affiliate.id ? (
                        <div className="col-span-2 sm:col-span-4 flex justify-center py-4">
                          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-foreground" />
                        </div>
                      ) : (
                        <>
                          <div className="flex items-center gap-2">
                            <MousePointerClick className="h-4 w-4 text-muted-foreground shrink-0" />
                            <div>
                              <p className="text-sm font-semibold">{affStats?.clicks ?? 0}</p>
                              <p className="text-[11px] text-muted-foreground">Cliques</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <ShoppingBag className="h-4 w-4 text-muted-foreground shrink-0" />
                            <div>
                              <p className="text-sm font-semibold">{affStats?.orders ?? 0}</p>
                              <p className="text-[11px] text-muted-foreground">Pedidos</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Percent className="h-4 w-4 text-muted-foreground shrink-0" />
                            <div>
                              <p className="text-sm font-semibold">{conversionRate.toFixed(1)}%</p>
                              <p className="text-[11px] text-muted-foreground">Conversão</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Wallet className="h-4 w-4 text-muted-foreground shrink-0" />
                            <div>
                              <p className="text-sm font-semibold">{formatCurrency(commissionTotalByAffiliate.get(affiliate.id) || 0)}</p>
                              <p className="text-[11px] text-muted-foreground">Comissão total</p>
                            </div>
                          </div>
                          <div className="col-span-2 sm:col-span-4 flex items-center gap-2 pt-1">
                            <CreditCard className="h-4 w-4 text-muted-foreground shrink-0" />
                            {affiliate.pix_key ? (
                              <div className="flex items-center gap-2 min-w-0">
                                <span className="text-xs text-muted-foreground shrink-0">
                                  Pix ({PIX_KEY_TYPE_LABELS[affiliate.pix_key_type || ''] || affiliate.pix_key_type}) — {affiliate.pix_holder_name}:
                                </span>
                                <span className="text-xs font-mono truncate">{affiliate.pix_key}</span>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-6 w-6 shrink-0"
                                  onClick={() => {
                                    navigator.clipboard.writeText(affiliate.pix_key || '');
                                    toast.success('Chave Pix copiada');
                                  }}
                                >
                                  <Copy className="h-3 w-3" />
                                </Button>
                              </div>
                            ) : (
                              <span className="text-xs text-muted-foreground">Afiliado ainda não cadastrou uma chave Pix.</span>
                            )}
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {commissions.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Extrato de comissões</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {commissions.slice(0, 50).map((c) => (
              <div key={c.id} className="flex items-center justify-between py-2 border-b last:border-0 text-sm">
                <div className="min-w-0">
                  <p className="font-medium truncate">{c.product_name_snapshot || 'Produto'}</p>
                  <p className="text-xs text-muted-foreground">
                    {c.affiliate_id ? affiliateNameById.get(c.affiliate_id) || 'Afiliado removido' : 'Afiliado removido'}
                    {' · '}{c.category_matched || 'comissão geral'}
                    {' · '}{format(new Date(c.created_at), "dd/MM/yyyy", { locale: ptBR })}
                  </p>
                </div>
                <div className="text-right shrink-0 ml-3">
                  <p className="font-semibold">{formatCurrency(c.commission_amount)}</p>
                  <Badge
                    variant={c.status === 'paid' ? 'default' : c.status === 'reversed' ? 'secondary' : 'outline'}
                    className="text-xs"
                  >
                    {c.status === 'paid' ? 'Paga' : c.status === 'reversed' ? 'Estornada' : 'Pendente'}
                  </Badge>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {payments.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <FileText className="h-4 w-4" /> Histórico de pagamentos
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {payments.map((p) => (
              <div key={p.id} className="flex items-center justify-between py-2 border-b last:border-0 text-sm">
                <div className="min-w-0">
                  <p className="font-medium truncate">
                    {p.affiliate_id ? affiliateNameById.get(p.affiliate_id) || 'Afiliado removido' : 'Afiliado removido'}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {format(new Date(p.paid_at), "dd/MM/yyyy", { locale: ptBR })}
                    {p.notes ? ` · ${p.notes}` : ''}
                  </p>
                </div>
                <div className="flex items-center gap-3 shrink-0 ml-3">
                  <span className="font-semibold">{formatCurrency(Number(p.total_amount))}</span>
                  {p.receipt_url && (
                    <a href={p.receipt_url} target="_blank" rel="noopener noreferrer" title="Ver comprovante">
                      <Button variant="ghost" size="icon" className="h-7 w-7">
                        <ExternalLink className="h-3.5 w-3.5" />
                      </Button>
                    </a>
                  )}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <AffiliateFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        affiliate={editingAffiliate}
        existingRules={editingRules}
        onCreate={createAffiliate}
        onUpdate={updateAffiliate}
        onSaveRules={saveCommissionRules}
      />

      <ResetAffiliatePasswordDialog
        open={!!resetPasswordAffiliate}
        onOpenChange={(open) => !open && setResetPasswordAffiliate(null)}
        affiliate={resetPasswordAffiliate}
        onReset={resetAffiliatePassword}
      />

      <RecordAffiliatePaymentDialog
        open={!!payingAffiliate}
        onOpenChange={(open) => !open && setPayingAffiliate(null)}
        affiliate={payingAffiliate}
        pendingCommissions={payingAffiliate ? commissions.filter(c => c.affiliate_id === payingAffiliate.id && c.status === 'pending') : []}
        onRecordPayment={recordAffiliatePayment}
      />
    </div>
  );
}
