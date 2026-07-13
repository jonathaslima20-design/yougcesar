import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, CreditCard, ArrowRight, LogOut, Package, FolderOpen, CircleArrowUp as ArrowUpCircle, Lock, TriangleAlert as AlertTriangle, Ban, Tag } from 'lucide-react';
import BannerClients from '@/components/subscription/BannerClients';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { trackViewPricing, trackInitiateCheckout } from '@/lib/metaEvents';
import { trackGoogleAdsCheckout } from '@/lib/googleAdsEvents';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { supabase } from '@/lib/supabase';
import { formatCurrencyI18n } from '@/lib/i18n';
import { calculateDiscountedPrice } from '@/lib/offerService';
import { useAuth } from '@/contexts/AuthContext';
import type { SubscriptionPlan, LimitReason, PlanStatus } from '@/types';
import type { OfferDiscountInfo } from '@/contexts/SubscriptionModalContext';
import { FREE_PLAN_PRODUCT_LIMIT, FREE_PLAN_CATEGORY_LIMIT } from '@/hooks/usePlanLimits';

interface SubscriptionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isForced?: boolean;
  limitReason?: LimitReason;
  planStatus?: PlanStatus;
  offerDiscount?: OfferDiscountInfo | null;
}

export default function SubscriptionModal({ open, onOpenChange, isForced = false, limitReason, planStatus, offerDiscount }: SubscriptionModalProps) {
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [googleAdsConfig, setGoogleAdsConfig] = useState<{ tagId: string; checkoutId: string } | null>(null);
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await signOut();
  };

  useEffect(() => {
    if (open) {
      fetchPlans();
      trackViewPricing();
      supabase
        .from('landing_tracking_config')
        .select('google_ads_tag_id, google_ads_enabled, google_ads_checkout_id')
        .maybeSingle()
        .then(({ data }) => {
          if (data?.google_ads_enabled && data?.google_ads_tag_id && data?.google_ads_checkout_id) {
            setGoogleAdsConfig({ tagId: data.google_ads_tag_id, checkoutId: data.google_ads_checkout_id });
          }
        });
    }
  }, [open]);

  const fetchPlans = async () => {
    try {
      const { data, error } = await supabase
        .from('subscription_plans')
        .select('*')
        .eq('is_active', true)
        .order('display_order', { ascending: true });

      if (error) throw error;
      setPlans(data || []);
    } catch (error) {
      console.error('Error fetching plans:', error);
    } finally {
      setLoading(false);
    }
  };

  const paidPlans = plans.filter((p) => p.duration !== 'Free');

  const isAnnualPlan = (duration: string) => duration === 'Anual';

  const limitMessage = (() => {
    if (limitReason === 'products') {
      return {
        icon: <Package className="h-5 w-5 text-amber-600" />,
        title: 'Limite de produtos atingido',
        description: `Seu plano Free permite até ${FREE_PLAN_PRODUCT_LIMIT} produtos. Faça upgrade para adicionar produtos ilimitados.`,
      };
    }
    if (limitReason === 'categories') {
      return {
        icon: <FolderOpen className="h-5 w-5 text-amber-600" />,
        title: 'Limite de categorias atingido',
        description: `Seu plano Free permite até ${FREE_PLAN_CATEGORY_LIMIT} categorias. Faça upgrade para criar categorias ilimitadas.`,
      };
    }
    return null;
  })();

  // Features available in ALL paid plans
  const commonPaidFeatures = [
    'Produtos ilimitados',
    'Categorias ilimitadas',
    'Catálogo Digital via Link',
    'Painel Administrativo',
    'Carrinho de compras',
    'Controle de Estoque e Inventário',
    'Gestão de Pedidos e Vendas',
    'Cupons de desconto',
    'Preços por quantidade (atacado)',
    'Configuração de domínio próprio com SSL',
    'Personalização de cores e fontes',
    'Integração com Meta Pixel e Google Tag',
    'Programa de Indicação ("Indique e Ganhe")',
  ];

  // Features exclusive to the Annual plan
  const annualExclusiveFeatures = [
    'API REST para integrações externas (Bling, Tiny, ERPs)',
    'Remoção da logomarca VitrineTurbo',
  ];

  const freeFeatures = [
    `Até ${FREE_PLAN_PRODUCT_LIMIT} produtos`,
    `Até ${FREE_PLAN_CATEGORY_LIMIT} categorias`,
    'Catálogo Digital via Link',
    'Painel Administrativo',
    'Carrinho de compras',
    'Controle de Estoque e Inventário',
    'Gestão de Pedidos e Vendas',
  ];

  const isUserOnFree = user?.plan_status === 'free';
  const isUserActive = user?.plan_status === 'active';

  const isExpired = planStatus === 'expired';
  const isSuspended = planStatus === 'suspended';

  const getModalTitle = () => {
    if (offerDiscount) return 'Oferta Exclusiva';
    if (isSuspended) return 'Conta Suspensa';
    if (isExpired) return 'Plano Expirado';
    if (isUserActive) return 'Gerenciar Plano';
    if (limitReason) return 'Faça Upgrade do seu Plano';
    return 'Escolha seu Plano';
  };

  const getModalDescription = () => {
    if (offerDiscount) {
      const discLabel = offerDiscount.discount_type === 'percent'
        ? `${offerDiscount.discount_value}% de desconto`
        : `${formatCurrencyI18n(offerDiscount.discount_value, user?.currency || 'BRL', user?.language || 'pt-BR')} de desconto`;
      return `${offerDiscount.offer_title} — ${discLabel} em qualquer plano. Aproveite!`;
    }
    if (isSuspended) return 'Sua conta foi suspensa pelo administrador. Entre em contato com o suporte para mais informações.';
    if (isExpired) return 'Seu plano venceu. Renove agora para recuperar o acesso completo à sua vitrine e ao painel.';
    if (isUserActive) return 'Seu plano está ativo. Você tem acesso completo à plataforma VitrineTurbo.';
    if (limitReason) return 'Você atingiu um limite do plano Free. Escolha um plano pago para continuar crescendo.';
    if (isUserOnFree) return 'Você está no Plano Free. Faça upgrade para desbloquear recursos ilimitados.';
    return 'Ative sua conta e tenha acesso completo à plataforma VitrineTurbo.';
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(newOpen) => {
        if (!isForced) {
          onOpenChange(newOpen);
        }
      }}
    >
      <DialogContent
        className="max-w-5xl max-h-[90vh] overflow-y-auto"
        onPointerDownOutside={(e) => {
          if (isForced) {
            e.preventDefault();
          }
        }}
        onEscapeKeyDown={(e) => {
          if (isForced) {
            e.preventDefault();
          }
        }}
      >
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-center">
            {getModalTitle()}
          </DialogTitle>
          <DialogDescription className="text-center">
            {getModalDescription()}
          </DialogDescription>
        </DialogHeader>

        {offerDiscount && (
          <div className="flex items-center justify-center gap-2 py-2 px-4 rounded-lg bg-emerald-50 border border-emerald-200 dark:bg-emerald-950/30 dark:border-emerald-800">
            <Tag className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            <span className="text-sm font-medium text-emerald-700 dark:text-emerald-300">
              {offerDiscount.discount_type === 'percent'
                ? `${offerDiscount.discount_value}% OFF em todos os planos`
                : `${formatCurrencyI18n(offerDiscount.discount_value, user?.currency || 'BRL', user?.language || 'pt-BR')} OFF em todos os planos`}
            </span>
          </div>
        )}

        {limitMessage && (
          <Alert className="bg-amber-50 border-amber-200">
            <div className="flex items-start gap-3">
              {limitMessage.icon}
              <div>
                <p className="font-semibold text-amber-800 text-sm">{limitMessage.title}</p>
                <AlertDescription className="text-amber-700 text-sm mt-0.5">
                  {limitMessage.description}
                </AlertDescription>
              </div>
            </div>
          </Alert>
        )}

        {isSuspended && (
          <Alert className="bg-red-50 border-red-200">
            <div className="flex items-start gap-3">
              <Ban className="h-5 w-5 text-red-600 mt-0.5" />
              <AlertDescription className="text-red-800">
                Sua conta foi suspensa. Você não pode realizar alterações. Entre em contato com o suporte para resolver esta situação.
              </AlertDescription>
            </div>
          </Alert>
        )}

        {isExpired && (
          <Alert className="bg-amber-50 border-amber-200">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5" />
              <div>
                <AlertDescription className="text-amber-800">
                  Seu plano venceu por falta de pagamento. Sua vitrine está inativa. Renove abaixo para reativar imediatamente.
                </AlertDescription>
                {user?.billing_cycle === 'monthly' && (
                  <AlertDescription className="text-amber-700 text-xs mt-2">
                    O plano mensal não está mais disponível. Escolha uma das opções abaixo para renovar.
                  </AlertDescription>
                )}
              </div>
            </div>
          </Alert>
        )}

        {isForced && !isUserActive && !isUserOnFree && !isExpired && !isSuspended && (
          <Alert className="bg-blue-50 border-blue-200">
            <AlertDescription className="text-blue-800">
              Para utilizar a plataforma, você precisa ativar um plano de assinatura.
            </AlertDescription>
          </Alert>
        )}

        {isUserActive && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <div className="flex items-center gap-2">
              <Check className="h-5 w-5 text-green-600" />
              <span className="text-green-800 font-medium">
                Seu plano está ativo! Você já tem acesso completo à plataforma.
              </span>
            </div>
          </div>
        )}

        {isUserOnFree && !isExpired && <BannerClients />}

        {isSuspended ? (
          <div className="mt-4 p-6 text-center bg-muted/30 rounded-lg border">
            <Ban className="h-12 w-12 text-red-400 mx-auto mb-3" />
            <p className="text-muted-foreground">
              Sua conta está suspensa e você não pode selecionar ou renovar planos. Entre em contato com o suporte para resolver esta situação.
            </p>
          </div>
        ) : loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          </div>
        ) : (
          <div className="mt-4 space-y-6">
            {/* Free Plan Card - only visible for free plan users */}
            {isUserOnFree && <div className="grid grid-cols-1 gap-4">
              <Card className="relative transition-all duration-200 border-2 border-gray-300 bg-gray-50/50">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-lg bg-gray-100 flex items-center justify-center">
                        <Lock className="h-5 w-5 text-gray-500" />
                      </div>
                      <div>
                        <CardTitle className="text-lg text-gray-700">Plano Free</CardTitle>
                        <p className="text-sm text-muted-foreground">Gratuito para sempre</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-bold text-gray-700">R$ 0</div>
                      {isUserOnFree && (
                        <Badge variant="secondary" className="text-xs mt-1">
                          Plano Atual
                        </Badge>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                    {freeFeatures.map((feature, index) => (
                      <div key={index} className="flex items-center gap-2 text-sm text-gray-600">
                        <Check className="h-3.5 w-3.5 text-gray-400 flex-shrink-0" />
                        <span>{feature}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>}

            {/* Divider */}
            {paidPlans.length > 0 && (
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-background px-3 text-muted-foreground font-medium flex items-center gap-1.5">
                    <ArrowUpCircle className="h-3.5 w-3.5" />
                    Faça upgrade e desbloqueie tudo
                  </span>
                </div>
              </div>
            )}

            {/* Paid Plans */}
            {paidPlans.length > 0 && (
              <div className={`grid grid-cols-1 gap-5 ${paidPlans.length === 1 ? 'md:grid-cols-1 max-w-sm mx-auto' : paidPlans.length === 2 ? 'md:grid-cols-2' : 'md:grid-cols-3'}`}>
                {paidPlans.map((plan) => {
                  const featured = isAnnualPlan(plan.duration);
                  const planFeatures = featured
                    ? [...commonPaidFeatures, ...annualExclusiveFeatures]
                    : commonPaidFeatures;

                  const hasOfferDiscount = offerDiscount && offerDiscount.discount_value > 0;
                  const discounted = hasOfferDiscount
                    ? calculateDiscountedPrice(plan.price, offerDiscount.discount_type, offerDiscount.discount_value, null)
                    : null;

                  return (
                    <div
                      key={plan.id}
                      className={`rounded-2xl p-7 border flex flex-col transition-all duration-200 hover:shadow-lg ${
                        featured ? 'bg-zinc-900 text-white border-zinc-800' : 'bg-white text-zinc-900 border-zinc-200'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className={`font-semibold text-base ${featured ? 'text-white' : 'text-zinc-900'}`}>
                          {plan.name}
                        </span>
                        <span
                          className={`text-[10px] uppercase tracking-wide px-2.5 py-1 rounded-full border font-medium ${
                            featured ? 'border-white/30 text-white' : 'border-zinc-200 text-zinc-500'
                          }`}
                        >
                          {plan.duration === 'Anual' ? 'Melhor valor' : plan.duration === 'Semestral' ? 'Mais escolhido' : 'Flexível'}
                        </span>
                      </div>
                      <div className="mt-6">
                        {discounted && discounted.discount > 0 ? (
                          <>
                            <span className={`text-lg line-through ${featured ? 'text-white/50' : 'text-zinc-400'}`}>
                              {formatCurrencyI18n(plan.price, user?.currency || 'BRL', user?.language || 'pt-BR')}
                            </span>
                            <div className="flex items-baseline gap-2 mt-1">
                              <span className={`text-4xl font-bold tracking-tight ${featured ? 'text-emerald-400' : 'text-emerald-600'}`}>
                                {formatCurrencyI18n(discounted.finalPrice, user?.currency || 'BRL', user?.language || 'pt-BR')}
                              </span>
                            </div>
                            <p className={`text-xs mt-1 font-medium ${featured ? 'text-emerald-400/80' : 'text-emerald-600'}`}>
                              Economia de {formatCurrencyI18n(discounted.discount, user?.currency || 'BRL', user?.language || 'pt-BR')}
                            </p>
                          </>
                        ) : (
                          <span className={`text-4xl font-bold tracking-tight ${featured ? 'text-white' : 'text-zinc-900'}`}>
                            {formatCurrencyI18n(plan.price, user?.currency || 'BRL', user?.language || 'pt-BR')}
                          </span>
                        )}
                      </div>
                      <ul className="mt-6 space-y-3 flex-1">
                        {planFeatures.map((feature, index) => (
                          <li key={index} className="flex items-center gap-3">
                            <span
                              className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 ${
                                featured ? 'bg-white/15' : 'bg-white border border-zinc-200'
                              }`}
                            >
                              <Check size={12} strokeWidth={3} className={featured ? 'text-white' : 'text-zinc-900'} />
                            </span>
                            <span className={`text-sm ${featured ? 'text-white/90' : 'text-zinc-700'}`}>{feature}</span>
                          </li>
                        ))}
                      </ul>
                      <button
                        className={`mt-6 rounded-full px-6 py-3 font-medium text-sm inline-flex items-center justify-center gap-2 transition-colors ${
                          featured
                            ? 'bg-white text-zinc-900 hover:bg-white/90'
                            : 'bg-zinc-900 text-white hover:bg-zinc-800'
                        }`}
                        onClick={() => {
                          trackInitiateCheckout(plan.name, plan.price);
                          if (googleAdsConfig) {
                            trackGoogleAdsCheckout(googleAdsConfig.tagId, googleAdsConfig.checkoutId);
                          }
                          onOpenChange(false);
                          const params = new URLSearchParams({ plan: plan.id, cycle: plan.duration });
                          if (offerDiscount) params.set('offer_id', offerDiscount.offer_id);
                          navigate(`/dashboard/checkout?${params.toString()}`);
                        }}
                      >
                        <CreditCard size={14} />
                        Assinar Agora
                        <ArrowRight size={14} />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}

            {paidPlans.length === 0 && !loading && (
              <div className="text-center py-8 text-muted-foreground">
                <p>Nenhum plano pago disponível no momento</p>
              </div>
            )}
          </div>
        )}

        <div className="mt-6 p-5 bg-muted/40 rounded-lg border">
          <h3 className="font-semibold mb-3 text-sm">Por que escolher o VitrineTurbo?</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
            <p className="flex items-center gap-2 text-muted-foreground">
              <Check className="h-4 w-4 text-green-500 flex-shrink-0" />
              Interface moderna e responsiva
            </p>
            <p className="flex items-center gap-2 text-muted-foreground">
              <Check className="h-4 w-4 text-green-500 flex-shrink-0" />
              Segurança e confiabilidade
            </p>
            <p className="flex items-center gap-2 text-muted-foreground">
              <Check className="h-4 w-4 text-green-500 flex-shrink-0" />
              Suporte técnico especializado
            </p>
            <p className="flex items-center gap-2 text-muted-foreground">
              <Check className="h-4 w-4 text-green-500 flex-shrink-0" />
              Analytics e relatórios detalhados
            </p>
            <p className="flex items-center gap-2 text-muted-foreground">
              <Check className="h-4 w-4 text-green-500 flex-shrink-0" />
              Atualizações constantes
            </p>
            <p className="flex items-center gap-2 text-muted-foreground">
              <Check className="h-4 w-4 text-green-500 flex-shrink-0" />
              Ganhe dinheiro indicando amigos
            </p>
          </div>
        </div>

        <div className="mt-4 p-5 bg-card border rounded-lg">
          <div className="text-center space-y-3">
            <h3 className="text-base font-semibold">Precisa de Ajuda?</h3>
            <p className="text-muted-foreground text-sm max-w-md mx-auto">
              Em caso de dúvidas sobre os planos ou funcionalidades, nossa equipe está pronta para ajudar.
            </p>
            <div className="flex flex-col sm:flex-row gap-2 justify-center">
              <Button variant="outline" asChild>
                <a
                  href="https://wa.me/5591982465495?text=Olá! Tenho dúvidas sobre os planos do VitrineTurbo e gostaria de falar com o suporte."
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <svg className="h-4 w-4 mr-2" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                  </svg>
                  Falar com Suporte
                </a>
              </Button>

              {isForced && (
                <Button
                  variant="outline"
                  className="border-red-200 hover:bg-red-50 text-red-700"
                  onClick={handleLogout}
                >
                  <LogOut className="h-4 w-4 mr-2" />
                  Sair da Conta
                </Button>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
