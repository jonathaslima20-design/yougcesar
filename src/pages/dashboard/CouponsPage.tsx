import { useState, useCallback } from 'react';
import { Ticket, Plus, Search, ToggleLeft, Copy, Trash2, Pencil, History, Percent, DollarSign, TrendingUp, Tag } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useCoupons, type CouponFormData } from '@/hooks/useCoupons';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import CouponFormDialog from '@/components/coupons/CouponFormDialog';
import type { Coupon, CouponUsage } from '@/types';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

type StatusFilter = 'all' | 'active' | 'inactive' | 'expired';

function getCouponStatus(coupon: Coupon): 'active' | 'inactive' | 'expired' {
  if (!coupon.is_active) return 'inactive';
  if (coupon.valid_until && new Date(coupon.valid_until) < new Date()) return 'expired';
  if (coupon.max_uses && coupon.current_uses >= coupon.max_uses) return 'expired';
  return 'active';
}

function CouponStatusBadge({ coupon }: { coupon: Coupon }) {
  const status = getCouponStatus(coupon);
  if (status === 'active') return <Badge className="bg-primary text-primary-foreground text-xs">Ativo</Badge>;
  if (status === 'expired') return <Badge variant="secondary" className="text-xs">Expirado</Badge>;
  return <Badge variant="outline" className="text-xs">Inativo</Badge>;
}

