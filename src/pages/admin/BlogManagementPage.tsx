import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { FolderOpen, FileText, Plus, Pencil, Trash2, Loader as Loader2, Eye, RefreshCw, ChartBar as BarChart3, Star, ExternalLink } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface BlogCategory {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  display_order: number;
  is_active: boolean;
  created_at: string;
  post_count?: number;
}

interface BlogPost {
  id: string;
  title: string;
  slug: string;
  content: string;
  excerpt: string | null;
  cover_image_url: string | null;
  category_id: string | null;
  tags: string[];
  meta_title: string | null;
  meta_description: string | null;
  is_published: boolean;
  is_featured: boolean;
  view_count: number;
  created_at: string;
  updated_at: string;
  category_name?: string;
}

const emptyPostForm = {
  title: '', slug: '', content: '', excerpt: '', cover_image_url: '',
  category_id: '', tags: '', meta_title: '', meta_description: '',
  is_published: false, is_featured: false,
};

export default function BlogManagementPage() {
  const [categories, setCategories] = useState<BlogCategory[]>([]);
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [loading, setLoading] = useState(true);

  const [categoryDialog, setCategoryDialog] = useState<{ open: boolean; editing: BlogCategory | null }>({ open: false, editing: null });
  const [categoryForm, setCategoryForm] = useState({ name: '', slug: '', description: '', display_order: 0, is_active: true });

  const [postDialog, setPostDialog] = useState<{ open: boolean; editing: BlogPost | null }>({ open: false, editing: null });
  const [postForm, setPostForm] = useState(emptyPostForm);

  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; type: 'category' | 'post'; id: string; name: string }>({ open: false, type: 'category', id: '', name: '' });

  const [postCategoryFilter, setPostCategoryFilter] = useState('all');
  const [postStatusFilter, setPostStatusFilter] = useState('all');
  const [postSearch, setPostSearch] = useState('');

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [catRes, postRes] = await Promise.all([
        supabase.from('blog_categories').select('*').order('display_order', { ascending: true }),
        supabase.from('blog_posts').select('*, blog_categories(name)').order('created_at', { ascending: false }),
      ]);

      const cats = catRes.data || [];
      const posts: BlogPost[] = (postRes.data || []).map((p: any) => ({
        ...p,
        category_name: p.blog_categories?.name || null,
      }));

      const postCountMap = new Map<string, number>();
      for (const p of posts) {
        if (p.category_id) postCountMap.set(p.category_id, (postCountMap.get(p.category_id) || 0) + 1);
      }

      setCategories(cats.map(c => ({ ...c, post_count: postCountMap.get(c.id) || 0 })));
      setPosts(posts);
    } catch (error) {
      console.error('Error fetching blog data:', error);
      toast.error('Erro ao carregar dados');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const generateSlug = (text: string) =>
    text.toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '').replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

  // Category CRUD
  const openCategoryDialog = (cat?: BlogCategory) => {
    if (cat) {
      setCategoryForm({ name: cat.name, slug: cat.slug, description: cat.description || '', display_order: cat.display_order, is_active: cat.is_active });
      setCategoryDialog({ open: true, editing: cat });
    } else {
      setCategoryForm({ name: '', slug: '', description: '', display_order: categories.length + 1, is_active: true });
      setCategoryDialog({ open: true, editing: null });
    }
  };

  const handleSaveCategory = async () => {
    if (!categoryForm.name.trim()) { toast.error('Nome obrigatório'); return; }
    const slug = categoryForm.slug || generateSlug(categoryForm.name);
    try {
      if (categoryDialog.editing) {
        const { error } = await supabase.from('blog_categories').update({
          name: categoryForm.name, slug, description: categoryForm.description || null,
          display_order: categoryForm.display_order, is_active: categoryForm.is_active,
          updated_at: new Date().toISOString(),
        }).eq('id', categoryDialog.editing.id);
        if (error) throw error;
        toast.success('Categoria atualizada');
      } else {
        const { error } = await supabase.from('blog_categories').insert({
          name: categoryForm.name, slug, description: categoryForm.description || null,
          display_order: categoryForm.display_order, is_active: categoryForm.is_active,
        });
        if (error) throw error;
        toast.success('Categoria criada');
      }
      setCategoryDialog({ open: false, editing: null });
      fetchAll();
    } catch (error) {
      console.error('Error saving category:', error);
      toast.error('Erro ao salvar categoria');
    }
  };

  // Post CRUD
  const openPostDialog = (post?: BlogPost) => {
    if (post) {
      setPostForm({
        title: post.title, slug: post.slug, content: post.content, excerpt: post.excerpt || '',
        cover_image_url: post.cover_image_url || '', category_id: post.category_id || '',
        tags: (post.tags || []).join(', '), meta_title: post.meta_title || '', meta_description: post.meta_description || '',
        is_published: post.is_published, is_featured: post.is_featured,
      });
      setPostDialog({ open: true, editing: post });
    } else {
      setPostForm(emptyPostForm);
      setPostDialog({ open: true, editing: null });
    }
  };

  const handleSavePost = async () => {
    if (!postForm.title.trim()) { toast.error('Título obrigatório'); return; }
    if (!postForm.content.trim()) { toast.error('Conteúdo obrigatório'); return; }
    const slug = postForm.slug || generateSlug(postForm.title);
    const tags = postForm.tags ? postForm.tags.split(',').map(t => t.trim()).filter(Boolean) : [];
    try {
      const payload = {
        title: postForm.title, slug, content: postForm.content,
        excerpt: postForm.excerpt || null,
        cover_image_url: postForm.cover_image_url || null,
        category_id: postForm.category_id || null, tags,
        meta_title: postForm.meta_title || null,
        meta_description: postForm.meta_description || null,
        is_published: postForm.is_published, is_featured: postForm.is_featured,
        updated_at: new Date().toISOString(),
        ...(postForm.is_published && !postDialog.editing?.is_published ? { published_at: new Date().toISOString() } : {}),
      };

      if (postDialog.editing) {
        const { error } = await supabase.from('blog_posts').update(payload).eq('id', postDialog.editing.id);
        if (error) throw error;
        toast.success('Artigo atualizado');
      } else {
        const { error } = await supabase.from('blog_posts').insert(payload);
        if (error) throw error;
        toast.success('Artigo criado');
      }
      setPostDialog({ open: false, editing: null });
      fetchAll();
    } catch (error) {
      console.error('Error saving post:', error);
      toast.error('Erro ao salvar artigo');
    }
  };

  // Delete
  const handleDelete = async () => {
    try {
      const table = deleteDialog.type === 'category' ? 'blog_categories' : 'blog_posts';
      const { error } = await supabase.from(table).delete().eq('id', deleteDialog.id);
      if (error) throw error;
      toast.success(`${deleteDialog.type === 'category' ? 'Categoria' : 'Artigo'} excluído`);
      setDeleteDialog({ open: false, type: 'category', id: '', name: '' });
      fetchAll();
    } catch (error) {
      console.error('Error deleting:', error);
      toast.error('Erro ao excluir');
    }
  };

  const filteredPosts = posts.filter(p => {
    if (postCategoryFilter !== 'all' && p.category_id !== postCategoryFilter) return false;
    if (postStatusFilter === 'published' && !p.is_published) return false;
    if (postStatusFilter === 'draft' && p.is_published) return false;
    if (postSearch && !p.title.toLowerCase().includes(postSearch.toLowerCase())) return false;
    return true;
  });

  const totalViews = posts.reduce((s, p) => s + p.view_count, 0);
  const publishedCount = posts.filter(p => p.is_published).length;

  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl page-title">Blog</h1>
          <p className="text-muted-foreground">Gerencie categorias e artigos do blog</p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchAll} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Atualizar
        </Button>
      </div>

      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        <MiniStat title="Total de Artigos" value={posts.length} icon={FileText} loading={loading} />
        <MiniStat title="Publicados" value={publishedCount} icon={ExternalLink} loading={loading} accent="green" />
        <MiniStat title="Visualizações" value={totalViews} icon={Eye} loading={loading} />
        <MiniStat title="Categorias" value={categories.length} icon={FolderOpen} loading={loading} />
      </div>

      <Tabs defaultValue="posts" className="space-y-4">
        <TabsList>
          <TabsTrigger value="posts" className="gap-2"><FileText className="h-4 w-4" /> Artigos</TabsTrigger>
          <TabsTrigger value="categories" className="gap-2"><FolderOpen className="h-4 w-4" /> Categorias</TabsTrigger>
          <TabsTrigger value="metrics" className="gap-2"><BarChart3 className="h-4 w-4" /> Métricas</TabsTrigger>
        </TabsList>

        {/* Posts Tab */}
        <TabsContent value="posts">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between flex-wrap gap-3">
              <CardTitle className="text-base">Artigos</CardTitle>
              <div className="flex items-center gap-2 flex-wrap">
                <Input
                  placeholder="Buscar artigo..."
                  value={postSearch}
                  onChange={(e) => setPostSearch(e.target.value)}
                  className="w-[200px]"
                />
                <Select value={postCategoryFilter} onValueChange={setPostCategoryFilter}>
                  <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas categorias</SelectItem>
                    {categories.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Select value={postStatusFilter} onValueChange={setPostStatusFilter}>
                  <SelectTrigger className="w-[130px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="published">Publicado</SelectItem>
                    <SelectItem value="draft">Rascunho</SelectItem>
                  </SelectContent>
                </Select>
                <Button onClick={() => openPostDialog()} size="sm">
                  <Plus className="h-4 w-4 mr-1" /> Novo Artigo
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
              ) : filteredPosts.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-12">Nenhum artigo encontrado</p>
              ) : (
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="min-w-[250px]">Título</TableHead>
                        <TableHead>Categoria</TableHead>
                        <TableHead className="text-center">Status</TableHead>
                        <TableHead className="text-center">Views</TableHead>
                        <TableHead>Data</TableHead>
                        <TableHead className="text-right">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredPosts.map(post => (
                        <TableRow key={post.id}>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium truncate max-w-[250px]">{post.title}</span>
                              {post.is_featured && <Star className="h-3.5 w-3.5 text-amber-500 flex-shrink-0" />}
                            </div>
                          </TableCell>
                          <TableCell>
                            {post.category_name
                              ? <Badge variant="outline" className="text-xs">{post.category_name}</Badge>
                              : <span className="text-xs text-muted-foreground">-</span>}
                          </TableCell>
                          <TableCell className="text-center">
                            {post.is_published
                              ? <Badge className="bg-green-500 text-xs">Publicado</Badge>
                              : <Badge variant="secondary" className="text-xs">Rascunho</Badge>}
                          </TableCell>
                          <TableCell className="text-center text-sm">{post.view_count}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {format(new Date(post.created_at), 'dd/MM/yy', { locale: ptBR })}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-1">
                              {post.is_published && (
                                <Button variant="ghost" size="sm" className="h-8 w-8 p-0" asChild title="Ver no site">
                                  <a href={`/blog/${post.slug}`} target="_blank" rel="noopener noreferrer">
                                    <ExternalLink className="h-4 w-4" />
                                  </a>
                                </Button>
                              )}
                              <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => openPostDialog(post)} title="Editar">
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-destructive" onClick={() => setDeleteDialog({ open: true, type: 'post', id: post.id, name: post.title })} title="Excluir">
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Categories Tab */}
        <TabsContent value="categories">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">Categorias</CardTitle>
              <Button onClick={() => openCategoryDialog()} size="sm">
                <Plus className="h-4 w-4 mr-1" /> Nova Categoria
              </Button>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
              ) : categories.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-12">Nenhuma categoria cadastrada</p>
              ) : (
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Nome</TableHead>
                        <TableHead>Slug</TableHead>
                        <TableHead className="text-center">Ordem</TableHead>
                        <TableHead className="text-center">Artigos</TableHead>
                        <TableHead className="text-center">Status</TableHead>
                        <TableHead className="text-right">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {categories.map(cat => (
                        <TableRow key={cat.id}>
                          <TableCell className="font-medium">{cat.name}</TableCell>
                          <TableCell className="text-sm text-muted-foreground font-mono">{cat.slug}</TableCell>
                          <TableCell className="text-center">{cat.display_order}</TableCell>
                          <TableCell className="text-center">{cat.post_count || 0}</TableCell>
                          <TableCell className="text-center">
                            {cat.is_active
                              ? <Badge className="bg-green-500 text-xs">Ativa</Badge>
                              : <Badge variant="secondary" className="text-xs">Inativa</Badge>}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-1">
                              <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => openCategoryDialog(cat)} title="Editar">
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-destructive" onClick={() => setDeleteDialog({ open: true, type: 'category', id: cat.id, name: cat.name })} title="Excluir">
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Metrics Tab */}
        <TabsContent value="metrics">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Artigos Mais Vistos</CardTitle>
            </CardHeader>
            <CardContent>
              {posts.filter(p => p.view_count > 0).sort((a, b) => b.view_count - a.view_count).slice(0, 8).map((post, i) => (
                <div key={post.id} className="flex items-center gap-3 py-2 border-b last:border-0">
                  <span className="text-sm font-bold text-muted-foreground w-5">{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{post.title}</p>
                    <p className="text-xs text-muted-foreground">{post.category_name || 'Sem categoria'}</p>
                  </div>
                  <div className="flex items-center gap-1 text-sm text-muted-foreground">
                    <Eye className="h-3.5 w-3.5" /> {post.view_count}
                  </div>
                </div>
              ))}
              {posts.filter(p => p.view_count > 0).length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-8">Nenhum artigo com visualizações ainda</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Category Dialog */}
      <Dialog open={categoryDialog.open} onOpenChange={(open) => !open && setCategoryDialog({ open: false, editing: null })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{categoryDialog.editing ? 'Editar Categoria' : 'Nova Categoria'}</DialogTitle>
            <DialogDescription>Preencha os dados da categoria</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nome</Label>
              <Input value={categoryForm.name} onChange={(e) => {
                setCategoryForm({ ...categoryForm, name: e.target.value, slug: categoryDialog.editing ? categoryForm.slug : generateSlug(e.target.value) });
              }} placeholder="Ex: Catálogo no WhatsApp" />
            </div>
            <div className="space-y-2">
              <Label>Slug</Label>
              <Input value={categoryForm.slug} onChange={(e) => setCategoryForm({ ...categoryForm, slug: e.target.value })} placeholder="catalogo-no-whatsapp" />
            </div>
            <div className="space-y-2">
              <Label>Descrição</Label>
              <Textarea value={categoryForm.description} onChange={(e) => setCategoryForm({ ...categoryForm, description: e.target.value })} rows={2} />
            </div>
            <div className="space-y-2">
              <Label>Ordem</Label>
              <Input type="number" value={categoryForm.display_order} onChange={(e) => setCategoryForm({ ...categoryForm, display_order: parseInt(e.target.value) || 0 })} />
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={categoryForm.is_active} onCheckedChange={(c) => setCategoryForm({ ...categoryForm, is_active: c })} />
              <Label>Ativa</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCategoryDialog({ open: false, editing: null })}>Cancelar</Button>
            <Button onClick={handleSaveCategory}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Post Dialog */}
      <Dialog open={postDialog.open} onOpenChange={(open) => !open && setPostDialog({ open: false, editing: null })}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{postDialog.editing ? 'Editar Artigo' : 'Novo Artigo'}</DialogTitle>
            <DialogDescription>Preencha os dados do artigo</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Título</Label>
              <Input value={postForm.title} onChange={(e) => {
                setPostForm({ ...postForm, title: e.target.value, slug: postDialog.editing ? postForm.slug : generateSlug(e.target.value) });
              }} placeholder="Título do artigo" />
            </div>
            <div className="space-y-2">
              <Label>Slug (URL: /blog/{postForm.slug || '...'})</Label>
              <Input value={postForm.slug} onChange={(e) => setPostForm({ ...postForm, slug: e.target.value })} placeholder="titulo-do-artigo" />
            </div>
            <div className="space-y-2">
              <Label>Categoria</Label>
              <Select value={postForm.category_id} onValueChange={(v) => setPostForm({ ...postForm, category_id: v })}>
                <SelectTrigger><SelectValue placeholder="Selecione uma categoria" /></SelectTrigger>
                <SelectContent>
                  {categories.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Imagem de capa (URL)</Label>
              <Input value={postForm.cover_image_url} onChange={(e) => setPostForm({ ...postForm, cover_image_url: e.target.value })} placeholder="https://..." />
            </div>
            <div className="space-y-2">
              <Label>Resumo</Label>
              <Textarea value={postForm.excerpt} onChange={(e) => setPostForm({ ...postForm, excerpt: e.target.value })} rows={2} placeholder="Resumo curto exibido nos cards e usado como fallback de descrição" />
            </div>
            <div className="space-y-2">
              <Label>Conteúdo (Markdown)</Label>
              <Textarea value={postForm.content} onChange={(e) => setPostForm({ ...postForm, content: e.target.value })} rows={14} placeholder={'## Título da seção\n\nConteúdo em markdown...'} className="font-mono text-sm" />
            </div>
            <div className="space-y-2">
              <Label>Tags (separadas por vírgula)</Label>
              <Input value={postForm.tags} onChange={(e) => setPostForm({ ...postForm, tags: e.target.value })} placeholder="whatsapp, catálogo, guia" />
            </div>

            <div className="border-t border-border pt-4 space-y-4">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">SEO</p>
              <div className="space-y-2">
                <Label>Meta title (opcional — usa o título se vazio)</Label>
                <Input value={postForm.meta_title} onChange={(e) => setPostForm({ ...postForm, meta_title: e.target.value })} placeholder="Aparece na aba do navegador e no Google" />
              </div>
              <div className="space-y-2">
                <Label>Meta description (opcional — usa o resumo se vazio)</Label>
                <Textarea value={postForm.meta_description} onChange={(e) => setPostForm({ ...postForm, meta_description: e.target.value })} rows={2} placeholder="Até ~160 caracteres, aparece no resultado de busca" />
              </div>
            </div>

            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2">
                <Switch checked={postForm.is_published} onCheckedChange={(c) => setPostForm({ ...postForm, is_published: c })} />
                <Label>Publicado</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={postForm.is_featured} onCheckedChange={(c) => setPostForm({ ...postForm, is_featured: c })} />
                <Label>Destaque</Label>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPostDialog({ open: false, editing: null })}>Cancelar</Button>
            <Button onClick={handleSavePost}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialog.open} onOpenChange={(open) => !open && setDeleteDialog({ open: false, type: 'category', id: '', name: '' })}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir {deleteDialog.type === 'category' ? 'Categoria' : 'Artigo'}</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir "{deleteDialog.name}"? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function MiniStat({ title, value, icon: Icon, loading, accent }: {
  title: string; value: React.ReactNode; icon: React.ComponentType<{ className?: string }>; loading: boolean; accent?: 'green';
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-4">
        <CardTitle className="text-xs font-medium text-muted-foreground">{title}</CardTitle>
        <Icon className={`h-4 w-4 ${accent === 'green' ? 'text-green-600' : 'text-muted-foreground'}`} />
      </CardHeader>
      <CardContent className="pt-0 px-4 pb-4">
        {loading ? <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /> : (
          <div className={`text-xl font-bold ${accent === 'green' ? 'text-green-600' : ''}`}>{value}</div>
        )}
      </CardContent>
    </Card>
  );
}
