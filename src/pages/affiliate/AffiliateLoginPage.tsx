import { useState } from 'react';
import { Navigate, useNavigate, useLocation } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import { Loader, CircleAlert as AlertCircle, Handshake } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { PasswordInput } from '@/components/ui/password-input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { useAffiliateAuth } from '@/contexts/AffiliateAuthContext';
import { ThemeToggle } from '@/components/ui/theme-toggle';

const formSchema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(1, 'Informe sua senha'),
});

type FormValues = z.infer<typeof formSchema>;

export default function AffiliateLoginPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const { affiliate, loading: authLoading, signIn } = useAffiliateAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const redirectTo = (location.state as { from?: string } | null)?.from || '/afiliado/painel';

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { email: '', password: '' },
  });

  if (!authLoading && affiliate) {
    return <Navigate to={redirectTo} replace />;
  }

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
        <div className="flex justify-center mb-6">
          <div className="flex items-center gap-2 text-lg font-bold">
            <Handshake className="h-6 w-6 text-primary" />
            Painel do Afiliado
          </div>
        </div>

        <Card className="shadow-xl border-border/50 backdrop-blur-sm">
          <CardHeader className="space-y-2 px-7 pt-7">
            <CardTitle className="text-2xl text-center page-title">Entrar</CardTitle>
            <CardDescription className="text-center text-[14px]">
              Acesse suas métricas de vendas e comissões
            </CardDescription>
          </CardHeader>
          <CardContent className="px-7 pb-7">
            {loginError && (
              <Alert variant="destructive" className="mb-4">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{loginError}</AlertDescription>
              </Alert>
            )}

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
            <p className="text-xs text-center text-muted-foreground mt-4">
              Sua conta de afiliado é criada pela loja que você representa. Se ainda não recebeu um acesso, fale com o lojista.
            </p>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
