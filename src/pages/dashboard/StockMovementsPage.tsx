import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { fetchStockMovements } from '@/lib/stockMovementService';
import type { StockMovement, StockMovementType } from '@/types';
import { ArrowLeft, ArrowDownToLine, ArrowUpFromLine, RefreshCcw, Clock, Undo2, Filter, Loader as Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const MOVEMENT_CONFIG: Record<StockMovementType, { label: string; icon: typeof ArrowDownToLine; colorClass: string; badgeClass: string }> = {
  entrada: { label: 'Entrada', icon: ArrowDownToLine, colorClass: 'text-green-600', badgeClass: 'bg-green-500/10 text-green-600 border-transparent' },
  saida: { label: 'Saída', icon: ArrowUpFromLine, colorClass: 'text-red-600', badgeClass: 'bg-red-500/10 text-red-600 border-transparent' },
  ajuste: { label: 'Ajuste', icon: RefreshCcw, colorClass: 'text-blue-600', badgeClass: 'bg-blue-500/10 text-blue-600 border-transparent' },
  reserva: { label: 'Reserva', icon: Clock, colorClass: 'text-amber-600', badgeClass: 'bg-amber-500/10 text-amber-600 border-transparent' },
  cancelamento: { label: 'Cancelamento', icon: Undo2, colorClass: 'text-gray-600', badgeClass: 'bg-gray-500/10 text-gray-600 border-transparent' },
};

const PAGE_SIZE = 30;

export default function StockMovementsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [typeFilter, setTypeFilter] = useState<string>('all');

  const loadMovements = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);

    const filters: { movement_type?: StockMovementType } = {};
    if (typeFilter !== 'all') {
      filters.movement_type = typeFilter as StockMovementType;
    }

    const { data, count } = await fetchStockMovements(
      user.id,
      PAGE_SIZE,
      page * PAGE_SIZE,
      filters
    );

    setMovements(data);
    setTotal(count);
    setLoading(false);
  }, [user?.id, page, typeFilter]);

  useEffect(() => {
    loadMovements();
  }, [loadMovements]);

  const handleFilterChange = (value: string) => {
    setTypeFilter(value);
    setPage(0);
  };

  const totalPages = Math.ceil(total / PAGE_SIZE);

  const getVariantLabel = (m: StockMovement): string | null => {
    const vs = m.variant_stock as { color?: string; size?: string; flavor?: string } | null;
    if (!vs) return null;
    const parts = [vs.color, vs.size, vs.flavor].filter(Boolean);
    return parts.length > 0 ? parts.join(' / ') : null;
  };

  return (
    <div className="w-full px-4 sm:px-6 lg:px-8 xl:px-12 2xl:px-16 py-6 space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate('/dashboard/inventory')}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl md:text-3xl page-title">Movimentações de Estoque</h1>
          <p className="text-sm text-muted-foreground">Histórico completo de entradas, saídas e ajustes</p>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <Filter className="h-4 w-4 text-muted-foreground" />
        <Select value={typeFilter} onValueChange={handleFilterChange}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Tipo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os tipos</SelectItem>
            <SelectItem value="entrada">Entrada</SelectItem>
            <SelectItem value="saida">Saída</SelectItem>
            <SelectItem value="ajuste">Ajuste</SelectItem>
            <SelectItem value="reserva">Reserva</SelectItem>
            <SelectItem value="cancelamento">Cancelamento</SelectItem>
          </SelectContent>
        </Select>
        <span className="text-sm text-muted-foreground ml-auto">
          {total} movimentação{total !== 1 ? 'ões' : ''}
        </span>
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : movements.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <RefreshCcw className="h-10 w-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm">Nenhuma movimentação encontrada</p>
            </div>
          ) : (
            <div className="divide-y">
              {movements.map((m) => {
                const config = MOVEMENT_CONFIG[m.movement_type];
                const Icon = config.icon;
                const variantLabel = getVariantLabel(m);
                const productInfo = m.product as { title?: string; featured_image_url?: string } | undefined;

                return (
                  <div key={m.id} className="flex items-center gap-4 px-4 py-3 hover:bg-muted/30 transition-colors">
                    <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted ${config.colorClass}`}>
                      <Icon className="h-4 w-4" />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-medium truncate">
                          {productInfo?.title || 'Produto'}
                        </p>
                        <Badge className={`text-[10px] px-1.5 py-0 ${config.badgeClass}`}>
                          {config.label}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        {variantLabel && (
                          <span className="text-xs text-muted-foreground">{variantLabel}</span>
                        )}
                        {m.reason && (
                          <span className="text-xs text-muted-foreground truncate">
                            {variantLabel ? '· ' : ''}{m.reason}
                          </span>
                        )}
                        {m.reference_type === 'order' && m.reference_id && (
                          <span className="text-xs text-muted-foreground">
                            Pedido
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <p className={`text-sm font-semibold ${m.quantity > 0 ? 'text-green-600' : m.quantity < 0 ? 'text-red-600' : 'text-muted-foreground'}`}>
                        {m.quantity > 0 ? '+' : ''}{m.quantity} un.
                      </p>
                      <p className="text-[10px] text-muted-foreground">
                        {m.previous_quantity} → {m.new_quantity}
                      </p>
                    </div>

                    <div className="text-right shrink-0 hidden sm:block">
                      <p className="text-xs text-muted-foreground">
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

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={page === 0}
          >
            Anterior
          </Button>
          <span className="text-sm text-muted-foreground">
            {page + 1} de {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
            disabled={page >= totalPages - 1}
          >
            Próxima
          </Button>
        </div>
      )}
    </div>
  );
}
