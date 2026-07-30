import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { Loader, Upload, TriangleAlert as AlertTriangle } from 'lucide-react';
import { useBuyerAuth } from '@/contexts/BuyerAuthContext';
import { supabase } from '@/lib/supabase';
import { supabaseBuyer } from '@/lib/supabaseBuyer';
import { uploadBuyerAvatar } from '@/lib/buyerAvatar';
import { cleanWhatsAppNumber } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { PhoneInputWithCountry } from '@/components/ui/phone-input-with-country';
import { ThemeToggle } from '@/components/ui/theme-toggle';
import { PasswordChangeDialog } from '@/components/Profile/PasswordChangeDialog';
import { BuyerAccountNav } from '@/components/buyer/BuyerAccountNav';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ImageCropper } from '@/components/ui/image-cropper';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

const formSchema = z.object({
  full_name: z.string().min(3, 'O nome deve ter pelo menos 3 caracteres'),
  country_code: z.string().default('55'),
  whatsapp: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

export default function BuyerProfilePage() {
  const { customer, loading: authLoading, updateProfile, refreshCustomer } = useBuyerAuth();
  const [isSaving, setIsSaving] = useState(false);
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [showCropper, setShowCropper] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [deleteRequested, setDeleteRequested] = useState(false);

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

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast.error('A imagem deve ter no máximo 5MB');
        return;
      }
      setSelectedFile(file);
      setShowCropper(true);
    }
    e.target.value = '';
  };

  const handleCropComplete = async (croppedBlob: Blob) => {
    if (!customer) return;
    try {
      setUploadingAvatar(true);
      setShowCropper(false);

      const file = new File([croppedBlob], selectedFile?.name || 'avatar.jpg', { type: 'image/jpeg' });
      await uploadBuyerAvatar(file, customer.id);
      await refreshCustomer();
      toast.success('Foto de perfil atualizada!');
    } catch (error: any) {
      console.error('Error uploading avatar:', error);
      toast.error(error.message || 'Erro ao atualizar foto de perfil');
    } finally {
      setUploadingAvatar(false);
      setSelectedFile(null);
    }
  };

  const handleDeleteAccount = async () => {
    if (!customer) return;
    setDeletingAccount(true);
    try {
      const { error } = await supabase.from('privacy_requests').insert({
        name: customer.full_name,
        email: customer.email,
        request_type: 'delete_account',
        message: `Solicitação enviada pelo comprador através do painel de conta (customer_id: ${customer.id}).`,
      });
      if (error) throw error;
      setDeleteRequested(true);
      toast.success('Solicitação enviada. Nossa equipe entrará em contato em até 15 dias úteis.');
    } catch (error) {
      console.error('Error submitting deletion request:', error);
      toast.error('Não foi possível enviar sua solicitação. Tente novamente.');
    } finally {
      setDeletingAccount(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="fixed top-4 right-4 z-50">
        <ThemeToggle />
      </div>
      <div className="max-w-2xl mx-auto px-4 py-10 space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-center mb-6">Minha Conta</h1>
          <BuyerAccountNav />
        </div>

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
              <div className="space-y-6">
                <div className="flex items-center gap-4">
                  <Avatar className="h-20 w-20">
                    <AvatarImage src={customer.avatar_url || undefined} alt={customer.full_name} />
                    <AvatarFallback>{customer.full_name?.[0] || 'C'}</AvatarFallback>
                  </Avatar>
                  <div>
                    <h3 className="font-semibold">Foto de Perfil</h3>
                    <p className="text-sm text-muted-foreground">JPG, PNG ou GIF (máx. 5MB)</p>
                    <div className="mt-2">
                      <input
                        type="file"
                        id="buyer-avatar"
                        accept="image/*"
                        onChange={handleAvatarChange}
                        className="hidden"
                        disabled={uploadingAvatar}
                      />
                      <label htmlFor="buyer-avatar">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={uploadingAvatar}
                          onClick={() => document.getElementById('buyer-avatar')?.click()}
                        >
                          {uploadingAvatar ? (
                            <Loader className="mr-2 h-4 w-4 animate-spin" />
                          ) : (
                            <Upload className="mr-2 h-4 w-4" />
                          )}
                          Alterar Foto
                        </Button>
                      </label>
                    </div>
                  </div>
                </div>

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
              </div>
            )}
          </CardContent>
        </Card>

        {customer && (
          <Card className="border-destructive/30">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2 text-destructive">
                <AlertTriangle className="h-4 w-4" />
                Excluir minha conta
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Isso envia uma solicitação de exclusão dos seus dados para nossa equipe, conforme a LGPD.
                Sua conta continua ativa até a solicitação ser processada (prazo de até 15 dias úteis).
                Registros de pedidos e pagamentos podem ter retenção legal obrigatória mesmo após a exclusão.
              </p>
              {deleteRequested ? (
                <p className="text-sm font-medium text-emerald-600 dark:text-emerald-400">
                  Solicitação enviada. Você receberá uma resposta por e-mail.
                </p>
              ) : (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive" size="sm" disabled={deletingAccount}>
                      {deletingAccount ? <Loader className="mr-2 h-4 w-4 animate-spin" /> : null}
                      Excluir minha conta
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Solicitar exclusão da conta?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Vamos enviar uma solicitação de exclusão de dados para nossa equipe. Essa ação não
                        exclui a conta imediatamente — ela será analisada e processada em até 15 dias úteis.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                      <AlertDialogAction onClick={handleDeleteAccount}>Solicitar exclusão</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      {showCropper && selectedFile && (
        <ImageCropper
          image={URL.createObjectURL(selectedFile)}
          onCrop={handleCropComplete}
          onCancel={() => {
            setShowCropper(false);
            setSelectedFile(null);
          }}
          aspectRatio={1}
          open={showCropper}
        />
      )}
    </div>
  );
}
