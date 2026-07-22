import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader } from 'lucide-react';
import { toast } from 'sonner';
import { resolveActiveSession } from '@/lib/auth/simpleAuth';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';

export default function AuthCallbackPage() {
  const navigate = useNavigate();
  const { refreshUser } = useAuth();

  useEffect(() => {
    let cancelled = false;

    const process = async () => {
      const { user, error, needsProfile, pendingAuth } = await resolveActiveSession();
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

      await refreshUser();
      toast.success('Login realizado com sucesso!');
      navigate('/dashboard', { replace: true });
    };

    process();

    return () => {
      cancelled = true;
    };
  }, [navigate, refreshUser]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-background">
      <Loader className="h-8 w-8 animate-spin text-primary" />
      <p className="text-muted-foreground text-sm">Concluindo login...</p>
    </div>
  );
}
