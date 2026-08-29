import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import {
  getStripeAdminConfig,
  saveStripeAdminConfig,
  testStripeAdminCredentials,
  saveStripePrices,
  type StripePriceRow,
} from '@/lib/stripeAdmin';
import { Loader as Loader2, CircleCheck as CheckCircle2, Circle as XCircle, CreditCard, Eye, EyeOff, Copy, RefreshCw } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';

interface StripeConfigForm {
  environment: string;
  publishable_key_test: string;
  secret_key_test: string;
  publishable_key_prod: string;
  secret_key_prod: string;
  webhook_secret_test: string;
  webhook_secret_prod: string;
}

const CURRENCIES: { value: StripePriceRow['currency']; label: string }[] = [
  { value: 'MXN', label: 'México (MXN)' },
  { value: 'CLP', label: 'Chile (CLP)' },
  { value: 'EUR', label: 'Espanha/Portugal (EUR)' },
  { value: 'USD', label: 'EUA / demais países (USD)' },
];

type PriceGrid = Record<string, { test: string; prod: string }>;

function priceKey(currency: string, cycle: string) {
  return `${currency}_${cycle}`;
}

export default function StripePage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingPrices, setSavingPrices] = useState(false);
  const [testing, setTesting] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'unknown' | 'connected' | 'failed'>('unknown');
  const [webhookUrl, setWebhookUrl] = useState('');
  const [showSecrets, setShowSecrets] = useState(false);

  const [config, setConfig] = useState<StripeConfigForm>({
    environment: 'test',
    publishable_key_test: '',
    secret_key_test: '',
    publishable_key_prod: '',
    secret_key_prod: '',
    webhook_secret_test: '',
    webhook_secret_prod: '',
  });

  const [prices, setPrices] = useState<PriceGrid>({});

  useEffect(() => {
    fetchConfig();
  }, []);

  const fetchConfig = async () => {
    try {
      const data = await getStripeAdminConfig();
      setWebhookUrl(data.webhook_url || '');

      if (data.config) {
        setConfig({
          environment: data.config.environment || 'test',
          publishable_key_test: data.config.publishable_key_test || '',
          secret_key_test: data.config.secret_key_test || '',
          publishable_key_prod: data.config.publishable_key_prod || '',
          secret_key_prod: data.config.secret_key_prod || '',
          webhook_secret_test: data.config.webhook_secret_test || '',
          webhook_secret_prod: data.config.webhook_secret_prod || '',
        });
      }

      const grid: PriceGrid = {};
      for (const c of CURRENCIES) {
        for (const cycle of ['monthly', 'annual'] as const) {
          grid[priceKey(c.value, cycle)] = { test: '', prod: '' };
        }
      }
      for (const row of data.prices || []) {
        const key = priceKey(row.currency, row.cycle);
        if (!grid[key]) continue;
        grid[key][row.environment === 'production' ? 'prod' : 'test'] = row.price_id || '';
      }
      setPrices(grid);
    } catch (error) {
      toast.error('Erro ao carregar configuração');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await saveStripeAdminConfig(config);
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
      const result = await testStripeAdminCredentials(config.environment as 'test' | 'production');
      if (result.success) {
        setConnectionStatus('connected');
        toast.success('Conexão verificada com sucesso!');
      } else {
        setConnectionStatus('failed');
        toast.error(result.error || 'Credenciais inválidas');
      }
    } catch (error) {
      setConnectionStatus('failed');
      toast.error(error instanceof Error ? error.message : 'Erro ao testar credenciais');
    } finally {
      setTesting(false);
    }
  };

  const handleCopyUrl = () => {
    navigator.clipboard.writeText(webhookUrl);
    toast.success('URL copiada!');
  };

  const handleSavePrices = async () => {
    setSavingPrices(true);
    try {
      const rows: StripePriceRow[] = [];
      for (const c of CURRENCIES) {
        for (const cycle of ['monthly', 'annual'] as const) {
          const entry = prices[priceKey(c.value, cycle)];
          rows.push({ environment: 'test', currency: c.value, cycle, price_id: entry?.test || '' });
          rows.push({ environment: 'production', currency: c.value, cycle, price_id: entry?.prod || '' });
        }
      }
      await saveStripePrices(rows);
      toast.success('Preços salvos com sucesso');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao salvar preços');
    } finally {
      setSavingPrices(false);
    }
  };

  const updatePrice = (currency: string, cycle: string, field: 'test' | 'prod', value: string) => {
    setPrices(prev => ({
      ...prev,
      [priceKey(currency, cycle)]: { ...prev[priceKey(currency, cycle)], [field]: value },
    }));
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
        <h1 className="text-2xl md:text-3xl page-title">Stripe (Internacional)</h1>
        <p className="text-sm text-muted-foreground">
          Configure as credenciais para processar assinaturas fora do Brasil. Clientes do Brasil continuam no Mercado Pago.
        </p>
      </div>

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
          <Button variant="outline" size="sm" onClick={handleTest} disabled={testing}>
            {testing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <RefreshCw className="h-4 w-4 mr-2" />}
            Testar Conexão
          </Button>
        </CardContent>
      </Card>

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
              <SelectItem value="test">Teste</SelectItem>
              <SelectItem value="production">Produção</SelectItem>
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base">Credenciais</CardTitle>
              <CardDescription>
                Encontre suas chaves em{' '}
                <a
                  href="https://dashboard.stripe.com/apikeys"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary underline"
                >
                  dashboard.stripe.com/apikeys
                </a>
              </CardDescription>
            </div>
            <Button variant="ghost" size="icon" onClick={() => setShowSecrets(!showSecrets)}>
              {showSecrets ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-4">
            <h4 className="text-sm font-medium flex items-center gap-2">
              <Badge variant="secondary" className="text-xs">Teste</Badge>
              Credenciais de Teste
            </h4>
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Publishable Key (Teste)</Label>
                <Input
                  value={config.publishable_key_test}
                  onChange={(e) => setConfig(prev => ({ ...prev, publishable_key_test: e.target.value }))}
                  placeholder="pk_test_..."
                  className="font-mono text-xs"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Secret Key (Teste)</Label>
                <Input
                  type={showSecrets ? 'text' : 'password'}
                  value={config.secret_key_test}
                  onChange={(e) => setConfig(prev => ({ ...prev, secret_key_test: e.target.value }))}
                  placeholder="sk_test_..."
                  className="font-mono text-xs"
                />
              </div>
            </div>
          </div>

          <Separator />

          <div className="space-y-4">
            <h4 className="text-sm font-medium flex items-center gap-2">
              <Badge className="bg-green-500/10 text-green-600 border-transparent text-xs">Produção</Badge>
              Credenciais Reais
            </h4>
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Publishable Key (Produção)</Label>
                <Input
                  value={config.publishable_key_prod}
                  onChange={(e) => setConfig(prev => ({ ...prev, publishable_key_prod: e.target.value }))}
                  placeholder="pk_live_..."
                  className="font-mono text-xs"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Secret Key (Produção)</Label>
                <Input
                  type={showSecrets ? 'text' : 'password'}
                  value={config.secret_key_prod}
                  onChange={(e) => setConfig(prev => ({ ...prev, secret_key_prod: e.target.value }))}
                  placeholder="sk_live_..."
                  className="font-mono text-xs"
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Webhook</CardTitle>
          <CardDescription>
            Cadastre esta URL no Dashboard da Stripe (Developers &gt; Webhooks), uma vez para o modo teste e outra para produção — as duas apontam pro mesmo endpoint.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-xs">URL do Webhook</Label>
            <div className="flex gap-2">
              <Input value={webhookUrl} readOnly className="font-mono text-xs" />
              <Button variant="outline" size="icon" onClick={handleCopyUrl} className="shrink-0">
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Signing Secret (Teste)</Label>
              <Input
                type={showSecrets ? 'text' : 'password'}
                value={config.webhook_secret_test}
                onChange={(e) => setConfig(prev => ({ ...prev, webhook_secret_test: e.target.value }))}
                placeholder="whsec_..."
                className="font-mono text-xs"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Signing Secret (Produção)</Label>
              <Input
                type={showSecrets ? 'text' : 'password'}
                value={config.webhook_secret_prod}
                onChange={(e) => setConfig(prev => ({ ...prev, webhook_secret_prod: e.target.value }))}
                placeholder="whsec_..."
                className="font-mono text-xs"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving} size="lg">
          {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
          Salvar Configuração
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Preços por país</CardTitle>
          <CardDescription>
            Cole aqui os Price IDs gerados por <code className="text-xs">scripts/setup-stripe-products.js</code>. Rode o script uma vez com a chave de teste e outra com a de produção.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {CURRENCIES.map((c) => (
            <div key={c.value} className="space-y-3">
              <h4 className="text-sm font-medium">{c.label}</h4>
              {(['monthly', 'annual'] as const).map((cycle) => (
                <div key={cycle} className="grid gap-2 sm:grid-cols-[100px_1fr_1fr] items-center">
                  <Label className="text-xs text-muted-foreground">
                    {cycle === 'monthly' ? 'Mensal' : 'Anual'}
                  </Label>
                  <Input
                    value={prices[priceKey(c.value, cycle)]?.test || ''}
                    onChange={(e) => updatePrice(c.value, cycle, 'test', e.target.value)}
                    placeholder="price_... (teste)"
                    className="font-mono text-xs"
                  />
                  <Input
                    value={prices[priceKey(c.value, cycle)]?.prod || ''}
                    onChange={(e) => updatePrice(c.value, cycle, 'prod', e.target.value)}
                    placeholder="price_... (produção)"
                    className="font-mono text-xs"
                  />
                </div>
              ))}
              <Separator />
            </div>
          ))}

          <div className="flex justify-end">
            <Button onClick={handleSavePrices} disabled={savingPrices}>
              {savingPrices ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Salvar Preços
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
