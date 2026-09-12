import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import {
  getCaktoAdminConfig,
  saveCaktoAdminConfig,
  testCaktoAdminCredentials,
  saveCaktoOffers,
} from '@/lib/caktoAdmin';
import { Loader as Loader2, CircleCheck as CheckCircle2, Circle as XCircle, Landmark, Eye, EyeOff, Copy, RefreshCw } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';

interface CaktoConfigForm {
  environment: string;
  client_id_test: string;
  client_secret_test: string;
  client_id_prod: string;
  client_secret_prod: string;
  sdk_client_id_test: string;
  sdk_client_id_prod: string;
  webhook_secret: string;
  pix_enabled: boolean;
  is_active: boolean;
}

interface PlanRow {
  id: string;
  name: string;
  duration: string;
}

interface OfferForm {
  product_id: string;
  offer_id: string;
}

export default function CaktoPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingOffers, setSavingOffers] = useState(false);
  const [testing, setTesting] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'unknown' | 'connected' | 'failed'>('unknown');
  const [webhookUrl, setWebhookUrl] = useState('');
  const [showSecrets, setShowSecrets] = useState(false);
  const [plans, setPlans] = useState<PlanRow[]>([]);
  const [offers, setOffers] = useState<Record<string, OfferForm>>({});

  const [config, setConfig] = useState<CaktoConfigForm>({
    environment: 'production',
    client_id_test: '',
    client_secret_test: '',
    client_id_prod: '',
    client_secret_prod: '',
    sdk_client_id_test: '',
    sdk_client_id_prod: '',
    webhook_secret: '',
    pix_enabled: false,
    is_active: false,
  });

  useEffect(() => {
    fetchAll();
  }, []);

  const fetchAll = async () => {
    try {
      const [{ data: plansData }, adminData] = await Promise.all([
        supabase
          .from('subscription_plans')
          .select('id, name, duration')
          .eq('is_active', true)
          .neq('duration', 'Free')
          .order('display_order'),
        getCaktoAdminConfig(),
      ]);

      setPlans(plansData || []);
      setWebhookUrl(adminData.webhook_url || '');

      if (adminData.config) {
        setConfig({
          environment: adminData.config.environment || 'production',
          client_id_test: adminData.config.client_id_test || '',
          client_secret_test: adminData.config.client_secret_test || '',
          client_id_prod: adminData.config.client_id_prod || '',
          client_secret_prod: adminData.config.client_secret_prod || '',
          sdk_client_id_test: adminData.config.sdk_client_id_test || '',
          sdk_client_id_prod: adminData.config.sdk_client_id_prod || '',
          webhook_secret: adminData.config.webhook_secret || '',
          pix_enabled: !!adminData.config.pix_enabled,
          is_active: !!adminData.config.is_active,
        });
      }

      const offerMap: Record<string, OfferForm> = {};
      for (const o of adminData.offers || []) {
        offerMap[o.plan_id] = { product_id: o.product_id || '', offer_id: o.offer_id || '' };
      }
      setOffers(offerMap);
    } catch (error) {
      toast.error('Erro ao carregar configuração');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await saveCaktoAdminConfig(config);
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
      const result = await testCaktoAdminCredentials(config.environment as 'test' | 'production');
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

  const handleSaveOffers = async () => {
    setSavingOffers(true);
    try {
      const rows = plans.map((plan) => ({
        environment: config.environment as 'test' | 'production',
        plan_id: plan.id,
        billing_cycle: plan.duration,
        product_id: offers[plan.id]?.product_id || '',
        offer_id: offers[plan.id]?.offer_id || '',
      }));
      await saveCaktoOffers(rows);
      toast.success('Ofertas salvas com sucesso');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao salvar ofertas');
    } finally {
      setSavingOffers(false);
    }
  };

  const updateOffer = (planId: string, field: keyof OfferForm, value: string) => {
    setOffers((prev) => ({ ...prev, [planId]: { ...prev[planId], [field]: value } as OfferForm }));
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
        <h1 className="text-2xl md:text-3xl page-title">Cakto</h1>
        <p className="text-sm text-muted-foreground">
          Provedor alternativo de assinatura para o Brasil. Quando ativado abaixo, substitui o Mercado Pago
          para todos os assinantes brasileiros — os dois não ficam ativos ao mesmo tempo.
        </p>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Landmark className="h-5 w-5 text-muted-foreground" />
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
              {connectionStatus === 'unknown' && <Badge variant="secondary">Não verificado</Badge>}
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
          <CardTitle className="text-base">Ativação</CardTitle>
          <CardDescription>
            "Provedor ativo para o Brasil" troca todo o roteamento do checkout de assinatura de Mercado Pago
            para Cakto. "Pix" só deve ser ligado depois que a conta Cakto Banking estiver liberada — antes
            disso, cobranças Pix retornam erro.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <p className="text-sm font-medium">Provedor ativo para o Brasil</p>
              <p className="text-xs text-muted-foreground">Ligado = Cakto. Desligado = Mercado Pago (padrão).</p>
            </div>
            <Switch
              checked={config.is_active}
              onCheckedChange={(checked) => setConfig((prev) => ({ ...prev, is_active: checked }))}
            />
          </div>
          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <p className="text-sm font-medium">Pix habilitado</p>
              <p className="text-xs text-muted-foreground">Requer conta Cakto Banking ativa e verificada.</p>
            </div>
            <Switch
              checked={config.pix_enabled}
              onCheckedChange={(checked) => setConfig((prev) => ({ ...prev, pix_enabled: checked }))}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Ambiente</CardTitle>
          <CardDescription>
            A Cakto ainda não publica uma URL de sandbox — solicite credenciais de teste ao suporte antes de
            usar "Teste" em produção.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Select
            value={config.environment}
            onValueChange={(value) => setConfig((prev) => ({ ...prev, environment: value }))}
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
                Client ID/Secret (OAuth2, uso no servidor) e o Client ID do SDK (escopo de tokenização de
                cartão, seguro para expor no navegador) — gerados no painel da Cakto.
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
                <Label className="text-xs">Client ID (Teste)</Label>
                <Input
                  value={config.client_id_test}
                  onChange={(e) => setConfig((prev) => ({ ...prev, client_id_test: e.target.value }))}
                  className="font-mono text-xs"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Client Secret (Teste)</Label>
                <Input
                  type={showSecrets ? 'text' : 'password'}
                  value={config.client_secret_test}
                  onChange={(e) => setConfig((prev) => ({ ...prev, client_secret_test: e.target.value }))}
                  className="font-mono text-xs"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">SDK Client ID (Teste)</Label>
                <Input
                  value={config.sdk_client_id_test}
                  onChange={(e) => setConfig((prev) => ({ ...prev, sdk_client_id_test: e.target.value }))}
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
                <Label className="text-xs">Client ID (Produção)</Label>
                <Input
                  value={config.client_id_prod}
                  onChange={(e) => setConfig((prev) => ({ ...prev, client_id_prod: e.target.value }))}
                  className="font-mono text-xs"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Client Secret (Produção)</Label>
                <Input
                  type={showSecrets ? 'text' : 'password'}
                  value={config.client_secret_prod}
                  onChange={(e) => setConfig((prev) => ({ ...prev, client_secret_prod: e.target.value }))}
                  className="font-mono text-xs"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">SDK Client ID (Produção)</Label>
                <Input
                  value={config.sdk_client_id_prod}
                  onChange={(e) => setConfig((prev) => ({ ...prev, sdk_client_id_prod: e.target.value }))}
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
            Cadastre esta URL no painel da Cakto (Integrações &gt; Webhooks) e cole aqui o secret gerado.
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
          <div className="space-y-1.5">
            <Label className="text-xs">Webhook Secret</Label>
            <Input
              type={showSecrets ? 'text' : 'password'}
              value={config.webhook_secret}
              onChange={(e) => setConfig((prev) => ({ ...prev, webhook_secret: e.target.value }))}
              className="font-mono text-xs"
            />
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
          <CardTitle className="text-base">Ofertas por plano</CardTitle>
          <CardDescription>
            Cole o Product ID e o Offer ID criados manualmente no painel da Cakto para cada plano do
            VitrineTurbo (ambiente "{config.environment === 'production' ? 'Produção' : 'Teste'}").
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {plans.map((plan) => (
            <div key={plan.id} className="grid gap-2 sm:grid-cols-[140px_1fr_1fr] items-center">
              <Label className="text-xs text-muted-foreground">
                {plan.name} ({plan.duration})
              </Label>
              <Input
                value={offers[plan.id]?.product_id || ''}
                onChange={(e) => updateOffer(plan.id, 'product_id', e.target.value)}
                placeholder="Product ID"
                className="font-mono text-xs"
              />
              <Input
                value={offers[plan.id]?.offer_id || ''}
                onChange={(e) => updateOffer(plan.id, 'offer_id', e.target.value)}
                placeholder="Offer ID"
                className="font-mono text-xs"
              />
            </div>
          ))}

          <div className="flex justify-end pt-2">
            <Button onClick={handleSaveOffers} disabled={savingOffers}>
              {savingOffers ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Salvar Ofertas
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
