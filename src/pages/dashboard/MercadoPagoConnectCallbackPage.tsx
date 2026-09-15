import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader } from 'lucide-react';
import { toast } from 'sonner';
import { exchangeMercadoPagoCode } from '@/lib/merchantPayments';

const MP_OAUTH_URL_KEY = 'vitrineturbo_mp_oauth_url';
const RETURN_TO = '/dashboard/settings?tab=payment';

export default function MercadoPagoConnectCallbackPage() {
  const navigate = useNavigate();
  const hasRun = useRef(false);

  useEffect(() => {
    if (hasRun.current) return;
    hasRun.current = true;

    const stashedUrl = sessionStorage.getItem(MP_OAUTH_URL_KEY);
    sessionStorage.removeItem(MP_OAUTH_URL_KEY);

    const callbackUrl = stashedUrl || window.location.href;
    const params = new URL(callbackUrl).searchParams;
    const oauthError = params.get('error_description') || params.get('error');
    const code = params.get('code');
    const state = params.get('state');

    const process = async () => {
      if (oauthError) {
        toast.error(`Conexão com o Mercado Pago cancelada: ${oauthError}`);
        navigate(RETURN_TO, { replace: true });
        return;
      }

      if (!code || !state) {
        toast.error('Retorno do Mercado Pago incompleto. Tente conectar novamente.');
        navigate(RETURN_TO, { replace: true });
        return;
      }

      try {
        await exchangeMercadoPagoCode({ code, state });
        toast.success('Conta Mercado Pago conectada com sucesso!');
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Erro ao concluir a conexão com o Mercado Pago');
      } finally {
        navigate(RETURN_TO, { replace: true });
      }
    };

    process();
  }, [navigate]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-background">
      <Loader className="h-8 w-8 animate-spin text-primary" />
      <p className="text-muted-foreground text-sm">Concluindo conexão com o Mercado Pago...</p>
    </div>
  );
}
