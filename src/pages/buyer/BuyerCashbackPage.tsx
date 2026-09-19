import { useEffect, useState } from 'react';
import { Navigate, Link } from 'react-router-dom';
import { Wallet, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { useBuyerAuth } from '@/contexts/BuyerAuthContext';
import { supabaseBuyer } from '@/lib/supabaseBuyer';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

interface CashbackBalanceRow {
  store_owner_id: string;
  balance: number;
}

interface CashbackTransactionRow {
  id: string;
  store_owner_id: string;
  order_id: string;
  type: 'earned' | 'redeemed';
  amount: number;
  created_at: string;
}

interface StoreInfo {
  name: string;
  slug: string;
}

function formatMoney(value: number) {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function BalancesSkeleton() {
  return (
    <div className="space-y-3">
      {[0, 1].map((i) => (
        <div key={i} className="flex items-center justify-between border border-border rounded-lg p-4">
          <div className="space-y-2">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3 w-20" />
          </div>
          <Skeleton className="h-6 w-20" />
        </div>
      ))}
    </div>
  );
}

export default function BuyerCashbackPage() {
  const { customer, loading: authLoading } = useBuyerAuth();
  const [balances, setBalances] = useState<CashbackBalanceRow[]>([]);
  const [transactions, setTransactions] = useState<CashbackTransactionRow[]>([]);
  const [stores, setStores] = useState<Record<string, StoreInfo>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!customer) return;

    (async () => {
      setLoading(true);
      const [{ data: balanceRows }, { data: txRows }] = await Promise.all([
        supabaseBuyer
          .from('cashback_balances')
          .select('store_owner_id, balance')
          .gt('balance', 0)
          .order('balance', { ascending: false }),
        supabaseBuyer
          .from('cashback_transactions')
          .select('id, store_owner_id, order_id, type, amount, created_at')
          .order('created_at', { ascending: false })
          .limit(30),
      ]);

      setBalances(balanceRows || []);
      setTransactions(txRows || []);

      const storeIds = [...new Set([...(balanceRows || []).map((b) => b.store_owner_id), ...(txRows || []).map((t) => t.store_owner_id)])];
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
    return <Navigate to="/conta/entrar" state={{ from: '/conta/cashback' }} replace />;
  }

  const totalBalance = balances.reduce((sum, b) => sum + b.balance, 0);

  return (
    <div className="container mx-auto p-4 md:p-6 max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl page-title">Meu Cashback</h1>
        <p className="text-sm text-muted-foreground mt-1">Saldo de cashback por loja, para usar na sua próxima compra</p>
      </div>

      {!loading && balances.length > 0 && (
        <Card>
          <CardContent className="pt-4 pb-4 px-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <Wallet className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold">{formatMoney(totalBalance)}</p>
              <p className="text-xs text-muted-foreground">Saldo total em todas as lojas</p>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Saldo por loja</CardTitle>
        </CardHeader>
        <CardContent>
          {authLoading || loading ? (
            <BalancesSkeleton />
          ) : balances.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Wallet className="h-10 w-10 mx-auto mb-3 opacity-50" />
              <p>Você ainda não tem saldo de cashback em nenhuma loja.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {balances.map((b) => {
                const store = stores[b.store_owner_id];
                return (
                  <div key={b.store_owner_id} className="flex items-center justify-between border border-border rounded-lg p-4">
                    <div>
                      <p className="font-medium">{store?.name || 'Loja'}</p>
                      {store?.slug && (
                        <Link to={`/${store.slug}`} className="text-xs text-primary hover:underline">
                          Visitar loja
                        </Link>
                      )}
                    </div>
                    <p className="font-semibold text-primary">{formatMoney(b.balance)}</p>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {!loading && transactions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Histórico</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {transactions.map((tx) => {
                const store = stores[tx.store_owner_id];
                const isEarned = tx.type === 'earned';
                return (
                  <div key={tx.id} className="flex items-center justify-between text-sm py-2 border-b border-border/60 last:border-0">
                    <div className="flex items-center gap-2 min-w-0">
                      {isEarned ? (
                        <ArrowUpRight className="h-4 w-4 text-green-600 dark:text-green-400 shrink-0" />
                      ) : (
                        <ArrowDownRight className="h-4 w-4 text-muted-foreground shrink-0" />
                      )}
                      <div className="min-w-0">
                        <p className="truncate">{store?.name || 'Loja'}</p>
                        <p className="text-xs text-muted-foreground">
                          {isEarned ? 'Cashback recebido' : 'Cashback usado'} · {new Date(tx.created_at).toLocaleDateString('pt-BR')}
                        </p>
                      </div>
                    </div>
                    <span className={isEarned ? 'text-green-600 dark:text-green-400 font-medium shrink-0' : 'text-muted-foreground shrink-0'}>
                      {isEarned ? '+' : '-'}{formatMoney(tx.amount)}
                    </span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
