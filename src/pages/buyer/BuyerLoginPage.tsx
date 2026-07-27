import { useState } from 'react';
import { Link, useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import { Loader, CircleAlert as AlertCircle } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { PasswordInput } from '@/components/ui/password-input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { useBuyerAuth } from '@/contexts/BuyerAuthContext';
import { ThemeToggle } from '@/components/ui/theme-toggle';
import GoogleIcon from '@/components/icons/GoogleIcon';
import { StoreBrand } from '@/components/corretor/StoreBrand';

const formSchema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(6, 'A senha deve ter pelo menos 6 caracteres'),
});

type FormValues = z.infer<typeof formSchema>;

export default function BuyerLoginPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const { signIn, signInWithGoogle } = useBuyerAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();

  const storeSlug = searchParams.get('loja') || undefined;
  const redirectTo =
    (location.state as { from?: string } | null)?.from || searchParams.get('from') || '/conta/pedidos';
  const registerLink = storeSlug ? `/conta/cadastro?loja=${storeSlug}` : '/conta/cadastro';

  const handleGoogleSignIn = async () => {
    setIsGoogleLoading(true);
    try {
      const { error } = await signInWithGoogle({ redirectTo, storeSlug });
      if (error) {
        toast.error(error);
        setIsGoogleLoading(false);
      }
    } catch {
      toast.error('Não foi possível iniciar o login com Google');
      setIsGoogleLoading(false);
    }
  };

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { email: '', password: '' },
  });

  const onSubmit = async (data: FormValues) => {
    setIsLoading(true);
    setLoginError(null);
    try {
      const { error } = await signIn(data.email, data.password);
      if (error) {
        setLoginError(error);
        toast.error(error);
        return;
      }
      toast.success('Login realizado com sucesso!');
      navigate(redirectTo, { replace: true });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background relative overflow-hidden">
      <div className="absolute inset-0 grid-bg opacity-40 pointer-events-none" />
      <div className="fixed top-4 right-4 z-50">
        <ThemeToggle />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="w-full max-w-md relative z-10"
      >
        {storeSlug && (
          <div className="flex justify-center mb-8">
            <StoreBrand storeSlug={storeSlug} />
          </div>
        )}

        <Card className="shadow-xl border-border/50 backdrop-blur-sm">
          <CardHeader className="space-y-2 px-7 pt-7">
            <CardTitle className="text-2xl text-center page-title">Entrar</CardTitle>
            <CardDescription className="text-center text-[14px]">
              Entre na sua conta de comprador para acompanhar seus pedidos
            </CardDescription>
          </CardHeader>
          <CardContent className="px-7">
            {loginError && (
              <Alert variant="destructive" className="mb-4">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{loginError}</AlertDescription>
              </Alert>
            )}

            <Button
              type="button"
              variant="outline"
              className="w-full mb-4"
              onClick={handleGoogleSignIn}
              disabled={isGoogleLoading || isLoading}
            >
              {isGoogleLoading ? (
                <Loader className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <GoogleIcon className="mr-2 h-4 w-4" />
              )}
              Entrar com Google
            </Button>

            <div className="relative mb-4">
              <div className="absolute inset-0 flex items-center">
                <Separator />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-card px-2 text-muted-foreground">ou</span>
              </div>
            </div>

            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl>
                        <Input placeholder="seu@email.com" type="email" disabled={isLoading} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Senha</FormLabel>
                      <FormControl>
                        <PasswordInput placeholder="******" disabled={isLoading} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading ? <Loader className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Entrar
                </Button>
              </form>
            </Form>
          </CardContent>
          <CardFooter className="px-7 pb-7">
            <div className="text-sm text-center text-muted-foreground w-full">
              Não tem uma conta?{' '}
              <Link to={registerLink} state={{ from: redirectTo }} className="text-primary hover:underline">
                Criar conta
              </Link>
            </div>
          </CardFooter>
        </Card>
      </motion.div>
    </div>
  );
}
