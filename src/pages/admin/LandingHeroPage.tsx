import { useEffect, useState, useCallback } from 'react';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { toast } from 'sonner';
import { GripVertical, Plus, Pencil, Trash2, Eye, EyeOff, Smartphone, Copy } from 'lucide-react';
import { HeroScreenEditor } from '@/components/admin/HeroScreenEditor';
import type { HeroConfig, HeroScreen } from '@/hooks/useLandingHeroScreens';

const SCREEN_TYPE_LABELS: Record<string, string> = {
  storefront: 'Vitrine (Storefront)',
  product_detail: 'Detalhes do Produto',
  dashboard: 'Dashboard',
  my_products: 'Meus Produtos',
  custom: 'Tela Customizada',
};

export default function LandingHeroPage() {
  const [config, setConfig] = useState<HeroConfig>({
    animation_type: 'slide',
    slide_interval_ms: 5000,
    mockup_shadow: 'lg',
    mockup_scale: 1.0,
    mockup_gap: 40,
    autoplay: true,
    pause_on_hover: true,
  });
  const [screens, setScreens] = useState<HeroScreen[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingConfig, setSavingConfig] = useState(false);
  const [editingScreen, setEditingScreen] = useState<HeroScreen | null>(null);
  const [isNewScreen, setIsNewScreen] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [configRes, screensRes] = await Promise.all([
        supabase.from('landing_hero_config').select('*').eq('id', 1).maybeSingle(),
        supabase.from('landing_hero_screens').select('*').order('display_order', { ascending: true }),
      ]);

      if (configRes.data) {
        setConfig({
          animation_type: configRes.data.animation_type,
          slide_interval_ms: configRes.data.slide_interval_ms,
          mockup_shadow: configRes.data.mockup_shadow,
          mockup_scale: configRes.data.mockup_scale,
          mockup_gap: configRes.data.mockup_gap,
          autoplay: configRes.data.autoplay,
          pause_on_hover: configRes.data.pause_on_hover,
        });
      }

      if (screensRes.data) {
        setScreens(screensRes.data);
      }
    } catch (err) {
      console.error(err);
      toast.error('Erro ao carregar configuracoes');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const saveConfig = async () => {
    setSavingConfig(true);
    try {
      const { error } = await supabase
        .from('landing_hero_config')
        .upsert({ id: 1, ...config, updated_at: new Date().toISOString() });

      if (error) throw error;
      toast.success('Configuracoes salvas!');
    } catch (err: any) {
      toast.error(err.message || 'Erro ao salvar');
    } finally {
      setSavingConfig(false);
    }
  };

  const toggleScreenActive = async (screen: HeroScreen) => {
    const { error } = await supabase
      .from('landing_hero_screens')
      .update({ is_active: !screen.is_active, updated_at: new Date().toISOString() })
      .eq('id', screen.id);

    if (error) { toast.error('Erro ao atualizar'); return; }
    setScreens(prev => prev.map(s => s.id === screen.id ? { ...s, is_active: !s.is_active } : s));
  };

  const deleteScreen = async (screen: HeroScreen) => {
    if (!confirm(`Excluir a tela "${screen.label}"?`)) return;
    const { error } = await supabase.from('landing_hero_screens').delete().eq('id', screen.id);
    if (error) { toast.error('Erro ao excluir'); return; }
    setScreens(prev => prev.filter(s => s.id !== screen.id));
    toast.success('Tela excluida');
  };

  const duplicateScreen = async (screen: HeroScreen) => {
    const newScreen: Omit<HeroScreen, 'id'> = {
      display_order: screens.length + 1,
      is_active: false,
      label: `${screen.label} (copia)`,
      screen_type: screen.screen_type,
      config: { ...screen.config },
      scroll_y: screen.scroll_y,
    };

    const { data, error } = await supabase
      .from('landing_hero_screens')
      .insert(newScreen)
      .select()
      .single();

    if (error) { toast.error('Erro ao duplicar tela'); return; }
    setScreens(prev => [...prev, data]);
    toast.success('Tela duplicada com sucesso');
  };

  const createNewScreen = (screenType: string) => {
    const newScreen: HeroScreen = {
      id: '',
      display_order: screens.length + 1,
      is_active: true,
      label: SCREEN_TYPE_LABELS[screenType] || 'Nova Tela',
      screen_type: screenType as HeroScreen['screen_type'],
      config: getDefaultConfig(screenType),
      scroll_y: 0,
    };
    setEditingScreen(newScreen);
    setIsNewScreen(true);
  };

  const onScreenSaved = (saved: HeroScreen) => {
    setScreens(prev => {
      const existing = prev.find(s => s.id === saved.id);
      if (existing) return prev.map(s => s.id === saved.id ? saved : s);
      return [...prev, saved];
    });
    setEditingScreen(null);
    setIsNewScreen(false);
  };

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);

    if (!over || active.id === over.id) return;

    const oldIndex = screens.findIndex(s => s.id === active.id);
    const newIndex = screens.findIndex(s => s.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const reordered = arrayMove(screens, oldIndex, newIndex).map((s, i) => ({
      ...s,
      display_order: i + 1,
    }));

    setScreens(reordered);

    try {
      await Promise.all(
        reordered.map(s =>
          supabase
            .from('landing_hero_screens')
            .update({ display_order: s.display_order, updated_at: new Date().toISOString() })
            .eq('id', s.id)
        )
      );
      toast.success('Ordem salva!');
    } catch {
      toast.error('Erro ao salvar ordem');
      setScreens(screens);
    }
  };

  if (editingScreen) {
    return (
      <HeroScreenEditor
        screen={editingScreen}
        isNew={isNewScreen}
        onSave={onScreenSaved}
        onCancel={() => { setEditingScreen(null); setIsNewScreen(false); }}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Smartphone className="w-6 h-6 text-gray-700" />
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Hero Landing Page</h1>
          <p className="text-sm text-gray-500">Configure os mockups de celular exibidos na secao Hero</p>
        </div>
      </div>

      {/* General Config */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Configuracoes Gerais do Carrossel</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Tipo de Animacao</Label>
              <Select value={config.animation_type} onValueChange={(v) => setConfig(p => ({ ...p, animation_type: v as any }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="slide">Slide</SelectItem>
                  <SelectItem value="fade">Fade</SelectItem>
                  <SelectItem value="scale">Scale</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Intervalo entre Slides (ms)</Label>
              <Input
                type="number"
                min={1000}
                max={30000}
                step={500}
                value={config.slide_interval_ms}
                onChange={(e) => setConfig(p => ({ ...p, slide_interval_ms: Number(e.target.value) }))}
              />
            </div>

            <div className="space-y-2">
              <Label>Sombra dos Mockups</Label>
              <Select value={config.mockup_shadow} onValueChange={(v) => setConfig(p => ({ ...p, mockup_shadow: v as any }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhuma</SelectItem>
                  <SelectItem value="sm">Leve</SelectItem>
                  <SelectItem value="md">Media</SelectItem>
                  <SelectItem value="lg">Grande</SelectItem>
                  <SelectItem value="xl">Extra Grande</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Escala dos Mockups: {config.mockup_scale.toFixed(2)}</Label>
              <Slider
                min={0.5}
                max={1.5}
                step={0.05}
                value={[config.mockup_scale]}
                onValueChange={([v]) => setConfig(p => ({ ...p, mockup_scale: v }))}
              />
            </div>

            <div className="space-y-2">
              <Label>Gap entre Mockups (px)</Label>
              <Input
                type="number"
                min={0}
                max={100}
                value={config.mockup_gap}
                onChange={(e) => setConfig(p => ({ ...p, mockup_gap: Number(e.target.value) }))}
              />
            </div>
          </div>

          <div className="flex items-center gap-6 pt-2">
            <div className="flex items-center gap-2">
              <Switch checked={config.autoplay} onCheckedChange={(v) => setConfig(p => ({ ...p, autoplay: v }))} />
              <Label>Autoplay</Label>
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={config.pause_on_hover} onCheckedChange={(v) => setConfig(p => ({ ...p, pause_on_hover: v }))} />
              <Label>Pausar ao Hover</Label>
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <Button onClick={saveConfig} disabled={savingConfig}>
              {savingConfig ? 'Salvando...' : 'Salvar Configuracoes'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Screens List */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg">Telas do Carrossel</CardTitle>
          <Select onValueChange={(v) => createNewScreen(v)}>
            <SelectTrigger className="w-auto gap-2">
              <Plus className="w-4 h-4" />
              <span>Nova Tela</span>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="storefront">Vitrine (Storefront)</SelectItem>
              <SelectItem value="product_detail">Detalhes do Produto</SelectItem>
              <SelectItem value="dashboard">Dashboard</SelectItem>
              <SelectItem value="my_products">Meus Produtos</SelectItem>
              <SelectItem value="custom">Tela Customizada</SelectItem>
            </SelectContent>
          </Select>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-16 rounded-lg bg-gray-100 animate-pulse" />
              ))}
            </div>
          ) : screens.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-8">Nenhuma tela configurada. Crie uma nova tela acima.</p>
          ) : (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
            >
              <SortableContext items={screens.map(s => s.id)} strategy={verticalListSortingStrategy}>
                <div className="space-y-2">
                  {screens.map((screen) => (
                    <SortableScreenItem
                      key={screen.id}
                      screen={screen}
                      onToggleActive={toggleScreenActive}
                      onEdit={(s) => { setEditingScreen(s); setIsNewScreen(false); }}
                      onDuplicate={duplicateScreen}
                      onDelete={deleteScreen}
                    />
                  ))}
                </div>
              </SortableContext>

              <DragOverlay>
                {activeId ? (() => {
                  const screen = screens.find(s => s.id === activeId);
                  return screen ? (
                    <ScreenItemContent screen={screen} isDragOverlay />
                  ) : null;
                })() : null}
              </DragOverlay>
            </DndContext>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function ScreenItemContent({
  screen,
  dragHandleProps,
  isDragging,
  isDragOverlay,
  onToggleActive,
  onEdit,
  onDuplicate,
  onDelete,
}: {
  screen: HeroScreen;
  dragHandleProps?: Record<string, any>;
  isDragging?: boolean;
  isDragOverlay?: boolean;
  onToggleActive?: (s: HeroScreen) => void;
  onEdit?: (s: HeroScreen) => void;
  onDuplicate?: (s: HeroScreen) => void;
  onDelete?: (s: HeroScreen) => void;
}) {
  return (
    <div
      className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${
        isDragOverlay
          ? 'bg-white border-blue-300 shadow-lg opacity-95'
          : isDragging
          ? 'bg-blue-50 border-blue-200 opacity-50'
          : screen.is_active
          ? 'bg-white border-gray-200'
          : 'bg-gray-50 border-gray-100 opacity-60'
      }`}
    >
      <div
        {...dragHandleProps}
        className="cursor-grab active:cursor-grabbing touch-none shrink-0"
        title="Arrastar para reordenar"
      >
        <GripVertical className="w-4 h-4 text-gray-400" />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium text-gray-900 truncate">{screen.label}</p>
          <span className="text-xs px-1.5 py-0.5 rounded bg-gray-100 text-gray-600 shrink-0">
            {SCREEN_TYPE_LABELS[screen.screen_type] || screen.screen_type}
          </span>
        </div>
        <p className="text-xs text-gray-500">Ordem: {screen.display_order}</p>
      </div>

      {!isDragOverlay && (
        <div className="flex items-center gap-1 shrink-0">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onToggleActive?.(screen)}
            title={screen.is_active ? 'Desativar' : 'Ativar'}
          >
            {screen.is_active ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onEdit?.(screen)}
            title="Editar"
          >
            <Pencil className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onDuplicate?.(screen)}
            title="Duplicar"
          >
            <Copy className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="text-red-500 hover:text-red-700"
            onClick={() => onDelete?.(screen)}
            title="Excluir"
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      )}
    </div>
  );
}

function SortableScreenItem({
  screen,
  onToggleActive,
  onEdit,
  onDuplicate,
  onDelete,
}: {
  screen: HeroScreen;
  onToggleActive: (s: HeroScreen) => void;
  onEdit: (s: HeroScreen) => void;
  onDuplicate: (s: HeroScreen) => void;
  onDelete: (s: HeroScreen) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: screen.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div ref={setNodeRef} style={style}>
      <ScreenItemContent
        screen={screen}
        dragHandleProps={{ ...attributes, ...listeners }}
        isDragging={isDragging}
        onToggleActive={onToggleActive}
        onEdit={onEdit}
        onDuplicate={onDuplicate}
        onDelete={onDelete}
      />
    </div>
  );
}

function getDefaultConfig(screenType: string): Record<string, any> {
  switch (screenType) {
    case 'storefront':
      return {
        cover_url: '', avatar_url: '', store_name: 'Minha Loja', bio: '',
        social_buttons: ['cart', 'whatsapp', 'instagram', 'phone', 'location'],
        bg_color: '#ffffff', text_color: '#0a0a0a', accent_color: '#0f172a',
        button_bg_color: '#0f172a', button_text_color: '#f8fafc',
        icon_color: '#0a0a0a', border_color: '#e4e4e7',
        font_family: 'Inter', heading_font_family: 'Inter Tight', font_size_base: 'md',
        promotional_banner_url: '',
        category_name: 'Destaques',
        products: [
          { title: 'Produto 1', image_url: '', price: 99.90, discount_price: null },
          { title: 'Produto 2', image_url: '', price: 149.90, discount_price: null },
        ],
      };
    case 'product_detail':
      return {
        product_image_url: '', product_images: ['', '', '', ''],
        product_title: 'Nome do Produto',
        product_description: 'Descricao do produto',
        price: 199.90, discount_price: null, discount_badge: '',
        color_options: ['#000000', '#ffffff'], size_options: ['P', 'M', 'G'],
        button_text: 'Adicionar ao Carrinho', button_color: '#0f172a',
        seller_avatar_url: '', seller_name: '',
      };
    case 'dashboard':
      return {
        user_name: 'Usuario', period_label: 'Ultimos 30 dias', accent_color: '#0f172a',
        stats: [
          { label: 'Produtos', value: '0', icon_name: 'Package' },
          { label: 'Visualizacoes', value: '0', icon_name: 'TrendingUp' },
        ],
      };
    case 'my_products':
      return {
        page_title: 'Meus Produtos', product_count: 0, view_mode: 'grid',
        products: [
          { title: 'Produto 1', image_url: '', price: 99.90, views_count: 0, status: 'visible', stock_qty: 10 },
        ],
      };
    case 'custom':
      return { image_url: '' };
    default:
      return {};
  }
}
