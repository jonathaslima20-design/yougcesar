import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { Loader, Upload } from 'lucide-react';
import { useBuyerAuth } from '@/contexts/BuyerAuthContext';
import { supabaseBuyer } from '@/lib/supabaseBuyer';
import { uploadBuyerAvatar } from '@/lib/buyerAvatar';
import { cleanWhatsAppNumber } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { PhoneInputWithCountry } from '@/components/ui/phone-input-with-country';
import { PasswordChangeDialog } from '@/components/Profile/PasswordChangeDialog';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ImageCropper } from '@/components/ui/image-cropper';

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

  return (
    <div className="container mx-auto p-4 md:p-6 max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl page-title">Meu Perfil</h1>
        <p className="text-sm text-muted-foreground mt-1">Atualize seus dados pessoais e preferências</p>
      </div>

      <div className="space-y-6">
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
