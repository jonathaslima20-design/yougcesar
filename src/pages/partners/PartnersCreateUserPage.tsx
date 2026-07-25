import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { createUser } from '@/lib/adminApi';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { PasswordInput } from '@/components/ui/password-input';
import { PhoneInputWithCountry } from '@/components/ui/phone-input-with-country';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { formatCurrencyI18n } from '@/lib/i18n';
import type { SubscriptionPlan } from '@/types';

const userSchema = z.object({
  name: z.string().min(1, 'Nome é obrigatório'),
  email: z.string().email('Email inválido'),
  password: z.string().min(6, 'Mínimo de 6 caracteres'),
  confirmPassword: z.string().min(6, 'Mínimo de 6 caracteres'),
  country_code: z.string().default('55'),
  whatsapp: z.string().optional(),
  plan_id: z.string().min(1, 'Selecione um plano'),
}).refine((data) => data.password === data.confirmPassword, {
  message: "As senhas não coincidem",
  path: ["confirmPassword"],
});

type UserFormData = z.infer<typeof userSchema>;

export default function PartnersCreateUserPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [deadlineHours, setDeadlineHours] = useState<number | null>(null);

  useEffect(() => {
    (async () => {
      const [plansRes, settingsRes] = await Promise.all([
        supabase
          .from('subscription_plans')
          .select('*')
          .eq('is_active', true)
          .neq('duration', 'Free')
          .order('display_order', { ascending: true }),
        supabase.from('partner_settings').select('payment_deadline_hours').limit(1).maybeSingle(),
      ]);
      setPlans(plansRes.data || []);
      setDeadlineHours(settingsRes.data?.payment_deadline_hours ?? 6);
    })();
  }, []);

  const form = useForm<UserFormData>({
    resolver: zodResolver(userSchema),
    defaultValues: {
      name: '',
      email: '',
      password: '',
      confirmPassword: '',
      country_code: '55',
      whatsapp: '',
      plan_id: '',
    },
  });

  const selectedPlanId = form.watch('plan_id');

  const onSubmit = async (data: UserFormData) => {
    setLoading(true);
    try {
      // Role is always forced to 'corretor' server-side for partner callers
      // (see supabase/functions/create-user), the value sent here is ignored.
      await createUser({
        email: data.email,
        password: data.password,
        name: data.name,
        country_code: data.country_code,
        whatsapp: data.whatsapp || '',
        role: 'corretor',
        plan_id: data.plan_id,
      });

      toast.success('Usuário criado com sucesso!');
      navigate('/partners/users');
    } catch (error: any) {
      console.error('Error creating user:', error);
      toast.error(error.message || 'Erro ao criar usuário');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto p-6 max-w-3xl">
      <div className="space-y-6">
        <div className="bg-card rounded-lg border p-8">
          <div className="mb-8">
            <h1 className="text-2xl font-semibold text-foreground mb-2">Cadastrar Usuário</h1>
            <p className="text-sm text-muted-foreground">
              A conta é criada imediatamente e vinculada a você em "Usuários".
            </p>
          </div>

          <div className="space-y-6">
            <h2 className="text-lg font-semibold text-foreground">Informações do Usuário</h2>

            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm font-medium text-foreground">Nome da Empresa ou Negócio</FormLabel>
                      <FormControl>
                        <Input
                          placeholder=""
                          className="h-11"
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
                      <FormLabel className="text-sm font-medium text-foreground">Email</FormLabel>
                      <FormControl>
                        <Input
                          type="email"
                          placeholder="cliente@email.com"
                          className="h-11"
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
                      <FormLabel className="text-sm font-medium text-foreground">Senha</FormLabel>
                      <FormControl>
                        <PasswordInput
                          placeholder="••••••"
                          className="h-11"
                          {...field}
                        />
                      </FormControl>
                      <FormDescription className="text-xs text-muted-foreground">
                        Mínimo de 6 caracteres
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="confirmPassword"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm font-medium text-foreground">Confirmar Senha</FormLabel>
                      <FormControl>
                        <PasswordInput
                          placeholder=""
                          className="h-11"
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
                      <FormLabel className="text-sm font-medium text-foreground">País e WhatsApp</FormLabel>
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
                  name="plan_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm font-medium text-foreground">Plano</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger className="h-11">
                            <SelectValue placeholder="Selecione um plano" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {plans.map((plan) => (
                            <SelectItem key={plan.id} value={plan.id}>
                              {plan.name} — {formatCurrencyI18n(plan.price, 'BRL', 'pt-BR')} ({plan.duration})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {selectedPlanId && (
                        <FormDescription className="text-xs text-muted-foreground">
                          O usuário fica com o plano ativo imediatamente. Ele terá {deadlineHours ?? 6} hora(s) para
                          efetuar o pagamento — se o prazo vencer sem pagamento, a vitrine é bloqueada automaticamente.
                        </FormDescription>
                      )}
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="flex gap-3 pt-4">
                  <Button
                    type="submit"
                    disabled={loading}
                    className="h-11 px-8"
                  >
                    {loading ? 'Criando...' : 'Criar Usuário'}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => navigate(-1)}
                    className="h-11 px-8"
                  >
                    Cancelar
                  </Button>
                </div>
              </form>
            </Form>
          </div>
        </div>
      </div>
    </div>
  );
}
