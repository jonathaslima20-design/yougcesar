import { useState, useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { uploadTestimonialAvatar, deleteTestimonialAvatar } from '@/lib/testimonialUpload';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
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
import { Plus, Trash2, Pencil, GripVertical, Upload } from 'lucide-react';

interface Testimonial {
  id: string;
  author_name: string;
  store_name: string;
  avatar_url: string | null;
  quote: string;
  result_label: string | null;
  result_value: string | null;
  display_order: number;
  is_active: boolean;
}

interface FormState {
  author_name: string;
  store_name: string;
  quote: string;
  result_label: string;
  result_value: string;
  is_active: boolean;
  avatar_url: string | null;
}

const EMPTY_FORM: FormState = {
  author_name: '',
  store_name: '',
  quote: '',
  result_label: '',
  result_value: '',
  is_active: true,
  avatar_url: null,
};

export default function LandingTestimonialsManager() {
  const [items, setItems] = useState<Testimonial[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const dragItemIndex = useRef<number | null>(null);
  const dragOverItemIndex = useRef<number | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);

  useEffect(() => {
    fetchItems();
  }, []);

  const fetchItems = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('landing_testimonials')
        .select('*')
        .order('display_order', { ascending: true });

      if (error) throw error;
      setItems(data || []);
    } catch (error) {
      console.error('Error fetching testimonials:', error);
      toast.error('Erro ao carregar depoimentos');
    } finally {
      setLoading(false);
    }
  };

  const openCreateDialog = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setAvatarFile(null);
    setAvatarPreview(null);
    setIsDialogOpen(true);
  };

  const openEditDialog = (item: Testimonial) => {
    setEditingId(item.id);
    setForm({
      author_name: item.author_name,
      store_name: item.store_name,
      quote: item.quote,
      result_label: item.result_label || '',
      result_value: item.result_value || '',
      is_active: item.is_active,
      avatar_url: item.avatar_url,
    });
    setAvatarFile(null);
    setAvatarPreview(item.avatar_url);
    setIsDialogOpen(true);
  };

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarFile(file);
    setAvatarPreview(URL.createObjectURL(file));
  };

  const handleSave = async () => {
    if (!form.author_name.trim() || !form.store_name.trim() || !form.quote.trim()) {
      toast.error('Preencha nome, loja e depoimento.');
      return;
    }

    setIsSaving(true);
    try {
      if (editingId) {
        let avatarUrl = form.avatar_url;
        if (avatarFile) {
          avatarUrl = await uploadTestimonialAvatar(avatarFile, editingId);
        }

        const { error } = await supabase
          .from('landing_testimonials')
          .update({
            author_name: form.author_name.trim(),
            store_name: form.store_name.trim(),
            quote: form.quote.trim(),
            result_label: form.result_label.trim() || null,
            result_value: form.result_value.trim() || null,
            is_active: form.is_active,
            avatar_url: avatarUrl,
          })
          .eq('id', editingId);

        if (error) throw error;
        toast.success('Depoimento atualizado!');
      } else {
        const nextOrder = items.length > 0
          ? Math.max(...items.map((c) => c.display_order)) + 1
          : 1;

        const { data, error } = await supabase
          .from('landing_testimonials')
          .insert({
            author_name: form.author_name.trim(),
            store_name: form.store_name.trim(),
            quote: form.quote.trim(),
            result_label: form.result_label.trim() || null,
            result_value: form.result_value.trim() || null,
            is_active: form.is_active,
            display_order: nextOrder,
          })
          .select()
          .single();

        if (error) throw error;

        if (avatarFile && data) {
          const avatarUrl = await uploadTestimonialAvatar(avatarFile, data.id);
          await supabase.from('landing_testimonials').update({ avatar_url: avatarUrl }).eq('id', data.id);
        }

        toast.success('Depoimento adicionado!');
      }

      setIsDialogOpen(false);
      fetchItems();
    } catch (error) {
      console.error('Error saving testimonial:', error);
      toast.error('Erro ao salvar depoimento.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (item: Testimonial) => {
    try {
      const { error } = await supabase.from('landing_testimonials').delete().eq('id', item.id);
      if (error) throw error;
      if (item.avatar_url) await deleteTestimonialAvatar(item.avatar_url);
      toast.success('Depoimento removido.');
      fetchItems();
    } catch (error) {
      console.error('Error deleting testimonial:', error);
      toast.error('Erro ao remover depoimento.');
    }
  };

  const toggleActive = async (item: Testimonial) => {
    const { error } = await supabase
      .from('landing_testimonials')
      .update({ is_active: !item.is_active })
      .eq('id', item.id);

    if (error) { toast.error('Erro ao atualizar'); return; }
    setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, is_active: !i.is_active } : i)));
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

    const reordered = [...items];
    const [moved] = reordered.splice(fromIndex, 1);
    reordered.splice(toIndex, 0, moved);

    const updated = reordered.map((item, i) => ({ ...item, display_order: i + 1 }));
    setItems(updated);

    try {
      await Promise.all(
        updated.map((item) =>
          supabase.from('landing_testimonials').update({ display_order: item.display_order }).eq('id', item.id)
        )
      );
      toast.success('Ordem atualizada!');
    } catch (error) {
      console.error('Error saving order:', error);
      toast.error('Erro ao salvar a nova ordem.');
      fetchItems();
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {items.length} depoimento{items.length !== 1 ? 's' : ''} configurado{items.length !== 1 ? 's' : ''}
        </p>
        <Button onClick={openCreateDialog}>
          <Plus className="h-4 w-4 mr-2" />
          Adicionar depoimento
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      ) : items.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mb-4">
              <GripVertical className="h-6 w-6 text-muted-foreground" />
            </div>
            <h3 className="font-semibold mb-1">Nenhum depoimento configurado</h3>
            <p className="text-sm text-muted-foreground mb-4">
              A seção de depoimentos só aparece na landing page quando houver pelo menos um depoimento ativo.
            </p>
            <Button onClick={openCreateDialog}>
              <Plus className="h-4 w-4 mr-2" />
              Adicionar primeiro depoimento
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {items.map((item, index) => (
            <Card
              key={item.id}
              draggable
              onDragStart={() => handleDragStart(index, item.id)}
              onDragEnter={() => handleDragEnter(index, item.id)}
              onDragEnd={handleDragEnd}
              onDragOver={(e) => e.preventDefault()}
              className={`transition-all select-none ${
                draggingId === item.id ? 'opacity-40 scale-[0.98]' : ''
              } ${
                dragOverId === item.id && draggingId !== item.id ? 'border-primary shadow-md' : ''
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
                    {item.avatar_url ? (
                      <img
                        src={item.avatar_url}
                        alt={item.author_name}
                        className="h-full w-full object-cover"
                        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                      />
                    ) : (
                      <span className="text-lg font-semibold text-muted-foreground">
                        {item.author_name.charAt(0).toUpperCase()}
                      </span>
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{item.author_name} · {item.store_name}</p>
                    <p className="text-xs text-muted-foreground truncate">{item.quote}</p>
                  </div>

                  {item.result_value && (
                    <div className="text-right flex-shrink-0 hidden sm:block">
                      <p className="text-sm font-semibold text-emerald-600">{item.result_value}</p>
                      {item.result_label && <p className="text-xs text-muted-foreground">{item.result_label}</p>}
                    </div>
                  )}

                  <div className="flex items-center gap-2 text-sm text-muted-foreground flex-shrink-0">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${item.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                      {item.is_active ? 'Ativo' : 'Inativo'}
                    </span>
                  </div>

                  <div className="flex items-center gap-1 flex-shrink-0">
                    <Switch checked={item.is_active} onCheckedChange={() => toggleActive(item)} />
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEditDialog(item)} title="Editar">
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Remover depoimento?</AlertDialogTitle>
                          <AlertDialogDescription>
                            O depoimento de "{item.author_name}" será removido da landing page. Esta ação não pode ser desfeita.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => handleDelete(item)}
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

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingId ? 'Editar depoimento' : 'Adicionar depoimento'}</DialogTitle>
            <DialogDescription>
              Esses dados aparecem na seção de depoimentos da landing page pública.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
            <div className="flex items-center gap-3">
              <div className="h-16 w-16 rounded-full overflow-hidden bg-muted flex-shrink-0 flex items-center justify-center">
                {avatarPreview ? (
                  <img src={avatarPreview} alt="Preview" className="h-full w-full object-cover" />
                ) : (
                  <span className="text-xl font-semibold text-muted-foreground">
                    {form.author_name.charAt(0).toUpperCase() || '?'}
                  </span>
                )}
              </div>
              <div>
                <Button type="button" variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
                  <Upload className="h-3.5 w-3.5 mr-2" />
                  Escolher foto
                </Button>
                <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Nome</Label>
                <Input
                  value={form.author_name}
                  onChange={(e) => setForm((f) => ({ ...f, author_name: e.target.value }))}
                  placeholder="Maria Silva"
                />
              </div>
              <div className="space-y-2">
                <Label>Loja</Label>
                <Input
                  value={form.store_name}
                  onChange={(e) => setForm((f) => ({ ...f, store_name: e.target.value }))}
                  placeholder="Malu Mix"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Depoimento</Label>
              <Textarea
                value={form.quote}
                onChange={(e) => setForm((f) => ({ ...f, quote: e.target.value }))}
                placeholder="Depois que migrei pra VitrineTurbo minhas vendas..."
                rows={4}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Valor do resultado (opcional)</Label>
                <Input
                  value={form.result_value}
                  onChange={(e) => setForm((f) => ({ ...f, result_value: e.target.value }))}
                  placeholder="+180%"
                />
              </div>
              <div className="space-y-2">
                <Label>Rótulo do resultado (opcional)</Label>
                <Input
                  value={form.result_label}
                  onChange={(e) => setForm((f) => ({ ...f, result_label: e.target.value }))}
                  placeholder="vendas em 3 meses"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Status</Label>
              <div className="flex items-center gap-2 pt-1">
                <Switch checked={form.is_active} onCheckedChange={(v) => setForm((f) => ({ ...f, is_active: v }))} />
                <span className="text-sm text-muted-foreground">{form.is_active ? 'Ativo' : 'Inativo'}</span>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving ? 'Salvando...' : 'Salvar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
