import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { toast } from 'sonner';
import { Loader as Loader2, Copy, CheckCircle2, ArrowLeft, ChevronRight, TriangleAlert as AlertTriangle } from 'lucide-react';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/contexts/AuthContext';
import { useCheckoutSettings } from '@/hooks/useCheckoutSettings';
import { usePlatformPaymentsEnabled } from '@/hooks/usePlatformPaymentsEnabled';
import type { CheckoutMode } from '@/types';
import {
  getMerchantPaymentConfig,
  saveMerchantPaymentConfig,
  testMerchantPaymentCredentials,
} from '@/lib/merchantPayments';

const formSchema = z.object({
  environment: z.enum(['test', 'production']),
  public_key: z.string().optional().or(z.literal('')),
  access_token: z.string().optional().or(z.literal('')),
  webhook_secret: z.string().optional().or(z.literal('')),
  is_active: z.boolean(),
  checkoutMode: z.enum(['whatsapp', 'ecommerce_optional', 'ecommerce_only']),
});

type FormValues = z.infer<typeof formSchema>;

export default function PaymentSettingsContent() {
  const { user } = useAuth();
  const { settings: checkoutSettings, loading: checkoutLoading, updateSettings } = useCheckoutSettings();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [notificationUrl, setNotificationUrl] = useState('');
  const [copied, setCopied] = useState(false);
  const [mpAccountEmail, setMpAccountEmail] = useState<string | null>(null);
  const [selectedProvider, setSelectedProvider] = useState<'mercadopago' | null>(null);
  const { enabled: platformPaymentsEnabled } = usePlatformPaymentsEnabled(user?.id);

  const isBRL = (user?.currency || 'BRL').toUpperCase() === 'BRL';

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      environment: 'production',
      public_key: '',
      access_token: '',
      webhook_secret: '',
      is_active: false,
      checkoutMode: 'whatsapp',
    },
  });

  const isActive = form.watch('is_active');

  useEffect(() => {
    loadConfig();
  }, []);

  useEffect(() => {
    if (!checkoutLoading) {
      form.setValue('checkoutMode', checkoutSettings.checkoutMode || 'whatsapp');
    }
  }, [checkoutLoading, checkoutSettings.checkoutMode]);

  const loadConfig = async () => {
    try {
      const { config, notification_url } = await getMerchantPaymentConfig();
      setNotificationUrl(notification_url);
      if (config) {
        form.reset({
          environment: config.environment,
          public_key: config.public_key || '',
          access_token: config.access_token || '',
          webhook_secret: config.webhook_secret || '',
          is_active: config.is_active,
          checkoutMode: form.getValues('checkoutMode'),
        });
        setMpAccountEmail(config.mp_account_email || null);
      }
    } catch (error) {
      console.error('Error loading payment config:', error);
      toast.error('Erro ao carregar configurações de pagamento');
    } finally {
      setLoading(false);
    }
  };

  const onSubmit = async (values: FormValues) => {
    setSaving(true);
    try {
      await saveMerchantPaymentConfig({
        environment: values.environment,
        public_key: values.public_key || '',
        access_token: values.access_token || '',
        webhook_secret: values.webhook_secret || '',
        is_active: values.is_active,
      });

      await updateSettings({ ...checkoutSettings, checkoutMode: values.checkoutMode as CheckoutMode });

      toast.success('Configurações salvas com sucesso');
      loadConfig();
    } catch (error: any) {
      toast.error(error.message || 'Erro ao salvar configurações');
    } finally {
      setSaving(false);
    }
  };

  const handleTestCredentials = async () => {
    setTesting(true);
    try {
      const accessToken = form.getValues('access_token');
      const result = await testMerchantPaymentCredentials(
        accessToken && !accessToken.startsWith('****') ? accessToken : undefined
      );
      if (result.success) {
        toast.success(`Conectado como ${result.account?.email || result.account?.nickname}`);
        setMpAccountEmail(result.account?.email || null);
      } else {
        toast.error(result.error || 'Credenciais inválidas');
      }
    } catch (error: any) {
      toast.error(error.message || 'Erro ao testar credenciais');
    } finally {
      setTesting(false);
    }
  };

  const handleCopyNotificationUrl = async () => {
    await navigator.clipboard.writeText(notificationUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading || checkoutLoading) {
    return (
      <div className="flex items-center justify-center min-h-[200px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!selectedProvider) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-sm font-medium mb-1">Meios de pagamento</h2>
          <p className="text-xs text-muted-foreground">
            Escolha um meio de pagamento para configurar. Mais opções em breve.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Card
            className="cursor-pointer hover:border-primary/50 transition-colors"
            onClick={() => setSelectedProvider('mercadopago')}
          >
            <CardContent className="flex items-center justify-between gap-4 py-5">
              <div className="flex items-center gap-4">
                <img src="/logos/mercado-pago.png" alt="Mercado Pago" className="h-7 w-auto" />
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={isActive ? 'default' : 'outline'}>
                  {isActive ? 'Ativo' : 'Inativo'}
                </Badge>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="text-muted-foreground -ml-2"
        onClick={() => setSelectedProvider(null)}
      >
        <ArrowLeft className="h-4 w-4 mr-1.5" />
        Voltar
      </Button>

      {!platformPaymentsEnabled && (
        <div className="flex items-start gap-2 rounded-md bg-amber-500/10 border border-amber-500/20 px-4 py-3 text-sm text-amber-700">
          <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
          <span>
            Pagamentos online estão temporariamente desativados para todas as lojas enquanto a
            VitrineTurbo finaliza os testes dessa funcionalidade. Você pode configurar suas credenciais
            normalmente, mas a ativação e o modo de checkout ficam bloqueados até isso ser liberado.
          </span>
        </div>
      )}

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
          <Card>
            <CardHeader>
              <CardTitle>Credenciais do Mercado Pago</CardTitle>
              <CardDescription>
                Conecte sua própria conta do Mercado Pago para receber pagamentos dos seus clientes
                diretamente, sem taxa da VitrineTurbo por venda.
                {mpAccountEmail && (
                  <span className="block mt-1 text-green-600 dark:text-green-400 flex items-center gap-1">
                    <CheckCircle2 className="h-3.5 w-3.5" /> Conectado: {mpAccountEmail}
                  </span>
                )}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <FormField
                control={form.control}
                name="environment"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Ambiente</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="production">Produção</SelectItem>
                        <SelectItem value="test">Teste</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="public_key"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Public Key</FormLabel>
                    <FormControl>
                      <Input placeholder="APP_USR-..." {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="access_token"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Access Token</FormLabel>
                    <FormControl>
                      <Input placeholder="APP_USR-..." {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="webhook_secret"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Webhook Secret</FormLabel>
                    <FormControl>
                      <Input placeholder="Chave secreta do webhook" {...field} />
                    </FormControl>
                    <FormDescription>
                      Obrigatório para ativar o pagamento online — evita que notificações de pagamento
                      falsificadas sejam aceitas.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="space-y-2">
                <FormLabel>URL de notificação (webhook)</FormLabel>
                <div className="flex gap-2">
                  <Input readOnly value={notificationUrl} className="font-mono text-xs" />
                  <Button type="button" variant="outline" size="icon" onClick={handleCopyNotificationUrl}>
                    {copied ? <CheckCircle2 className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
                <FormDescription>
                  Cole esta URL nas notificações webhook da sua conta do Mercado Pago.
                </FormDescription>
              </div>

              <Button type="button" variant="outline" onClick={handleTestCredentials} disabled={testing}>
                {testing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Testar credenciais
              </Button>

              <Separator />

              <FormField
                control={form.control}
                name="is_active"
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between rounded-lg border border-border p-4">
                    <div>
                      <FormLabel>Ativar pagamento online na vitrine</FormLabel>
                      <FormDescription>
                        {isBRL
                          ? 'Permite que clientes paguem via PIX/cartão direto na sua vitrine.'
                          : 'Disponível apenas para lojas com moeda configurada em Real (BRL).'}
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        disabled={!isBRL || !platformPaymentsEnabled}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Como finalizar o pedido</CardTitle>
              <CardDescription>
                Escolha se o cliente finaliza pelo WhatsApp, paga direto na vitrine, ou tem as duas opções.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <FormField
                control={form.control}
                name="checkoutMode"
                render={({ field }) => (
                  <FormItem>
                    <Select onValueChange={field.onChange} value={field.value} disabled={!platformPaymentsEnabled}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="whatsapp">Só WhatsApp (padrão atual)</SelectItem>
                        <SelectItem value="ecommerce_optional">WhatsApp e Pagar Agora (cliente escolhe)</SelectItem>
                        <SelectItem value="ecommerce_only">Só Pagar Agora</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          <div className="flex justify-end">
            <Button type="submit" disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {saving ? 'Salvando...' : 'Salvar Configurações'}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}
