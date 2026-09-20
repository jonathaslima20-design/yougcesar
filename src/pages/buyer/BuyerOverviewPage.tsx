import { useEffect, useState } from 'react';
import { Navigate, Link } from 'react-router-dom';
import { Wallet, Medal, Package, MapPin, ArrowRight } from 'lucide-react';
import { useBuyerAuth } from '@/contexts/BuyerAuthContext';
import { useBuyerAccountSummary } from '@/hooks/useBuyerAccountSummary';
import { useLastStoreCashbackEnabled } from '@/hooks/useLastStoreCashbackEnabled';
import { supabaseBuyer } from '@/lib/supabaseBuyer';
import { fetchCustomerAddresses, type CustomerAddress } from '@/lib/customerAddressService';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import OrderStatusBadge from '@/components/orders/OrderStatusBadge';
import type { OrderStatus } from '@/types';

interface RecentOrder {
  id: string;
  store_owner_id: string;
  status: OrderStatus;
  total: number;
  created_at: string;
}

interface StoreInfo {
  name: string;
  slug: string;
}

function formatMoney(value: number) {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatMemberSince(dateStr?: string) {
  if (!dateStr) return null;
  return new Date(dateStr).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
}

export default function BuyerOverviewPage() {
  const { customer, loading: authLoading } = useBuyerAuth();
  const summary = useBuyerAccountSummary(customer?.id);
  const cashbackAvailable = useLastStoreCashbackEnabled();
  const [recentOrders, setRecentOrders] = useState<RecentOrder[]>([]);
  const [stores, setStores] = useState<Record<string, StoreInfo>>({});
  const [defaultAddress, setDefaultAddress] = useState<CustomerAddress | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!customer) return;

    (async () => {
      setLoading(true);
      const [{ data: orderRows }, addresses] = await Promise.all([
        supabaseBuyer
          .from('orders')
          .select('id, store_owner_id, status, total, created_at')
          .order('created_at', { ascending: false })
          .limit(3),
        fetchCustomerAddresses(customer.id).catch(() => []),
      ]);

      const rows = orderRows || [];
      setRecentOrders(rows);
      setDefaultAddress(addresses.find((a) => a.is_default) || addresses[0] || null);

      const storeIds = [...new Set(rows.map((o) => o.store_owner_id))];
      if (storeIds.length > 0) {
        const { data: storeRows } = await supabaseBuyer.from('users').select('id, name, slug').in('id', storeIds);
        const map: Record<string, StoreInfo> = {};
        (storeRows || []).forEach((s: { id: string; name: string; slug: string }) => {
          map[s.id] = { name: s.name, slug: s.slug };
        });
        setStores(map);
      }

      setLoading(false);
    })();
  }, [customer]);

  if (!authLoading && !customer) {
    return <Navigate to="/conta/entrar" state={{ from: '/conta' }} replace />;
  }

  const memberSince = formatMemberSince(customer?.created_at);

  return (
    <div className="container mx-auto p-4 md:p-6 max-w-2xl space-y-6">
      <Card>
        <CardContent className="pt-5 pb-5 px-5 flex items-center gap-4">
          <Avatar className="h-14 w-14 ring-1 ring-border">
            <AvatarImage src={customer?.avatar_url || undefined} alt={customer?.full_name} />
            <AvatarFallback className="text-lg font-semibold">{customer?.full_name?.[0] || 'C'}</AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <h1 className="text-lg font-semibold truncate">{customer?.full_name}</h1>
            <p className="text-xs text-muted-foreground">
              {memberSince ? `Cliente desde ${memberSince}` : customer?.email}
            </p>
          </div>
        </CardContent>
      </Card>

      <div className={`grid gap-3 ${cashbackAvailable ? 'grid-cols-3' : 'grid-cols-2'}`}>
        {cashbackAvailable && (
          <Card>
            <CardContent className="pt-4 pb-3 px-3">
              <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center mb-2">
                <Wallet className="h-4 w-4 text-primary" />
              </div>
              {summary.loading ? (
                <Skeleton className="h-6 w-16" />
              ) : (
                <p className="text-base md:text-xl font-bold truncate">{formatMoney(summary.cashbackTotal)}</p>
              )}
              <p className="text-[11px] text-muted-foreground">Cashback</p>
            </CardContent>
          </Card>
        )}
        <Card>
          <CardContent className="pt-4 pb-3 px-3">
            <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center mb-2">
              <Medal className="h-4 w-4 text-primary" />
            </div>
            <p className="text-base md:text-xl font-bold truncate">{summary.tier.label}</p>
            <p className="text-[11px] text-muted-foreground">Nível</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 px-3">
            <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center mb-2">
              <Package className="h-4 w-4 text-primary" />
            </div>
            <p className="text-base md:text-xl font-bold truncate">{summary.activeOrdersCount}</p>
            <p className="text-[11px] text-muted-foreground">Pedidos ativos</p>
          </CardContent>
        </Card>
      </div>

      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold">Pedidos recentes</h2>
          <Link to="/conta/pedidos" className="text-xs text-primary hover:underline flex items-center gap-1">
            Ver todos <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
        {authLoading || loading ? (
          <div className="space-y-2">
            {[0, 1].map((i) => (
              <Skeleton key={i} className="h-16 w-full rounded-lg" />
            ))}
          </div>
        ) : recentOrders.length === 0 ? (
          <Card>
            <CardContent className="py-6 text-center text-sm text-muted-foreground">
              Você ainda não fez nenhum pedido.
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {recentOrders.map((order) => (
              <Link
                key={order.id}
                to={`/conta/pedidos/${order.id}`}
                className="flex items-center justify-between border border-border rounded-lg p-3 hover:bg-muted/40 transition-colors"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{stores[order.store_owner_id]?.name || 'Loja'}</p>
                  <div className="mt-1">
                    <OrderStatusBadge status={order.status} />
                  </div>
                </div>
                <p className="text-sm font-semibold shrink-0">{formatMoney(order.total)}</p>
              </Link>
            ))}
          </div>
        )}
      </div>

      {defaultAddress && (
        <div>
          <h2 className="text-sm font-semibold mb-3">Endereço padrão</h2>
          <Card>
            <CardContent className="py-4 px-4 flex items-start gap-3">
              <MapPin className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
              <div className="text-sm">
                <p className="font-medium">{defaultAddress.label}</p>
                <p className="text-muted-foreground">
                  {defaultAddress.street}, {defaultAddress.number} — {defaultAddress.city}/{defaultAddress.state}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
