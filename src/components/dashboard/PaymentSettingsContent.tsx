import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { toast } from 'sonner';
import { Loader as Loader2, Copy, CheckCircle2, ArrowLeft, ChevronRight, TriangleAlert as AlertTriangle, CreditCard, Eye, EyeOff, RefreshCw, Circle as XCircle } from 'lucide-react';

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
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useAuth } from '@/contexts/AuthContext';
import { usePlatformPaymentsEnabled } from '@/hooks/usePlatformPaymentsEnabled';
import {
  getMerchantPaymentConfig,
  saveMerchantPaymentConfig,
  testMerchantPaymentCredentials,
} from '@/lib/merchantPayments';

const formSchema = z.object({
  environment: z.enum(['test', 'production']),
  public_key_test: z.string().optional().or(z.literal('')),
  access_token_test: z.string().optional().or(z.literal('')),
  public_key_prod: z.string().optional().or(z.literal('')),
  access_token_prod: z.string().optional().or(z.literal('')),
  webhook_secret: z.string().optional().or(z.literal('')),
  is_active: z.boolean(),
});

type FormValues = z.infer<typeof formSchema>;

export default function PaymentSettingsContent() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [notificationUrl, setNotificationUrl] = useState('');
  const [copied, setCopied] = useState(false);
  const [showTokens, setShowTokens] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'unknown' | 'connected' | 'failed'>('unknown');
  const [accountInfo, setAccountInfo] = useState<{ email?: string; nickname?: string } | null>(null);
  const [selectedProvider, setSelectedProvider] = useState<'mercadopago' | null>(null);
  const { enabled: platformPaymentsEnabled } = usePlatformPaymentsEnabled(user?.id);

  const isBRL = (user?.currency || 'BRL').toUpperCase() === 'BRL';

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      environment: 'test',
      public_key_test: '',
      access_token_test: '',
      public_key_prod: '',
      access_token_prod: '',
      webhook_secret: '',
      is_active: false,
    },
  });

  const isActive = form.watch('is_active');

  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    try {
      const { config, notification_url } = await getMerchantPaymentConfig();
      setNotificationUrl(notification_url);
      if (config) {
        form.reset({
          environment: config.environment,
          public_key_test: config.public_key_test || '',
          access_token_test: config.access_token_test || '',
          public_key_prod: config.public_key_prod || '',
          access_token_prod: config.access_token_prod || '',
          webhook_secret: config.webhook_secret || '',
          is_active: config.is_active,
        });
        if (config.mp_account_email) {
          setAccountInfo({ email: config.mp_account_email });
          setConnectionStatus('connected');
        }
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
        public_key_test: values.public_key_test || '',
        access_token_test: values.access_token_test || '',
        public_key_prod: values.public_key_prod || '',
        access_token_prod: values.access_token_prod || '',
        webhook_secret: values.webhook_secret || '',
        is_active: values.is_active,
      });

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
    setConnectionStatus('unknown');
    try {
      // Test always reads what's saved in the DB, not the live form — save
      // first so "Testar Conexão" can't fail on a merchant who typed
      // credentials but hasn't scrolled down to "Salvar Configurações" yet.
      const values = form.getValues();
      await saveMerchantPaymentConfig({
        environment: values.environment,
        public_key_test: values.public_key_test || '',
        access_token_test: values.access_token_test || '',
        public_key_prod: values.public_key_prod || '',
        access_token_prod: values.access_token_prod || '',
        webhook_secret: values.webhook_secret || '',
        is_active: values.is_active,
      });

      const result = await testMerchantPaymentCredentials();
      if (result.success) {
        setConnectionStatus('connected');
        setAccountInfo(result.account);
        toast.success(`Conectado como ${result.account?.email || result.account?.nickname}`);
      } else {
        setConnectionStatus('failed');
        setAccountInfo(null);
        toast.error(result.error || 'Credenciais inválidas');
      }
      await loadConfig();
    } catch (error: any) {
      setConnectionStatus('failed');
      setAccountInfo(null);
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

  if (loading) {
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
            normalmente, mas a ativação fica bloqueada até isso ser liberado. O modo de finalização de
            pedido (WhatsApp/pagamento online) agora é definido em Regras de Pedido.
          </span>
        </div>
      )}

      {/* Connection Status */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-muted-foreground" />
              <CardTitle className="text-base">Status da Conexão</CardTitle>
            </div>
            <div className="flex items-center gap-2">
              {connectionStatus === 'connected' && (
                <Badge className="bg-green-500/10 text-green-600 border-transparent">
                  <CheckCircle2 className="h-3 w-3 mr-1" /> Conectado
                </Badge>
              )}
              {connectionStatus === 'failed' && (
                <Badge className="bg-red-500/10 text-red-600 border-transparent">
                  <XCircle className="h-3 w-3 mr-1" /> Falha
                </Badge>
              )}
              {connectionStatus === 'unknown' && (
                <Badge variant="secondary">Não verificado</Badge>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {accountInfo && (
            <div className="text-sm text-muted-foreground mb-3">
              Conta: <span className="font-medium text-foreground">{accountInfo.email || accountInfo.nickname}</span>
            </div>
          )}
          <Button variant="outline" size="sm" onClick={handleTestCredentials} disabled={testing}>
            {testing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <RefreshCw className="h-4 w-4 mr-2" />}
            Salvar e Testar Conexão
          </Button>
          <p className="text-xs text-muted-foreground mt-2">
            Salva as credenciais preenchidas abaixo para o ambiente selecionado e testa a conexão com o Mercado Pago.
          </p>
        </CardContent>
      </Card>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          {/* Environment */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Ambiente</CardTitle>
              <CardDescription>
                Use "Teste" pra simular pagamentos durante a configuração e "Produção" quando estiver pronto
                pra receber pagamentos reais. Os dois pares de credenciais abaixo ficam salvos ao mesmo
                tempo — trocar o ambiente não apaga o outro.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <FormField
                control={form.control}
                name="environment"
                render={({ field }) => (
                  <FormItem>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger className="w-[200px]">
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="test">Teste (Sandbox)</SelectItem>
                        <SelectItem value="production">Produção</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          {/* Credentials */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base">Credenciais</CardTitle>
                  <CardDescription>
                    Encontre suas credenciais em{' '}
                    <a
                      href="https://www.mercadopago.com.br/developers/panel/app"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary underline"
                    >
                      mercadopago.com.br/developers
                    </a>
                  </CardDescription>
                </div>
                <Button type="button" variant="ghost" size="icon" onClick={() => setShowTokens(!showTokens)}>
                  {showTokens ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Test Credentials */}
              <div className="space-y-4">
                <h4 className="text-sm font-medium flex items-center gap-2">
                  <Badge variant="secondary" className="text-xs">Teste</Badge>
                  Credenciais de Sandbox
                </h4>
                <div className="space-y-3">
                  <FormField
                    control={form.control}
                    name="public_key_test"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs">Public Key (Teste)</FormLabel>
                        <FormControl>
                          <Input placeholder="TEST-..." className="font-mono text-xs" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="access_token_test"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs">Access Token (Teste)</FormLabel>
                        <FormControl>
                          <Input
                            type={showTokens ? 'text' : 'password'}
                            placeholder="TEST-..."
                            className="font-mono text-xs"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              <Separator />

              {/* Production Credentials */}
              <div className="space-y-4">
                <h4 className="text-sm font-medium flex items-center gap-2">
                  <Badge className="bg-green-500/10 text-green-600 border-transparent text-xs">Produção</Badge>
                  Credenciais Reais
                </h4>
                <div className="space-y-3">
                  <FormField
                    control={form.control}
                    name="public_key_prod"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs">Public Key (Produção)</FormLabel>
                        <FormControl>
                          <Input placeholder="APP_USR-..." className="font-mono text-xs" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="access_token_prod"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs">Access Token (Produção)</FormLabel>
                        <FormControl>
                          <Input
                            type={showTokens ? 'text' : 'password'}
                            placeholder="APP_USR-..."
                            className="font-mono text-xs"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Webhook */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Webhook</CardTitle>
              <CardDescription>
                Configure esta URL no painel do Mercado Pago (Developers &gt; Webhooks) para receber
                notificações de pagamento automaticamente.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <FormLabel>URL de notificação (webhook)</FormLabel>
                <div className="flex gap-2">
                  <Input readOnly value={notificationUrl} className="font-mono text-xs" />
                  <Button type="button" variant="outline" size="icon" onClick={handleCopyNotificationUrl}>
                    {copied ? <CheckCircle2 className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
              </div>

              <FormField
                control={form.control}
                name="webhook_secret"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs">Webhook Secret</FormLabel>
                    <FormControl>
                      <Input
                        type={showTokens ? 'text' : 'password'}
                        placeholder="Chave secreta do webhook"
                        className="font-mono text-xs"
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>
                      Obrigatório para ativar o pagamento online — evita que notificações de pagamento
                      falsificadas sejam aceitas.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Alert>
                <AlertDescription className="text-xs">
                  No painel do Mercado Pago, marque apenas o evento "Pagamentos" ao configurar o webhook.
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>

          {/* Activation */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Ativação</CardTitle>
            </CardHeader>
            <CardContent>
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
