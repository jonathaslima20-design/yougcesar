import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { trackPurchase } from '@/lib/metaEvents';
import { trackGoogleAdsPurchase } from '@/lib/googleAdsEvents';
import {
  createPixPayment,
  createCardPayment,
  getPaymentStatus,
  getPublicKey,
  type PixPaymentResult,
  type CardPaymentResult,
} from '@/lib/mpPayments';
import { formatCurrencyI18n } from '@/lib/i18n';
import {
  fetchOfferForCheckout,
  calculateDiscountedPrice,
  type OfferCheckoutInfo,
} from '@/lib/offerService';
import { validateReferralCoupon, calculateReferralDiscount } from '@/lib/referralUtils';
import { toast } from 'sonner';
import { QrCode, CreditCard, Copy, Check, Loader as Loader2, ArrowLeft, ShieldCheck, Clock, CircleCheck as CheckCircle2, Circle as XCircle, CircleAlert as AlertCircle, CalendarClock, Tag, Ticket, Lock } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { initMercadoPago, CardPayment } from '@mercadopago/sdk-react';

type PaymentTab = 'pix' | 'card';

interface PlanInfo {
  id: string;
  name: string;
  price: number;
  duration: string;
}

interface OfferContext {
  offer_id: string;
  base_price: number;
  discount: number;
  final_price: number;
  coupon_code: string | null;
  description: string;
}

function formatCpf(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 14);
  if (digits.length <= 11) {
    return digits
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
  }
  return digits
    .replace(/(\d{2})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1/$2')
    .replace(/(\d{4})(\d{1,2})$/, '$1-$2');
}

