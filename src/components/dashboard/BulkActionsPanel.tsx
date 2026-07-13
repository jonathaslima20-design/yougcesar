import { useState, useEffect } from 'react';
import { Trash2, Eye, EyeOff, CreditCard as Edit3, X, Tag, Image as ImageIcon, DollarSign, Tags } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { TagInput } from '@/components/ui/tag-input';
import { Input } from '@/components/ui/input';
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { supabase } from '@/lib/supabase';
import type { ProductTag } from '@/hooks/useProductTags';

interface BulkActionsPanelProps {
  selectedCount: number;
  onClearSelection: () => void;
  onBulkVisibilityToggle: (visible: boolean) => Promise<void>;
  onBulkCategoryChange: (categories: string[]) => Promise<void>;
  onBulkBrandChange: (brand: string) => Promise<void>;
  onBulkDelete: () => Promise<void>;
  onBulkImageCompression: () => Promise<void>;
  onBulkPricing: () => void;
  onBulkTagAssign?: (tagId: string) => void;
  onBulkTagRemove?: (tagId: string) => void;
  loading: boolean;
  userId?: string;
  tags?: ProductTag[];
}

export function BulkActionsPanel({
  selectedCount,
  onClearSelection,
  onBulkVisibilityToggle,
  onBulkCategoryChange,
  onBulkBrandChange,
  onBulkDelete,
  onBulkImageCompression,
  onBulkPricing,
  onBulkTagAssign,
  onBulkTagRemove,
  loading,
  userId,
  tags = [],
}: BulkActionsPanelProps) {
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([]);
  const [newCategories, setNewCategories] = useState<string[]>([]);
  const [newBrand, setNewBrand] = useState<string>('');
  const [showCategoryDialog, setShowCategoryDialog] = useState(false);
  const [showBrandDialog, setShowBrandDialog] = useState(false);
  const [showTagDialog, setShowTagDialog] = useState(false);
  const [tagAction, setTagAction] = useState<'add' | 'remove'>('add');
  const [selectedTagId, setSelectedTagId] = useState('');

  useEffect(() => {
    if (userId) fetchCategories();
  }, [userId]);

  const fetchCategories = async () => {
    try {
      const { data, error } = await supabase
        .from('user_product_categories')
        .select('id, name')
        .eq('user_id', userId)
        .order('name');
      if (error) throw error;
      setCategories(data || []);
    } catch (error) {
      console.error('Error fetching categories:', error);
    }
  };

  const handleCategoryChange = async () => {
    if (newCategories.length === 0) return;
    await onBulkCategoryChange(newCategories);
    setNewCategories([]);
    setShowCategoryDialog(false);
  };

  const handleBrandChange = async () => {
    if (!newBrand.trim()) return;
    await onBulkBrandChange(newBrand.trim());
    setNewBrand('');
    setShowBrandDialog(false);
  };

  const handleTagAction = () => {
    if (!selectedTagId) return;
    if (tagAction === 'add' && onBulkTagAssign) {
      onBulkTagAssign(selectedTagId);
    } else if (tagAction === 'remove' && onBulkTagRemove) {
      onBulkTagRemove(selectedTagId);
    }
    setSelectedTagId('');
    setShowTagDialog(false);
  };

  if (selectedCount === 0) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 md:static md:z-auto">
      <div className="bg-background/95 backdrop-blur-md border-t md:border md:rounded-xl shadow-2xl md:shadow-sm p-3 md:p-4 md:bg-primary/5 md:border-primary/20">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          {/* Selected count */}
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="bg-primary/10 text-primary text-xs">
              {selectedCount} selecionado{selectedCount > 1 ? 's' : ''}
            </Badge>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClearSelection}>
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-1.5 flex-wrap overflow-x-auto pb-1 md:pb-0">
            <Button variant="outline" size="sm" className="text-xs h-7 px-2" onClick={() => onBulkVisibilityToggle(true)} disabled={loading}>
              <Eye className="h-3 w-3 mr-1" />
              <span className="hidden sm:inline">Mostrar</span>
            </Button>

            <Button variant="outline" size="sm" className="text-xs h-7 px-2" onClick={() => onBulkVisibilityToggle(false)} disabled={loading}>
              <EyeOff className="h-3 w-3 mr-1" />
              <span className="hidden sm:inline">Ocultar</span>
            </Button>

            <Button variant="outline" size="sm" className="text-xs h-7 px-2" onClick={onBulkPricing} disabled={loading}>
              <DollarSign className="h-3 w-3 mr-1" />
              <span className="hidden sm:inline">Preços</span>
            </Button>

            {/* Category Dialog */}
            <Dialog open={showCategoryDialog} onOpenChange={setShowCategoryDialog}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm" className="text-xs h-7 px-2" disabled={loading}>
                  <Edit3 className="h-3 w-3 mr-1" />
                  <span className="hidden sm:inline">Categoria</span>
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Alterar Categoria</DialogTitle>
                  <DialogDescription>
                    Novas categorias para {selectedCount} produtos
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <TagInput
                    value={newCategories}
                    onChange={setNewCategories}
                    suggestions={categories.map(c => c.name)}
                    placeholder="Adicionar categoria..."
                    maxTags={5}
                  />
                  <div className="flex justify-end gap-2">
                    <Button variant="outline" size="sm" onClick={() => { setShowCategoryDialog(false); setNewCategories([]); }}>
                      Cancelar
                    </Button>
                    <Button size="sm" onClick={handleCategoryChange} disabled={newCategories.length === 0 || loading}>
                      Aplicar
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>

            {/* Brand Dialog */}
            <Dialog open={showBrandDialog} onOpenChange={setShowBrandDialog}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm" className="text-xs h-7 px-2" disabled={loading}>
                  <Tag className="h-3 w-3 mr-1" />
                  <span className="hidden sm:inline">Marca</span>
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Alterar Marca</DialogTitle>
                  <DialogDescription>
                    Nova marca para {selectedCount} produtos
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <Input
                    value={newBrand}
                    onChange={(e) => setNewBrand(e.target.value)}
                    placeholder="Digite a nova marca..."
                    maxLength={50}
                  />
                  <div className="flex justify-end gap-2">
                    <Button variant="outline" size="sm" onClick={() => { setShowBrandDialog(false); setNewBrand(''); }}>
                      Cancelar
                    </Button>
                    <Button size="sm" onClick={handleBrandChange} disabled={!newBrand.trim() || loading}>
                      Aplicar
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>

            {/* Tags Dialog */}
            {tags.length > 0 && (
              <Dialog open={showTagDialog} onOpenChange={setShowTagDialog}>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm" className="text-xs h-7 px-2" disabled={loading}>
                    <Tags className="h-3 w-3 mr-1" />
                    <span className="hidden sm:inline">Tags</span>
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-sm">
                  <DialogHeader>
                    <DialogTitle>Tags em Lote</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div className="flex gap-2">
                      <button
                        onClick={() => setTagAction('add')}
                        className={`flex-1 px-3 py-2 rounded-lg text-xs font-medium border transition-all ${tagAction === 'add' ? 'border-primary bg-primary/5 text-primary' : 'border-border text-muted-foreground'}`}
                      >
                        Adicionar
                      </button>
                      <button
                        onClick={() => setTagAction('remove')}
                        className={`flex-1 px-3 py-2 rounded-lg text-xs font-medium border transition-all ${tagAction === 'remove' ? 'border-destructive bg-destructive/5 text-destructive' : 'border-border text-muted-foreground'}`}
                      >
                        Remover
                      </button>
                    </div>
                    <Select value={selectedTagId} onValueChange={setSelectedTagId}>
                      <SelectTrigger className="h-9">
                        <SelectValue placeholder="Selecione uma tag" />
                      </SelectTrigger>
                      <SelectContent>
                        {tags.map(tag => (
                          <SelectItem key={tag.id} value={tag.id}>
                            <div className="flex items-center gap-2">
                              <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: tag.color }} />
                              {tag.name}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <div className="flex justify-end gap-2">
                      <Button variant="outline" size="sm" onClick={() => setShowTagDialog(false)}>Cancelar</Button>
                      <Button size="sm" onClick={handleTagAction} disabled={!selectedTagId}>Aplicar</Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            )}

            <Button variant="outline" size="sm" className="text-xs h-7 px-2" onClick={onBulkImageCompression} disabled={loading}>
              <ImageIcon className="h-3 w-3 mr-1" />
              <span className="hidden sm:inline">Comprimir</span>
            </Button>

            {/* Delete */}
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" size="sm" className="text-xs h-7 px-2" disabled={loading}>
                  <Trash2 className="h-3 w-3 mr-1" />
                  <span className="hidden sm:inline">Excluir</span>
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Excluir {selectedCount} produto{selectedCount > 1 ? 's' : ''}?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Esta ação não pode ser desfeita. Todas as imagens serão removidas.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction onClick={onBulkDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                    Excluir
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
      </div>
    </div>
  );
}
