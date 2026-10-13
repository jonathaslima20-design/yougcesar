import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useReferralData } from '@/hooks/useReferralData';
import { logActivity } from '@/lib/activityLogger';
import { formatCurrencyI18n } from '@/lib/i18n';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Gift, Users, DollarSign, TrendingUp,
  Share2, UserPlus, MousePointerClick, CreditCard, Copy,
  CircleAlert as AlertCircle, FileText, Ticket, Wallet, Info, Check, Hourglass,
} from 'lucide-react';
import { toast } from 'sonner';
import PixKeyDialog from '@/components/referral/PixKeyDialog';
import WithdrawalDialog from '@/components/referral/WithdrawalDialog';
import type { ReferredUser } from '@/hooks/useReferralData';

function maskEmail(email: string): string {
  const [local, domain] = email.split('@');
  if (!domain) return email;
  const visible = local.substring(0, 2);
  return `${visible}***@${domain}`;
}

function getReferralTypeBadge(type: 'direct' | 'trial') {
  return type === 'trial'
    ? <Badge variant="outline" className="border-violet-300 text-violet-700 dark:border-violet-800 dark:text-violet-400">Teste 15 dias</Badge>
    : <Badge variant="outline">Indicação Direta</Badge>;
}

function getReferredStatusBadge(referred: ReferredUser) {
  switch (referred.plan_status) {
    case 'active':
      return <Badge className="bg-emerald-600 hover:bg-emerald-600">Plano ativo</Badge>;
    case 'free':
      return <Badge variant="secondary">Grátis</Badge>;
    case 'trial':
      return (
        <Badge variant="secondary" className="bg-violet-100 text-violet-700 dark:bg-violet-950/40 dark:text-violet-400">
          Em teste · faltam {referred.days_left ?? 0} {referred.days_left === 1 ? 'dia' : 'dias'}
        </Badge>
      );
    case 'trial_expired':
      return <Badge variant="destructive">Teste expirado</Badge>;
    case 'expired':
      return <Badge variant="destructive">Expirado</Badge>;
    case 'suspended':
      return <Badge variant="destructive">Suspenso</Badge>;
    default:
      return <Badge variant="secondary">Aguardando pagamento</Badge>;
  }
}

function getCommissionBadge(status: string | null) {
  if (!status) return <span className="text-muted-foreground text-sm">—</span>;
  if (status === 'paid') return <Badge className="bg-emerald-600 hover:bg-emerald-600">Paga</Badge>;
  return <Badge variant="secondary">Pendente</Badge>;
}

