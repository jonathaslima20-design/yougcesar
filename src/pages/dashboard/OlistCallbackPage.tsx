import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader } from 'lucide-react';
import { toast } from 'sonner';
import { exchangeErpCode } from '@/lib/merchantErp';

const ERP_OAUTH_URL_KEY = 'vitrineturbo_erp_oauth_url';
const RETURN_TO = '/dashboard/settings?tab=integrations';

export default function OlistCallbackPage() {
  const navigate = useNavigate();
  const hasRun = useRef(false);

  useEffect(() => {
    if (hasRun.current) return;
    hasRun.current = true;

    const stashedUrl = sessionStorage.getItem(ERP_OAUTH_URL_KEY);
    sessionStorage.removeItem(ERP_OAUTH_URL_KEY);

    const callbackUrl = stashedUrl || window.location.href;
    const params = new URL(callbackUrl).searchParams;
    const oauthError = params.get('error_description') || params.get('error');
    const code = params.get('code');
    const state = params.get('state');

    const process = async () => {
      if (oauthError) {
        toast.error(`Conexão com a Olist cancelada: ${oauthError}`);
        navigate(RETURN_TO, { replace: true });
        return;
      }

      if (!code || !state) {
        toast.error('Retorno da Olist incompleto. Tente conectar novamente.');
        navigate(RETURN_TO, { replace: true });
        return;
      }

      try {
        await exchangeErpCode({ code, state });
        toast.success('Conta Olist ERP conectada com sucesso!');
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Erro ao concluir a conexão com a Olist');
      } finally {
        navigate(RETURN_TO, { replace: true });
      }
    };

    process();
  }, [navigate]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-background">
      <Loader className="h-8 w-8 animate-spin text-primary" />
      <p className="text-muted-foreground text-sm">Concluindo conexão com a Olist...</p>
    </div>
  );
}
