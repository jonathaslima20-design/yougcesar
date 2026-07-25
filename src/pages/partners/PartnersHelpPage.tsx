import { useState, useEffect } from 'react';
import { Wallet, Clock, Link2, Landmark, MessageCircle, CircleCheck as CheckCircle2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { usePartnerCommissionStats } from '@/hooks/usePartnerCommissionStats';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { formatCurrencyI18n } from '@/lib/i18n';

interface PartnerRules {
  payment_deadline_hours: number;
  grace_period_days: number;
  self_referral_block: boolean;
  renewal_commissions_enabled: boolean;
}

export default function PartnersHelpPage() {
  const { user } = useAuth();
  const { tiers, currentTier, activeUserCount, minimumWithdrawalAmount, loading: statsLoading } = usePartnerCommissionStats(user?.id);
  const [rules, setRules] = useState<PartnerRules | null>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('partner_settings')
        .select('payment_deadline_hours, grace_period_days, self_referral_block, renewal_commissions_enabled')
        .limit(1)
        .maybeSingle();
      setRules(data);
    })();
  }, []);

  return (
    <div className="container mx-auto p-6 max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Central de Ajuda</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Como funciona o programa VitrineTurbo Partners — comissões, prazos e regras.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Wallet className="h-4 w-4" />
            Como você ganha comissão
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Você recebe uma porcentagem sobre o valor pago por cada usuário que gerenciar — e a comissão se repete
            {' '}<strong className="text-foreground">a cada renovação</strong> do plano dele, não só na primeira venda
            {rules && !rules.renewal_commissions_enabled && ' (recorrência atualmente desativada pelo administrador)'}.
            Quanto mais usuários ativos você mantém, maior a sua taxa:
          </p>

          <div className="space-y-2">
            {statsLoading ? (
              <Skeleton className="h-16 w-full" />
            ) : (
              tiers.map((tier) => {
                const isCurrent = currentTier?.id === tier.id;
                return (
                  <div
                    key={tier.id}
                    className={`flex items-center justify-between rounded-lg border p-3 ${
                      isCurrent ? 'border-foreground/30 bg-foreground/[0.03]' : 'border-border'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      {isCurrent && <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />}
                      <div>
                        <p className="text-sm font-medium">
                          {tier.min_active_users === 0 ? 'A partir de 0 usuários ativos' : `A partir de ${tier.min_active_users} usuários ativos`}
                          {tier.label && <span className="text-muted-foreground"> — {tier.label}</span>}
                        </p>
                        {isCurrent && <p className="text-xs text-muted-foreground">Sua faixa atual</p>}
                      </div>
                    </div>
                    <Badge variant={isCurrent ? 'default' : 'outline'} className="text-sm">
                      {tier.commission_percentage}%
                    </Badge>
                  </div>
                );
              })
            )}
          </div>

          {!statsLoading && (
            <p className="text-xs text-muted-foreground">
              Você tem hoje <strong className="text-foreground">{activeUserCount}</strong> usuário(s) ativo(s) contando para sua faixa.
              {rules && rules.grace_period_days > 0 && (
                <> Usuários com pagamento em atraso ainda contam por até {rules.grace_period_days} dia(s) de carência.</>
              )}
            </p>
          )}

          {rules?.self_referral_block && (
            <p className="text-xs text-muted-foreground">
              Indicações do próprio parceiro (autoindicação) não geram comissão.
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Cadastro de usuários e pagamento pendente
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <p className="text-sm text-muted-foreground">
            Ao cadastrar um usuário em "Cadastrar Usuário" com um plano selecionado, a conta dele é ativada
            {' '}<strong className="text-foreground">imediatamente</strong> — ele já pode usar a vitrine normalmente.
          </p>
          <p className="text-sm text-muted-foreground">
            Ele tem{' '}
            <strong className="text-foreground">
              {rules ? `${rules.payment_deadline_hours} hora(s)` : 'algumas horas'}
            </strong>{' '}
            para efetuar o pagamento do plano. Se o prazo vencer sem pagamento, a conta é bloqueada automaticamente —
            o mesmo ambiente de um usuário com plano vencido — até que o pagamento seja feito.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Link2 className="h-4 w-4" />
            Seu link de indicação
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <p className="text-sm text-muted-foreground">
            Qualquer pessoa que se cadastrar pelo seu link (disponível em "Meu Link") entra automaticamente em
            "Meus Usuários" — mas apenas no{' '}
            <strong className="text-foreground">plano Free</strong>. Para vender um plano pago diretamente, use
            "Cadastrar Usuário".
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Landmark className="h-4 w-4" />
            Saques
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Suas comissões ficam pendentes até serem liberadas para saque via PIX, em "Comissões". O valor mínimo
            para solicitar um saque é{' '}
            <strong className="text-foreground">
              {statsLoading ? '...' : formatCurrencyI18n(minimumWithdrawalAmount, 'BRL', 'pt-BR')}
            </strong>.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-5 text-center space-y-3">
          <h3 className="text-sm font-semibold">Ainda com dúvidas?</h3>
          <p className="text-sm text-muted-foreground">Fale com o suporte diretamente pelo WhatsApp.</p>
          <a
            href="https://wa.me/5591982465495?text=Ol%C3%A1!%20Tenho%20d%C3%BAvidas%20sobre%20o%20programa%20VitrineTurbo%20Partners."
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-full bg-foreground text-background px-5 py-2.5 text-sm font-medium hover:bg-foreground/90 transition-colors"
          >
            <MessageCircle className="h-4 w-4" />
            Falar com Suporte
          </a>
        </CardContent>
      </Card>
    </div>
  );
}
