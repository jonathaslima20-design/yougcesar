import { useState } from 'react';
import { Loader as Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PasswordInput } from '@/components/ui/password-input';
import { Separator } from '@/components/ui/separator';
import { useBuyerAuth } from '@/contexts/BuyerAuthContext';
import GoogleIcon from '@/components/icons/GoogleIcon';

interface BuyerAuthInlineProps {
  onSuccess: () => void;
  storeSlug?: string;
}

export default function BuyerAuthInline({ onSuccess, storeSlug }: BuyerAuthInlineProps) {
  const { signIn, signUp, signInWithGoogle } = useBuyerAuth();
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGoogleSignIn = async () => {
    setError(null);
    setGoogleLoading(true);
    try {
      const { error: googleError } = await signInWithGoogle({
        redirectTo: window.location.pathname,
        storeSlug,
      });
      if (googleError) {
        setError(googleError);
        setGoogleLoading(false);
      }
    } catch {
      setError('Não foi possível iniciar o login com Google');
      setGoogleLoading(false);
    }
  };

  const handleSubmit = async () => {
    setError(null);
    if (!email.trim() || !password.trim() || (mode === 'signup' && !fullName.trim())) {
      setError('Preencha todos os campos');
      return;
    }

    setLoading(true);
    try {
      const result =
        mode === 'login'
          ? await signIn(email, password)
          : await signUp(email, password, { full_name: fullName });

      if (result.error) {
        setError(result.error);
        return;
      }
      onSuccess();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="border rounded-lg p-3 space-y-3 bg-muted/20">
      <div className="flex gap-1 text-xs">
        <button
          type="button"
          onClick={() => setMode('login')}
          className={`flex-1 px-2 py-1.5 rounded-md font-medium transition-colors ${mode === 'login' ? 'bg-background shadow-sm' : 'text-muted-foreground'}`}
        >
          Entrar
        </button>
        <button
          type="button"
          onClick={() => setMode('signup')}
          className={`flex-1 px-2 py-1.5 rounded-md font-medium transition-colors ${mode === 'signup' ? 'bg-background shadow-sm' : 'text-muted-foreground'}`}
        >
          Criar conta
        </button>
      </div>

      <p className="text-xs text-muted-foreground">
        Pra pagar direto na vitrine, entre ou crie uma conta de comprador.
      </p>

      <Button
        type="button"
        variant="outline"
        size="sm"
        className="w-full h-9"
        onClick={handleGoogleSignIn}
        disabled={googleLoading || loading}
      >
        {googleLoading ? (
          <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
        ) : (
          <GoogleIcon className="mr-2 h-3.5 w-3.5" />
        )}
        Continuar com Google
      </Button>

      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <Separator />
        </div>
        <div className="relative flex justify-center text-[10px] uppercase">
          <span className="bg-muted/20 px-2 text-muted-foreground">ou</span>
        </div>
      </div>

      {mode === 'signup' && (
        <div className="space-y-1">
          <Label className="text-xs">Nome</Label>
          <Input value={fullName} onChange={(e) => setFullName(e.target.value)} className="h-9 text-xs" />
        </div>
      )}
      <div className="space-y-1">
        <Label className="text-xs">Email</Label>
        <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="h-9 text-xs" />
      </div>
      <div className="space-y-1">
        <Label className="text-xs">Senha</Label>
        <PasswordInput value={password} onChange={(e) => setPassword(e.target.value)} className="h-9 text-xs" />
      </div>

      {error && <p className="text-xs text-destructive">{error}</p>}

      <Button type="button" size="sm" className="w-full h-9" onClick={handleSubmit} disabled={loading}>
        {loading && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
        {mode === 'login' ? 'Entrar' : 'Criar conta e continuar'}
      </Button>
    </div>
  );
}
