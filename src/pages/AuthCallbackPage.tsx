import { useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Loader } from 'lucide-react';
import { toast } from 'sonner';
import { resolveActiveSession } from '@/lib/auth/simpleAuth';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';

export default function AuthCallbackPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { refreshUser } = useAuth();
  const hasRun = useRef(false);

  useEffect(() => {
    if (hasRun.current) return;
    hasRun.current = true;

    let cancelled = false;

    const process = async () => {
      // Admin impersonation links carry their own token: verify it directly via the SDK
      // instead of relying on Supabase's /verify redirect, which requires a PKCE code
      // verifier this browser never generated (the link was created server-side by an admin).
      console.log('[callback] start');
      const impersonateToken = searchParams.get('impersonate_token');
      if (impersonateToken) {
        console.log('[callback] verifying impersonation token...');
        const { error: verifyError } = await supabase.auth.verifyOtp({
          token_hash: impersonateToken,
          type: 'magiclink',
        });
        console.log('[callback] verifyOtp done', { verifyError });
        if (cancelled) return;
        if (verifyError) {
          console.error('impersonation verifyOtp error:', verifyError);
          toast.error(`Link de impersonação inválido ou expirado: ${verifyError.message}`);
          navigate('/login', { replace: true });
          return;
        }
      }

      console.log('[callback] resolving active session...');
      const { user, error, needsProfile, pendingAuth } = await resolveActiveSession();
      console.log('[callback] resolveActiveSession done', { hasUser: !!user, error, needsProfile });
      if (cancelled) return;

      if (needsProfile && pendingAuth) {
        navigate('/completar-cadastro', { replace: true, state: { pendingAuth } });
        return;
      }

      if (error === 'BLOCKED_USER') {
        await supabase.auth.signOut();
        toast.error('Usuário desabilitado por pendência financeira, entre em contato com o suporte.');
        navigate('/login', { replace: true });
        return;
      }

      if (error || !user) {
        toast.error(error || 'Não foi possível concluir o login');
        navigate('/login', { replace: true });
        return;
      }

      console.log('[callback] refreshing user in context...');
      await refreshUser();
      console.log('[callback] done, navigating to dashboard');
      toast.success('Login realizado com sucesso!');
      navigate('/dashboard', { replace: true });
    };

    process();

    return () => {
      cancelled = true;
    };
    // Intentionally run once on mount: `navigate` and `refreshUser` are recreated on
    // every render, and re-running this effect mid-flight was cancelling the in-progress
    // verification (its cleanup fired and flipped `cancelled` before the flow finished).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-background">
      <Loader className="h-8 w-8 animate-spin text-primary" />
      <p className="text-muted-foreground text-sm">Concluindo login...</p>
    </div>
  );
}