function PixSection({ plan, onSuccess, earlyRenewal, offerContext, referralCode }: { plan: PlanInfo; onSuccess: () => void; earlyRenewal?: boolean; offerContext?: OfferContext | null; referralCode?: string }) {
  const { user } = useAuth();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState(user?.email || '');
  const [doc, setDoc] = useState('');
  const [loading, setLoading] = useState(false);
  const [pixResult, setPixResult] = useState<PixPaymentResult | null>(null);
  const [copied, setCopied] = useState(false);
  const [paymentApproved, setPaymentApproved] = useState(false);
  const pollingRef = useRef<NodeJS.Timeout | null>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  useEffect(() => {
    if (user?.name) {
      const parts = user.name.split(' ');
      setFirstName(parts[0] || '');
      setLastName(parts.slice(1).join(' ') || '');
    }
  }, [user]);

  useEffect(() => {
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }
    };
  }, []);

  const startPolling = useCallback((paymentId: string) => {
    pollingRef.current = setInterval(async () => {
      try {
        const status = await getPaymentStatus(paymentId);
        if (status.status === 'approved') {
          if (pollingRef.current) clearInterval(pollingRef.current);
          setPaymentApproved(true);
          onSuccess();
        }
      } catch (e) {
        // ignore polling errors
      }
    }, 5000);

    channelRef.current = supabase
      .channel(`mp_payment_${paymentId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'mp_payments',
          filter: `id=eq.${paymentId}`,
        },
        (payload) => {
          if (payload.new?.status === 'approved') {
            if (pollingRef.current) clearInterval(pollingRef.current);
            setPaymentApproved(true);
            onSuccess();
          }
        }
      )
      .subscribe();
  }, [onSuccess]);

  const handleSubmit = async () => {
    if (!firstName || !email || !doc) {
      toast.error('Preencha todos os campos obrigatórios');
      return;
    }

    const cleanDoc = doc.replace(/\D/g, '');
    if (cleanDoc.length < 11) {
      toast.error('CPF/CNPJ inválido');
      return;
    }

    setLoading(true);
    try {
      const result = await createPixPayment({
        plan_id: plan.id,
        billing_cycle: plan.duration,
        payer: {
          email,
          first_name: firstName,
          last_name: lastName,
          doc: cleanDoc,
        },
        early_renewal: earlyRenewal,
        offer_id: offerContext?.offer_id,
        referral_code: referralCode,
      });
      setPixResult(result);
      startPolling(result.payment_id);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao gerar PIX');
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    if (pixResult?.pix_qr_code) {
      navigator.clipboard.writeText(pixResult.pix_qr_code);
      setCopied(true);
      toast.success('Código PIX copiado!');
      setTimeout(() => setCopied(false), 3000);
    }
  };

  if (paymentApproved) {
    return <PaymentSuccess />;
  }

  if (pixResult) {
    return (
      <div className="space-y-6">
        <div className="text-center space-y-2">
          <div className="flex justify-center">
            <div className="h-14 w-14 rounded-full bg-green-500/10 flex items-center justify-center">
              <QrCode className="h-7 w-7 text-green-600" />
            </div>
          </div>
          <h3 className="text-lg font-semibold">QR Code gerado!</h3>
          <p className="text-sm text-muted-foreground">
            Escaneie o QR Code ou copie o codigo para pagar
          </p>
        </div>

        {pixResult.pix_qr_code_base64 && (
          <div className="flex justify-center">
            <div className="bg-white p-4 rounded-lg border">
              <img
                src={`data:image/png;base64,${pixResult.pix_qr_code_base64}`}
                alt="QR Code PIX"
                className="w-48 h-48"
              />
            </div>
          </div>
        )}

        {pixResult.pix_qr_code && (
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Código Pix (copia e cola)</Label>
            <div className="flex gap-2">
              <Input
                value={pixResult.pix_qr_code}
                readOnly
                className="text-xs font-mono"
              />
              <Button
                variant="outline"
                size="icon"
                onClick={handleCopy}
                className="shrink-0"
              >
                {copied ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
          </div>
        )}

        <div className="flex items-center gap-2 justify-center text-sm text-muted-foreground">
          <Clock className="h-4 w-4" />
          <span>Aguardando confirmação do pagamento...</span>
          <Loader2 className="h-4 w-4 animate-spin" />
        </div>

        <div className="bg-muted/50 rounded-lg p-3 text-center">
          <p className="text-xs text-muted-foreground">
            Após o pagamento, seu plano será ativado automaticamente em poucos segundos.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="firstName">Nome *</Label>
          <Input
            id="firstName"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            placeholder="Nome"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="lastName">Sobrenome</Label>
          <Input
            id="lastName"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            placeholder="Sobrenome"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="email">E-mail *</Label>
        <Input
          id="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="seu@email.com"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="doc">CPF/CNPJ *</Label>
        <Input
          id="doc"
          value={doc}
          onChange={(e) => setDoc(formatCpf(e.target.value))}
          placeholder="000.000.000-00"
          maxLength={18}
        />
      </div>

      <Button
        onClick={handleSubmit}
        disabled={loading}
        className="w-full"
        size="lg"
      >
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin mr-2" />
        ) : (
          <QrCode className="h-4 w-4 mr-2" />
        )}
        Gerar QR Code Pix
      </Button>

      <p className="text-xs text-center text-muted-foreground">
        O pagamento via Pix é confirmado instantaneamente
      </p>
    </div>
  );
}

interface CardSectionProps {
  plan: PlanInfo;
  onSuccess: () => void;
  earlyRenewal?: boolean;
  offerContext?: OfferContext | null;
  referralCode?: string;
}

function CardSection({ plan, onSuccess, earlyRenewal, offerContext, referralCode }: CardSectionProps) {
  const [result, setResult] = useState<CardPaymentResult | null>(null);
  const [brickReady, setBrickReady] = useState(false);
  const planRef = useRef(plan);
  planRef.current = plan;
  const onSuccessRef = useRef(onSuccess);
  onSuccessRef.current = onSuccess;
  const earlyRenewalRef = useRef(earlyRenewal);
  earlyRenewalRef.current = earlyRenewal;
  const offerIdRef = useRef(offerContext?.offer_id);
  offerIdRef.current = offerContext?.offer_id;
  const referralCodeRef = useRef(referralCode);
  referralCodeRef.current = referralCode;

  const handleSubmit = useCallback(async (formData: any) => {
    return new Promise<void>(async (resolve, reject) => {
      try {
        const currentPlan = planRef.current;
        const cardResult = await createCardPayment({
          plan_id: currentPlan.id,
          billing_cycle: currentPlan.duration,
          token: formData.token,
          installments: formData.installments,
          payment_method_id: formData.payment_method_id,
          issuer_id: formData.issuer_id || '',
          payer: {
            email: formData.payer?.email || '',
            doc: formData.payer?.identification?.number || '',
          },
          early_renewal: earlyRenewalRef.current,
          offer_id: offerIdRef.current,
          referral_code: referralCodeRef.current,
        });
        setResult(cardResult);
        if (cardResult.status === 'approved') {
          onSuccessRef.current();
        }
        resolve();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Erro ao processar pagamento');
        reject();
      }
    });
  }, []);

  const handleReady = useCallback(() => {
    setBrickReady(true);
  }, []);

  const handleError = useCallback((error: any) => {
    console.error('CardPayment Brick error:', error);
  }, []);

  const effectiveAmount = offerContext?.final_price ?? plan.price;
  const initialization = useMemo(() => ({ amount: effectiveAmount }), [effectiveAmount]);
  const customization = useMemo(() => ({
    visual: { hideFormTitle: true },
    paymentMethods: { maxInstallments: 12 },
  }), []);

  if (result) {
    if (result.status === 'approved') {
      return <PaymentSuccess />;
    }

    if (result.status === 'in_process') {
      return (
        <div className="text-center space-y-4 py-8">
          <div className="flex justify-center">
            <div className="h-14 w-14 rounded-full bg-amber-500/10 flex items-center justify-center">
              <Clock className="h-7 w-7 text-amber-500" />
            </div>
          </div>
          <h3 className="text-lg font-semibold">Pagamento em análise</h3>
          <p className="text-sm text-muted-foreground max-w-sm mx-auto">
            Seu pagamento está sendo processado. Você será notificado assim que for aprovado.
          </p>
          <Badge variant="outline" className="text-amber-600">
            {result.card_last4 && `Cartão ****${result.card_last4}`}
          </Badge>
        </div>
      );
    }

    return (
      <div className="text-center space-y-4 py-8">
        <div className="flex justify-center">
          <div className="h-14 w-14 rounded-full bg-red-500/10 flex items-center justify-center">
            <XCircle className="h-7 w-7 text-red-500" />
          </div>
        </div>
        <h3 className="text-lg font-semibold">Pagamento recusado</h3>
        <p className="text-sm text-muted-foreground max-w-sm mx-auto">
          {result.status_detail || 'Verifique os dados do cartão e tente novamente.'}
        </p>
        <Button variant="outline" onClick={() => setResult(null)}>
          Tentar novamente
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {!brickReady && (
        <div className="flex flex-col items-center justify-center gap-3 py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          <span className="text-sm text-muted-foreground">Carregando formulário seguro...</span>
        </div>
      )}
      <div style={{ minHeight: brickReady ? undefined : 0, overflow: brickReady ? undefined : 'hidden' }}>
        <CardPayment
          initialization={initialization}
          customization={customization}
          onSubmit={handleSubmit}
          onReady={handleReady}
          onError={handleError}
        />
      </div>

      {brickReady && (
        <div className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground pt-2">
          <ShieldCheck className="h-3.5 w-3.5" />
          <span>Pagamento processado com seguranca pelo Mercado Pago</span>
        </div>
      )}
    </div>
  );
}

function PaymentSuccess() {
  const navigate = useNavigate();

  return (
    <div className="text-center space-y-4 py-8">
      <div className="flex justify-center">
        <div className="h-16 w-16 rounded-full bg-green-500/10 flex items-center justify-center animate-in zoom-in duration-300">
          <CheckCircle2 className="h-8 w-8 text-green-600" />
        </div>
      </div>
      <h3 className="text-xl font-semibold">Pagamento aprovado!</h3>
      <p className="text-sm text-muted-foreground max-w-sm mx-auto">
        Seu plano foi ativado com sucesso. Aproveite todos os recursos da plataforma!
      </p>
      <Button onClick={() => navigate('/dashboard')} size="lg">
        Ir para o Dashboard
      </Button>
    </div>
  );
}

export default function CheckoutPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user, refreshUser } = useAuth();
  const [plan, setPlan] = useState<PlanInfo | null>(null);
  const [planLoading, setPlanLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<PaymentTab>('pix');
  const [paymentComplete, setPaymentComplete] = useState(false);
  const [sdkReady, setSdkReady] = useState(false);
  const [sdkError, setSdkError] = useState(false);
  const [offerContext, setOfferContext] = useState<OfferContext | null>(null);
  const [offerLoading, setOfferLoading] = useState(false);
  const [googleAdsConfig, setGoogleAdsConfig] = useState<{ tagId: string; purchaseId: string } | null>(null);

  // Referral coupon state
  const [referralInput, setReferralInput] = useState('');
  const [referralValidated, setReferralValidated] = useState(false);
  const [referralLocked, setReferralLocked] = useState(false);
  const [referralValidating, setReferralValidating] = useState(false);
  const [referralError, setReferralError] = useState('');
  const [referralDiscount, setReferralDiscount] = useState<{ discount: number; finalPrice: number } | null>(null);
  const [validatedReferralCode, setValidatedReferralCode] = useState<string | undefined>(undefined);
  const [isFirstPayment, setIsFirstPayment] = useState(false);

  const planId = searchParams.get('plan');
  const cycle = searchParams.get('cycle');
  const earlyRenewal = searchParams.get('early_renewal') === 'true';
  const offerId = searchParams.get('offer_id');

  useEffect(() => {
    const resolvePlan = async () => {
      let resolvedPlanId = planId;

      if (!resolvedPlanId && offerId) {
        const { data: offer } = await supabase
          .from('promotional_offers')
          .select('plano_alvo_id')
          .eq('id', offerId)
          .maybeSingle();

        resolvedPlanId = offer?.plano_alvo_id || null;
      }

      if (!resolvedPlanId) {
        navigate('/dashboard/settings');
        return;
      }

      const { data, error } = await supabase
        .from('subscription_plans')
        .select('id, name, price, duration')
        .eq('id', resolvedPlanId)
        .maybeSingle();

      if (error || !data) {
        toast.error('Plano não encontrado');
        navigate('/dashboard/settings');
        return;
      }

      setPlan({
        id: data.id,
        name: data.name,
        price: Number(data.price),
        duration: cycle || data.duration,
      });
      setPlanLoading(false);
    };

    resolvePlan();
  }, [planId, offerId, cycle, navigate]);

  useEffect(() => {
    if (!offerId || !user?.id || !plan) {
      setOfferContext(null);
      return;
    }
    let cancelled = false;
    const loadOffer = async () => {
      setOfferLoading(true);
      try {
        const info: OfferCheckoutInfo | null = await fetchOfferForCheckout(offerId, user.id);
        if (cancelled || !info) {
          if (!cancelled && offerId) {
            toast.warning('Oferta indisponivel - prosseguindo com preco normal');
          }
          return;
        }
        const { discount, finalPrice } = calculateDiscountedPrice(
          plan.price,
          info.discount_type,
          info.discount_value,
          info.coupon?.max_discount_amount ?? null
        );
        if (discount <= 0) return;
        const description = info.coupon
          ? `Cupom ${info.coupon.code} aplicado automaticamente`
          : info.discount_type === 'percent'
            ? `${info.discount_value}% de desconto da oferta`
            : `${formatCurrencyI18n(info.discount_value)} de desconto da oferta`;
        setOfferContext({
          offer_id: info.offer.id,
          base_price: plan.price,
          discount,
          final_price: finalPrice,
          coupon_code: info.coupon?.code ?? null,
          description,
        });
      } catch (err) {
        console.error('Failed to load offer for checkout', err);
      } finally {
        if (!cancelled) setOfferLoading(false);
      }
    };
    loadOffer();
    return () => { cancelled = true; };
  }, [offerId, user?.id, plan]);

  // Auto-detect referral: check user's referred_by or URL/localStorage ref code
  useEffect(() => {
    if (!user?.id || !plan) return;
    let cancelled = false;

    const checkReferral = async () => {
      // First check if user already has prior approved payments (not eligible for referral discount)
      const { data: priorPayments } = await supabase
        .from('mp_payments')
        .select('id')
        .eq('user_id', user.id)
        .eq('status', 'approved')
        .limit(1);

      if (cancelled) return;
      if (priorPayments && priorPayments.length > 0) {
        // User already paid before - not eligible for referral discount
        setIsFirstPayment(false);
        localStorage.removeItem('vitrineturbo_ref_code');
        return;
      }

      setIsFirstPayment(true);

      // Check if user already has referred_by set
      const { data: userData } = await supabase
        .from('users')
        .select('referred_by')
        .eq('id', user.id)
        .maybeSingle();

      if (cancelled) return;

      if (userData?.referred_by) {
        // User was already referred - find the referrer's code
        const { data: referrer } = await supabase
          .from('users')
          .select('referral_code')
          .eq('id', userData.referred_by)
          .maybeSingle();

        if (cancelled) return;
        if (referrer?.referral_code) {
          setReferralInput(referrer.referral_code);
          setReferralLocked(true);
          setReferralValidated(true);
          setValidatedReferralCode(referrer.referral_code);
          // Get discount percentage from settings
          const { data: settings } = await supabase
            .from('referral_settings')
            .select('discount_percentage')
            .limit(1)
            .maybeSingle();
          const pct = settings?.discount_percentage ?? 20;
          setReferralDiscount(calculateReferralDiscount(plan.price, pct));
        }
        return;
      }

      // Check URL param or localStorage
      const refFromUrl = new URLSearchParams(window.location.search).get('ref');
      const refFromStorage = localStorage.getItem('vitrineturbo_ref_code');
      const refCode = refFromUrl || refFromStorage;

      if (refCode && !cancelled) {
        setReferralInput(refCode);
        setReferralLocked(true);
        // Auto-validate (validateReferralCoupon now also checks payment history)
        const result = await validateReferralCoupon(refCode, user.id);
        if (cancelled) return;
        if (result.valid) {
          setReferralValidated(true);
          setValidatedReferralCode(refCode);
          const { data: settings } = await supabase
            .from('referral_settings')
            .select('discount_percentage')
            .limit(1)
            .maybeSingle();
          const pct = settings?.discount_percentage ?? 20;
          setReferralDiscount(calculateReferralDiscount(plan.price, pct));
        } else {
          // Invalid referral for this user - unlock the field and clear localStorage
          setReferralLocked(false);
          setReferralInput('');
          localStorage.removeItem('vitrineturbo_ref_code');
        }
      }
    };

    checkReferral();
    return () => { cancelled = true; };
  }, [user?.id, plan]);

  const handleApplyReferral = async () => {
    if (!user?.id || !plan) return;
    setReferralError('');
    setReferralValidating(true);

    const result = await validateReferralCoupon(referralInput, user.id);

    if (result.valid) {
      setReferralValidated(true);
      setValidatedReferralCode(referralInput.trim().toUpperCase());
      const { data: settings } = await supabase
        .from('referral_settings')
        .select('discount_percentage')
        .limit(1)
        .maybeSingle();
      const pct = settings?.discount_percentage ?? 20;
      setReferralDiscount(calculateReferralDiscount(plan.price, pct));
      toast.success('Cupom aplicado! 20% de desconto ativado');
    } else {
      setReferralError(result.error || 'Cupom invalido');
    }
    setReferralValidating(false);
  };

  useEffect(() => {
    let cancelled = false;

    const initSdk = async () => {
      try {
        const info = await getPublicKey();
        if (cancelled) return;
        if (!info.public_key) {
          setSdkError(true);
          return;
        }
        initMercadoPago(info.public_key, { locale: 'pt-BR' });
        setSdkReady(true);
      } catch (error) {
        if (!cancelled) {
          console.error('MercadoPago SDK init failed:', error);
          setSdkError(true);
        }
      }
    };

    initSdk();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    supabase
      .from('landing_tracking_config')
      .select('google_ads_tag_id, google_ads_enabled, google_ads_purchase_id')
      .maybeSingle()
      .then(({ data }) => {
        if (data?.google_ads_enabled && data?.google_ads_tag_id && data?.google_ads_purchase_id) {
          setGoogleAdsConfig({ tagId: data.google_ads_tag_id, purchaseId: data.google_ads_purchase_id });
        }
      });
  }, []);

  const handleRetrySDK = useCallback(async () => {
    setSdkError(false);
    setSdkReady(false);
    try {
      const info = await getPublicKey();
      if (!info.public_key) {
        setSdkError(true);
        return;
      }
      initMercadoPago(info.public_key, { locale: 'pt-BR' });
      setSdkReady(true);
    } catch {
      setSdkError(true);
    }
  }, []);

  const handleSuccess = useCallback(async () => {
    setPaymentComplete(true);
    if (plan) {
      trackPurchase(plan.name, plan.price, user?.email);
      if (googleAdsConfig) {
        trackGoogleAdsPurchase(googleAdsConfig.tagId, googleAdsConfig.purchaseId, plan.price, plan.id);
      }
    }
    // Save referred_by if coupon was used and user doesn't already have it
    if (validatedReferralCode && user?.id) {
      const { data: currentUser } = await supabase
        .from('users')
        .select('referred_by')
        .eq('id', user.id)
        .maybeSingle();

      if (!currentUser?.referred_by) {
        const { data: referrer } = await supabase
          .from('users')
          .select('id')
          .ilike('referral_code', validatedReferralCode)
          .maybeSingle();

        if (referrer) {
          await supabase
            .from('users')
            .update({ referred_by: referrer.id })
            .eq('id', user.id);
        }
      }
    }
    await refreshUser();
  }, [refreshUser, plan, user?.email, user?.id, validatedReferralCode, googleAdsConfig]);

  if (planLoading || !plan) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const renderCardContent = () => {
    if (sdkError) {
      return (
        <div className="text-center space-y-4 py-8">
          <div className="flex justify-center">
            <div className="h-14 w-14 rounded-full bg-red-500/10 flex items-center justify-center">
              <AlertCircle className="h-7 w-7 text-red-500" />
            </div>
          </div>
          <h3 className="text-lg font-semibold">Erro ao carregar formulário</h3>
          <p className="text-sm text-muted-foreground max-w-sm mx-auto">
            Não foi possível inicializar o sistema de pagamento. Verifique sua conexão.
          </p>
          <Button variant="outline" onClick={handleRetrySDK}>
            Tentar novamente
          </Button>
        </div>
      );
    }

    if (!sdkReady) {
      return (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      );
    }

    return (
      <CardSection
        plan={plan}
        onSuccess={handleSuccess}
        earlyRenewal={earlyRenewal}
        offerContext={effectiveOfferContext}
        referralCode={validatedReferralCode}
      />
    );
  };

  // Referral discount takes priority over promotional offers
  const effectiveOfferContext = referralDiscount ? null : offerContext;
  const effectivePrice = referralDiscount
    ? referralDiscount.finalPrice
    : (effectiveOfferContext?.final_price ?? plan.price);

  return (
    <div className="w-full px-4 sm:px-6 lg:px-8 py-6">
      <div className="max-w-lg mx-auto space-y-6">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate(-1)}
          className="text-muted-foreground"
        >
          <ArrowLeft className="h-4 w-4 mr-1" />
          Voltar
        </Button>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-semibold">{plan.name}</p>
                <p className="text-sm text-muted-foreground">Ciclo: {plan.duration}</p>
              </div>
              <div className="text-right">
                {(referralDiscount || effectiveOfferContext) ? (
                  <>
                    <p className="text-xs line-through text-muted-foreground">
                      {formatCurrencyI18n(plan.price)}
                    </p>
                    <p className="text-2xl font-bold text-emerald-600">
                      {formatCurrencyI18n(effectivePrice)}
                    </p>
                  </>
                ) : (
                  <p className="text-2xl font-bold text-primary">
                    {formatCurrencyI18n(plan.price)}
                  </p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {offerLoading && (
          <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            <span>Aplicando oferta...</span>
          </div>
        )}

        {/* Referral discount banner */}
        {referralDiscount && referralValidated && (
          <div className="flex items-start gap-3 rounded-lg border border-emerald-200 bg-emerald-50/60 px-4 py-3 text-sm text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-300">
            <Ticket className="h-4 w-4 mt-0.5 shrink-0" />
            <div className="flex-1">
              <p className="font-medium">Voce ganhou 20% de desconto por indicacao!</p>
              <p className="text-xs mt-0.5 opacity-80">
                Voce economiza {formatCurrencyI18n(referralDiscount.discount)}
              </p>
            </div>
          </div>
        )}

        {/* Promotional offer banner (only shows if no referral discount) */}
        {effectiveOfferContext && !referralDiscount && (
          <div className="flex items-start gap-3 rounded-lg border border-emerald-200 bg-emerald-50/60 px-4 py-3 text-sm text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-300">
            <Tag className="h-4 w-4 mt-0.5 shrink-0" />
            <div className="flex-1">
              <p className="font-medium">{effectiveOfferContext.description}</p>
              <p className="text-xs mt-0.5 opacity-80">
                Voce economiza {formatCurrencyI18n(effectiveOfferContext.discount)}
                {effectiveOfferContext.coupon_code && ` - cupom ${effectiveOfferContext.coupon_code}`}
              </p>
            </div>
          </div>
        )}

        {/* Referral Coupon Field */}
        {!referralValidated && isFirstPayment && (
          <Card>
            <CardContent className="p-4 space-y-3">
              <Label className="text-sm font-medium flex items-center gap-2">
                <Ticket className="h-4 w-4" />
                Tem um cupom de indicacao?
              </Label>
              <div className="flex gap-2">
                <Input
                  value={referralInput}
                  onChange={(e) => { setReferralInput(e.target.value.toUpperCase()); setReferralError(''); }}
                  placeholder="Ex: VT3K8MX"
                  className="font-mono"
                  readOnly={referralLocked}
                  disabled={referralValidating}
                />
                <Button
                  onClick={handleApplyReferral}
                  disabled={!referralInput.trim() || referralValidating}
                  variant="outline"
                  className="shrink-0"
                >
                  {referralValidating ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Aplicar'}
                </Button>
              </div>
              {referralError && (
                <p className="text-xs text-destructive">{referralError}</p>
              )}
            </CardContent>
          </Card>
        )}

        {/* Referral validated badge */}
        {referralValidated && isFirstPayment && (
          <div className="flex items-center gap-2 px-1">
            <Lock className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">Cupom de indicacao <strong>{referralInput}</strong> aplicado</span>
          </div>
        )}

        {earlyRenewal && user?.subscription_end_date && (
          <div className="flex items-start gap-3 rounded-lg border border-blue-200 bg-blue-50/60 px-4 py-3 text-sm text-blue-800 dark:border-blue-800 dark:bg-blue-950/30 dark:text-blue-300">
            <CalendarClock className="h-4 w-4 mt-0.5 shrink-0" />
            <p>
              Renovação antecipada — o novo período será calculado a partir do vencimento atual
              {' '}(<strong>{new Date(user.subscription_end_date).toLocaleDateString('pt-BR')}</strong>),
              sem perda dos dias restantes.
            </p>
          </div>
        )}

        {paymentComplete ? (
          <Card>
            <CardContent className="p-6">
              <PaymentSuccess />
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="text-lg">Forma de pagamento</CardTitle>
              <CardDescription>Escolha como deseja pagar</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setActiveTab('pix')}
                  className={cn(
                    'flex items-center justify-center gap-2 py-3 px-4 rounded-lg border-2 transition-all',
                    activeTab === 'pix'
                      ? 'border-primary bg-primary/5 text-primary'
                      : 'border-muted hover:border-muted-foreground/30 text-muted-foreground'
                  )}
                >
                  <QrCode className="h-4 w-4" />
                  <span className="text-sm font-medium">Pix</span>
                </button>
                <button
                  onClick={() => setActiveTab('card')}
                  className={cn(
                    'flex items-center justify-center gap-2 py-3 px-4 rounded-lg border-2 transition-all',
                    activeTab === 'card'
                      ? 'border-primary bg-primary/5 text-primary'
                      : 'border-muted hover:border-muted-foreground/30 text-muted-foreground'
                  )}
                >
                  <CreditCard className="h-4 w-4" />
                  <span className="text-sm font-medium">Cartão</span>
                </button>
              </div>

              <Separator />

              {activeTab === 'pix' ? (
                <PixSection plan={plan} onSuccess={handleSuccess} earlyRenewal={earlyRenewal} offerContext={effectiveOfferContext} referralCode={validatedReferralCode} />
              ) : (
                renderCardContent()
              )}
            </CardContent>
          </Card>
        )}

        <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
          <ShieldCheck className="h-4 w-4" />
          <span>Pagamento seguro processado por Mercado Pago</span>
        </div>
      </div>
    </div>
  );
}
