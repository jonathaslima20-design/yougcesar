import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { Ticket, Percent, DollarSign, Copy, Check } from 'lucide-react';
import { toast } from 'sonner';
import { useBuyerAuth } from '@/contexts/BuyerAuthContext';
import { supabase } from '@/lib/supabase';
import { supabaseBuyer } from '@/lib/supabaseBuyer';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import type { Coupon } from '@/types';

interface StoreInfo {
  name: string;
  slug: string;
}

function formatMoney(value: number) {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function CouponCard({ coupon, storeName }: { coupon: Coupon; storeName: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(coupon.code);
    setCopied(true);
    toast.success('Código copiado!');
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border p-3">
      <div className="min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-mono font-semibold text-sm">{coupon.code}</span>
          <span className="text-xs text-muted-foreground flex items-center gap-1">
            {coupon.discount_type === 'percentage' ? (
              <>
                <Percent className="h-3 w-3" /> {coupon.discount_value}%
              </>
            ) : (
              <>
                <DollarSign className="h-3 w-3" /> {formatMoney(coupon.discount_value)}
              </>
            )}
          </span>
        </div>
        {coupon.name && <p className="text-sm text-muted-foreground truncate">{coupon.name}</p>}
        <p className="text-xs text-muted-foreground mt-0.5">
          {storeName}
          {coupon.min_order_value > 0 && ` · Pedido mínimo ${formatMoney(coupon.min_order_value)}`}
          {coupon.valid_until && ` · Válido até ${new Date(coupon.valid_until).toLocaleDateString('pt-BR')}`}
        </p>
      </div>
      <Button variant="outline" size="sm" onClick={handleCopy} className="shrink-0">
        {copied ? <Check className="h-3.5 w-3.5 text-green-600" /> : <Copy className="h-3.5 w-3.5" />}
      </Button>
    </div>
  );
}

export default function BuyerCouponsPage() {
  const { customer, loading: authLoading } = useBuyerAuth();
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [stores, setStores] = useState<Record<string, StoreInfo>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!customer) return;

    (async () => {
      setLoading(true);

      const { data: orderRows } = await supabaseBuyer.from('orders').select('store_owner_id');
      const storeIds = [...new Set((orderRows || []).map((o) => o.store_owner_id))];

      if (storeIds.length === 0) {
        setCoupons([]);
        setLoading(false);
        return;
      }

      const now = new Date().toISOString();
      const [{ data: couponRows }, { data: storeRows }] = await Promise.all([
        supabase
          .from('coupons')
          .select('*')
          .in('user_id', storeIds)
          .eq('is_active', true)
          .lte('valid_from', now)
          .or(`valid_until.is.null,valid_until.gte.${now}`),
        supabaseBuyer.from('users').select('id, name, slug').in('id', storeIds),
      ]);

      const map: Record<string, StoreInfo> = {};
      (storeRows || []).forEach((s: { id: string; name: string; slug: string }) => {
        map[s.id] = { name: s.name, slug: s.slug };
      });
      setStores(map);

      // "Expired by usage" isn't covered by the RLS filter above — mirrors
      // CouponsPage.tsx's getCouponStatus check on the merchant side.
      const valid = (couponRows || []).filter(
        (c) => c.max_uses == null || c.current_uses < c.max_uses
      );
      setCoupons(valid as Coupon[]);
      setLoading(false);
    })();
  }, [customer]);

  if (!authLoading && !customer) {
    return <Navigate to="/conta/entrar" state={{ from: '/conta/cupons' }} replace />;
  }

  const couponsByStore = coupons.reduce<Record<string, Coupon[]>>((acc, coupon) => {
    (acc[coupon.user_id] ||= []).push(coupon);
    return acc;
  }, {});

  return (
    <div className="container mx-auto p-4 md:p-6 max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl page-title">Cupons</h1>
        <p className="text-sm text-muted-foreground mt-1">Cupons ativos das lojas onde você já comprou</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Cupons Disponíveis</CardTitle>
        </CardHeader>
        <CardContent>
          {authLoading || loading ? (
            <div className="space-y-2">
              {[0, 1].map((i) => (
                <div key={i} className="h-16 rounded-lg border bg-muted/40 animate-pulse" />
              ))}
            </div>
          ) : coupons.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Ticket className="h-10 w-10 mx-auto mb-3 opacity-50" />
              <p>Nenhum cupom disponível no momento.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {Object.entries(couponsByStore).map(([storeOwnerId, storeCoupons]) => (
                <div key={storeOwnerId} className="space-y-2">
                  {storeCoupons.map((coupon) => (
                    <CouponCard
                      key={coupon.id}
                      coupon={coupon}
                      storeName={stores[storeOwnerId]?.name || 'Loja'}
                    />
                  ))}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
