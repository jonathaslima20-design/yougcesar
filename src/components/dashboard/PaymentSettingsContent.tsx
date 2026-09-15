import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { Loader as Loader2, ArrowLeft, ChevronRight, TriangleAlert as AlertTriangle, CircleCheck as CheckCircle2, Unlink } from 'lucide-react';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { useAuth } from '@/contexts/AuthContext';
import { usePlatformPaymentsEnabled } from '@/hooks/usePlatformPaymentsEnabled';
import {
  getMerchantPaymentConfig,
  getMercadoPagoAuthorizeUrl,
  disconnectMercadoPago,
  type MerchantPaymentConfig,
} from '@/lib/merchantPayments';

export default function PaymentSettingsContent() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [config, setConfig] = useState<MerchantPaymentConfig | null>(null);
  const [selectedProvider, setSelectedProvider] = useState<'mercadopago' | null>(null);
  const { enabled: platformPaymentsEnabled } = usePlatformPaymentsEnabled(user?.id);

  const isBRL = (user?.currency || 'BRL').toUpperCase() === 'BRL';
  const isConnected = !!config?.connected;

  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    try {
      const { config } = await getMerchantPaymentConfig();
      setConfig(config);
    } catch (error) {
      console.error('Error loading payment config:', error);
      toast.error('Erro ao carregar configurações de pagamento');
    } finally {
      setLoading(false);
    }
  };

  const handleConnect = async () => {
    setConnecting(true);
    try {
      const { authorize_url } = await getMercadoPagoAuthorizeUrl();
      window.location.href = authorize_url;
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao iniciar conexão com o Mercado Pago');
      setConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    setDisconnecting(true);
    try {
      await disconnectMercadoPago();
      toast.success('Conta Mercado Pago desconectada');
      await loadConfig();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao desconectar');
    } finally {
      setDisconnecting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[200px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!selectedProvider) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-sm font-medium mb-1">Meios de pagamento</h2>
          <p className="text-xs text-muted-foreground">
            Escolha um meio de pagamento para configurar. Mais opções em breve.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Card
            className="cursor-pointer hover:border-primary/50 transition-colors"
            onClick={() => setSelectedProvider('mercadopago')}
          >
            <CardContent className="flex items-center justify-between gap-4 py-5">
              <div className="flex items-center gap-4">
                <img src="/logos/mercado-pago.png" alt="Mercado Pago" className="h-7 w-auto" />
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={isConnected ? 'default' : 'outline'}>
                  {isConnected ? 'Conectado' : 'Não conectado'}
                </Badge>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="text-muted-foreground -ml-2"
        onClick={() => setSelectedProvider(null)}
      >
        <ArrowLeft className="h-4 w-4 mr-1.5" />
        Voltar
      </Button>

      {!isBRL && (
        <div className="flex items-start gap-2 rounded-md bg-amber-500/10 border border-amber-500/20 px-4 py-3 text-sm text-amber-700">
          <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
          <span>Pagamento online disponível apenas para lojas com moeda configurada em Real (BRL).</span>
        </div>
      )}

      {!platformPaymentsEnabled && (
        <div className="flex items-start gap-2 rounded-md bg-amber-500/10 border border-amber-500/20 px-4 py-3 text-sm text-amber-700">
          <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
          <span>
            Pagamentos online estão temporariamente desativados para todas as lojas enquanto a
            VitrineTurbo finaliza os testes dessa funcionalidade.
          </span>
        </div>
      )}

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                Mercado Pago
                {isConnected && (
                  <Badge className="bg-green-500 text-white text-[10px] px-1.5">
                    <CheckCircle2 className="h-3 w-3 mr-1" /> Conectado
                  </Badge>
                )}
              </CardTitle>
              <CardDescription>
                Conecte sua conta do Mercado Pago pra receber pagamentos via Pix e cartão direto na sua
                vitrine. Toda venda paga online é depositada na sua própria conta.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {isConnected ? (
            <>
              {config?.mp_account_email && (
                <p className="text-sm text-muted-foreground">
                  Conta: <span className="font-medium text-foreground">{config.mp_account_email}</span>
                </p>
              )}
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="ghost" className="text-destructive hover:text-destructive" disabled={disconnecting}>
                    <Unlink className="mr-2 h-4 w-4" />
                    Desconectar
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Desconectar do Mercado Pago?</AlertDialogTitle>
                    <AlertDialogDescription>
                      O pagamento online na sua vitrine para de funcionar até você conectar novamente.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={handleDisconnect}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      Desconectar
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </>
          ) : (
            <Button onClick={handleConnect} disabled={connecting || !isBRL || !platformPaymentsEnabled}>
              {connecting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Conectar com Mercado Pago
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
