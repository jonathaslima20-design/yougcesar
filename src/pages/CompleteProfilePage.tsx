import { useEffect, useState } from 'react';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import { Loader } from 'lucide-react';
import { trackLead } from '@/lib/metaEvents';
import { getStoredAttribution, clearStoredAttribution } from '@/lib/attribution';

import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { PhoneInputWithCountry } from '@/components/ui/phone-input-with-country';
import { Checkbox } from '@/components/ui/checkbox';
import { cleanWhatsAppNumber } from '@/lib/utils';
import Logo from '@/components/Logo';
import { completeGoogleProfile, type PendingGoogleAuth } from '@/lib/auth/simpleAuth';
import { useAuth } from '@/contexts/AuthContext';

const formSchema = z.object({
  owner_name: z.string().min(2, 'O nome deve ter pelo menos 2 caracteres'),
  name: z.string().min(3, 'O nome deve ter pelo menos 3 caracteres'),
  country_code: z.string().default('55'),
  whatsapp: z.string().min(1, 'WhatsApp é obrigatório'),
  accepted_terms: z.boolean().refine((v) => v === true, {
    message: 'Você precisa aceitar os Termos de Uso e a Política de Privacidade para continuar.',
  }),
});

type FormValues = z.infer<typeof formSchema>;

export default function CompleteProfilePage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { refreshUser } = useAuth();
  const [isLoading, setIsLoading] = useState(false);

  const pendingAuth = (location.state as { pendingAuth?: PendingGoogleAuth } | null)?.pendingAuth;

  useEffect(() => {
    if (!pendingAuth) {
      navigate('/login', { replace: true });
    }
  }, [pendingAuth, navigate]);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      owner_name: pendingAuth?.fullName || '',
      name: '',
      country_code: '55',
      whatsapp: '',
      accepted_terms: false,
    },
  });

  if (!pendingAuth) {
    return null;
  }

  const onSubmit = async (data: FormValues) => {
    setIsLoading(true);

    try {
      const cleanedWhatsApp = cleanWhatsAppNumber(data.whatsapp, data.country_code);
      const referralCode = localStorage.getItem('vitrineturbo_ref_code');

      const { error } = await completeGoogleProfile(pendingAuth.id, pendingAuth.email, {
        name: data.name,
        owner_name: data.owner_name,
        country_code: data.country_code,
        whatsapp: cleanedWhatsApp,
        accepted_terms: data.accepted_terms,
        referral_code: referralCode || undefined,
        attribution: getStoredAttribution(),
      });

      if (error) {
        toast.error(error);
        return;
      }

      localStorage.removeItem('vitrineturbo_ref_code');
      clearStoredAttribution();
      trackLead(pendingAuth.email);
      await refreshUser();
      toast.success('Cadastro concluído com sucesso!');
      navigate('/dashboard');
    } catch (error: any) {
      toast.error(error.message || 'Erro ao concluir cadastro');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background relative overflow-hidden">
      <div className="absolute inset-0 grid-bg opacity-40 pointer-events-none" />

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
            <CardTitle className="text-2xl text-center page-title">Falta pouco!</CardTitle>
            <CardDescription className="text-center text-[14px]">
              Complete seus dados para finalizar o cadastro com {pendingAuth.email}
            </CardDescription>
          </CardHeader>
          <CardContent className="px-7">
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="owner_name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Seu Nome</FormLabel>
                      <FormControl>
                        <Input placeholder="Seu nome" disabled={isLoading} {...field} />
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
                        <Input placeholder="Nome da sua empresa ou negócio" disabled={isLoading} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="country_code"
                  render={() => (
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

                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading ? <Loader className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Concluir Cadastro
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
