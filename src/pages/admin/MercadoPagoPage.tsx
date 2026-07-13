import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import {
  getAdminConfig,
  saveAdminConfig,
  testAdminCredentials,
} from '@/lib/mpPayments';
import { Loader as Loader2, CircleCheck as CheckCircle2, Circle as XCircle, CreditCard, Eye, EyeOff, Copy, RefreshCw } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface MpConfig {
  environment: string;
  public_key_test: string;
  access_token_test: string;
  public_key_prod: string;
  access_token_prod: string;
  webhook_secret: string;
  notification_url: string;
}

export default function MercadoPagoPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'unknown' | 'connected' | 'failed'>('unknown');
  const [accountInfo, setAccountInfo] = useState<{ email?: string; nickname?: string } | null>(null);
  const [defaultNotificationUrl, setDefaultNotificationUrl] = useState('');
  const [showTokens, setShowTokens] = useState(false);

  const [config, setConfig] = useState<MpConfig>({
    environment: 'test',
    public_key_test: '',
    access_token_test: '',
    public_key_prod: '',
    access_token_prod: '',
    webhook_secret: '',
    notification_url: '',
  });

  useEffect(() => {
    fetchConfig();
  }, []);

  const fetchConfig = async () => {
    try {
      const data = await getAdminConfig();
      setDefaultNotificationUrl(data.notification_url || '');

      if (data.config) {
        setConfig({
          environment: data.config.environment || 'test',
          public_key_test: data.config.public_key_test || '',
          access_token_test: data.config.access_token_test || '',
          public_key_prod: data.config.public_key_prod || '',
          access_token_prod: data.config.access_token_prod || '',
          webhook_secret: data.config.webhook_secret || '',
          notification_url: data.config.notification_url || data.notification_url || '',
        });
      } else {
        setConfig(prev => ({
          ...prev,
          notification_url: data.notification_url || '',
        }));
      }
    } catch (error) {
      toast.error('Erro ao carregar configuração');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await saveAdminConfig(config);
      toast.success('Configuração salva com sucesso');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao salvar');
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    setTesting(true);
    setConnectionStatus('unknown');
    try {
      const result = await testAdminCredentials();
      if (result.success) {
        setConnectionStatus('connected');
        setAccountInfo(result.account);
        toast.success('Conexão verificada com sucesso!');
      } else {
        setConnectionStatus('failed');
        setAccountInfo(null);
        toast.error(result.error || 'Credenciais inválidas');
      }
    } catch (error) {
      setConnectionStatus('failed');
      setAccountInfo(null);
      toast.error(error instanceof Error ? error.message : 'Erro ao testar credenciais');
    } finally {
      setTesting(false);
    }
  };

  const handleCopyUrl = () => {
    navigator.clipboard.writeText(config.notification_url || defaultNotificationUrl);
    toast.success('URL copiada!');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="w-full px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl page-title">Mercado Pago</h1>
        <p className="text-sm text-muted-foreground">
          Configure as credenciais para processar pagamentos
        </p>
      </div>

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
          <Button
            variant="outline"
            size="sm"
            onClick={handleTest}
            disabled={testing}
          >
            {testing ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <RefreshCw className="h-4 w-4 mr-2" />
            )}
            Testar Conexão
          </Button>
        </CardContent>
      </Card>

      {/* Environment */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Ambiente</CardTitle>
          <CardDescription>
            Use "Teste" durante o desenvolvimento e "Produção" quando estiver pronto para receber pagamentos reais.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Select
            value={config.environment}
            onValueChange={(value) => setConfig(prev => ({ ...prev, environment: value }))}
          >
            <SelectTrigger className="w-[200px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="test">Teste (Sandbox)</SelectItem>
              <SelectItem value="production">Produção</SelectItem>
            </SelectContent>
          </Select>
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
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setShowTokens(!showTokens)}
            >
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
              <div className="space-y-1.5">
                <Label className="text-xs">Public Key (Teste)</Label>
                <Input
                  value={config.public_key_test}
                  onChange={(e) => setConfig(prev => ({ ...prev, public_key_test: e.target.value }))}
                  placeholder="APP_USR-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                  className="font-mono text-xs"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Access Token (Teste)</Label>
                <Input
                  type={showTokens ? 'text' : 'password'}
                  value={config.access_token_test}
                  onChange={(e) => setConfig(prev => ({ ...prev, access_token_test: e.target.value }))}
                  placeholder="APP_USR-xxxxxxxxxxxxxx..."
                  className="font-mono text-xs"
                />
              </div>
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
              <div className="space-y-1.5">
                <Label className="text-xs">Public Key (Produção)</Label>
                <Input
                  value={config.public_key_prod}
                  onChange={(e) => setConfig(prev => ({ ...prev, public_key_prod: e.target.value }))}
                  placeholder="APP_USR-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                  className="font-mono text-xs"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Access Token (Produção)</Label>
                <Input
                  type={showTokens ? 'text' : 'password'}
                  value={config.access_token_prod}
                  onChange={(e) => setConfig(prev => ({ ...prev, access_token_prod: e.target.value }))}
                  placeholder="APP_USR-xxxxxxxxxxxxxx..."
                  className="font-mono text-xs"
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Webhook */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Webhook</CardTitle>
          <CardDescription>
            Configure esta URL no painel do Mercado Pago (Developers &gt; Webhooks) para receber notificações de pagamento automaticamente.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-xs">URL de Notificação</Label>
            <div className="flex gap-2">
              <Input
                value={config.notification_url || defaultNotificationUrl}
                onChange={(e) => setConfig(prev => ({ ...prev, notification_url: e.target.value }))}
                className="font-mono text-xs"
                readOnly
              />
              <Button variant="outline" size="icon" onClick={handleCopyUrl} className="shrink-0">
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Webhook Secret (opcional, recomendado para produção)</Label>
            <Input
              type={showTokens ? 'text' : 'password'}
              value={config.webhook_secret}
              onChange={(e) => setConfig(prev => ({ ...prev, webhook_secret: e.target.value }))}
              placeholder="Chave secreta do webhook"
              className="font-mono text-xs"
            />
          </div>

          <Alert>
            <AlertDescription className="text-xs">
              No painel do Mercado Pago, marque apenas o evento "Pagamentos" ao configurar o webhook.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>

      {/* Save Button */}
      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving} size="lg">
          {saving ? (
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
          ) : null}
          Salvar Configuração
        </Button>
      </div>
    </div>
  );
}
