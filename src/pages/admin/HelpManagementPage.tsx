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
import { FolderOpen, FileText, Plus, Pencil, Trash2, Loader as Loader2, Eye, ThumbsUp, ThumbsDown, RefreshCw, ChartBar as BarChart3, Star } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface HelpCategory {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  icon: string;
  display_order: number;
  is_active: boolean;
  created_at: string;
  article_count?: number;
}

interface HelpArticle {
  id: string;
  title: string;
  slug: string;
  content: string;
  excerpt: string | null;
  category_id: string | null;
  tags: string[];
  is_published: boolean;
  is_featured: boolean;
  view_count: number;
  helpful_count: number;
  not_helpful_count: number;
  created_at: string;
  updated_at: string;
  category_name?: string;
}

const ICON_OPTIONS = [
  'Rocket', 'Package', 'Settings', 'ShoppingCart', 'Gift',
  'AlertCircle', 'FileText', 'CreditCard', 'TrendingUp',
  'BarChart2', 'Users', 'Zap',
];

export default function HelpManagementPage() {
  const [categories, setCategories] = useState<HelpCategory[]>([]);
  const [articles, setArticles] = useState<HelpArticle[]>([]);
  const [loading, setLoading] = useState(true);

  const [categoryDialog, setCategoryDialog] = useState<{ open: boolean; editing: HelpCategory | null }>({ open: false, editing: null });
  const [categoryForm, setCategoryForm] = useState({ name: '', slug: '', description: '', icon: 'FileText', display_order: 0, is_active: true });

  const [articleDialog, setArticleDialog] = useState<{ open: boolean; editing: HelpArticle | null }>({ open: false, editing: null });
  const [articleForm, setArticleForm] = useState({ title: '', slug: '', content: '', excerpt: '', category_id: '', tags: '', is_published: false, is_featured: false });

  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; type: 'category' | 'article'; id: string; name: string }>({ open: false, type: 'category', id: '', name: '' });

  const [articleCategoryFilter, setArticleCategoryFilter] = useState('all');
  const [articleStatusFilter, setArticleStatusFilter] = useState('all');
  const [articleSearch, setArticleSearch] = useState('');

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [catRes, artRes] = await Promise.all([
        supabase.from('help_categories').select('*').order('display_order', { ascending: true }),
        supabase.from('help_articles').select('*, help_categories(name)').order('created_at', { ascending: false }),
      ]);

      const cats = catRes.data || [];
      const arts: HelpArticle[] = (artRes.data || []).map((a: any) => ({
        ...a,
        category_name: a.help_categories?.name || null,
      }));

      const articleCountMap = new Map<string, number>();
      for (const art of arts) {
        if (art.category_id) {
          articleCountMap.set(art.category_id, (articleCountMap.get(art.category_id) || 0) + 1);
        }
      }

      setCategories(cats.map(c => ({ ...c, article_count: articleCountMap.get(c.id) || 0 })));
      setArticles(arts);
    } catch (error) {
      console.error('Error fetching help data:', error);
      toast.error('Erro ao carregar dados');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const generateSlug = (text: string) =>
    text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

  // Category CRUD
  const openCategoryDialog = (cat?: HelpCategory) => {
    if (cat) {
      setCategoryForm({ name: cat.name, slug: cat.slug, description: cat.description || '', icon: cat.icon, display_order: cat.display_order, is_active: cat.is_active });
      setCategoryDialog({ open: true, editing: cat });
    } else {
      setCategoryForm({ name: '', slug: '', description: '', icon: 'FileText', display_order: categories.length + 1, is_active: true });
      setCategoryDialog({ open: true, editing: null });
    }
  };

  const handleSaveCategory = async () => {
    if (!categoryForm.name.trim()) { toast.error('Nome obrigatório'); return; }
    const slug = categoryForm.slug || generateSlug(categoryForm.name);
    try {
      if (categoryDialog.editing) {
        const { error } = await supabase.from('help_categories').update({
          name: categoryForm.name, slug, description: categoryForm.description || null,
          icon: categoryForm.icon, display_order: categoryForm.display_order, is_active: categoryForm.is_active,
          updated_at: new Date().toISOString(),
        }).eq('id', categoryDialog.editing.id);
        if (error) throw error;
        toast.success('Categoria atualizada');
      } else {
        const { error } = await supabase.from('help_categories').insert({
          name: categoryForm.name, slug, description: categoryForm.description || null,
          icon: categoryForm.icon, display_order: categoryForm.display_order, is_active: categoryForm.is_active,
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

  // Article CRUD
  const openArticleDialog = (art?: HelpArticle) => {
    if (art) {
      setArticleForm({
        title: art.title, slug: art.slug, content: art.content, excerpt: art.excerpt || '',
        category_id: art.category_id || '', tags: (art.tags || []).join(', '),
        is_published: art.is_published, is_featured: art.is_featured,
      });
      setArticleDialog({ open: true, editing: art });
    } else {
      setArticleForm({ title: '', slug: '', content: '', excerpt: '', category_id: '', tags: '', is_published: false, is_featured: false });
      setArticleDialog({ open: true, editing: null });
    }
  };

  const handleSaveArticle = async () => {
    if (!articleForm.title.trim()) { toast.error('Título obrigatório'); return; }
    if (!articleForm.content.trim()) { toast.error('Conteúdo obrigatório'); return; }
    const slug = articleForm.slug || generateSlug(articleForm.title);
    const tags = articleForm.tags ? articleForm.tags.split(',').map(t => t.trim()).filter(Boolean) : [];
    try {
      const payload = {
        title: articleForm.title, slug, content: articleForm.content,
        excerpt: articleForm.excerpt || null,
        category_id: articleForm.category_id || null, tags,
        is_published: articleForm.is_published, is_featured: articleForm.is_featured,
        updated_at: new Date().toISOString(),
        ...(articleForm.is_published && !articleDialog.editing?.is_published ? { published_at: new Date().toISOString() } : {}),
      };

      if (articleDialog.editing) {
        const { error } = await supabase.from('help_articles').update(payload).eq('id', articleDialog.editing.id);
        if (error) throw error;
        toast.success('Artigo atualizado');
      } else {
        const { error } = await supabase.from('help_articles').insert(payload);
        if (error) throw error;
        toast.success('Artigo criado');
      }
      setArticleDialog({ open: false, editing: null });
      fetchAll();
    } catch (error) {
      console.error('Error saving article:', error);
      toast.error('Erro ao salvar artigo');
    }
  };

  // Delete
  const handleDelete = async () => {
    try {
      const table = deleteDialog.type === 'category' ? 'help_categories' : 'help_articles';
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

  // Filtered articles
  const filteredArticles = articles.filter(a => {
    if (articleCategoryFilter !== 'all' && a.category_id !== articleCategoryFilter) return false;
    if (articleStatusFilter === 'published' && !a.is_published) return false;
    if (articleStatusFilter === 'draft' && a.is_published) return false;
    if (articleSearch && !a.title.toLowerCase().includes(articleSearch.toLowerCase())) return false;
    return true;
  });

  // Stats
  const totalViews = articles.reduce((s, a) => s + a.view_count, 0);
  const totalHelpful = articles.reduce((s, a) => s + a.helpful_count, 0);
  const totalNotHelpful = articles.reduce((s, a) => s + a.not_helpful_count, 0);
  const approvalRate = totalHelpful + totalNotHelpful > 0
    ? Math.round((totalHelpful / (totalHelpful + totalNotHelpful)) * 100)
    : 0;

  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl page-title">Central de Ajuda</h1>
          <p className="text-muted-foreground">Gerencie categorias e artigos da central de ajuda</p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchAll} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Atualizar
        </Button>
      </div>

      {/* Stats */}
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        <MiniStat title="Total de Artigos" value={articles.length} icon={FileText} loading={loading} />
        <MiniStat title="Visualizações" value={totalViews} icon={Eye} loading={loading} />
        <MiniStat title="Taxa de Aprovação" value={`${approvalRate}%`} icon={ThumbsUp} loading={loading} accent="green" />
        <MiniStat title="Categorias" value={categories.length} icon={FolderOpen} loading={loading} />
      </div>

      <Tabs defaultValue="articles" className="space-y-4">
        <TabsList>
          <TabsTrigger value="articles" className="gap-2"><FileText className="h-4 w-4" /> Artigos</TabsTrigger>
          <TabsTrigger value="categories" className="gap-2"><FolderOpen className="h-4 w-4" /> Categorias</TabsTrigger>
          <TabsTrigger value="metrics" className="gap-2"><BarChart3 className="h-4 w-4" /> Métricas</TabsTrigger>
        </TabsList>

        {/* Articles Tab */}
        <TabsContent value="articles">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between flex-wrap gap-3">
              <CardTitle className="text-base">Artigos</CardTitle>
              <div className="flex items-center gap-2 flex-wrap">
                <Input
                  placeholder="Buscar artigo..."
                  value={articleSearch}
                  onChange={(e) => setArticleSearch(e.target.value)}
                  className="w-[200px]"
                />
                <Select value={articleCategoryFilter} onValueChange={setArticleCategoryFilter}>
                  <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas categorias</SelectItem>
                    {categories.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Select value={articleStatusFilter} onValueChange={setArticleStatusFilter}>
                  <SelectTrigger className="w-[130px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="published">Publicado</SelectItem>
                    <SelectItem value="draft">Rascunho</SelectItem>
                  </SelectContent>
                </Select>
                <Button onClick={() => openArticleDialog()} size="sm">
                  <Plus className="h-4 w-4 mr-1" /> Novo Artigo
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
              ) : filteredArticles.length === 0 ? (
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
                        <TableHead className="text-center">Feedback</TableHead>
                        <TableHead>Data</TableHead>
                        <TableHead className="text-right">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredArticles.map(art => (
                        <TableRow key={art.id}>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium truncate max-w-[250px]">{art.title}</span>
                              {art.is_featured && <Star className="h-3.5 w-3.5 text-amber-500 flex-shrink-0" />}
                            </div>
                          </TableCell>
                          <TableCell>
                            {art.category_name
                              ? <Badge variant="outline" className="text-xs">{art.category_name}</Badge>
                              : <span className="text-xs text-muted-foreground">-</span>}
                          </TableCell>
                          <TableCell className="text-center">
                            {art.is_published
                              ? <Badge className="bg-green-500 text-xs">Publicado</Badge>
                              : <Badge variant="secondary" className="text-xs">Rascunho</Badge>}
                          </TableCell>
                          <TableCell className="text-center text-sm">{art.view_count}</TableCell>
                          <TableCell className="text-center">
                            <div className="flex items-center justify-center gap-2 text-xs">
                              <span className="flex items-center gap-0.5 text-green-600">
                                <ThumbsUp className="h-3 w-3" /> {art.helpful_count}
                              </span>
                              <span className="flex items-center gap-0.5 text-red-500">
                                <ThumbsDown className="h-3 w-3" /> {art.not_helpful_count}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {format(new Date(art.created_at), 'dd/MM/yy', { locale: ptBR })}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-1">
                              <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => openArticleDialog(art)} title="Editar">
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-destructive" onClick={() => setDeleteDialog({ open: true, type: 'article', id: art.id, name: art.title })} title="Excluir">
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
                        <TableHead className="text-center">Ícone</TableHead>
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
                          <TableCell className="text-center text-xs text-muted-foreground">{cat.icon}</TableCell>
                          <TableCell className="text-center">{cat.display_order}</TableCell>
                          <TableCell className="text-center">{cat.article_count || 0}</TableCell>
                          <TableCell className="text-center">
                            {cat.is_active
                              ? <Badge className="bg-green-500 text-xs">Ativo</Badge>
                              : <Badge variant="secondary" className="text-xs">Inativo</Badge>}
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
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Artigos Mais Vistos</CardTitle>
              </CardHeader>
              <CardContent>
                {articles.filter(a => a.view_count > 0).sort((a, b) => b.view_count - a.view_count).slice(0, 5).map((art, i) => (
                  <div key={art.id} className="flex items-center gap-3 py-2 border-b last:border-0">
                    <span className="text-sm font-bold text-muted-foreground w-5">{i + 1}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{art.title}</p>
                      <p className="text-xs text-muted-foreground">{art.category_name || 'Sem categoria'}</p>
                    </div>
                    <div className="flex items-center gap-1 text-sm text-muted-foreground">
                      <Eye className="h-3.5 w-3.5" /> {art.view_count}
                    </div>
                  </div>
                ))}
                {articles.filter(a => a.view_count > 0).length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-8">Nenhum artigo com visualizações</p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Feedback dos Artigos</CardTitle>
              </CardHeader>
              <CardContent>
                {articles.filter(a => a.helpful_count + a.not_helpful_count > 0).sort((a, b) => {
                  const rateA = a.helpful_count / (a.helpful_count + a.not_helpful_count);
                  const rateB = b.helpful_count / (b.helpful_count + b.not_helpful_count);
                  return rateB - rateA;
                }).slice(0, 5).map(art => {
                  const total = art.helpful_count + art.not_helpful_count;
                  const rate = total > 0 ? Math.round((art.helpful_count / total) * 100) : 0;
                  return (
                    <div key={art.id} className="flex items-center gap-3 py-2 border-b last:border-0">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{art.title}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                            <div className="h-full bg-green-500 rounded-full" style={{ width: `${rate}%` }} />
                          </div>
                          <span className="text-xs text-muted-foreground w-10 text-right">{rate}%</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 text-xs">
                        <span className="text-green-600">{art.helpful_count}</span>
                        <span className="text-muted-foreground">/</span>
                        <span className="text-red-500">{art.not_helpful_count}</span>
                      </div>
                    </div>
                  );
                })}
                {articles.filter(a => a.helpful_count + a.not_helpful_count > 0).length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-8">Nenhum feedback recebido</p>
                )}
              </CardContent>
            </Card>
          </div>
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
              }} placeholder="Ex: Primeiros Passos" />
            </div>
            <div className="space-y-2">
              <Label>Slug</Label>
              <Input value={categoryForm.slug} onChange={(e) => setCategoryForm({ ...categoryForm, slug: e.target.value })} placeholder="primeiros-passos" />
            </div>
            <div className="space-y-2">
              <Label>Descrição</Label>
              <Textarea value={categoryForm.description} onChange={(e) => setCategoryForm({ ...categoryForm, description: e.target.value })} rows={2} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Ícone</Label>
                <Select value={categoryForm.icon} onValueChange={(v) => setCategoryForm({ ...categoryForm, icon: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {ICON_OPTIONS.map(icon => <SelectItem key={icon} value={icon}>{icon}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Ordem</Label>
                <Input type="number" value={categoryForm.display_order} onChange={(e) => setCategoryForm({ ...categoryForm, display_order: parseInt(e.target.value) || 0 })} />
              </div>
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

      {/* Article Dialog */}
      <Dialog open={articleDialog.open} onOpenChange={(open) => !open && setArticleDialog({ open: false, editing: null })}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{articleDialog.editing ? 'Editar Artigo' : 'Novo Artigo'}</DialogTitle>
            <DialogDescription>Preencha os dados do artigo</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Título</Label>
              <Input value={articleForm.title} onChange={(e) => {
                setArticleForm({ ...articleForm, title: e.target.value, slug: articleDialog.editing ? articleForm.slug : generateSlug(e.target.value) });
              }} placeholder="Título do artigo" />
            </div>
            <div className="space-y-2">
              <Label>Slug</Label>
              <Input value={articleForm.slug} onChange={(e) => setArticleForm({ ...articleForm, slug: e.target.value })} placeholder="titulo-do-artigo" />
            </div>
            <div className="space-y-2">
              <Label>Categoria</Label>
              <Select value={articleForm.category_id} onValueChange={(v) => setArticleForm({ ...articleForm, category_id: v })}>
                <SelectTrigger><SelectValue placeholder="Selecione uma categoria" /></SelectTrigger>
                <SelectContent>
                  {categories.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Resumo</Label>
              <Textarea value={articleForm.excerpt} onChange={(e) => setArticleForm({ ...articleForm, excerpt: e.target.value })} rows={2} placeholder="Resumo curto do artigo" />
            </div>
            <div className="space-y-2">
              <Label>Conteúdo</Label>
              <Textarea value={articleForm.content} onChange={(e) => setArticleForm({ ...articleForm, content: e.target.value })} rows={12} placeholder="Conteúdo completo do artigo..." className="font-mono text-sm" />
            </div>
            <div className="space-y-2">
              <Label>Tags (separadas por vírgula)</Label>
              <Input value={articleForm.tags} onChange={(e) => setArticleForm({ ...articleForm, tags: e.target.value })} placeholder="tag1, tag2, tag3" />
            </div>
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2">
                <Switch checked={articleForm.is_published} onCheckedChange={(c) => setArticleForm({ ...articleForm, is_published: c })} />
                <Label>Publicado</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={articleForm.is_featured} onCheckedChange={(c) => setArticleForm({ ...articleForm, is_featured: c })} />
                <Label>Destaque</Label>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setArticleDialog({ open: false, editing: null })}>Cancelar</Button>
            <Button onClick={handleSaveArticle}>Salvar</Button>
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
