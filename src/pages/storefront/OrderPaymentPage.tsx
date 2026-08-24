import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { initMercadoPago, CardPayment } from '@mercadopago/sdk-react';
import { toast } from 'sonner';
import {
  QrCode,
  CreditCard,
  Copy,
  Check,
  Loader as Loader2,
  ArrowLeft,
  ShieldCheck,
  Clock,
  CircleCheck as CheckCircle2,
  Circle as XCircle,
  CircleAlert as AlertCircle,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { useBuyerAuth } from '@/contexts/BuyerAuthContext';
import { supabaseBuyer } from '@/lib/supabaseBuyer';
import {
  getSellerPublicKey,
  createOrderPixPayment,
  createOrderCardPayment,
  getOrderPaymentStatus,
  type OrderPixPaymentResult,
  type OrderCardPaymentResult,
} from '@/lib/merchantPayments';
import { OrderStatusTimeline } from '@/components/buyer/OrderStatusTimeline';
import { OrderItemsSummary, type OrderItemRow } from '@/components/buyer/OrderItemsSummary';
import { OrderShippingAddress, hasShippingAddress } from '@/components/buyer/OrderShippingAddress';
import { OrderPickupInfo } from '@/components/buyer/OrderPickupInfo';
import { formatCpfCnpj } from '@/lib/document';
import type { OrderStatus } from '@/types';

type PaymentTab = 'pix' | 'card';

interface OrderInfo {
  id: string;
  store_owner_id: string;
  status: OrderStatus;
  total: number;
  payment_status: string;
  subtotal: number;
  delivery_fee: number | null;
  delivery_option: string | null;
  delivery_scope: string | null;
  pickup_instructions: string | null;
  insurance_fee: number | null;
  discount_amount: number | null;
  shipping_street: string | null;
  shipping_number: string | null;
  shipping_complement: string | null;
  shipping_neighborhood: string | null;
  shipping_city: string | null;
  shipping_state: string | null;
  shipping_zip_code: string | null;
  customer_cpf: string | null;
}

interface StoreInfo {
  name: string;
  slug: string;
  city?: string | null;
  state?: string | null;
}

// Não repete a lista de itens aqui: a coluna de resumo (à esquerda no
// desktop) já mostra isso o tempo todo, antes e depois do pagamento.
function PaymentSuccess({ storeSlug, order, store }: { storeSlug: string; order: OrderInfo; store: StoreInfo | null }) {
  const isPickup = order.delivery_scope === 'pickup';
  const hasAddress = !isPickup && hasShippingAddress(order);

  return (
    <div className="space-y-6">
      <div className="text-center space-y-4 py-4">
        <div className="flex justify-center">
          <div className="h-16 w-16 rounded-full bg-green-500/10 flex items-center justify-center animate-in zoom-in duration-300">
            <CheckCircle2 className="h-8 w-8 text-green-600" />
          </div>
        </div>
        <h3 className="text-xl font-semibold">Pagamento aprovado!</h3>
        <p className="text-sm text-muted-foreground max-w-sm mx-auto">
          Seu pedido foi confirmado. O vendedor já foi notificado.
        </p>
      </div>

      <Separator />

      <div className="space-y-2">
        <p className="text-sm font-medium">Status do pedido</p>
        <OrderStatusTimeline status={order.status} />
      </div>

      {isPickup && (
        <>
          <Separator />
          <div className="space-y-2">
            <p className="text-sm font-medium">Retirada na loja</p>
            <OrderPickupInfo order={order} store={store || undefined} />
          </div>
        </>
      )}

      {hasAddress && (
        <>
          <Separator />
          <div className="space-y-2">
            <p className="text-sm font-medium">Endereço de entrega</p>
            <OrderShippingAddress address={order} />
          </div>
        </>
      )}

      <div className="flex gap-2 justify-center pt-2">
        <Button asChild variant="outline">
          <Link to={`/${storeSlug}`}>Voltar à loja</Link>
        </Button>
        <Button asChild>
          <Link to={`/conta/pedidos/${order.id}`}>Ver pedido</Link>
        </Button>
      </div>
    </div>
  );
}

function PixSection({ order, onSuccess }: { order: OrderInfo; onSuccess: () => void }) {
  // Every field here is typed fresh by the buyer at payment time — none of
  // it is prefilled from the account or from the checkout step. Mixing an
  // account-derived value into what's sent for this specific charge caused
  // silent mismatches (e.g. a real CPF from checkout landing in a field the
  // buyer had visibly retyped) that were hard to diagnose from the outside.
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [doc, setDoc] = useState('');
  const [loading, setLoading] = useState(false);
  const [pixResult, setPixResult] = useState<OrderPixPaymentResult | null>(null);
  const [copied, setCopied] = useState(false);
  const [approved, setApproved] = useState(false);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, []);

  const startPolling = useCallback(
    (orderPaymentId: string) => {
      pollingRef.current = setInterval(async () => {
        try {
          const status = await getOrderPaymentStatus(orderPaymentId);
          if (status.status === 'approved') {
            if (pollingRef.current) clearInterval(pollingRef.current);
            setApproved(true);
            onSuccess();
          }
        } catch {
          // ignore polling errors
        }
      }, 5000);
    },
    [onSuccess]
  );

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
      const result = await createOrderPixPayment({
        order_id: order.id,
        payer: { email, first_name: firstName, last_name: lastName, doc: cleanDoc },
      });
      setPixResult(result);
      startPolling(result.order_payment_id);
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

  if (approved) return null;

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
          <p className="text-sm text-muted-foreground">Escaneie o QR Code ou copie o código para pagar</p>
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
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="firstName">Nome *</Label>
          <Input id="firstName" value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="Nome" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="lastName">Sobrenome</Label>
          <Input id="lastName" value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="Sobrenome" />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="email">E-mail *</Label>
        <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="seu@email.com" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="doc">CPF/CNPJ *</Label>
        <Input id="doc" value={doc} onChange={(e) => setDoc(formatCpfCnpj(e.target.value))} placeholder="000.000.000-00" maxLength={18} />
      </div>
      <Button onClick={handleSubmit} disabled={loading} className="w-full" size="lg">
        {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <QrCode className="h-4 w-4 mr-2" />}
        Gerar QR Code Pix
      </Button>
      <p className="text-xs text-center text-muted-foreground">O pagamento via Pix é confirmado instantaneamente</p>
    </div>
  );
}

