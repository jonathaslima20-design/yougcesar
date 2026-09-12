import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import {
  createPixPayment,
  createCardPayment,
  getPaymentStatus,
  loadCaktoSdkScript,
  type CaktoSdkInstance,
} from '@/lib/caktoPayments';
import { toast } from 'sonner';
import { logActivity } from '@/lib/activityLogger';
import { formatCurrencyI18n } from '@/lib/i18n';
import { QrCode, CreditCard, Copy, Check, Loader as Loader2, Clock, CircleCheck as CheckCircle2, Circle as XCircle, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useNavigate } from 'react-router-dom';

interface PlanInfo {
  id: string;
  name: string;
  price: number;
  duration: string;
}

interface OfferContext {
  offer_id: string;
  final_price: number;
}

interface SectionProps {
  plan: PlanInfo;
  sdkClientId: string;
  onSuccess: () => void;
  earlyRenewal?: boolean;
  offerContext?: OfferContext | null;
  referralCode?: string;
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

function formatCardNumber(value: string): string {
  return value.replace(/\D/g, '').slice(0, 19).replace(/(\d{4})(?=\d)/g, '$1 ');
}

function formatPhoneE164(value: string): string {
  const digits = value.replace(/\D/g, '');
  return digits.startsWith('55') ? digits : `55${digits}`;
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

// Both card and Pix payloads require a customer.fingerprint. The Cakto docs
// don't spell out its source for Pix, only that it's a "device/session
// identifier" — reusing the antifraud module's session reference for both is
// the pragmatic reading (same SDK, same underlying device session), but
// this should be confirmed with Cakto support/sandbox before relying on it
// at scale.
async function initSdkAndGetFingerprint(sdkClientId: string): Promise<{ sdk: CaktoSdkInstance; fingerprint: string }> {
  await loadCaktoSdkScript();
  if (!window.Cakto) throw new Error('SDK da Cakto não carregou');
  const sdk = new window.Cakto.CaktoSDK({ client_id: sdkClientId });
  await sdk.initAntifraud();
  await sdk.completeAntifraudProfile();
  const fingerprint = sdk.getAntifraudReference();
  return { sdk, fingerprint };
}

export function CaktoPixSection({ plan, sdkClientId, onSuccess, earlyRenewal, offerContext, referralCode }: SectionProps) {
  const { user } = useAuth();
  const [name, setName] = useState(user?.name || '');
  const [email, setEmail] = useState(user?.email || '');
  const [phone, setPhone] = useState('');
  const [doc, setDoc] = useState('');
  const [loading, setLoading] = useState(false);
  const [pixResult, setPixResult] = useState<{ pix_qr_code: string; payment_id: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [paymentApproved, setPaymentApproved] = useState(false);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  useEffect(() => {
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
      if (channelRef.current) supabase.removeChannel(channelRef.current);
    };
  }, []);

  const startPolling = useCallback((paymentId: string) => {
    pollingRef.current = setInterval(async () => {
      try {
        const status = await getPaymentStatus(paymentId);
        if (status.status === 'paid') {
          if (pollingRef.current) clearInterval(pollingRef.current);
          setPaymentApproved(true);
          onSuccess();
        }
      } catch {
        // ignore polling errors
      }
    }, 5000);

    channelRef.current = supabase
      .channel(`cakto_payment_${paymentId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'cakto_payments', filter: `id=eq.${paymentId}` },
        (payload) => {
          if (payload.new?.status === 'paid') {
            if (pollingRef.current) clearInterval(pollingRef.current);
            setPaymentApproved(true);
            onSuccess();
          }
        }
      )
      .subscribe();
  }, [onSuccess]);

  const handleSubmit = async () => {
    if (!name || !email || !doc || !phone) {
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
      const { fingerprint } = await initSdkAndGetFingerprint(sdkClientId);
      const result = await createPixPayment({
        plan_id: plan.id,
        billing_cycle: plan.duration,
        customer: { name, email, phone: formatPhoneE164(phone), doc: cleanDoc, fingerprint },
        early_renewal: earlyRenewal,
        offer_id: offerContext?.offer_id,
        referral_code: referralCode,
      });
      setPixResult({ pix_qr_code: result.pix_qr_code, payment_id: result.payment_id });
      logActivity(
        'payment.pix_generated',
        `Gerou código Pix para o plano "${plan.name}" (${formatCurrencyI18n(offerContext?.final_price ?? plan.price)})`,
        'plan',
        plan.id
      );
      startPolling(result.payment_id);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao gerar Pix');
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    if (pixResult?.pix_qr_code) {
      navigator.clipboard.writeText(pixResult.pix_qr_code);
      setCopied(true);
      toast.success('Código Pix copiado!');
      setTimeout(() => setCopied(false), 3000);
    }
  };

  if (paymentApproved) return <PaymentSuccess />;

  if (pixResult) {
    return (
      <div className="space-y-6">
        <div className="text-center space-y-2">
          <div className="flex justify-center">
            <div className="h-14 w-14 rounded-full bg-green-500/10 flex items-center justify-center">
              <QrCode className="h-7 w-7 text-green-600" />
            </div>
          </div>
          <h3 className="text-lg font-semibold">Código Pix gerado!</h3>
          <p className="text-sm text-muted-foreground">Copie o código para pagar no app do seu banco</p>
        </div>

        {pixResult.pix_qr_code && (
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Código Pix (copia e cola)</Label>
            <div className="flex gap-2">
              <Input value={pixResult.pix_qr_code} readOnly className="text-xs font-mono" />
              <Button variant="outline" size="icon" onClick={handleCopy} className="shrink-0">
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
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="cakto-pix-name">Nome completo *</Label>
        <Input id="cakto-pix-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome completo" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="cakto-pix-email">E-mail *</Label>
        <Input id="cakto-pix-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="seu@email.com" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="cakto-pix-phone">WhatsApp *</Label>
        <Input id="cakto-pix-phone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="(11) 99999-9999" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="cakto-pix-doc">CPF/CNPJ *</Label>
        <Input id="cakto-pix-doc" value={doc} onChange={(e) => setDoc(formatCpf(e.target.value))} placeholder="000.000.000-00" maxLength={18} />
      </div>

      <Button onClick={handleSubmit} disabled={loading} className="w-full" size="lg">
        {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <QrCode className="h-4 w-4 mr-2" />}
        Gerar código Pix
      </Button>
    </div>
  );
}

export function CaktoCardSection({ plan, sdkClientId, onSuccess, earlyRenewal, offerContext, referralCode }: SectionProps) {
  const { user } = useAuth();
  const [name, setName] = useState(user?.name || '');
  const [email, setEmail] = useState(user?.email || '');
  const [phone, setPhone] = useState('');
  const [doc, setDoc] = useState('');
  const [holderName, setHolderName] = useState('');
  const [cardNumber, setCardNumber] = useState('');
  const [expMonth, setExpMonth] = useState('');
  const [expYear, setExpYear] = useState('');
  const [cvv, setCvv] = useState('');
  const [installments, setInstallments] = useState('1');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ status: string } | null>(null);
  const cardFillLoggedRef = useRef(false);

  const logCardFillStarted = () => {
    if (cardFillLoggedRef.current) return;
    cardFillLoggedRef.current = true;
    logActivity(
      'payment.card_form_started',
      `Iniciou o preenchimento dos dados do cartão para o plano "${plan.name}"`,
      'plan',
      plan.id
    );
  };

  const handleSubmit = async () => {
    if (!name || !email || !doc || !phone || !holderName || !cardNumber || !expMonth || !expYear || !cvv) {
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
      const { sdk, fingerprint } = await initSdkAndGetFingerprint(sdkClientId);
      const { cardToken } = await sdk.createToken({
        holderName,
        cardNumber: cardNumber.replace(/\D/g, ''),
        cvv,
        expMonth,
        expYear,
      });
      const antifraudReference = sdk.getAntifraudReference();

      const cardResult = await createCardPayment({
        plan_id: plan.id,
        billing_cycle: plan.duration,
        card_token: cardToken,
        antifraud_reference: antifraudReference,
        installments: Number(installments),
        customer: { name, email, phone: formatPhoneE164(phone), doc: cleanDoc, fingerprint },
        early_renewal: earlyRenewal,
        offer_id: offerContext?.offer_id,
        referral_code: referralCode,
      });

      setResult({ status: cardResult.status });
      if (cardResult.status === 'paid') {
        onSuccess();
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao processar pagamento');
    } finally {
      setLoading(false);
    }
  };

  if (result) {
    if (result.status === 'paid') return <PaymentSuccess />;

    return (
      <div className="text-center space-y-4 py-8">
        <div className="flex justify-center">
          <div className="h-14 w-14 rounded-full bg-red-500/10 flex items-center justify-center">
            <XCircle className="h-7 w-7 text-red-500" />
          </div>
        </div>
        <h3 className="text-lg font-semibold">Pagamento recusado</h3>
        <p className="text-sm text-muted-foreground max-w-sm mx-auto">
          Verifique os dados do cartão ou tente outro meio de pagamento.
        </p>
        <Button variant="outline" onClick={() => setResult(null)}>
          Tentar novamente
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="cakto-card-name">Nome completo *</Label>
          <Input id="cakto-card-name" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="cakto-card-phone">WhatsApp *</Label>
          <Input id="cakto-card-phone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="(11) 99999-9999" />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="cakto-card-email">E-mail *</Label>
        <Input id="cakto-card-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="cakto-card-doc">CPF/CNPJ *</Label>
        <Input id="cakto-card-doc" value={doc} onChange={(e) => setDoc(formatCpf(e.target.value))} placeholder="000.000.000-00" maxLength={18} />
      </div>

      <Label className="text-xs text-muted-foreground pt-2">Dados do cartão</Label>
      <div className="space-y-2">
        <Label htmlFor="cakto-holder-name">Nome impresso no cartão *</Label>
        <Input id="cakto-holder-name" value={holderName} onChange={(e) => setHolderName(e.target.value)} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="cakto-card-number">Número do cartão *</Label>
        <Input
          id="cakto-card-number"
          value={cardNumber}
          onChange={(e) => { logCardFillStarted(); setCardNumber(formatCardNumber(e.target.value)); }}
          placeholder="0000 0000 0000 0000"
          maxLength={23}
        />
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div className="space-y-2">
          <Label htmlFor="cakto-exp-month">Mês *</Label>
          <Input id="cakto-exp-month" value={expMonth} onChange={(e) => setExpMonth(e.target.value.replace(/\D/g, '').slice(0, 2))} placeholder="MM" maxLength={2} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="cakto-exp-year">Ano *</Label>
          <Input id="cakto-exp-year" value={expYear} onChange={(e) => setExpYear(e.target.value.replace(/\D/g, '').slice(0, 4))} placeholder="AAAA" maxLength={4} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="cakto-cvv">CVV *</Label>
          <Input id="cakto-cvv" value={cvv} onChange={(e) => setCvv(e.target.value.replace(/\D/g, '').slice(0, 4))} placeholder="123" maxLength={4} />
        </div>
      </div>

      <div className="space-y-2">
        <Label>Parcelas</Label>
        <Select value={installments} onValueChange={setInstallments}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Array.from({ length: 12 }, (_, i) => i + 1).map((n) => (
              <SelectItem key={n} value={String(n)}>
                {n}x
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Button onClick={handleSubmit} disabled={loading} className="w-full" size="lg">
        {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <CreditCard className="h-4 w-4 mr-2" />}
        Pagar
      </Button>

      <div className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground pt-2">
        <ShieldCheck className="h-3.5 w-3.5" />
        <span>Pagamento processado com segurança pela Cakto</span>
      </div>
    </div>
  );
}
