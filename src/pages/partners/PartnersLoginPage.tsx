import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import { Loader, CircleAlert as AlertCircle, Eye, EyeOff } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { useAuth } from '@/contexts/AuthContext';
import { ThemeToggle } from '@/components/ui/theme-toggle';
import Logo from '@/components/Logo';
import { supabase } from '@/lib/supabase';

const formSchema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(6, 'A senha deve ter pelo menos 6 caracteres'),
});

type FormValues = z.infer<typeof formSchema>;

export default function PartnersLoginPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const { signIn } = useAuth();
  const navigate = useNavigate();

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { email: '', password: '' },
  });

  const onSubmit = async (data: FormValues) => {
    try {
      setIsLoading(true);
      setLoginError(null);

      const { error } = await signIn(data.email, data.password);

      if (error) {
        let friendlyError: string;
        if (error === 'BLOCKED_USER') {
          friendlyError = 'Usuário desabilitado por pendência financeira, entre em contato com o suporte.';
        } else if (error.includes('Invalid login credentials') || error.includes('invalid_credentials') || error.includes('E-mail ou senha incorretos')) {
          friendlyError = 'E-mail ou senha incorretos!';
        } else if (error.includes('Erro de conexão') || error.includes('Failed to fetch')) {
          friendlyError = 'Erro de conexão com o servidor. Verifique sua conexão com a internet e tente novamente.';
        } else {
          friendlyError = error;
        }
        setLoginError(friendlyError);
        toast.error(friendlyError);
        return;
      }

      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (authUser) {
        const { data: profile } = await supabase
          .from('users')
          .select('role')
          .eq('id', authUser.id)
          .maybeSingle();

        if (profile?.role !== 'partner') {
          await supabase.auth.signOut();
          const message = 'Esta área é exclusiva para parceiros VitrineTurbo.';
          setLoginError(message);
          toast.error(message);
          return;
        }
      }

      toast.success('Login realizado com sucesso!');
      navigate('/partners');
    } catch (error: any) {
      console.error('Partners login error:', error);
      const errorMessage = error.message || 'Erro inesperado ao realizar login';
      setLoginError(errorMessage);
      toast.error(errorMessage);
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
        <div className="flex items-center justify-center gap-3 mb-10">
          <Logo size="lg" showText={false} noLink />
          <span className="font-serif italic text-3xl text-foreground/90 tracking-tight">
            Partners
          </span>
        </div>

        <Card className="shadow-xl border-border/50 backdrop-blur-sm">
          <CardHeader className="space-y-2 px-7 pt-7">
            <CardTitle className="text-2xl text-center page-title">Entrar</CardTitle>
            <CardDescription className="text-center text-[14px]">
              Acesse o painel de parceiros VitrineTurbo
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
                        <Input
                          placeholder="seu@email.com"
                          type="email"
                          disabled={isLoading}
                          {...field}
                        />
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
                        <div className="relative">
                          <Input
                            placeholder="******"
                            type={showPassword ? 'text' : 'password'}
                            disabled={isLoading}
                            {...field}
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                            onClick={() => setShowPassword(!showPassword)}
                            disabled={isLoading}
                          >
                            {showPassword ? (
                              <EyeOff className="h-4 w-4 text-muted-foreground" />
                            ) : (
                              <Eye className="h-4 w-4 text-muted-foreground" />
                            )}
                          </Button>
                        </div>
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
        </Card>
      </motion.div>
    </div>
  );
}
