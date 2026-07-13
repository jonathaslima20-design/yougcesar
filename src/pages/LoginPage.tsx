import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import { Loader, CircleAlert as AlertCircle, ExternalLink, MessageCircle, Eye, EyeOff } from 'lucide-react';

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
import { useTheme } from '@/contexts/ThemeContext';
import { ThemeToggle } from '@/components/ui/theme-toggle';
import Logo from '@/components/Logo';
import { getErrorMessage, errorMessages } from '@/lib/errorMessages';
import { generateWhatsAppUrl } from '@/lib/utils';
import { supabase } from '@/lib/supabase';
import { injectMetaPixel } from '@/lib/tracking';

const formSchema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(6, 'A senha deve ter pelo menos 6 caracteres'),
});

type FormValues = z.infer<typeof formSchema>;

export default function LoginPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const { signIn } = useAuth();

  useEffect(() => {
    supabase
      .from('site_settings')
      .select('setting_value')
      .eq('setting_name', 'global_meta_pixel_id')
      .maybeSingle()
      .then(({ data }) => {
        if (data?.setting_value) {
          injectMetaPixel(data.setting_value);
        }
      });
  }, []);
  const navigate = useNavigate();
  
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });
  
  const onSubmit = async (data: FormValues) => {
    try {
      setIsLoading(true);
      setLoginError(null);

      const normalizedEmail = data.email.trim().toLowerCase();

      console.log('🔐 LOGIN ATTEMPT:', {
        email: normalizedEmail,
        hasPassword: !!data.password,
        passwordLength: data.password.length
      });

      const { error } = await signIn(data.email, data.password);

      console.log('🔐 LOGIN RESULT:', {
        success: !error,
        error: error || 'none'
      });

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

        // For admin accounts, run diagnostic
        if (normalizedEmail.includes('admin') || normalizedEmail.includes('jonathas')) {
          console.log('🔧 Running diagnostics for admin account...');
          try {
            const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-auth-sync`, {
              method: 'GET',
              headers: {
                'Content-Type': 'application/json',
              }
            });
            const diagnostics = await response.json();
            console.log('📋 Admin diagnostics:', diagnostics);
          } catch (diagError) {
            console.error('Diagnostic error:', diagError);
          }
        }

        setLoginError(friendlyError);
        toast.error(friendlyError);
        return;
      }

      toast.success('Login realizado com sucesso!');
      navigate('/dashboard');
    } catch (error: any) {
      console.error('Login error:', error);
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
        <div className="flex justify-center mb-10">
          <div className="scale-130">
            <Logo size="lg" showText={false} />
          </div>
        </div>

        <Card className="shadow-xl border-border/50 backdrop-blur-sm">
          <CardHeader className="space-y-2 px-7 pt-7">
            <CardTitle className="text-2xl text-center page-title">Entrar</CardTitle>
            <CardDescription className="text-center text-[14px]">
              Entre com seu email e senha para acessar sua conta
            </CardDescription>
          </CardHeader>
          <CardContent className="px-7">
            {loginError && (
              <Alert variant="destructive" className="mb-4">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  {loginError}
                  {loginError === 'Usuário desabilitado por pendência financeira, entre em contato com o suporte.' ? (
                    <div className="mt-3">
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full bg-green-50 hover:bg-green-100 border-green-200 text-green-800"
                        asChild
                      >
                        <a
                          href={generateWhatsAppUrl('5591982465495')}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <MessageCircle className="h-4 w-4 mr-2" />
                          Falar com Suporte via WhatsApp
                        </a>
                      </Button>
                    </div>
                  ) : loginError.includes('credenciais') && (
                    <div className="mt-2 text-sm">
                      <p>Verifique se:</p>
                      <ul className="list-disc list-inside mt-1 space-y-1">
                        <li>O email está correto</li>
                        <li>A senha está correta</li>
                        <li>Não há espaços extras</li>
                        <li>As maiúsculas/minúsculas estão corretas</li>
                      </ul>
                    </div>
                  )}
                </AlertDescription>
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
                            type={showPassword ? "text" : "password"}
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
                <Button 
                  type="submit" 
                  className="w-full" 
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <Loader className="mr-2 h-4 w-4 animate-spin" />
                  ) : null}
                  Entrar
                </Button>
              </form>
            </Form>
          </CardContent>
          <CardFooter className="px-7 pb-7 flex flex-col space-y-4">
            <div className="text-sm text-center text-muted-foreground">
              Não tem uma conta?{' '}
            </div>
            
            <Button 
              variant="outline" 
              className="w-full" 
              asChild
            >
              <Link to="/register">
                <ExternalLink className="h-4 w-4 mr-2" />
                Criar Conta Agora
              </Link>
            </Button>
          </CardFooter>
        </Card>
      </motion.div>
    </div>
  );
}