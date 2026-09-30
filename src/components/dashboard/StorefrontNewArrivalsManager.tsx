import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Loader2, Search, Percent, GripVertical } from 'lucide-react';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, useSortable, arrayMove } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { sanitizeCategoryName } from '@/lib/categoryUtils';

interface ProductRow {
  id: string;
  title: string;
  featured_image_url: string | null;
  price: number | null;
  discounted_price: number | null;
  categories: string[];
  flag: boolean;
  // Position within this carousel only (null = not yet placed, sorts last).
  // Independent from `display_order` (the merchant's main catalog order) and
  // from the same product's position in any other carousel.
  order: number | null;
}

interface StorefrontProductPickerManagerProps {
  /** products column holding the merchant's on/off flag for this section. */
  column: 'storefront_featured' | 'storefront_offer' | 'storefront_highlight';
  /** Warn on rows without a real markdown (used by "Ofertas"). */
  requireDiscount?: boolean;
}

const hasDiscount = (p: Pick<ProductRow, 'price' | 'discounted_price'>) =>
  p.discounted_price != null && p.discounted_price > 0 && p.discounted_price < (p.price ?? 0);

function OrderRow({ product, index }: { product: ProductRow; index: number }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: product.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition: transition || 'transform 150ms ease',
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 10 : undefined,
  };

  return (
    <div ref={setNodeRef} style={style} className="flex items-center gap-2.5 rounded-lg border bg-card p-2">
      <button
        type="button"
        {...attributes}
        {...listeners}
        className="-m-1 shrink-0 touch-none p-1 text-muted-foreground cursor-grab active:cursor-grabbing"
        aria-label="Arrastar para reordenar"
      >
        <GripVertical className="h-4 w-4" />
      </button>
      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-muted text-[11px] font-medium text-muted-foreground">
        {index + 1}
      </span>
      <div className="h-9 w-9 shrink-0 overflow-hidden rounded border bg-muted flex items-center justify-center">
        {product.featured_image_url ? (
          <img src={product.featured_image_url} alt="" className="h-full w-full object-cover" />
        ) : (
          <span className="text-[9px] text-muted-foreground">—</span>
        )}
      </div>
      <span className="flex-1 min-w-0 truncate text-sm">{product.title}</span>
    </div>
  );
}

/**
 * Picker for "Novidades"/"Ofertas"/"Destaques": a plain one-by-one list is unworkable
 * once a store has hundreds of products, so this adds search, a category filter, and
 * bulk actions (mark/unmark everything currently filtered, "only selected" to review
 * picks, and — for Ofertas — one click to select every product that already has a
 * discounted_price, which is the common case: the merchant already priced the
 * markdown, they just want it to show up here).
 *
 * Display order is separate from all of that: a drag-and-drop list of only the
 * currently selected products, always in full (never affected by search/category
 * filters) so a drag's neighbor is always the item actually next to it on the
 * storefront. Persisted per-section (`<column>_order`), independent from
 * `display_order` (the main catalog's own order) and from this same product's
 * position in any other carousel.
 */
