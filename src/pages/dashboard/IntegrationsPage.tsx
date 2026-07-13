import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { Key, Plus, Trash2, Copy, Eye, EyeOff, Clock, Shield, Code as Code2, Zap, Lock } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface ApiKey {
  id: string;
  key_prefix: string;
  name: string;
  permissions: string[];
  rate_limit_per_minute: number;
  is_active: boolean;
  last_used_at: string | null;
  expires_at: string | null;
  created_at: string;
}

const ALL_PERMISSIONS = [
  { value: 'products:read', label: 'Produtos (Leitura)', group: 'Produtos' },
  { value: 'products:write', label: 'Produtos (Escrita)', group: 'Produtos' },
  { value: 'stock:read', label: 'Estoque (Leitura)', group: 'Estoque' },
  { value: 'stock:write', label: 'Estoque (Escrita)', group: 'Estoque' },
  { value: 'orders:read', label: 'Pedidos (Leitura)', group: 'Pedidos' },
  { value: 'orders:write', label: 'Pedidos (Escrita)', group: 'Pedidos' },
  { value: 'categories:read', label: 'Categorias/Tags (Leitura)', group: 'Categorias' },
  { value: 'categories:write', label: 'Categorias/Tags (Escrita)', group: 'Categorias' },
  { value: 'coupons:read', label: 'Cupons (Leitura)', group: 'Cupons' },
  { value: 'coupons:write', label: 'Cupons (Escrita)', group: 'Cupons' },
  { value: 'store:read', label: 'Loja (Leitura)', group: 'Loja' },
  { value: 'store:write', label: 'Loja (Escrita)', group: 'Loja' },
];

