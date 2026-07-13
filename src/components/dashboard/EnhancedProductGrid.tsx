import { useState, useEffect, useCallback } from 'react';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  DragOverlay,
  type DragStartEvent,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  rectSortingStrategy,
  useSortable,
  arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Save, X, RotateCcw, Loader } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { formatCurrencyI18n } from '@/lib/i18n';
import type { Product } from '@/types';

interface EnhancedProductGridProps {
  products: Product[];
  isDragMode: boolean;
  onDragEnd: (result: any) => Promise<void>;
  onSaveOrder: () => Promise<void>;
  onCancelReorder: () => void;
  user: any;
  reordering: boolean;
}

function SortableProductCard({ product, index, user }: { product: Product; index: number; user: any }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: product.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition: transition || 'transform 200ms ease',
    opacity: isDragging ? 0.4 : 1,
    zIndex: isDragging ? 50 : undefined,
  };

  const hasDiscount = product.discounted_price && product.discounted_price < product.price;
  const displayPrice = hasDiscount ? product.discounted_price : product.price;

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <Card className="h-full cursor-grab active:cursor-grabbing border border-border/60 hover:border-primary/40 transition-colors duration-150">
        <CardContent className="p-2 md:p-3 relative">
          <div className="absolute top-1 left-1 md:top-2 md:left-2 z-10 bg-primary text-primary-foreground rounded-full w-5 h-5 md:w-6 md:h-6 flex items-center justify-center text-[10px] md:text-xs font-bold">
            {index + 1}
          </div>

          <div className="absolute top-1 right-1 md:top-2 md:right-2 z-10 bg-muted/80 rounded-md p-1">
            <GripVertical className="h-3.5 w-3.5 text-muted-foreground" />
          </div>

          <div className="aspect-square relative mb-2 mt-6 md:mt-7 rounded-lg overflow-hidden bg-white border border-border/30">
            {product.featured_image_url ? (
              <img
                src={product.featured_image_url}
                alt={product.title}
                className="w-full h-full object-cover"
                loading="lazy"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-muted/20">
                <span className="text-muted-foreground text-[10px]">Sem imagem</span>
              </div>
            )}
          </div>

          <h3 className="font-semibold text-[10px] md:text-xs leading-tight line-clamp-2 mb-1">
            {product.title}
          </h3>

          {displayPrice && displayPrice > 0 && (
            <div className="text-xs font-bold text-primary">
              {formatCurrencyI18n(displayPrice, user?.currency || 'BRL', user?.language || 'pt-BR')}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function DragOverlayCard({ product, user }: { product: Product; user: any }) {
  const hasDiscount = product.discounted_price && product.discounted_price < product.price;
  const displayPrice = hasDiscount ? product.discounted_price : product.price;

  return (
    <Card className="shadow-2xl ring-2 ring-primary/50 rotate-2 scale-105 w-[160px] md:w-[200px]">
      <CardContent className="p-2 md:p-3">
        <div className="aspect-square relative mb-2 rounded-lg overflow-hidden bg-white border border-border/30">
          {product.featured_image_url ? (
            <img
              src={product.featured_image_url}
              alt={product.title}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-muted/20">
              <span className="text-muted-foreground text-[10px]">Sem imagem</span>
            </div>
          )}
        </div>
        <h3 className="font-semibold text-[10px] md:text-xs leading-tight line-clamp-2 mb-1">
          {product.title}
        </h3>
        {displayPrice && displayPrice > 0 && (
          <div className="text-xs font-bold text-primary">
            {formatCurrencyI18n(displayPrice, user?.currency || 'BRL', user?.language || 'pt-BR')}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function EnhancedProductGrid({
  products,
  isDragMode,
  onDragEnd,
  onSaveOrder,
  onCancelReorder,
  user,
  reordering,
}: EnhancedProductGridProps) {
  const [localProducts, setLocalProducts] = useState(products);
  const [hasChanges, setHasChanges] = useState(false);
  const [originalProducts] = useState(products);
  const [activeProduct, setActiveProduct] = useState<Product | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setLocalProducts(products);
  }, [products]);

  const pointerSensor = useSensor(PointerSensor, {
    activationConstraint: { distance: 8 },
  });

  const touchSensor = useSensor(TouchSensor, {
    activationConstraint: { delay: 200, tolerance: 5 },
  });

  const sensors = useSensors(pointerSensor, touchSensor);

  const handleDragStart = useCallback((event: DragStartEvent) => {
    const product = localProducts.find(p => p.id === event.active.id);
    setActiveProduct(product || null);
  }, [localProducts]);

  const handleDragEnd = useCallback(async (event: DragEndEvent) => {
    setActiveProduct(null);
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = localProducts.findIndex(p => p.id === active.id);
    const newIndex = localProducts.findIndex(p => p.id === over.id);

    if (oldIndex === -1 || newIndex === -1) return;

    const reordered = arrayMove(localProducts, oldIndex, newIndex);
    setLocalProducts(reordered);
    setHasChanges(true);

    await onDragEnd({
      source: { index: oldIndex },
      destination: { index: newIndex },
      draggableId: active.id,
    });
  }, [localProducts, onDragEnd]);

  const handleSave = async () => {
    try {
      setSaving(true);
      await onSaveOrder();
      setHasChanges(false);
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setLocalProducts(originalProducts);
    setHasChanges(false);
    onCancelReorder();
  };

  const handleUndo = () => {
    setLocalProducts(originalProducts);
    setHasChanges(false);
  };

  return (
    <>
      {/* Reorder Controls */}
      {isDragMode && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50">
          <Card className="shadow-xl border-primary/20 bg-background/95 backdrop-blur-sm">
            <CardContent className="p-3 md:p-4">
              <div className="flex items-center gap-3 md:gap-4">
                <div className="hidden md:flex items-center gap-2 text-sm text-muted-foreground">
                  {hasChanges ? (
                    <span className="text-emerald-600 font-medium">Pronto para salvar</span>
                  ) : (
                    <span>Arraste para reordenar</span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {hasChanges && (
                    <Button size="sm" variant="outline" onClick={handleUndo} disabled={reordering || saving} className="h-8">
                      <RotateCcw className="h-3 w-3 mr-1" />
                      <span className="hidden sm:inline">Desfazer</span>
                    </Button>
                  )}
                  <Button size="sm" variant="outline" onClick={handleCancel} disabled={reordering || saving} className="h-8">
                    <X className="h-3 w-3 mr-1" />
                    <span className="hidden sm:inline">Cancelar</span>
                  </Button>
                  {hasChanges && (
                    <Button size="sm" onClick={handleSave} disabled={reordering || saving} className="h-8">
                      {saving ? <Loader className="h-3 w-3 animate-spin mr-1" /> : <Save className="h-3 w-3 mr-1" />}
                      Salvar
                    </Button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Sortable Grid */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <SortableContext items={localProducts.map(p => p.id)} strategy={rectSortingStrategy}>
          <div className={`grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2 md:gap-4 p-2 md:p-4 ${
            reordering ? 'pointer-events-none opacity-60' : ''
          }`}>
            {localProducts.map((product, index) => (
              <SortableProductCard
                key={product.id}
                product={product}
                index={index}
                user={user}
              />
            ))}
          </div>
        </SortableContext>

        <DragOverlay dropAnimation={{ duration: 200, easing: 'ease' }}>
          {activeProduct ? <DragOverlayCard product={activeProduct} user={user} /> : null}
        </DragOverlay>
      </DndContext>

      {/* Saving overlay */}
      {reordering && (
        <div className="fixed inset-0 bg-black/20 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-background rounded-xl p-5 flex items-center gap-3 shadow-2xl border">
            <Loader className="h-5 w-5 animate-spin text-primary" />
            <span className="text-sm font-medium">Salvando nova ordem...</span>
          </div>
        </div>
      )}
    </>
  );
}
