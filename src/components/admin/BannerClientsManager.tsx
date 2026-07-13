import { useState, useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
import { Plus, Trash2, RefreshCw, Search, ExternalLink, GripVertical } from 'lucide-react';

interface BannerClient {
  id: string;
  corretor_page_url: string;
  business_name: string;
  avatar_url: string | null;
  display_order: number;
  is_active: boolean;
  created_at: string;
}

interface CorretorPreview {
  name: string;
  avatar_url: string | null;
  slug: string;
}

export default function BannerClientsManager() {
  const [clients, setClients] = useState<BannerClient[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [selectedClient, setSelectedClient] = useState<BannerClient | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const [urlInput, setUrlInput] = useState('');
  const [isFetching, setIsFetching] = useState(false);
  const [preview, setPreview] = useState<CorretorPreview | null>(null);
  const [addIsActive, setAddIsActive] = useState(true);

  const [editIsActive, setEditIsActive] = useState(true);

  const dragItemIndex = useRef<number | null>(null);
  const dragOverItemIndex = useRef<number | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);

  useEffect(() => {
    fetchClients();
  }, []);

  const fetchClients = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('banner_clients')
        .select('*')
        .order('display_order', { ascending: true });

      if (error) throw error;
      setClients(data || []);
    } catch (error) {
      console.error('Error fetching banner clients:', error);
      toast.error('Erro ao carregar clientes do banner');
    } finally {
      setLoading(false);
    }
  };

  const extractSlugFromUrl = (url: string): string | null => {
    try {
      const trimmed = url.trim();
      const urlObj = new URL(trimmed.startsWith('http') ? trimmed : `https://${trimmed}`);
      const parts = urlObj.pathname.split('/').filter(Boolean);
      if (parts.length === 0) return null;
      return parts[parts.length - 1];
    } catch {
      const parts = url.trim().split('/').filter(Boolean);
      if (parts.length === 0) return null;
      return parts[parts.length - 1];
    }
  };

  const fetchCorretorPreview = async () => {
    if (!urlInput.trim()) {
      toast.error('Cole a URL da página do corretor');
      return;
    }

    const slug = extractSlugFromUrl(urlInput);
    if (!slug) {
      toast.error('URL inválida. Cole a URL completa da página do corretor.');
      return;
    }

    setIsFetching(true);
    setPreview(null);

    try {
      const { data, error } = await supabase
        .from('users')
        .select('name, avatar_url, slug')
        .eq('slug', slug)
        .eq('role', 'corretor')
        .eq('is_blocked', false)
        .maybeSingle();

      if (error) throw error;

      if (!data) {
        toast.error('Corretor não encontrado. Verifique a URL e tente novamente.');
        return;
      }

      setPreview({
        name: data.name,
        avatar_url: data.avatar_url,
        slug: data.slug,
      });
    } catch (error) {
      console.error('Error fetching corretor:', error);
      toast.error('Erro ao buscar corretor. Verifique a URL.');
    } finally {
      setIsFetching(false);
    }
  };

  const handleRefreshClient = async (client: BannerClient) => {
    const slug = extractSlugFromUrl(client.corretor_page_url);
    if (!slug) {
      toast.error('URL inválida no registro.');
      return;
    }

    try {
      const { data, error } = await supabase
        .from('users')
        .select('name, avatar_url')
        .eq('slug', slug)
        .eq('role', 'corretor')
        .eq('is_blocked', false)
        .maybeSingle();

      if (error) throw error;
      if (!data) {
        toast.error('Corretor não encontrado.');
        return;
      }

      const { error: updateError } = await supabase
        .from('banner_clients')
        .update({ business_name: data.name, avatar_url: data.avatar_url })
        .eq('id', client.id);

      if (updateError) throw updateError;
      toast.success('Dados atualizados com sucesso!');
      fetchClients();
    } catch (error) {
      console.error('Error refreshing client:', error);
      toast.error('Erro ao atualizar dados do corretor.');
    }
  };

  const handleAddClient = async () => {
    if (!preview) {
      toast.error('Busque um corretor antes de adicionar.');
      return;
    }

    const nextOrder = clients.length > 0
      ? Math.max(...clients.map((c) => c.display_order)) + 1
      : 1;

    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('banner_clients')
        .insert({
          corretor_page_url: urlInput.trim(),
          business_name: preview.name,
          avatar_url: preview.avatar_url,
          display_order: nextOrder,
          is_active: addIsActive,
        });

      if (error) throw error;
      toast.success('Cliente adicionado ao banner!');
      setIsAddDialogOpen(false);
      resetAddForm();
      fetchClients();
    } catch (error) {
      console.error('Error adding client:', error);
      toast.error('Erro ao adicionar cliente.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleEditOpen = (client: BannerClient) => {
    setSelectedClient(client);
    setEditIsActive(client.is_active);
    setIsEditDialogOpen(true);
  };

  const handleEditSave = async () => {
    if (!selectedClient) return;
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('banner_clients')
        .update({ is_active: editIsActive })
        .eq('id', selectedClient.id);

      if (error) throw error;
      toast.success('Cliente atualizado!');
      setIsEditDialogOpen(false);
      fetchClients();
    } catch (error) {
      console.error('Error updating client:', error);
      toast.error('Erro ao atualizar cliente.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const { error } = await supabase
        .from('banner_clients')
        .delete()
        .eq('id', id);

      if (error) throw error;
      toast.success('Cliente removido do banner.');
      fetchClients();
    } catch (error) {
      console.error('Error deleting client:', error);
      toast.error('Erro ao remover cliente.');
    }
  };

  const resetAddForm = () => {
    setUrlInput('');
    setPreview(null);
    setAddIsActive(true);
  };

  const handleDragStart = (index: number, id: string) => {
    dragItemIndex.current = index;
    setDraggingId(id);
  };

  const handleDragEnter = (index: number, id: string) => {
    dragOverItemIndex.current = index;
    setDragOverId(id);
  };

  const handleDragEnd = async () => {
    const fromIndex = dragItemIndex.current;
    const toIndex = dragOverItemIndex.current;

    setDraggingId(null);
    setDragOverId(null);
    dragItemIndex.current = null;
    dragOverItemIndex.current = null;

    if (fromIndex === null || toIndex === null || fromIndex === toIndex) return;

    const reordered = [...clients];
    const [moved] = reordered.splice(fromIndex, 1);
    reordered.splice(toIndex, 0, moved);

    const updated = reordered.map((client, i) => ({ ...client, display_order: i + 1 }));
    setClients(updated);

    try {
      await Promise.all(
        updated.map((client) =>
          supabase
            .from('banner_clients')
            .update({ display_order: client.display_order })
            .eq('id', client.id)
        )
      );
      toast.success('Ordem atualizada!');
    } catch (error) {
      console.error('Error saving order:', error);
      toast.error('Erro ao salvar a nova ordem.');
      fetchClients();
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-muted-foreground">
            {clients.length} cliente{clients.length !== 1 ? 's' : ''} configurado{clients.length !== 1 ? 's' : ''}
          </p>
        </div>
        <Button onClick={() => setIsAddDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Adicionar Cliente
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      ) : clients.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mb-4">
              <GripVertical className="h-6 w-6 text-muted-foreground" />
            </div>
            <h3 className="font-semibold mb-1">Nenhum cliente configurado</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Adicione links de páginas de corretores para exibir no banner de prova social.
            </p>
            <Button onClick={() => setIsAddDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Adicionar primeiro cliente
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {clients.map((client, index) => (
            <Card
              key={client.id}
              draggable
              onDragStart={() => handleDragStart(index, client.id)}
              onDragEnter={() => handleDragEnter(index, client.id)}
              onDragEnd={handleDragEnd}
              onDragOver={(e) => e.preventDefault()}
              className={`transition-all select-none ${
                draggingId === client.id ? 'opacity-40 scale-[0.98]' : ''
              } ${
                dragOverId === client.id && draggingId !== client.id
                  ? 'border-primary shadow-md'
                  : ''
              }`}
            >
              <CardContent className="p-4">
                <div className="flex items-center gap-4">
                  <div
                    className="cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground flex-shrink-0"
                    title="Arraste para reordenar"
                  >
                    <GripVertical className="h-5 w-5" />
                  </div>

                  <div className="h-12 w-12 rounded-full overflow-hidden bg-muted flex-shrink-0 flex items-center justify-center">
                    {client.avatar_url ? (
                      <img
                        src={client.avatar_url}
                        alt={client.business_name}
                        className="h-full w-full object-cover"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = 'none';
                        }}
                      />
                    ) : (
                      <span className="text-lg font-semibold text-muted-foreground">
                        {client.business_name.charAt(0).toUpperCase()}
                      </span>
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{client.business_name}</p>
                    <a
                      href={client.corretor_page_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-muted-foreground hover:text-primary flex items-center gap-1 truncate"
                    >
                      {client.corretor_page_url}
                      <ExternalLink className="h-3 w-3 flex-shrink-0" />
                    </a>
                  </div>

                  <div className="flex items-center gap-2 text-sm text-muted-foreground flex-shrink-0">
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full ${client.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}
                    >
                      {client.is_active ? 'Ativo' : 'Inativo'}
                    </span>
                  </div>

                  <div className="flex items-center gap-1 flex-shrink-0">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => handleRefreshClient(client)}
                      title="Atualizar dados do corretor"
                    >
                      <RefreshCw className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => handleEditOpen(client)}
                      title="Editar status"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg>
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Remover cliente do banner?</AlertDialogTitle>
                          <AlertDialogDescription>
                            "{client.business_name}" será removido do banner de prova social. Esta ação não pode ser desfeita.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => handleDelete(client.id)}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          >
                            Remover
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Add Dialog */}
      <Dialog open={isAddDialogOpen} onOpenChange={(open) => { setIsAddDialogOpen(open); if (!open) resetAddForm(); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Adicionar Cliente ao Banner</DialogTitle>
            <DialogDescription>
              Cole a URL completa da página do corretor. O nome e avatar serão buscados automaticamente.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>URL da página do corretor</Label>
              <div className="flex gap-2">
                <Input
                  placeholder="https://seusite.com.br/username"
                  value={urlInput}
                  onChange={(e) => { setUrlInput(e.target.value); setPreview(null); }}
                  onKeyDown={(e) => { if (e.key === 'Enter') fetchCorretorPreview(); }}
                />
                <Button
                  variant="outline"
                  onClick={fetchCorretorPreview}
                  disabled={isFetching || !urlInput.trim()}
                  className="flex-shrink-0"
                >
                  {isFetching ? (
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current" />
                  ) : (
                    <Search className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>

            {preview && (
              <div className="flex items-center gap-3 p-3 rounded-lg border bg-muted/40">
                <div className="h-12 w-12 rounded-full overflow-hidden bg-muted flex-shrink-0 flex items-center justify-center">
                  {preview.avatar_url ? (
                    <img src={preview.avatar_url} alt={preview.name} className="h-full w-full object-cover" />
                  ) : (
                    <span className="text-lg font-semibold text-muted-foreground">
                      {preview.name.charAt(0).toUpperCase()}
                    </span>
                  )}
                </div>
                <div>
                  <p className="font-medium">{preview.name}</p>
                  <p className="text-xs text-muted-foreground">/{preview.slug}</p>
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label>Status</Label>
              <div className="flex items-center gap-2 pt-1">
                <Switch
                  checked={addIsActive}
                  onCheckedChange={setAddIsActive}
                />
                <span className="text-sm text-muted-foreground">
                  {addIsActive ? 'Ativo' : 'Inativo'}
                </span>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => { setIsAddDialogOpen(false); resetAddForm(); }}>
              Cancelar
            </Button>
            <Button onClick={handleAddClient} disabled={isSaving || !preview}>
              {isSaving ? 'Adicionando...' : 'Adicionar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Editar Cliente</DialogTitle>
            <DialogDescription>
              Ajuste o status de exibição para "{selectedClient?.business_name}".
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Status</Label>
              <div className="flex items-center gap-2">
                <Switch
                  checked={editIsActive}
                  onCheckedChange={setEditIsActive}
                />
                <span className="text-sm text-muted-foreground">
                  {editIsActive ? 'Ativo' : 'Inativo'}
                </span>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleEditSave} disabled={isSaving}>
              {isSaving ? 'Salvando...' : 'Salvar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
