import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { Loader } from 'lucide-react';
import { useBuyerAuth } from '@/contexts/BuyerAuthContext';
import { supabaseBuyer } from '@/lib/supabaseBuyer';
import { cleanWhatsAppNumber } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { PhoneInputWithCountry } from '@/components/ui/phone-input-with-country';
import { ThemeToggle } from '@/components/ui/theme-toggle';
import { PasswordChangeDialog } from '@/components/Profile/PasswordChangeDialog';
import { BuyerAccountNav } from '@/components/buyer/BuyerAccountNav';

const formSchema = z.object({
  full_name: z.string().min(3, 'O nome deve ter pelo menos 3 caracteres'),
  country_code: z.string().default('55'),
  whatsapp: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

export default function BuyerProfilePage() {
  const { customer, loading: authLoading, updateProfile } = useBuyerAuth();
  const [isSaving, setIsSaving] = useState(false);
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { full_name: '', country_code: '55', whatsapp: '' },
  });

  useEffect(() => {
    if (customer) {
      form.reset({
        full_name: customer.full_name,
        country_code: customer.country_code,
        whatsapp: customer.whatsapp || '',
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customer]);

  if (!authLoading && !customer) {
    return <Navigate to="/conta/entrar" state={{ from: '/conta/perfil' }} replace />;
  }

  const onSubmit = async (data: FormValues) => {
    setIsSaving(true);
    try {
      const cleanedWhatsApp = data.whatsapp ? cleanWhatsAppNumber(data.whatsapp, data.country_code) : null;
      const { error } = await updateProfile({
        full_name: data.full_name,
        whatsapp: cleanedWhatsApp,
        country_code: data.country_code,
      });
      if (error) {
        toast.error(error);
        return;
      }
      toast.success('Perfil atualizado com sucesso!');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="fixed top-4 right-4 z-50">
        <ThemeToggle />
      </div>
      <div className="max-w-2xl mx-auto px-4 py-10">
        <h1 className="text-2xl font-bold text-center mb-6">Minha Conta</h1>
        <BuyerAccountNav />

        <Card>
          <CardHeader>
            <CardTitle>Meu Perfil</CardTitle>
          </CardHeader>
          <CardContent>
            {authLoading || !customer ? (
              <div className="flex justify-center py-8">
                <Loader className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input value={customer.email} disabled />
                    </FormControl>
                  </FormItem>
                  <FormField
                    control={form.control}
                    name="full_name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nome</FormLabel>
                        <FormControl>
                          <Input placeholder="Seu nome completo" disabled={isSaving} {...field} />
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
                        <FormLabel>WhatsApp</FormLabel>
                        <FormControl>
                          <PhoneInputWithCountry
                            value={customer.whatsapp || ''}
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
                  <div className="flex flex-col sm:flex-row justify-between gap-3 pt-2">
                    <PasswordChangeDialog
                      user={{ id: customer.id }}
                      open={passwordDialogOpen}
                      onOpenChange={setPasswordDialogOpen}
                      client={supabaseBuyer}
                    />
                    <Button type="submit" disabled={isSaving}>
                      {isSaving ? <Loader className="mr-2 h-4 w-4 animate-spin" /> : null}
                      Salvar
                    </Button>
                  </div>
                </form>
              </Form>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
