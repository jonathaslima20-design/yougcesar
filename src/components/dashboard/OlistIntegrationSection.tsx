import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Loader as Loader2, CheckCircle2, Copy, RefreshCw, Unlink, Link2, DollarSign } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
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
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import {
  getErpConfig,
  saveErpClientCredentials,
  getErpAuthorizeUrl,
  disconnectErp,
  pullErpStock,
  pushErpPrice,
  unlinkErpProduct,
  type ErpConfig,
} from '@/lib/merchantErp';
import OlistProductLinkDialog from './OlistProductLinkDialog';

interface LinkedProduct {
  id: string;
  title: string;
  price: number | null;
  stock_quantity: number | null;
}

export default function OlistIntegrationSection() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [config, setConfig] = useState<ErpConfig | null>(null);
  const [redirectUri, setRedirectUri] = useState('');
  const [clientId, setClientId] = useState('');
  const [clientSecret, setClientSecret] = useState('');
  const [saving, setSaving] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [linkDialogOpen, setLinkDialogOpen] = useState(false);
  const [linkedProducts, setLinkedProducts] = useState<LinkedProduct[]>([]);
  const [busyProductId, setBusyProductId] = useState<string | null>(null);

  useEffect(() => {
    loadConfig();
  }, []);

  async function loadLinkedProducts() {
    if (!user?.id) return;
    const { data } = await supabase
      .from('products')
      .select('id, title, price, stock_quantity')
      .eq('user_id', user.id)
      .not('olist_product_id', 'is', null)
      .order('title');
    setLinkedProducts(data || []);
  }

  async function loadConfig() {
    setLoading(true);
    try {
      const { config, redirect_uri } = await getErpConfig();
      setConfig(config);
      setRedirectUri(redirect_uri);
      setClientId(config?.client_id || '');
      setClientSecret(config?.client_secret || '');
      if (config?.connected) await loadLinkedProducts();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao carregar configuração da Olist');
    } finally {
      setLoading(false);
    }
  }

  async function handlePushPrice(product: LinkedProduct) {
    setBusyProductId(product.id);
    try {
      await pushErpPrice({ product_id: product.id });
      toast.success(`Preço de "${product.title}" atualizado na Olist.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao atualizar preço na Olist');
    } finally {
      setBusyProductId(null);
    }
  }

  async function handleUnlinkProduct(product: LinkedProduct) {
    setBusyProductId(product.id);
    try {
      await unlinkErpProduct({ product_id: product.id });
      toast.success(`"${product.title}" desvinculado da Olist.`);
      setLinkedProducts((prev) => prev.filter((p) => p.id !== product.id));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao desvincular produto');
    } finally {
      setBusyProductId(null);
    }
  }

  async function handleSaveCredentials() {
    setSaving(true);
    try {
      await saveErpClientCredentials({ client_id: clientId, client_secret: clientSecret });
      toast.success('Credenciais salvas. Agora clique em "Conectar com a Olist".');
      loadConfig();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao salvar credenciais');
    } finally {
      setSaving(false);
    }
  }

  async function handleConnect() {
    setConnecting(true);
    try {
      const { authorize_url } = await getErpAuthorizeUrl();
      window.location.href = authorize_url;
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao iniciar conexão com a Olist');
      setConnecting(false);
    }
  }

  async function handleDisconnect() {
    try {
      await disconnectErp();
      toast.success('Conta Olist desconectada');
      loadConfig();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao desconectar');
    }
  }

  async function handleSyncStock() {
    setSyncing(true);
    try {
      const result = await pullErpStock();
      if (result.synced > 0 || result.failed === 0) {
        toast.success(
          `Estoque sincronizado: ${result.synced} produto(s) atualizado(s)${
            result.failed > 0 ? `, ${result.failed} falharam` : ''
          }.`
        );
      } else {
        toast.error(`Falha ao sincronizar ${result.failed} produto(s).`);
      }
      if (result.has_more) {
        toast.info('Ainda há produtos para sincronizar — clique em "Sincronizar estoque" novamente.');
      }
      loadConfig();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao sincronizar estoque');
    } finally {
      setSyncing(false);
    }
  }

  function copyRedirectUri() {
    navigator.clipboard.writeText(redirectUri);
    toast.success('Redirect URL copiada');
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[120px]">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  const isConnected = !!config?.connected;

  return (
    <div className="space-y-6">
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              Olist ERP (Tiny)
              {isConnected && (
                <Badge className="bg-green-500 text-white text-[10px] px-1.5">
                  <CheckCircle2 className="h-3 w-3 mr-1" /> Conectado
                </Badge>
              )}
            </CardTitle>
            <CardDescription>
              Sincronize estoque e produtos com sua conta do Olist ERP (antigo Tiny). Quando vendida na
              Vitrine, a baixa é enviada pra Olist na hora; o estoque da Olist é atualizado aqui
              automaticamente a cada 15 minutos.
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        {!isConnected && (
          <div className="rounded-lg border bg-muted/20 p-4 space-y-2 text-sm">
            <p className="font-medium">Como conectar:</p>
            <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
              <li>No seu Olist ERP, acesse Configurações → Aplicativos → Novo Aplicativo.</li>
              <li>Cole esta Redirect URL no campo de URL de redirecionamento:</li>
            </ol>
            <div className="flex items-center gap-2">
              <code className="flex-1 bg-background border px-3 py-1.5 rounded text-xs font-mono truncate">
                {redirectUri}
              </code>
              <Button variant="outline" size="icon" className="shrink-0 h-8 w-8" onClick={copyRedirectUri}>
                <Copy className="h-3.5 w-3.5" />
              </Button>
            </div>
            <ol className="list-decimal list-inside space-y-1 text-muted-foreground" start={3}>
              <li>Copie o Client ID e o Client Secret gerados e cole abaixo.</li>
            </ol>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="olist-client-id">Client ID</Label>
            <Input
              id="olist-client-id"
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              placeholder="Client ID gerado no Olist ERP"
              className="mt-1.5"
            />
          </div>
          <div>
            <Label htmlFor="olist-client-secret">Client Secret</Label>
            <Input
              id="olist-client-secret"
              value={clientSecret}
              onChange={(e) => setClientSecret(e.target.value)}
              placeholder="Client Secret gerado no Olist ERP"
              type="password"
              className="mt-1.5"
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" onClick={handleSaveCredentials} disabled={saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Salvar Credenciais
          </Button>

          {!isConnected ? (
            <Button onClick={handleConnect} disabled={connecting || !clientId.trim()}>
              {connecting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Conectar com a Olist
            </Button>
          ) : (
            <>
              <Button variant="outline" onClick={handleSyncStock} disabled={syncing}>
                {syncing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                Sincronizar Agora
              </Button>
              <Button variant="outline" onClick={() => setLinkDialogOpen(true)}>
                <Link2 className="mr-2 h-4 w-4" />
                Vincular Produtos
              </Button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="ghost" className="text-destructive hover:text-destructive">
                    <Unlink className="mr-2 h-4 w-4" />
                    Desconectar
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Desconectar da Olist?</AlertDialogTitle>
                    <AlertDialogDescription>
                      A sincronização de estoque e produtos será interrompida até você conectar novamente.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={handleDisconnect}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      Desconectar
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </>
          )}
        </div>

        {isConnected && config?.last_synced_at && (
          <p className="text-xs text-muted-foreground">
            Última sincronização de estoque: {new Date(config.last_synced_at).toLocaleString('pt-BR')}
            {' · '}atualiza automaticamente a cada 15 min
          </p>
        )}
      </CardContent>
    </Card>

    {isConnected && linkedProducts.length > 0 && (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Produtos Vinculados</CardTitle>
          <CardDescription>
            Empurre o preço atualizado pra Olist, ou desvincule um produto se não quiser mais sincronizá-lo.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {linkedProducts.map((product) => (
              <div
                key={product.id}
                className="flex items-center justify-between gap-3 p-3 border rounded-lg"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{product.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {product.price != null ? `R$ ${product.price.toFixed(2)}` : 'Sem preço'}
                    {' · '}
                    {product.stock_quantity ?? 0} em estoque
                  </p>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handlePushPrice(product)}
                    disabled={busyProductId === product.id}
                  >
                    <DollarSign className="h-3.5 w-3.5 mr-1" />
                    Empurrar preço
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-destructive hover:text-destructive"
                    onClick={() => handleUnlinkProduct(product)}
                    disabled={busyProductId === product.id}
                  >
                    <Unlink className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    )}

      <OlistProductLinkDialog
        open={linkDialogOpen}
        onOpenChange={(open) => {
          setLinkDialogOpen(open);
          if (!open) loadLinkedProducts();
        }}
      />
    </div>
  );
}
