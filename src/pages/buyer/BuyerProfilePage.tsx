import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { Loader, Upload, ShieldCheck, KeyRound } from 'lucide-react';
import { useBuyerAuth } from '@/contexts/BuyerAuthContext';
import { useBuyerAccountSummary } from '@/hooks/useBuyerAccountSummary';
import { supabaseBuyer } from '@/lib/supabaseBuyer';
import { uploadBuyerAvatar } from '@/lib/buyerAvatar';
import { cleanWhatsAppNumber } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { PhoneInputWithCountry } from '@/components/ui/phone-input-with-country';
import { PasswordChangeDialog } from '@/components/Profile/PasswordChangeDialog';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ImageCropper } from '@/components/ui/image-cropper';

function formatMemberSince(dateStr?: string) {
  if (!dateStr) return null;
  return new Date(dateStr).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
}

function formatMoney(value: number) {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

const formSchema = z.object({
  full_name: z.string().min(3, 'O nome deve ter pelo menos 3 caracteres'),
  country_code: z.string().default('55'),
  whatsapp: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

export default function BuyerProfilePage() {
  const { customer, loading: authLoading, updateProfile, refreshCustomer } = useBuyerAuth();
  const summary = useBuyerAccountSummary(customer?.id);
  const [isSaving, setIsSaving] = useState(false);
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [showCropper, setShowCropper] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

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

  const memberSince = formatMemberSince(customer?.created_at);

  return (
    <div className="container mx-auto p-4 md:p-6 max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl page-title">Meu Perfil</h1>
        <p className="text-sm text-muted-foreground mt-1">Atualize seus dados pessoais e preferências</p>
      </div>

      {authLoading || !customer ? (
        <div className="flex justify-center py-8">
          <Loader className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="space-y-6">
          {/* Identity card */}
          <Card>
            <CardContent className="pt-5 pb-5 px-5">
              <div className="flex items-center gap-4">
                <div className="relative shrink-0">
                  <Avatar className="h-16 w-16 ring-1 ring-border">
                    <AvatarImage src={customer.avatar_url || undefined} alt={customer.full_name} />
                    <AvatarFallback className="text-lg font-semibold">{customer.full_name?.[0] || 'C'}</AvatarFallback>
                  </Avatar>
                  <input
                    type="file"
                    id="buyer-avatar"
                    accept="image/*"
                    onChange={handleAvatarChange}
                    className="hidden"
                    disabled={uploadingAvatar}
                  />
                  <label htmlFor="buyer-avatar">
                    <button
                      type="button"
                      disabled={uploadingAvatar}
                      onClick={() => document.getElementById('buyer-avatar')?.click()}
                      className="absolute -bottom-1 -right-1 h-6 w-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-sm hover:opacity-90 transition-opacity"
                      aria-label="Alterar foto de perfil"
                    >
                      {uploadingAvatar ? <Loader className="h-3 w-3 animate-spin" /> : <Upload className="h-3 w-3" />}
                    </button>
                  </label>
                </div>
                <div className="min-w-0">
                  <h2 className="text-lg font-semibold truncate">{customer.full_name}</h2>
                  <p className="text-xs text-muted-foreground">
                    {memberSince ? `Cliente desde ${memberSince}` : customer.email}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 mt-5 pt-5 border-t">
                <div>
                  <p className="text-xs text-muted-foreground">Total gasto</p>
                  <p className="text-base font-semibold">{formatMoney(summary.totalSpent)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Nível</p>
                  <p className="text-base font-semibold">{summary.tier.label}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Dados pessoais */}
          <Card>
            <CardHeader>
              <CardTitle>Dados pessoais</CardTitle>
              <CardDescription>Nome e WhatsApp usados nos seus pedidos.</CardDescription>
            </CardHeader>
            <CardContent>
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
                  <div className="flex justify-end pt-2">
                    <Button type="submit" disabled={isSaving}>
                      {isSaving ? <Loader className="mr-2 h-4 w-4 animate-spin" /> : null}
                      Salvar
                    </Button>
                  </div>
                </form>
              </Form>
            </CardContent>
          </Card>

          {/* Segurança */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-muted-foreground" />
                Segurança
              </CardTitle>
              <CardDescription>Gerencie a senha da sua conta.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between rounded-lg border p-4">
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-lg bg-muted flex items-center justify-center shrink-0">
                    <KeyRound className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">Senha</p>
                    <p className="text-xs text-muted-foreground">Altere a senha usada pra entrar na sua conta</p>
                  </div>
                </div>
                <PasswordChangeDialog
                  user={{ id: customer.id }}
                  open={passwordDialogOpen}
                  onOpenChange={setPasswordDialogOpen}
                  client={supabaseBuyer}
                />
              </div>
            </CardContent>
          </Card>
        </div>
      )}

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
