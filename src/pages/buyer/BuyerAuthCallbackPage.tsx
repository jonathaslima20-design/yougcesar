import { useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Loader } from 'lucide-react';
import { toast } from 'sonner';
import { resolveBuyerOAuthCallback } from '@/lib/auth/buyerAuth';
import { useBuyerAuth } from '@/contexts/BuyerAuthContext';

export default function BuyerAuthCallbackPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { refreshCustomer } = useBuyerAuth();
  const hasRun = useRef(false);

  useEffect(() => {
    if (hasRun.current) return;
    hasRun.current = true;

    let cancelled = false;

    const process = async () => {
      const { error } = await resolveBuyerOAuthCallback();
      if (cancelled) return;

      if (error) {
        toast.error(error);
        const storeSlug = searchParams.get('loja');
        navigate(storeSlug ? `/conta/entrar?loja=${storeSlug}` : '/conta/entrar', { replace: true });
        return;
      }

      await refreshCustomer();
      if (cancelled) return;

      toast.success('Login realizado com sucesso!');
      const redirectTo = searchParams.get('from') || '/conta/pedidos';
      navigate(redirectTo, { replace: true });
    };

    process();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-background">
      <Loader className="h-8 w-8 animate-spin text-primary" />
      <p className="text-muted-foreground text-sm">Concluindo login...</p>
    </div>
  );
}
