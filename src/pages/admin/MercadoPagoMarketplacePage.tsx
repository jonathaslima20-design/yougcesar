import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { Loader as Loader2, Eye, EyeOff, Copy, Percent, Link2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  getMarketplaceConfig,
  saveMarketplaceConfig,
  type MarketplaceConfig,
} from '@/lib/mercadopagoMarketplaceAdmin';

export default function MercadoPagoMarketplacePage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showSecrets, setShowSecrets] = useState(false);
  const [redirectUri, setRedirectUri] = useState('');

  const [config, setConfig] = useState<MarketplaceConfig>({
    client_id: '',
    client_secret: '',
    environment: 'test',
    webhook_secret: '',
    fee_percentage: 1,
  });

  useEffect(() => {
    fetchConfig();
  }, []);

  const fetchConfig = async () => {
    try {
      const data = await getMarketplaceConfig();
      setRedirectUri(data.redirect_uri || '');
      if (data.config) {
        setConfig({
          client_id: data.config.client_id || '',
          client_secret: data.config.client_secret || '',
          environment: data.config.environment || 'test',
          webhook_secret: data.config.webhook_secret || '',
          fee_percentage: data.config.fee_percentage ?? 1,
        });
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao carregar configuração');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await saveMarketplaceConfig(config);
      toast.success('Configuração salva com sucesso');
      fetchConfig();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao salvar');
    } finally {
      setSaving(false);
    }
  };

  const handleCopyRedirectUri = () => {
    navigator.clipboard.writeText(redirectUri);
    toast.success('Redirect URL copiada!');
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
        <h1 className="text-2xl md:text-3xl page-title">Taxa da Plataforma (Mercado Pago)</h1>
        <p className="text-sm text-muted-foreground">
          Aplicação Mercado Pago do VitrineTurbo usada pelo split de pagamentos — cada venda paga
          online por um comprador dentro de uma loja gera uma comissão automática pra essa conta.
        </p>
      </div>

      <Alert>
        <AlertDescription className="text-xs space-y-1">
          <p>Antes de configurar aqui, registre uma Aplicação no{' '}
            <a
              href="https://www.mercadopago.com.br/developers/panel"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary underline"
            >
              painel de desenvolvedores do Mercado Pago
            </a>{' '}
            e cole a Redirect URL abaixo exatamente nas configurações OAuth dessa Aplicação.
          </p>
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Link2 className="h-4 w-4 text-muted-foreground" />
            Redirect URL
          </CardTitle>
          <CardDescription>
            Precisa ser colada exatamente assim nas configurações OAuth da Aplicação no Mercado Pago.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <Input value={redirectUri} readOnly className="font-mono text-xs" />
            <Button variant="outline" size="icon" onClick={handleCopyRedirectUri} className="shrink-0">
              <Copy className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Ambiente</CardTitle>
          <CardDescription>
            Use "Teste" enquanto valida o fluxo com contas de teste do Mercado Pago; troque pra "Produção"
            quando estiver pronto pra liberar geral.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Select
            value={config.environment}
            onValueChange={(value) => setConfig((prev) => ({ ...prev, environment: value as 'test' | 'production' }))}
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

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base">Credenciais da Aplicação</CardTitle>
              <CardDescription>
                Client ID e Client Secret gerados no registro da Aplicação no Mercado Pago.
              </CardDescription>
            </div>
            <Button variant="ghost" size="icon" onClick={() => setShowSecrets(!showSecrets)}>
              {showSecrets ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-xs">Client ID</Label>
            <Input
              value={config.client_id}
              onChange={(e) => setConfig((prev) => ({ ...prev, client_id: e.target.value }))}
              placeholder="Client ID da Aplicação"
              className="font-mono text-xs"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Client Secret</Label>
            <Input
              type={showSecrets ? 'text' : 'password'}
              value={config.client_secret}
              onChange={(e) => setConfig((prev) => ({ ...prev, client_secret: e.target.value }))}
              placeholder="Client Secret da Aplicação"
              className="font-mono text-xs"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Webhook</CardTitle>
          <CardDescription>
            Segredo de assinatura configurado no painel de Notificações dessa Aplicação (Developers &gt;
            Webhooks). Diferente do webhook por lojista de antes — agora é um único segredo pra toda a
            Aplicação.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-1.5">
            <Label className="text-xs">Webhook Secret</Label>
            <Input
              type={showSecrets ? 'text' : 'password'}
              value={config.webhook_secret}
              onChange={(e) => setConfig((prev) => ({ ...prev, webhook_secret: e.target.value }))}
              placeholder="Chave secreta do webhook"
              className="font-mono text-xs"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Percent className="h-4 w-4 text-muted-foreground" />
            Taxa da Plataforma
          </CardTitle>
          <CardDescription>
            Percentual descontado automaticamente (via `application_fee` do Mercado Pago) em cada venda
            paga online dentro das lojas.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-1.5 w-[160px]">
            <Label className="text-xs">Percentual (%)</Label>
            <Input
              type="number"
              step="0.01"
              min="0"
              max="100"
              value={config.fee_percentage}
              onChange={(e) => setConfig((prev) => ({ ...prev, fee_percentage: Number(e.target.value) }))}
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
    </div>
  );
}