function CardSection({ order, onSuccess }: { order: OrderInfo; onSuccess: () => void }) {
  // Nome/Sobrenome and the card's own document field are typed fresh here —
  // never inherited from the account or the checkout step. Mercado Pago's
  // own charge decision (including its test-card simulation) is keyed off
  // exactly what's submitted with the card, so silently substituting an
  // account-derived value in for it produces mismatches that are invisible
  // in the UI and hard to diagnose.
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [result, setResult] = useState<OrderCardPaymentResult | null>(null);
  const [brickReady, setBrickReady] = useState(false);
  const orderIdRef = useRef(order.id);
  orderIdRef.current = order.id;
  const onSuccessRef = useRef(onSuccess);
  onSuccessRef.current = onSuccess;
  // Refs (not state deps) so typing a name doesn't remount the Brick —
  // handleSubmit is memoized with an empty dep array on purpose.
  const firstNameRef = useRef(firstName);
  firstNameRef.current = firstName;
  const lastNameRef = useRef(lastName);
  lastNameRef.current = lastName;

  const handleSubmit = useCallback(async (formData: any) => {
    return new Promise<void>(async (resolve, reject) => {
      if (!firstNameRef.current.trim()) {
        toast.error('Informe seu nome');
        reject();
        return;
      }
      try {
        const cardResult = await createOrderCardPayment({
          order_id: orderIdRef.current,
          token: formData.token,
          installments: formData.installments,
          payment_method_id: formData.payment_method_id,
          issuer_id: formData.issuer_id || '',
          payer: {
            email: formData.payer?.email || '',
            first_name: firstNameRef.current,
            last_name: lastNameRef.current,
            doc: formData.payer?.identification?.number || '',
          },
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

  const handleReady = useCallback(() => setBrickReady(true), []);
  const handleError = useCallback((error: any) => console.error('CardPayment Brick error:', error), []);

  const initialization = useMemo(() => ({ amount: order.total }), [order.total]);
  const customization = useMemo(
    () => ({ visual: { hideFormTitle: true }, paymentMethods: { maxInstallments: 12 } }),
    []
  );

  if (result) {
    if (result.status === 'approved') return null;

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
        <p className="text-sm text-muted-foreground max-w-sm mx-auto">Verifique os dados do cartão ou tente outro meio de pagamento.</p>
        <Button variant="outline" onClick={() => setResult(null)}>
          Tentar novamente
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="cardFirstName">Nome *</Label>
          <Input id="cardFirstName" value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="Nome" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="cardLastName">Sobrenome</Label>
          <Input id="cardLastName" value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="Sobrenome" />
        </div>
      </div>
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
          <span>Pagamento processado com segurança pelo Mercado Pago</span>
        </div>
      )}
    </div>
  );
}

export default function OrderPaymentPage() {
  const { slug, orderId } = useParams<{ slug: string; orderId: string }>();
  const navigate = useNavigate();
  const { customer, loading: authLoading } = useBuyerAuth();
  const [order, setOrder] = useState<OrderInfo | null>(null);
  const [items, setItems] = useState<OrderItemRow[]>([]);
  const [store, setStore] = useState<StoreInfo | null>(null);
  const [orderLoading, setOrderLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<PaymentTab>('pix');
  const [paymentComplete, setPaymentComplete] = useState(false);
  const [sdkReady, setSdkReady] = useState(false);
  const [sdkError, setSdkError] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    if (!customer) {
      navigate('/conta/entrar', { state: { from: `/${slug}/pedido/${orderId}/pagamento` } });
      return;
    }
    if (!orderId) return;

    (async () => {
      const { data } = await supabaseBuyer
        .from('orders')
        .select(
          'id, store_owner_id, status, total, payment_status, subtotal, delivery_fee, delivery_option, delivery_scope, pickup_instructions, insurance_fee, discount_amount, shipping_street, shipping_number, shipping_complement, shipping_neighborhood, shipping_city, shipping_state, shipping_zip_code, customer_cpf'
        )
        .eq('id', orderId)
        .maybeSingle();

      if (!data) {
        toast.error('Pedido não encontrado');
        navigate(`/${slug}`);
        return;
      }

      setOrder(data);

      const { data: itemRows } = await supabaseBuyer
        .from('order_items')
        .select(
          'id, product_id, product_title, product_image_url, quantity, unit_price, selected_color, selected_size, selected_flavor, selected_variant_label, subtotal'
        )
        .eq('order_id', orderId);
      setItems(itemRows || []);
      if (data.payment_status === 'approved') setPaymentComplete(true);

      const { data: storeData } = await supabaseBuyer
        .from('users')
        .select('name, slug, city, state')
        .eq('id', data.store_owner_id)
        .maybeSingle();
      if (storeData) setStore(storeData);

      setOrderLoading(false);
    })();
  }, [authLoading, customer, orderId, navigate, slug]);

  useEffect(() => {
    if (!order) return;
    let cancelled = false;

    const initSdk = async () => {
      try {
        const info = await getSellerPublicKey(order.store_owner_id);
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
    return () => {
      cancelled = true;
    };
  }, [order]);

  const handleSuccess = useCallback(() => {
    setPaymentComplete(true);
  }, []);

  if (authLoading || orderLoading || !order) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="w-full px-4 sm:px-6 lg:px-8 py-6">
      <div className="max-w-6xl mx-auto space-y-6">
        <Button variant="ghost" size="sm" onClick={() => navigate(`/${slug}`)} className="text-muted-foreground">
          <ArrowLeft className="h-4 w-4 mr-1" />
          Voltar à loja
        </Button>

        <div className="grid grid-cols-1 lg:grid-cols-[420px_1fr] gap-6 items-start">
        {/* Coluna de pagamento: no mobile fica em cima (ordem 1); no desktop
            passa para a direita, com o resumo assumindo a esquerda. */}
        <div className="order-1 lg:order-2 space-y-6">
          {paymentComplete ? (
            <Card>
              <CardContent className="p-6">
                <PaymentSuccess storeSlug={slug || ''} order={order} store={store} />
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

                {sdkError ? (
                  <div className="text-center space-y-4 py-8">
                    <div className="flex justify-center">
                      <div className="h-14 w-14 rounded-full bg-red-500/10 flex items-center justify-center">
                        <AlertCircle className="h-7 w-7 text-red-500" />
                      </div>
                    </div>
                    <h3 className="text-lg font-semibold">Pagamento online indisponível</h3>
                    <p className="text-sm text-muted-foreground max-w-sm mx-auto">
                      Não foi possível carregar o sistema de pagamento desta loja no momento.
                    </p>
                  </div>
                ) : activeTab === 'pix' ? (
                  <PixSection order={order} onSuccess={handleSuccess} />
                ) : !sdkReady ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : (
                  <CardSection order={order} onSuccess={handleSuccess} />
                )}
              </CardContent>
            </Card>
          )}

          <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
            <ShieldCheck className="h-4 w-4" />
            <span>Pagamento seguro processado por Mercado Pago</span>
          </div>
        </div>

        {/* Coluna de resumo: no mobile fica embaixo (ordem 2); no desktop
            vira a esquerda e acompanha a rolagem (sticky). */}
        <div className="order-2 lg:order-1 lg:sticky lg:top-6">
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="text-lg">Resumo do pedido</CardTitle>
              <CardDescription>{store?.name || 'Pedido'} · #{order.id.slice(0, 8)}</CardDescription>
            </CardHeader>
            <CardContent>
              <OrderItemsSummary items={items} totals={order} />
            </CardContent>
          </Card>
        </div>
        </div>
      </div>
    </div>
  );
}