function generateApiKey(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = 'vtb_';
  for (let i = 0; i < 48; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

async function hashKey(key: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(key);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

export default function IntegrationsPage() {
  const { user } = useAuth();
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [keyToDelete, setKeyToDelete] = useState<string | null>(null);
  const [newKeyName, setNewKeyName] = useState('');
  const [newKeyPermissions, setNewKeyPermissions] = useState<string[]>([
    'products:read', 'orders:read', 'stock:read', 'categories:read', 'coupons:read', 'store:read',
  ]);
  const [generatedKey, setGeneratedKey] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [showDocs, setShowDocs] = useState(false);

  const isEligible = user?.plan_status === 'active' && user?.billing_cycle === 'annually';

  useEffect(() => {
    if (isEligible) fetchApiKeys();
    else setLoading(false);
  }, [isEligible]);

  async function fetchApiKeys() {
    setLoading(true);
    const { data, error } = await supabase
      .from('api_keys')
      .select('*')
      .order('created_at', { ascending: false });

    if (!error && data) setApiKeys(data);
    setLoading(false);
  }

  async function createApiKey() {
    if (!newKeyName.trim()) {
      toast.error('Informe um nome para a chave');
      return;
    }
    if (newKeyPermissions.length === 0) {
      toast.error('Selecione ao menos uma permissão');
      return;
    }

    setCreating(true);
    const rawKey = generateApiKey();
    const keyHash = await hashKey(rawKey);
    const keyPrefix = rawKey.substring(0, 12);

    const { error } = await supabase.from('api_keys').insert({
      user_id: user?.id,
      key_hash: keyHash,
      key_prefix: keyPrefix,
      name: newKeyName.trim(),
      permissions: newKeyPermissions,
    });

    if (error) {
      toast.error('Erro ao criar chave de API');
      setCreating(false);
      return;
    }

    setGeneratedKey(rawKey);
    setCreating(false);
    fetchApiKeys();
  }

  async function deleteApiKey() {
    if (!keyToDelete) return;
    const { error } = await supabase.from('api_keys').delete().eq('id', keyToDelete);
    if (error) {
      toast.error('Erro ao revogar chave');
    } else {
      toast.success('Chave revogada com sucesso');
      setApiKeys((prev) => prev.filter((k) => k.id !== keyToDelete));
    }
    setDeleteDialogOpen(false);
    setKeyToDelete(null);
  }

  function togglePermission(permission: string) {
    setNewKeyPermissions((prev) =>
      prev.includes(permission)
        ? prev.filter((p) => p !== permission)
        : [...prev, permission]
    );
  }

  function copyToClipboard(text: string) {
    navigator.clipboard.writeText(text);
    toast.success('Copiado para a área de transferência');
  }

  function resetCreateDialog() {
    setCreateDialogOpen(false);
    setGeneratedKey(null);
    setNewKeyName('');
    setNewKeyPermissions([
      'products:read', 'orders:read', 'stock:read', 'categories:read', 'coupons:read', 'store:read',
    ]);
  }

  const baseUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/api-gateway`;

  if (!isEligible) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 sm:px-6 py-4 sm:py-6 max-w-5xl">
          <Card className="border shadow-sm">
            <CardContent className="p-8 sm:p-12 text-center">
              <div className="mx-auto w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-6">
                <Lock className="h-8 w-8 text-muted-foreground" />
              </div>
              <h2 className="text-2xl font-semibold mb-3">API e Integrações</h2>
              <p className="text-muted-foreground max-w-md mx-auto mb-6">
                A API do VitrineTurbo permite integrar sua loja com sistemas externos como Bling, Tiny, e outros ERPs.
                Este recurso está disponível exclusivamente para assinantes do plano Anual.
              </p>
              <Badge variant="outline" className="text-sm px-4 py-1.5">
                Disponível no Plano Anual
              </Badge>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 sm:px-6 py-4 sm:py-6 max-w-5xl">
        <Card className="border shadow-sm">
          <div className="p-4 sm:p-8">
            {/* Header */}
            <div className="mb-6">
              <h1 className="text-xl sm:text-2xl font-semibold mb-1">Integrações & API</h1>
              <p className="text-xs sm:text-sm text-muted-foreground">
                Gerencie suas chaves de API para integrar com sistemas externos
              </p>
            </div>

            {/* Quick Info Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
              <div className="flex items-start gap-3 p-4 rounded-lg border bg-card">
                <Shield className="h-5 w-5 text-green-600 mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-medium">Segura</p>
                  <p className="text-xs text-muted-foreground">Chaves criptografadas com SHA-256</p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-4 rounded-lg border bg-card">
                <Zap className="h-5 w-5 text-amber-600 mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-medium">Rate Limit</p>
                  <p className="text-xs text-muted-foreground">60 requisições/minuto por chave</p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-4 rounded-lg border bg-card">
                <Code2 className="h-5 w-5 text-blue-600 mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-medium">RESTful</p>
                  <p className="text-xs text-muted-foreground">API padrão com JSON</p>
                </div>
              </div>
            </div>

            {/* API Keys Section */}
            <div className="mb-8">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold">Chaves de API</h2>
                <Button onClick={() => setCreateDialogOpen(true)} size="sm">
                  <Plus className="h-4 w-4 mr-1.5" />
                  Nova Chave
                </Button>
              </div>

              {loading ? (
                <div className="space-y-3">
                  {[1, 2].map((i) => (
                    <div key={i} className="h-20 rounded-lg border bg-muted/30 animate-pulse" />
                  ))}
                </div>
              ) : apiKeys.length === 0 ? (
                <div className="text-center py-12 border rounded-lg bg-muted/20">
                  <Key className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
                  <p className="text-sm text-muted-foreground mb-4">
                    Nenhuma chave de API criada ainda
                  </p>
                  <Button onClick={() => setCreateDialogOpen(true)} variant="outline" size="sm">
                    <Plus className="h-4 w-4 mr-1.5" />
                    Criar primeira chave
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  {apiKeys.map((key) => (
                    <div
                      key={key.id}
                      className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/30 transition-colors"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="font-medium text-sm truncate">{key.name}</p>
                          <Badge
                            variant={key.is_active ? 'default' : 'secondary'}
                            className={`text-[10px] px-1.5 ${key.is_active ? 'bg-green-500 text-white' : ''}`}
                          >
                            {key.is_active ? 'Ativa' : 'Inativa'}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground">
                          <code className="bg-muted px-1.5 py-0.5 rounded font-mono">
                            {key.key_prefix}...
                          </code>
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {key.last_used_at
                              ? `Usado ${format(new Date(key.last_used_at), "dd/MM/yy 'as' HH:mm", { locale: ptBR })}`
                              : 'Nunca utilizada'}
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-1 mt-2">
                          {key.permissions.slice(0, 4).map((p) => (
                            <Badge key={p} variant="outline" className="text-[10px] px-1.5 py-0">
                              {p}
                            </Badge>
                          ))}
                          {key.permissions.length > 4 && (
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                              +{key.permissions.length - 4}
                            </Badge>
                          )}
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-destructive hover:text-destructive shrink-0 ml-2"
                        onClick={() => {
                          setKeyToDelete(key.id);
                          setDeleteDialogOpen(true);
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Documentation Section */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold">Documentação da API</h2>
                <Button variant="outline" size="sm" onClick={() => setShowDocs(!showDocs)}>
                  {showDocs ? <EyeOff className="h-4 w-4 mr-1.5" /> : <Eye className="h-4 w-4 mr-1.5" />}
                  {showDocs ? 'Ocultar' : 'Ver Documentação'}
                </Button>
              </div>

              {showDocs && (
                <div className="border rounded-lg p-5 bg-muted/20 space-y-6">
                  {/* Base URL */}
                  <div>
                    <h3 className="text-sm font-semibold mb-2">Base URL</h3>
                    <div className="flex items-center gap-2">
                      <code className="bg-background border px-3 py-1.5 rounded text-xs font-mono flex-1 truncate">
                        {baseUrl}/api/v1
                      </code>
                      <Button
                        variant="outline"
                        size="icon"
                        className="shrink-0 h-8 w-8"
                        onClick={() => copyToClipboard(`${baseUrl}/api/v1`)}
                      >
                        <Copy className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>

                  {/* Authentication */}
                  <div>
                    <h3 className="text-sm font-semibold mb-2">Autenticação</h3>
                    <p className="text-xs text-muted-foreground mb-2">
                      Envie sua chave de API no header <code className="bg-background px-1 rounded">X-API-Key</code>:
                    </p>
                    <pre className="bg-background border rounded p-3 text-xs font-mono overflow-x-auto">
{`curl -H "X-API-Key: vtb_sua_chave_aqui" \\
  ${baseUrl}/api/v1/products`}
                    </pre>
                  </div>

                  {/* Endpoints */}
                  <div>
                    <h3 className="text-sm font-semibold mb-3">Endpoints Disponíveis</h3>
                    <div className="space-y-2">
                      {[
                        { method: 'GET', path: '/products', desc: 'Listar produtos' },
                        { method: 'GET', path: '/products/:id', desc: 'Detalhe do produto' },
                        { method: 'POST', path: '/products', desc: 'Criar produto' },
                        { method: 'PUT', path: '/products/:id', desc: 'Atualizar produto' },
                        { method: 'PATCH', path: '/products/:id', desc: 'Atualizar campos parciais' },
                        { method: 'DELETE', path: '/products/:id', desc: 'Remover produto' },
                        { method: 'GET', path: '/products/:id/stock', desc: 'Consultar estoque' },
                        { method: 'PUT', path: '/products/:id/stock', desc: 'Definir estoque' },
                        { method: 'POST', path: '/products/:id/stock/adjust', desc: 'Ajustar estoque' },
                        { method: 'GET', path: '/stock/low', desc: 'Produtos com estoque baixo' },
                        { method: 'GET', path: '/categories', desc: 'Listar categorias' },
                        { method: 'POST', path: '/categories', desc: 'Criar categoria' },
                        { method: 'GET', path: '/tags', desc: 'Listar tags' },
                        { method: 'POST', path: '/tags', desc: 'Criar tag' },
                        { method: 'GET', path: '/orders', desc: 'Listar pedidos' },
                        { method: 'GET', path: '/orders/:id', desc: 'Detalhe do pedido' },
                        { method: 'POST', path: '/orders', desc: 'Criar pedido' },
                        { method: 'PATCH', path: '/orders/:id/status', desc: 'Atualizar status do pedido' },
                        { method: 'GET', path: '/coupons', desc: 'Listar cupons' },
                        { method: 'POST', path: '/coupons', desc: 'Criar cupom' },
                        { method: 'POST', path: '/coupons/validate', desc: 'Validar cupom' },
                        { method: 'GET', path: '/store', desc: 'Informacoes da loja' },
                        { method: 'PUT', path: '/store', desc: 'Atualizar loja' },
                        { method: 'GET', path: '/store/appearance', desc: 'Aparência da vitrine' },
                        { method: 'GET', path: '/store/settings', desc: 'Configurações' },
                      ].map((endpoint, i) => (
                        <div key={i} className="flex items-center gap-3 text-xs">
                          <Badge
                            variant="outline"
                            className={`font-mono w-16 justify-center text-[10px] ${
                              endpoint.method === 'GET'
                                ? 'text-green-700 border-green-300'
                                : endpoint.method === 'POST'
                                ? 'text-blue-700 border-blue-300'
                                : endpoint.method === 'PUT' || endpoint.method === 'PATCH'
                                ? 'text-amber-700 border-amber-300'
                                : 'text-red-700 border-red-300'
                            }`}
                          >
                            {endpoint.method}
                          </Badge>
                          <code className="font-mono text-foreground">{endpoint.path}</code>
                          <span className="text-muted-foreground ml-auto hidden sm:block">{endpoint.desc}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Response Format */}
                  <div>
                    <h3 className="text-sm font-semibold mb-2">Formato de Resposta</h3>
                    <pre className="bg-background border rounded p-3 text-xs font-mono overflow-x-auto">
{`// Sucesso
{
  "data": { ... },
  "meta": { "page": 1, "per_page": 20, "total": 150, "total_pages": 8 }
}

// Erro
{
  "error": { "code": "not_found", "message": "Product not found" }
}`}
                    </pre>
                  </div>

                  {/* Filtering */}
                  <div>
                    <h3 className="text-sm font-semibold mb-2">Filtros e Paginação</h3>
                    <pre className="bg-background border rounded p-3 text-xs font-mono overflow-x-auto">
{`GET /api/v1/products?page=1&per_page=50&status=disponivel&category=Calcados&min_price=100&sort_by=price&sort_order=asc`}
                    </pre>
                  </div>
                </div>
              )}
            </div>
          </div>
        </Card>

        {/* Create API Key Dialog */}
        <Dialog open={createDialogOpen} onOpenChange={(open) => { if (!open) resetCreateDialog(); }}>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            {generatedKey ? (
              <>
                <DialogHeader>
                  <DialogTitle>Chave Criada com Sucesso</DialogTitle>
                  <DialogDescription>
                    Copie sua chave agora. Ela não será exibida novamente.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
                    <p className="text-xs text-amber-800 font-medium mb-2">
                      Guarde esta chave em local seguro:
                    </p>
                    <div className="flex items-center gap-2">
                      <code className="flex-1 bg-white border px-3 py-2 rounded text-xs font-mono break-all">
                        {generatedKey}
                      </code>
                      <Button
                        variant="outline"
                        size="icon"
                        className="shrink-0"
                        onClick={() => copyToClipboard(generatedKey)}
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
                <DialogFooter>
                  <Button onClick={resetCreateDialog}>Fechar</Button>
                </DialogFooter>
              </>
            ) : (
              <>
                <DialogHeader>
                  <DialogTitle>Nova Chave de API</DialogTitle>
                  <DialogDescription>
                    Configure as permissões para esta integração.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-5 py-4">
                  <div>
                    <Label htmlFor="key-name" className="text-sm font-medium">
                      Nome da integração
                    </Label>
                    <Input
                      id="key-name"
                      placeholder="Ex: Bling ERP, Minha Aplicação"
                      value={newKeyName}
                      onChange={(e) => setNewKeyName(e.target.value)}
                      className="mt-1.5"
                    />
                  </div>

                  <div>
                    <Label className="text-sm font-medium">Permissões</Label>
                    <p className="text-xs text-muted-foreground mt-0.5 mb-3">
                      Selecione o que esta chave pode acessar
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {ALL_PERMISSIONS.map((perm) => (
                        <label
                          key={perm.value}
                          className="flex items-center gap-2 p-2 rounded border hover:bg-muted/50 cursor-pointer transition-colors"
                        >
                          <Checkbox
                            checked={newKeyPermissions.includes(perm.value)}
                            onCheckedChange={() => togglePermission(perm.value)}
                          />
                          <span className="text-xs">{perm.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={resetCreateDialog}>
                    Cancelar
                  </Button>
                  <Button onClick={createApiKey} disabled={creating}>
                    {creating ? 'Criando...' : 'Criar Chave'}
                  </Button>
                </DialogFooter>
              </>
            )}
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation */}
        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Revogar Chave de API</AlertDialogTitle>
              <AlertDialogDescription>
                Esta ação é irreversível. Qualquer sistema que utilize esta chave perderá o acesso imediatamente.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                onClick={deleteApiKey}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Revogar
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}