export default function ReferralPage() {
  const { user } = useAuth();
  const { stats, pixKeys, referralLink, trialReferralLink, clickCount, referredUsers, isLoading, refreshData, error } = useReferralData(user?.id);
  const [showPixDialog, setShowPixDialog] = useState(false);
  const [showWithdrawalDialog, setShowWithdrawalDialog] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedTrialLink, setCopiedTrialLink] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);

  const referralCode = referralLink ? referralLink.split('ref=')[1] || '' : '';

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(referralLink);
      setCopiedLink(true);
      toast.success('Link copiado!');
      logActivity('referral.copy_link', 'Copiou o link de indicação', 'referral');
      setTimeout(() => setCopiedLink(false), 2000);
    } catch {
      toast.error('Erro ao copiar link');
    }
  };

  const copyTrialLinkToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(trialReferralLink);
      setCopiedTrialLink(true);
      toast.success('Link de teste copiado!');
      logActivity('referral.copy_trial_link', 'Copiou o link de indicação com teste de 15 dias', 'referral');
      setTimeout(() => setCopiedTrialLink(false), 2000);
    } catch {
      toast.error('Erro ao copiar link');
    }
  };

  const copyCodeToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(referralCode);
      setCopiedCode(true);
      toast.success('Código copiado!');
      logActivity('referral.copy_code', 'Copiou o código/cupom de indicação', 'referral');
      setTimeout(() => setCopiedCode(false), 2000);
    } catch {
      toast.error('Erro ao copiar código');
    }
  };

  if (isLoading) {
    return (
      <div className="container mx-auto p-4 md:p-6 space-y-6 max-w-5xl">
        <Skeleton className="h-24 w-full rounded-xl" />
        <div className="grid gap-4 md:grid-cols-2">
          <Skeleton className="h-32 rounded-xl" />
          <Skeleton className="h-32 rounded-xl" />
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  if (error && !referralLink) {
    return (
      <div className="container mx-auto p-4 md:p-6 space-y-6 max-w-5xl">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            {error || 'Não foi possível gerar seu link de indicação. Por favor, recarregue a página.'}
          </AlertDescription>
        </Alert>
        <Button onClick={refreshData} className="w-full max-w-md mx-auto block">
          Tentar Novamente
        </Button>
      </div>
    );
  }

  const withdrawalMin = 50;
  const available = stats?.availableForWithdrawal || 0;
  const withdrawalProgress = Math.min((available / withdrawalMin) * 100, 100);

  return (
    <TooltipProvider>
      <div className="container mx-auto p-4 md:p-6 space-y-8 max-w-5xl">
        {/* Hero */}
        <div className="relative overflow-hidden rounded-2xl bg-foreground text-background px-6 py-10 sm:px-10 sm:py-12">
          <div className="pointer-events-none absolute -top-16 -right-16 w-56 h-56 rounded-full bg-background/10 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-20 -left-10 w-48 h-48 rounded-full bg-background/5 blur-3xl" />

          <div className="relative text-center space-y-2 mb-8">
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Indique e Ganhe</h1>
            <p className="text-background/70 max-w-lg mx-auto text-sm sm:text-base">
              Compartilhe o VitrineTurbo e ganhe comissão por cada indicação que assinar um plano
            </p>
          </div>

          <div className="relative grid grid-cols-2 max-w-sm mx-auto divide-x divide-background/15">
            <div className="text-center px-4">
              <div className="text-4xl sm:text-5xl font-bold tracking-tight">30%</div>
              <div className="text-xs sm:text-sm text-background/70 mt-1.5 flex items-center justify-center gap-1.5">
                <DollarSign className="h-3.5 w-3.5" /> você ganha
              </div>
            </div>
            <div className="text-center px-4">
              <div className="text-4xl sm:text-5xl font-bold tracking-tight">20%</div>
              <div className="text-xs sm:text-sm text-background/70 mt-1.5 flex items-center justify-center gap-1.5">
                <Ticket className="h-3.5 w-3.5" /> indicado ganha
              </div>
            </div>
          </div>
        </div>

        {/* Link principal */}
        <Card className="border-2 border-foreground/10 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Share2 className="h-5 w-5" />
              Seu Link de Indicação
              <Tooltip>
                <TooltipTrigger asChild>
                  <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-[220px]">
                  <p>O indicado se cadastra e precisa contratar um plano para liberar o acesso. Também presente no logo VitrineTurbo no rodapé do seu catálogo.</p>
                </TooltipContent>
              </Tooltip>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2">
              <Input
                value={referralLink}
                readOnly
                className="font-mono text-sm h-11"
              />
              <Button
                onClick={copyToClipboard}
                size="lg"
                className="shrink-0 min-w-[110px] h-11 transition-all duration-200"
                variant={copiedLink ? 'secondary' : 'default'}
              >
                {copiedLink ? (
                  <>
                    <Check className="h-4 w-4 mr-1" />
                    Copiado
                  </>
                ) : (
                  <>
                    <Copy className="h-4 w-4 mr-1" />
                    Copiar
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Link de teste + Cupom (secundários) */}
        <div className="grid md:grid-cols-2 gap-4">
          <Card className="transition-all duration-200 hover:shadow-md border-violet-200 dark:border-violet-900">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Hourglass className="h-4 w-4 text-violet-600 dark:text-violet-400" />
                Link de Teste (15 dias)
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent side="top" className="max-w-[240px]">
                    <p>Seu indicado usa a plataforma de graça por 15 dias, sem pagar nada. A comissão é sua do mesmo jeito, quando ele assinar um plano.</p>
                  </TooltipContent>
                </Tooltip>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex gap-2">
                <Input
                  value={trialReferralLink}
                  readOnly
                  className="font-mono text-xs"
                />
                <Button
                  onClick={copyTrialLinkToClipboard}
                  className="shrink-0 min-w-[90px] transition-all duration-200 bg-violet-600 hover:bg-violet-700 text-white"
                  variant={copiedTrialLink ? 'secondary' : 'default'}
                >
                  {copiedTrialLink ? (
                    <>
                      <Check className="h-4 w-4 mr-1" />
                      Copiado
                    </>
                  ) : (
                    <>
                      <Copy className="h-4 w-4 mr-1" />
                      Copiar
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="transition-all duration-200 hover:shadow-md">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Ticket className="h-4 w-4" />
                Seu Cupom de Desconto
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <div className="flex-1 rounded-lg bg-muted px-4 py-2.5 text-center">
                  <span className="text-xl font-bold font-mono tracking-widest">{referralCode}</span>
                </div>
                <Button
                  onClick={copyCodeToClipboard}
                  variant={copiedCode ? 'secondary' : 'outline'}
                  className="shrink-0 min-w-[90px] transition-all duration-200"
                >
                  {copiedCode ? (
                    <>
                      <Check className="h-4 w-4 mr-1" />
                      Copiado
                    </>
                  ) : (
                    <>
                      <Copy className="h-4 w-4 mr-1" />
                      Copiar
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* How it Works - Minimal Timeline */}
        <div className="py-2">
          <div className="flex items-center gap-2 mb-4">
            <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">Como funciona</h2>
          </div>
          <div className="relative">
            <div className="hidden md:block absolute top-[18px] left-[12.5%] right-[12.5%] h-px bg-border" />
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 relative">
              {[
                { num: '1', icon: Share2, label: 'Compartilhe', desc: 'Envie link ou código' },
                { num: '2', icon: Ticket, label: 'Desconto 20%', desc: 'Indicado ganha desconto' },
                { num: '3', icon: DollarSign, label: 'Comissão 30%', desc: 'Você recebe ao assinarem' },
                { num: '4', icon: Wallet, label: 'Saque PIX', desc: 'Retire quando quiser' },
              ].map((step) => (
                <div key={step.num} className="flex flex-col items-center text-center gap-2">
                  <div className="relative z-10 flex items-center justify-center w-9 h-9 rounded-full bg-foreground text-background text-sm font-bold ring-4 ring-background">
                    {step.num}
                  </div>
                  <span className="text-sm font-medium">{step.label}</span>
                  <span className="text-xs text-muted-foreground leading-tight">{step.desc}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Commission Reward Tiers */}
        <div>
          <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide mb-4">Sua comissão por plano</h2>
          <div className="grid md:grid-cols-3 gap-4">
            <Card className="transition-all duration-200 hover:shadow-md bg-muted/30">
              <CardContent className="pt-5 pb-5 text-center space-y-1.5">
                <div className="text-2xl font-bold text-muted-foreground">R$ 17,10</div>
                <div className="text-sm text-muted-foreground">Plano Mensal</div>
                <Badge variant="secondary" className="text-xs">30% de R$ 57</Badge>
              </CardContent>
            </Card>

            <Card className="transition-all duration-200 hover:shadow-md border-foreground/15">
              <CardContent className="pt-5 pb-5 text-center space-y-1.5">
                <div className="text-2xl font-bold">R$ 68,70</div>
                <div className="text-sm text-muted-foreground">Plano Semestral</div>
                <Badge variant="secondary" className="text-xs">30% de R$ 229</Badge>
              </CardContent>
            </Card>

            <Card className="transition-all duration-200 hover:shadow-lg relative bg-foreground text-background border-none">
              <div className="absolute -top-2.5 left-1/2 -translate-x-1/2">
                <Badge className="text-[10px] px-2 py-0.5 bg-background text-foreground hover:bg-background">Maior Retorno</Badge>
              </div>
              <CardContent className="pt-6 pb-6 text-center space-y-1.5">
                <div className="text-3xl font-bold">R$ 100,80</div>
                <div className="text-sm text-background/70">Plano Anual</div>
                <Badge variant="secondary" className="text-xs bg-background/15 text-background hover:bg-background/15">30% de R$ 336</Badge>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Metrics Section */}
        <section className="space-y-6">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-muted-foreground" />
            <h2 className="text-lg font-semibold">Minhas Métricas</h2>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-xs font-medium">Cliques no Link</CardTitle>
                <MousePointerClick className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{clickCount}</div>
                {clickCount > 0 && (
                  <p className="text-xs text-muted-foreground mt-1">
                    {Math.round((referredUsers.length / clickCount) * 100)}% viraram cadastro
                  </p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-xs font-medium">Total de Indicados</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{referredUsers.length}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  {stats?.activeReferrals || 0} com plano ativo
                  {referredUsers.length > 0 && ` (${Math.round(((stats?.activeReferrals || 0) / referredUsers.length) * 100)}%)`}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-xs font-medium">Comissões Totais</CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatCurrencyI18n(stats?.totalCommissions || 0, 'BRL', 'pt-BR')}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-xs font-medium">Disponível p/ Saque</CardTitle>
                <Wallet className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatCurrencyI18n(available, 'BRL', 'pt-BR')}</div>
              </CardContent>
            </Card>
          </div>

          {/* Referred Users Table */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Users className="h-4 w-4" />
                Seus Indicados
                {referredUsers.length > 0 && (
                  <Badge variant="secondary" className="text-xs ml-1">{referredUsers.length}</Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {referredUsers.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <UserPlus className="h-8 w-8 mx-auto mb-3 opacity-30" />
                  <p className="text-sm">Nenhum indicado ainda</p>
                  <p className="text-xs mt-1.5">
                    Copie seu link acima e comece a compartilhar
                  </p>
                </div>
              ) : (
                <>
                  {/* Mobile: stacked cards */}
                  <div className="md:hidden space-y-3">
                    {referredUsers.slice(0, 10).map((referred) => (
                      <div key={referred.id} className="rounded-lg border p-3 space-y-2.5">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="font-medium text-sm truncate">{referred.name || '\u2014'}</p>
                            <p className="text-xs text-muted-foreground truncate">{maskEmail(referred.email)}</p>
                          </div>
                          <span className="text-xs text-muted-foreground shrink-0">
                            {new Date(referred.created_at).toLocaleDateString('pt-BR')}
                          </span>
                        </div>
                        <div className="flex flex-wrap items-center gap-1.5">
                          {getReferralTypeBadge(referred.referral_type)}
                          {getReferredStatusBadge(referred)}
                          {getCommissionBadge(referred.commission_status)}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Desktop: table */}
                  <div className="hidden md:block rounded-md border overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Nome</TableHead>
                          <TableHead>Email</TableHead>
                          <TableHead>Cadastro</TableHead>
                          <TableHead>Tipo</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Comiss\u00e3o</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {referredUsers.slice(0, 10).map((referred) => (
                          <TableRow key={referred.id}>
                            <TableCell className="font-medium">{referred.name || '\u2014'}</TableCell>
                            <TableCell className="text-muted-foreground text-sm">{maskEmail(referred.email)}</TableCell>
                            <TableCell className="text-sm">
                              {new Date(referred.created_at).toLocaleDateString('pt-BR')}
                            </TableCell>
                            <TableCell>{getReferralTypeBadge(referred.referral_type)}</TableCell>
                            <TableCell>{getReferredStatusBadge(referred)}</TableCell>
                            <TableCell>{getCommissionBadge(referred.commission_status)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </section>

        {/* Withdrawal Section */}
        <section className="space-y-4">
          <div className="flex items-center gap-2">
            <Wallet className="h-5 w-5 text-muted-foreground" />
            <h2 className="text-lg font-semibold">Retirar Ganhos</h2>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <Card className="transition-all duration-200 hover:shadow-md">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <CreditCard className="h-4 w-4" />
                  Chave PIX
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {pixKeys.length > 0 ? (
                  <>
                    <div className="p-3 bg-muted rounded-lg">
                      <p className="text-sm font-medium">{pixKeys[0].holder_name}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {pixKeys[0].pix_key_type.toUpperCase()}: {pixKeys[0].pix_key}
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full"
                      onClick={() => setShowPixDialog(true)}
                    >
                      Editar Chave PIX
                    </Button>
                  </>
                ) : (
                  <>
                    <p className="text-sm text-muted-foreground">
                      Configure sua chave PIX para receber saques
                    </p>
                    <Button
                      className="w-full"
                      onClick={() => setShowPixDialog(true)}
                    >
                      <CreditCard className="h-4 w-4 mr-2" />
                      Configurar PIX
                    </Button>
                  </>
                )}
              </CardContent>
            </Card>

            <Card className="transition-all duration-200 hover:shadow-md">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <DollarSign className="h-4 w-4" />
                  Solicitar Saque
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="text-center py-2">
                  <div className="text-3xl font-bold">
                    {formatCurrencyI18n(available, 'BRL', 'pt-BR')}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">Disponível para saque</p>
                </div>

                {available < withdrawalMin && (
                  <div className="space-y-1.5">
                    <Progress value={withdrawalProgress} className="h-2" />
                    <p className="text-xs text-muted-foreground text-center">
                      Faltam {formatCurrencyI18n(withdrawalMin - available, 'BRL', 'pt-BR')} para o mínimo de R$ 50,00
                    </p>
                  </div>
                )}

                {available >= withdrawalMin ? (
                  <Button
                    className="w-full"
                    onClick={() => setShowWithdrawalDialog(true)}
                  >
                    <DollarSign className="h-4 w-4 mr-2" />
                    Solicitar Saque
                  </Button>
                ) : (
                  <Button className="w-full" disabled variant="secondary">
                    <DollarSign className="h-4 w-4 mr-2" />
                    Solicitar Saque
                  </Button>
                )}

                {pixKeys.length === 0 && (
                  <p className="text-xs text-center text-muted-foreground">
                    Configure sua chave PIX primeiro
                  </p>
                )}
              </CardContent>
            </Card>
          </div>
        </section>

        {/* Terms Link */}
        <div className="text-center pt-2 pb-4">
          <Link
            to="/termos-indicacoes"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <FileText className="h-4 w-4" />
            Termos e Condições do Programa de Indicações
          </Link>
        </div>

        {/* Dialogs */}
        <PixKeyDialog
          open={showPixDialog}
          onOpenChange={setShowPixDialog}
          onSuccess={refreshData}
          existingKey={pixKeys[0] || null}
        />

        <WithdrawalDialog
          open={showWithdrawalDialog}
          onOpenChange={setShowWithdrawalDialog}
          onSuccess={refreshData}
          availableAmount={stats?.availableForWithdrawal || 0}
          pixKeys={pixKeys}
          onConfigurePixKey={() => {
            setShowWithdrawalDialog(false);
            setShowPixDialog(true);
          }}
        />
      </div>
    </TooltipProvider>
  );
}
