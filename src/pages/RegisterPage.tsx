import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import { Loader, CircleAlert as AlertCircle, MessageCircle } from 'lucide-react';
import { trackLead } from '@/lib/metaEvents';
import { trackGoogleAdsCadastro } from '@/lib/googleAdsEvents';

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
import { PhoneInputWithCountry } from '@/components/ui/phone-input-with-country';
import { Checkbox } from '@/components/ui/checkbox';
import { cleanWhatsAppNumber, generateWhatsAppUrl } from '@/lib/utils';
import Logo from '@/components/Logo';
import { supabase } from '@/lib/supabase';
import { injectMetaPixel } from '@/lib/tracking';

const formSchema = z.object({
  owner_name: z.string().min(2, 'O nome deve ter pelo menos 2 caracteres'),
  name: z.string().min(3, 'O nome deve ter pelo menos 3 caracteres'),
  email: z.string().email('Email inválido'),
  password: z.string().min(6, 'A senha deve ter pelo menos 6 caracteres'),
  confirmPassword: z.string(),
  country_code: z.string().default('55'),
  whatsapp: z.string().min(1, 'WhatsApp é obrigatório'),
  accepted_terms: z.boolean().refine((v) => v === true, {
    message: 'Você precisa aceitar os Termos de Uso e a Política de Privacidade para continuar.',
  }),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'As senhas não coincidem',
  path: ['confirmPassword'],
});

type FormValues = z.infer<typeof formSchema>;

export default function RegisterPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [registerError, setRegisterError] = useState<string | null>(null);
  const [searchParams] = useSearchParams();
  const [googleAdsConfig, setGoogleAdsConfig] = useState<{ tagId: string; cadastroId: string } | null>(null);

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

    supabase
      .from('landing_tracking_config')
      .select('google_ads_tag_id, google_ads_enabled, google_ads_cadastro_id')
      .maybeSingle()
      .then(({ data }) => {
        if (data?.google_ads_enabled && data?.google_ads_tag_id && data?.google_ads_cadastro_id) {
          setGoogleAdsConfig({ tagId: data.google_ads_tag_id, cadastroId: data.google_ads_cadastro_id });
        }
      });
  }, []);
  const { signUp } = useAuth();
  const navigate = useNavigate();
  // Capturar código de indicação da URL ou localStorage
  const referralCode = searchParams.get('ref') || localStorage.getItem('vitrineturbo_ref_code');

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      owner_name: '',
      name: '',
      email: '',
      password: '',
      confirmPassword: '',
      country_code: '55',
      whatsapp: '',
      accepted_terms: false,
    },
  });

  const onSubmit = async (data: FormValues) => {
    setIsLoading(true);
    setRegisterError(null);

    try {
      // Clean WhatsApp number with country code
      const cleanedWhatsApp = cleanWhatsAppNumber(data.whatsapp, data.country_code);

      const { error } = await signUp(
        data.email,
        data.password,
        {
          name: data.name,
          owner_name: data.owner_name,
          niche_type: 'diversos',
          country_code: data.country_code,
          whatsapp: cleanedWhatsApp,
          accepted_terms: data.accepted_terms,
          referral_code: referralCode || undefined,
        }
      );

      if (error) {
        // Handle duplicate email error
        if (error === 'EMAIL_ALREADY_EXISTS') {
          setRegisterError(error);
          toast.error('Este e-mail já está cadastrado no sistema');
          return;
        }

        toast.error(error);
        return;
      }

      // Clear referral code from localStorage after successful registration
      localStorage.removeItem('vitrineturbo_ref_code');
      trackLead(data.email);
      if (googleAdsConfig) {
        trackGoogleAdsCadastro(googleAdsConfig.tagId, googleAdsConfig.cadastroId);
      }
      toast.success('Cadastro realizado com sucesso!');
      navigate('/dashboard');
    } catch (error: any) {
      console.error('Register error:', error);
      const errorMsg = error.message || 'Erro ao realizar cadastro';
      setRegisterError(errorMsg);
      toast.error(errorMsg);
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
            <CardTitle className="text-2xl text-center page-title">Criar Conta</CardTitle>
            <CardDescription className="text-center text-[14px]">
              Cadastre-se para criar sua vitrine digital de produtos
            </CardDescription>
          </CardHeader>
          <CardContent className="px-7">
            {registerError && (
              <Alert variant="destructive" className="mb-4">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  {registerError === 'EMAIL_ALREADY_EXISTS' ? (
                    <>
                      <div>Este e-mail já está cadastrado no sistema.</div>
                      <div className="text-sm mt-1">Por favor, utilize outro e-mail ou entre em contato com o suporte.</div>
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
                    </>
                  ) : (
                    registerError
                  )}
                </AlertDescription>
              </Alert>
            )}
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="owner_name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Seu Nome</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Seu nome"
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
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nome da Empresa ou Negócio</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Nome da sua empresa ou negócio"
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
                  name="country_code"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>País e WhatsApp</FormLabel>
                      <FormControl>
                        <PhoneInputWithCountry
                          defaultCountry="BR"
                          onChange={(data) => {
                            form.setValue('country_code', data.ddi.replace('+', ''));
                            form.setValue('whatsapp', data.phone);
                          }}
                          placeholder="(11) 99999-9999"
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
                        <PasswordInput
                          placeholder="******"
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
                  name="confirmPassword"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Confirmar Senha</FormLabel>
                      <FormControl>
                        <PasswordInput
                          placeholder="******"
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
                  name="accepted_terms"
                  render={({ field }) => (
                    <FormItem>
                      <div className="flex items-start gap-3 rounded-lg border border-border bg-muted/30 px-4 py-3">
                        <FormControl>
                          <Checkbox
                            id="accepted_terms"
                            checked={field.value}
                            onCheckedChange={field.onChange}
                            disabled={isLoading}
                            className="mt-0.5 shrink-0"
                          />
                        </FormControl>
                        <FormLabel
                          htmlFor="accepted_terms"
                          className="text-sm font-normal text-foreground/80 leading-relaxed cursor-pointer"
                        >
                          Li e aceito os{' '}
                          <Link
                            to="/termos-de-uso"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-medium text-primary underline underline-offset-2 hover:text-primary/80 transition-colors"
                          >
                            Termos de Uso
                          </Link>
                          {' '}e a{' '}
                          <Link
                            to="/politica-de-privacidade"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-medium text-primary underline underline-offset-2 hover:text-primary/80 transition-colors"
                          >
                            Política de Privacidade
                          </Link>
                          {' '}do VitrineTurbo.
                        </FormLabel>
                      </div>
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
                  Cadastrar
                </Button>
              </form>
            </Form>
          </CardContent>
          <CardFooter className="flex flex-col px-7 pb-7">
            <div className="text-sm text-center text-muted-foreground mt-2">
              Já tem uma conta?{' '}
              <Link to="/login" className="text-primary hover:underline">
                Entrar
              </Link>
            </div>
          </CardFooter>
        </Card>
      </motion.div>
    </div>
  );
}