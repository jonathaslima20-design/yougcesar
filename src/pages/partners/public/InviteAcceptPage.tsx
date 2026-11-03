import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { BadgeCheck, Loader2, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { resolveActiveSession } from '@/lib/auth/simpleAuth';
import { partnerApi } from '@/lib/partners/partnerApi';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { PasswordInput } from '@/components/ui/password-input';

type InviteInfo = { kind: 'partner' | 'client' | 'team'; name: string; email: string; partner_name: string | null };

/** /convite/:token — activation for partners, clients taking over a store, and agency staff. */
export default function InviteAcceptPage() {
  const { token } = useParams();
  const navigate = useNavigate();
  const { refreshUser } = useAuth();
  const [info, setInfo] = useState<InviteInfo | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [keepAccess, setKeepAccess] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    document.title = 'Ativar acesso | VitrineTurbo';
    if (!token) return;
    partnerApi
      .inspectInvite(token)
      .then(setInfo)
      .catch((e: Error) => setProblem(e.message))
      .finally(() => setLoading(false));
  }, [token]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !info) return;
    if (password.length < 8) {
      toast.error('A senha precisa ter pelo menos 8 caracteres.');
      return;
    }
    if (password !== confirm) {
      toast.error('As senhas não conferem.');
      return;
    }
    setSubmitting(true);
    try {
      await supabase.auth.signOut().catch(() => undefined);
      const { hashedToken, kind } = await partnerApi.redeemInvite(token);
      const { error: verifyError } = await supabase.auth.verifyOtp({ token_hash: hashedToken, type: 'magiclink' });
      if (verifyError) throw new Error('Não foi possível validar o convite. Peça um novo link.');
      const { error: passwordError } = await supabase.auth.updateUser({ password });
      if (passwordError) throw new Error(passwordError.message);

      const { user, error } = await resolveActiveSession();
      if (error || !user) throw new Error(error || 'Não foi possível concluir o acesso.');
      await refreshUser();

      if (kind === 'client') {
        await supabase.rpc('accept_partner_store_invite', { p_grant: keepAccess });
        toast.success('Tudo pronto! Esta é a sua loja.');
        navigate('/dashboard', { replace: true });
      } else {
        toast.success('Acesso ativado. Bem-vindo ao VitrineTurbo Partners!');
        navigate('/partners', { replace: true });
      }
    } catch (error) {
      toast.error((error as Error).message);
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (problem || !info) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <Card className="max-w-md w-full">
          <CardHeader>
            <CardTitle>Convite indisponível</CardTitle>
            <CardDescription>{problem ?? 'Convite não encontrado.'}</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            <Button asChild>
              <Link to="/login">Entrar como lojista</Link>
            </Button>
            <Button asChild variant="outline">
              <Link to="/partners/login">Entrar no painel Partners</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const title =
    info.kind === 'client'
      ? 'Sua loja está pronta'
      : info.kind === 'team'
        ? `Você foi convidado para a equipe${info.partner_name ? ` de ${info.partner_name}` : ''}`
        : 'Ative seu painel de parceiro';
  const description =
    info.kind === 'client'
      ? `${info.partner_name ?? 'Seu parceiro'} montou a sua loja no VitrineTurbo. Defina uma senha para assumir a conta.`
      : 'Defina uma senha para acessar o VitrineTurbo Partners.';

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4 py-10">
      <Card className="max-w-md w-full">
        <CardHeader>
          <div className="h-11 w-11 rounded-2xl bg-primary/10 flex items-center justify-center mb-2">
            <BadgeCheck className="h-5 w-5 text-primary" />
          </div>
          <CardTitle className="text-xl">{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="space-y-4">
            <div className="rounded-lg bg-muted/50 px-3 py-2 text-sm">
              <span className="text-muted-foreground">E-mail de acesso: </span>
              <span className="font-medium break-all">{info.email}</span>
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Nova senha</Label>
              <PasswordInput id="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm">Confirme a senha</Label>
              <PasswordInput id="confirm" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" required />
            </div>
            {info.kind === 'client' && (
              <label className="flex items-start gap-3 rounded-lg border p-3 text-sm cursor-pointer">
                <Checkbox checked={keepAccess} onCheckedChange={(v) => setKeepAccess(v === true)} className="mt-0.5" />
                <span>
                  <span className="font-medium flex items-center gap-1.5">
                    <ShieldCheck className="h-4 w-4" /> Permitir que {info.partner_name ?? 'meu parceiro'} continue gerenciando a loja
                  </span>
                  <span className="text-muted-foreground block mt-1">
                    Você pode revogar esse acesso quando quiser, nas configurações da sua conta.
                  </span>
                </span>
              </label>
            )}
            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {info.kind === 'client' ? 'Assumir minha loja' : 'Ativar acesso'}
            </Button>
            <p className="text-xs text-muted-foreground text-center">
              Ao continuar, você concorda com os{' '}
              <Link to={info.kind === 'client' ? '/termos-de-uso' : '/parceiros/termos'} target="_blank" className="underline">
                termos
              </Link>{' '}
              e a{' '}
              <Link to="/politica-de-privacidade" target="_blank" className="underline">política de privacidade</Link>.
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