export default function CouponsPage() {
  const { user } = useAuth();
  const {
    coupons,
    loading,
    stats,
    createCoupon,
    updateCoupon,
    deleteCoupon,
    toggleCouponActive,
    duplicateCoupon,
    fetchCouponById,
    fetchCouponUsageHistory,
  } = useCoupons();

  const [formOpen, setFormOpen] = useState(false);
  const [editingCoupon, setEditingCoupon] = useState<Coupon | null>(null);
  const [editProductIds, setEditProductIds] = useState<string[]>([]);
  const [editCategoryIds, setEditCategoryIds] = useState<string[]>([]);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyData, setHistoryData] = useState<CouponUsage[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyCoupon, setHistoryCoupon] = useState<Coupon | null>(null);

  const filteredCoupons = coupons.filter(c => {
    if (statusFilter !== 'all') {
      const status = getCouponStatus(c);
      if (statusFilter !== status) return false;
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      if (!c.code.toLowerCase().includes(q) && !c.name.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  const handleCreate = () => {
    setEditingCoupon(null);
    setEditProductIds([]);
    setEditCategoryIds([]);
    setFormOpen(true);
  };

  const handleEdit = async (coupon: Coupon) => {
    const detail = await fetchCouponById(coupon.id);
    if (detail) {
      setEditingCoupon(detail.coupon);
      setEditProductIds(detail.productIds);
      setEditCategoryIds(detail.categoryIds);
      setFormOpen(true);
    }
  };

  const handleSave = useCallback(async (data: CouponFormData) => {
    if (editingCoupon) {
      return updateCoupon(editingCoupon.id, data);
    }
    return createCoupon(data);
  }, [editingCoupon, updateCoupon, createCoupon]);

  const handleDelete = async () => {
    if (!deleteId) return;
    await deleteCoupon(deleteId);
    setDeleteId(null);
  };

  const handleViewHistory = async (coupon: Coupon) => {
    setHistoryCoupon(coupon);
    setHistoryOpen(true);
    setHistoryLoading(true);
    const data = await fetchCouponUsageHistory(coupon.id);
    setHistoryData(data);
    setHistoryLoading(false);
  };

  return (
    <div className="w-full px-4 sm:px-6 lg:px-8 xl:px-12 2xl:px-16 py-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Cupons de Desconto</h1>
          <p className="text-muted-foreground text-sm mt-1">Gerencie seus cupons de desconto</p>
        </div>
        <Button onClick={handleCreate}>
          <Plus className="h-4 w-4 mr-2" />
          Criar Cupom
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <Ticket className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.totalActive}</p>
                <p className="text-xs text-muted-foreground">Cupons ativos</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <TrendingUp className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.totalUses}</p>
                <p className="text-xs text-muted-foreground">Total de usos</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <DollarSign className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{formatCurrency(stats.totalDiscountGiven)}</p>
                <p className="text-xs text-muted-foreground">Descontos concedidos</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por código ou nome..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
          <SelectTrigger className="w-full sm:w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os status</SelectItem>
            <SelectItem value="active">Ativos</SelectItem>
            <SelectItem value="inactive">Inativos</SelectItem>
            <SelectItem value="expired">Expirados</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Coupon List */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-foreground" />
        </div>
      ) : filteredCoupons.length === 0 ? (
        <div className="text-center py-16">
          <div className="mx-auto w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-4">
            <Ticket className="h-8 w-8 text-muted-foreground" />
          </div>
          {coupons.length === 0 ? (
            <>
              <h3 className="text-lg font-semibold mb-1">Nenhum cupom criado</h3>
              <p className="text-muted-foreground text-sm mb-4">Crie seu primeiro cupom de desconto para atrair mais clientes</p>
              <Button onClick={handleCreate}>
                <Plus className="h-4 w-4 mr-2" />
                Criar Cupom
              </Button>
            </>
          ) : (
            <>
              <h3 className="text-lg font-semibold mb-1">Nenhum resultado</h3>
              <p className="text-muted-foreground text-sm">Nenhum cupom corresponde aos filtros aplicados</p>
            </>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {filteredCoupons.map((coupon) => (
            <Card key={coupon.id} className="overflow-hidden">
              <CardContent className="p-4">
                <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                  {/* Left: Code & Name */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-mono font-bold text-base tracking-wider">{coupon.code}</span>
                      <CouponStatusBadge coupon={coupon} />
                      {coupon.applies_to === 'specific_products' && (
                        <Badge variant="outline" className="text-xs"><Tag className="h-3 w-3 mr-1" />Produtos</Badge>
                      )}
                      {coupon.applies_to === 'specific_categories' && (
                        <Badge variant="outline" className="text-xs"><Tag className="h-3 w-3 mr-1" />Categorias</Badge>
                      )}
                    </div>
                    {coupon.name && (
                      <p className="text-sm text-muted-foreground truncate">{coupon.name}</p>
                    )}
                    <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground flex-wrap">
                      <span className="flex items-center gap-1">
                        {coupon.discount_type === 'percentage'
                          ? <><Percent className="h-3 w-3" /> {coupon.discount_value}%</>
                          : <><DollarSign className="h-3 w-3" /> {formatCurrency(coupon.discount_value)}</>
                        }
                        {coupon.discount_type === 'percentage' && coupon.max_discount_amount && (
                          <span className="text-muted-foreground/70">(max {formatCurrency(coupon.max_discount_amount)})</span>
                        )}
                      </span>
                      <span>
                        Usos: {coupon.current_uses}{coupon.max_uses ? `/${coupon.max_uses}` : ''}
                      </span>
                      {coupon.valid_until && (
                        <span>
                          Ate {format(new Date(coupon.valid_until), "dd/MM/yyyy", { locale: ptBR })}
                        </span>
                      )}
                      {coupon.min_order_value > 0 && (
                        <span>Min: {formatCurrency(coupon.min_order_value)}</span>
                      )}
                    </div>
                  </div>

                  {/* Right: Actions */}
                  <div className="flex items-center gap-1 shrink-0">
                    <Switch
                      checked={coupon.is_active}
                      onCheckedChange={(v) => toggleCouponActive(coupon.id, v)}
                      title={coupon.is_active ? 'Desativar' : 'Ativar'}
                    />
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleViewHistory(coupon)} title="Histórico de uso">
                      <History className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleEdit(coupon)} title="Editar">
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => duplicateCoupon(coupon.id)} title="Duplicar">
                      <Copy className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => setDeleteId(coupon.id)} title="Excluir">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create/Edit Dialog */}
      <CouponFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        coupon={editingCoupon}
        couponProductIds={editProductIds}
        couponCategoryIds={editCategoryIds}
        onSave={handleSave}
      />

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir cupom?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. O cupom será removido permanentemente.
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

      {/* Usage History Dialog */}
      <Dialog open={historyOpen} onOpenChange={setHistoryOpen}>
        <DialogContent className="max-w-md max-h-[70vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Histórico de Uso - {historyCoupon?.code}</DialogTitle>
          </DialogHeader>
          {historyLoading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-foreground" />
            </div>
          ) : historyData.length === 0 ? (
            <p className="text-center text-muted-foreground py-8 text-sm">Nenhum uso registrado</p>
          ) : (
            <div className="space-y-2">
              {historyData.map(usage => (
                <div key={usage.id} className="flex items-center justify-between py-2 border-b last:border-0">
                  <div>
                    <p className="text-sm font-medium">{usage.customer_whatsapp || 'Cliente'}</p>
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(usage.used_at), "dd/MM/yyyy 'as' HH:mm", { locale: ptBR })}
                    </p>
                  </div>
                  <span className="text-sm font-semibold text-primary">
                    -{formatCurrency(usage.discount_applied)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
