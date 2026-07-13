import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useInventoryEnabled } from '@/hooks/useInventoryEnabled';
import { useInventoryOverview } from '@/hooks/useInventoryOverview';
import { fetchStockMovements } from '@/lib/stockMovementService';
import { supabase } from '@/lib/supabase';
import type { StockMovement, StockMovementType } from '@/types';
import { toast } from 'sonner';
import { Package, TriangleAlert as AlertTriangle, Circle as XCircle, Boxes, ArrowDownToLine, ArrowUpFromLine, RefreshCcw, Clock, Undo2, Loader as Loader2, ArrowRight, Warehouse, ChartBar as BarChart3, TrendingDown } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const MOVEMENT_CONFIG: Record<StockMovementType, { label: string; icon: typeof ArrowDownToLine; colorClass: string; badgeClass: string }> = {
  entrada: { label: 'Entrada', icon: ArrowDownToLine, colorClass: 'text-green-600', badgeClass: 'bg-green-500/10 text-green-600 border-transparent' },
  saida: { label: 'Saída', icon: ArrowUpFromLine, colorClass: 'text-red-600', badgeClass: 'bg-red-500/10 text-red-600 border-transparent' },
  ajuste: { label: 'Ajuste', icon: RefreshCcw, colorClass: 'text-blue-600', badgeClass: 'bg-blue-500/10 text-blue-600 border-transparent' },
  reserva: { label: 'Reserva', icon: Clock, colorClass: 'text-amber-600', badgeClass: 'bg-amber-500/10 text-amber-600 border-transparent' },
  cancelamento: { label: 'Cancelamento', icon: Undo2, colorClass: 'text-gray-600', badgeClass: 'bg-gray-500/10 text-gray-600 border-transparent' },
};

function InventoryActivationInvite() {
  const { user } = useAuth();
  const [activating, setActivating] = useState(false);
  const navigate = useNavigate();

  const handleActivate = async () => {
    if (!user?.id) return;
    setActivating(true);

    try {
      const { data: existing } = await supabase
        .from('user_storefront_settings')
        .select('id, settings')
        .eq('user_id', user.id)
        .maybeSingle();

      if (existing) {
        const updatedSettings = {
          ...(existing.settings || {}),
          enableInventory: true,
        };
        const { error } = await supabase
          .from('user_storefront_settings')
          .update({ settings: updatedSettings })
          .eq('id', existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('user_storefront_settings')
          .insert({
            user_id: user.id,
            settings: { enableInventory: true },
          });
        if (error) throw error;
      }

      toast.success('Controle de estoque ativado!');
      window.location.reload();
    } catch (error) {
      console.error('Error activating inventory:', error);
      toast.error('Erro ao ativar controle de estoque');
    } finally {
      setActivating(false);
    }
  };

  return (
    <div className="w-full px-4 sm:px-6 lg:px-8 xl:px-12 2xl:px-16 py-6">
      <div className="max-w-2xl mx-auto text-center py-16 space-y-6">
        <div className="flex justify-center">
          <div className="h-20 w-20 rounded-full bg-muted flex items-center justify-center">
            <Warehouse className="h-10 w-10 text-muted-foreground" />
          </div>
        </div>

        <div className="space-y-2">
          <h1 className="text-2xl md:text-3xl page-title">Controle de Estoque</h1>
          <p className="text-muted-foreground max-w-md mx-auto">
            Gerencie a quantidade dos seus produtos com rastreamento automático, alertas de estoque baixo e histórico completo de movimentações.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-lg mx-auto text-left">
          <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
            <BarChart3 className="h-5 w-5 text-primary mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-medium">Visão em tempo real</p>
              <p className="text-xs text-muted-foreground">Saiba exatamente o que tem disponível</p>
            </div>
          </div>
          <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
            <AlertTriangle className="h-5 w-5 text-amber-500 mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-medium">Alertas automáticos</p>
              <p className="text-xs text-muted-foreground">Notificações de estoque baixo</p>
            </div>
          </div>
          <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
            <TrendingDown className="h-5 w-5 text-green-500 mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-medium">Dedução automática</p>
              <p className="text-xs text-muted-foreground">Estoque atualiza com vendas</p>
            </div>
          </div>
        </div>

        <div className="pt-2">
          <Button
            size="lg"
            onClick={handleActivate}
            disabled={activating}
            className="min-w-[200px]"
          >
            {activating ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <Package className="h-4 w-4 mr-2" />
            )}
            Ativar Controle de Estoque
          </Button>
          <p className="text-xs text-muted-foreground mt-3">
            Você pode desativar a qualquer momento sem perder dados
          </p>
        </div>
      </div>
    </div>
  );
}

function InventoryDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { trackedProducts, lowStockCount, outOfStockCount, totalUnits, criticalProducts, loading, refresh } = useInventoryOverview();
  const [recentMovements, setRecentMovements] = useState<StockMovement[]>([]);
  const [movementsLoading, setMovementsLoading] = useState(true);

  useEffect(() => {
    if (!user?.id) return;
    setMovementsLoading(true);
    fetchStockMovements(user.id, 5, 0, {}).then(({ data }) => {
      setRecentMovements(data);
      setMovementsLoading(false);
    });
  }, [user?.id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="w-full px-4 sm:px-6 lg:px-8 xl:px-12 2xl:px-16 py-6 space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl page-title">Estoque</h1>
        <p className="text-sm text-muted-foreground">Visão geral do inventário dos seus produtos</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Package className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{trackedProducts}</p>
                <p className="text-xs text-muted-foreground">Produtos rastreados</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <AlertTriangle className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{lowStockCount}</p>
                <p className="text-xs text-muted-foreground">Estoque baixo</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <XCircle className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{outOfStockCount}</p>
                <p className="text-xs text-muted-foreground">Esgotados</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Boxes className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{totalUnits}</p>
                <p className="text-xs text-muted-foreground">Unidades em estoque</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Critical Products */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base">Produtos Críticos</CardTitle>
              <CardDescription>Produtos com estoque baixo ou esgotado</CardDescription>
            </div>
            {criticalProducts.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate('/dashboard/listings')}
                className="text-xs"
              >
                Ver todos
                <ArrowRight className="h-3 w-3 ml-1" />
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {criticalProducts.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Package className="h-8 w-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm">Nenhum produto em situação crítica</p>
              <p className="text-xs mt-1">Todos os produtos estão com estoque adequado</p>
            </div>
          ) : (
            <div className="divide-y">
              {criticalProducts.map((product) => (
                <div
                  key={product.id}
                  className="flex items-center gap-3 px-4 py-3 hover:bg-muted/30 transition-colors cursor-pointer"
                  onClick={() => navigate(`/dashboard/products/${product.id}/edit`)}
                >
                  <div className="h-10 w-10 rounded-md bg-muted overflow-hidden shrink-0">
                    {product.featured_image_url ? (
                      <img
                        src={product.featured_image_url}
                        alt={product.title}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="h-full w-full flex items-center justify-center">
                        <Package className="h-4 w-4 text-muted-foreground" />
                      </div>
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{product.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {product.stock_quantity} un. disponível
                    </p>
                  </div>

                  <Badge
                    className={
                      product.status === 'out_of_stock'
                        ? 'bg-red-500/10 text-red-600 border-transparent text-[10px]'
                        : 'bg-amber-500/10 text-amber-600 border-transparent text-[10px]'
                    }
                  >
                    {product.status === 'out_of_stock' ? 'Esgotado' : 'Baixo'}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent Movements */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base">Movimentações Recentes</CardTitle>
              <CardDescription>Últimas alterações no estoque</CardDescription>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate('/dashboard/stock-movements')}
              className="text-xs"
            >
              Ver todas
              <ArrowRight className="h-3 w-3 ml-1" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {movementsLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : recentMovements.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <RefreshCcw className="h-8 w-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm">Nenhuma movimentação registrada</p>
            </div>
          ) : (
            <div className="divide-y">
              {recentMovements.map((m) => {
                const config = MOVEMENT_CONFIG[m.movement_type];
                const Icon = config.icon;
                const productInfo = m.product as { title?: string } | undefined;

                return (
                  <div key={m.id} className="flex items-center gap-3 px-4 py-3">
                    <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted ${config.colorClass}`}>
                      <Icon className="h-3.5 w-3.5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm truncate">{productInfo?.title || 'Produto'}</p>
                      <Badge className={`text-[10px] px-1.5 py-0 ${config.badgeClass}`}>
                        {config.label}
                      </Badge>
                    </div>
                    <div className="text-right shrink-0">
                      <p className={`text-sm font-semibold ${m.quantity > 0 ? 'text-green-600' : m.quantity < 0 ? 'text-red-600' : 'text-muted-foreground'}`}>
                        {m.quantity > 0 ? '+' : ''}{m.quantity} un.
                      </p>
                      <p className="text-[10px] text-muted-foreground">
                        {format(new Date(m.created_at), "dd MMM, HH:mm", { locale: ptBR })}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default function InventoryOverviewPage() {
  const { inventoryEnabled, loading } = useInventoryEnabled();

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!inventoryEnabled) {
    return <InventoryActivationInvite />;
  }

  return <InventoryDashboard />;
}