export function StorefrontProductPickerManager({ column, requireDiscount = false }: StorefrontProductPickerManagerProps) {
  const { user } = useAuth();
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyIds, setBusyIds] = useState<Set<string>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);
  const [reorderSaving, setReorderSaving] = useState(false);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('todas');
  const [onlySelected, setOnlySelected] = useState(false);

  const orderColumn = `${column}_order` as const;

  useEffect(() => {
    if (!user?.id) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    supabase
      .from('products')
      .select(`id, title, featured_image_url, price, discounted_price, category, ${column}, ${orderColumn}`)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) {
          console.error(`Error fetching products for ${column}:`, error);
          setProducts([]);
        } else {
          setProducts(
            ((data || []) as unknown as Array<Record<string, any>>).map((row) => ({
              id: row.id,
              title: row.title,
              featured_image_url: row.featured_image_url,
              price: row.price,
              discounted_price: row.discounted_price,
              categories: (Array.isArray(row.category) ? row.category : [])
                .map(sanitizeCategoryName)
                .filter(Boolean),
              flag: !!row[column],
              order: row[orderColumn] ?? null,
            }))
          );
        }
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [user?.id, column, orderColumn]);

  const categories = useMemo(() => {
    const set = new Set<string>();
    products.forEach((p) => p.categories.forEach((c) => set.add(c)));
    return Array.from(set).sort();
  }, [products]);

  const normalizedQuery = query.trim().toLowerCase();
  const filtered = products.filter((p) => {
    if (category !== 'todas' && !p.categories.includes(category)) return false;
    if (normalizedQuery && !p.title.toLowerCase().includes(normalizedQuery)) return false;
    if (onlySelected && !p.flag) return false;
    return true;
  });

  const orderedSelected = useMemo(
    () =>
      products
        .filter((p) => p.flag)
        .sort((a, b) => (a.order ?? Number.MAX_SAFE_INTEGER) - (b.order ?? Number.MAX_SAFE_INTEGER)),
    [products]
  );

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } })
  );

  const handleReorder = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = orderedSelected.findIndex((p) => p.id === active.id);
    const newIndex = orderedSelected.findIndex((p) => p.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const reordered = arrayMove(orderedSelected, oldIndex, newIndex);
    const orderById = new Map(reordered.map((p, index) => [p.id, index]));
    setProducts((prev) => prev.map((p) => (orderById.has(p.id) ? { ...p, order: orderById.get(p.id)! } : p)));

    setReorderSaving(true);
    const results = await Promise.allSettled(
      reordered.map((p, index) => supabase.from('products').update({ [orderColumn]: index }).eq('id', p.id))
    );
    setReorderSaving(false);
    const failed = results.some((r) => r.status === 'rejected' || (r.status === 'fulfilled' && !!(r.value as any).error));
    if (failed) {
      toast.error('Erro ao salvar a nova ordem. Tente novamente.');
    }
  };

  const applyToIds = async (ids: string[], flag: boolean) => {
    if (ids.length === 0) return;
    setBulkBusy(true);
    const payload: Record<string, unknown> = { [column]: flag };
    // Unselecting clears the saved position too — re-selecting later starts fresh
    // at the end of the list instead of jumping back to a stale middle spot.
    if (!flag) payload[orderColumn] = null;
    const { error } = await supabase.from('products').update(payload).in('id', ids);
    setBulkBusy(false);
    if (error) {
      toast.error('Erro ao atualizar produtos');
      return;
    }
    const idSet = new Set(ids);
    setProducts((prev) => prev.map((p) => (idSet.has(p.id) ? { ...p, flag, order: flag ? p.order : null } : p)));
    toast.success(flag ? `${ids.length} produto${ids.length > 1 ? 's' : ''} adicionado${ids.length > 1 ? 's' : ''}` : `${ids.length} produto${ids.length > 1 ? 's' : ''} removido${ids.length > 1 ? 's' : ''}`);
  };

  const handleToggle = async (product: ProductRow) => {
    const nextFlag = !product.flag;
    setBusyIds((prev) => new Set(prev).add(product.id));
    const payload: Record<string, unknown> = { [column]: nextFlag };
    if (!nextFlag) payload[orderColumn] = null;
    const { error } = await supabase.from('products').update(payload).eq('id', product.id);
    setBusyIds((prev) => {
      const next = new Set(prev);
      next.delete(product.id);
      return next;
    });
    if (error) {
      toast.error('Erro ao atualizar produto');
      return;
    }
    setProducts((prev) => prev.map((p) => (p.id === product.id ? { ...p, flag: nextFlag, order: nextFlag ? p.order : null } : p)));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-10">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const selectedCount = products.filter((p) => p.flag).length;
  const filteredSelectedCount = filtered.filter((p) => p.flag).length;
  const discountedUnselected = products.filter((p) => !p.flag && hasDiscount(p));

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Escolha quais produtos aparecem
        {selectedCount > 0 ? ` (${selectedCount} selecionado${selectedCount > 1 ? 's' : ''}).` : '.'}
        {selectedCount === 0 ? ' Enquanto nenhum for selecionado, a seção fica oculta na loja.' : ''}
      </p>

      {products.length === 0 ? (
        <p className="text-sm text-muted-foreground">Você ainda não tem produtos cadastrados.</p>
      ) : (
        <>
          {orderedSelected.length > 1 && (
            <div className="space-y-2">
              <div>
                <h4 className="text-sm font-medium">Ordem de exibição</h4>
                <p className="text-xs text-muted-foreground">
                  Arraste para definir a ordem dos produtos selecionados no carrossel da loja.
                  {reorderSaving && ' Salvando...'}
                </p>
              </div>
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleReorder}>
                <SortableContext items={orderedSelected.map((p) => p.id)} strategy={verticalListSortingStrategy}>
                  <div className="space-y-1.5">
                    {orderedSelected.map((product, index) => (
                      <OrderRow key={product.id} product={product} index={index} />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
            </div>
          )}

          <div className="flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar produto..."
                className="pl-8"
              />
            </div>
            {categories.length > 0 && (
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger className="sm:w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todas">Todas as categorias</SelectItem>
                  {categories.map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={bulkBusy || filtered.length === 0 || filteredSelectedCount === filtered.length}
              onClick={() => applyToIds(filtered.map((p) => p.id), true)}
            >
              Marcar {filtered.length !== products.length ? 'filtrados' : 'todos'} ({filtered.length})
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={bulkBusy || filteredSelectedCount === 0}
              onClick={() => applyToIds(filtered.filter((p) => p.flag).map((p) => p.id), false)}
            >
              Desmarcar {filtered.length !== products.length ? 'filtrados' : 'todos'}
            </Button>
            {requireDiscount && discountedUnselected.length > 0 && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={bulkBusy}
                onClick={() => applyToIds(discountedUnselected.map((p) => p.id), true)}
              >
                <Percent className="mr-1.5 h-3.5 w-3.5" />
                Selecionar com desconto ({discountedUnselected.length})
              </Button>
            )}
            <label className="ml-auto flex items-center gap-1.5 text-sm text-muted-foreground">
              <Switch checked={onlySelected} onCheckedChange={setOnlySelected} />
              Só selecionados
            </label>
          </div>

          {filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">Nenhum produto encontrado.</p>
          ) : (
            <div className="space-y-2 max-h-[480px] overflow-y-auto pr-1">
              {filtered.map((product) => (
                <Card key={product.id}>
                  <CardContent className="flex items-center gap-3 p-3">
                    <div className="h-12 w-12 rounded border bg-muted overflow-hidden shrink-0 flex items-center justify-center">
                      {product.featured_image_url ? (
                        <img src={product.featured_image_url} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <span className="text-[10px] text-muted-foreground">Sem foto</span>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className="block text-sm font-medium truncate">{product.title}</span>
                      {requireDiscount && product.flag && !hasDiscount(product) && (
                        <span className="block text-xs text-amber-600">
                          Sem preço promocional — o card não mostrará desconto.
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <Switch
                        checked={product.flag}
                        onCheckedChange={() => handleToggle(product)}
                        disabled={busyIds.has(product.id) || bulkBusy}
                      />
                      <span className="text-xs text-muted-foreground w-16">
                        {product.flag ? 'Em destaque' : 'Oculto'}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

export function StorefrontNewArrivalsManager() {
  return <StorefrontProductPickerManager column="storefront_featured" />;
}

export function StorefrontOffersManager() {
  return <StorefrontProductPickerManager column="storefront_offer" requireDiscount />;
}

export function StorefrontHighlightsManager() {
  return <StorefrontProductPickerManager column="storefront_highlight" />;
}
