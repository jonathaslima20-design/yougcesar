import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { Wallet, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { useBuyerAuth } from '@/contexts/BuyerAuthContext';
import { useBuyerStore } from '@/contexts/BuyerStoreContext';
import { supabaseBuyer } from '@/lib/supabaseBuyer';
import { Card, CardContent } from '@/components/ui/card';
import { SectionTitle } from '@/components/buyer/overview/BuyerOverviewCards';
import { Skeleton } from '@/components/ui/skeleton';

interface CashbackTransactionRow {
  id: string;
  order_id: string;
  type: 'earned' | 'redeemed';
  amount: number;
  created_at: string;
}

function formatMoney(value: number) {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export default function BuyerCashbackPage() {
  const { customer, loading: authLoading } = useBuyerAuth();
  const { store, path, loginPath } = useBuyerStore();
  const [balance, setBalance] = useState(0);
  const [transactions, setTransactions] = useState<CashbackTransactionRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!customer || !store) return;

    (async () => {
      setLoading(true);
      const [{ data: balanceRow }, { data: txRows }] = await Promise.all([
        supabaseBuyer.from('cashback_balances').select('balance').eq('store_owner_id', store.id).maybeSingle(),
        supabaseBuyer
          .from('cashback_transactions')
          .select('id, order_id, type, amount, created_at')
          .eq('store_owner_id', store.id)
          .order('created_at', { ascending: false })
          .limit(30),
      ]);

      setBalance(balanceRow?.balance || 0);
      setTransactions(txRows || []);
      setLoading(false);
    })();
  }, [customer, store]);

  if (!authLoading && !customer) {
    return <Navigate to={loginPath} state={{ from: path('/cashback') }} replace />;
  }

  return (
    <div className="container mx-auto p-4 md:p-6 max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl page-title">Meu Cashback</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Saldo de cashback em {store?.name || 'esta loja'}, para usar na sua próxima compra
        </p>
      </div>

      <Card>
        <CardContent className="pt-5 pb-5 px-5">
          <p className="text-xs text-muted-foreground flex items-center gap-1.5 mb-1.5">
            <Wallet className="h-3.5 w-3.5" />
            Saldo disponível
          </p>
          {authLoading || loading ? (
            <Skeleton className="h-9 w-32" />
          ) : (
            <p className="text-3xl font-bold">{formatMoney(balance)}</p>
          )}
        </CardContent>
      </Card>

      {!loading && transactions.length > 0 && (
        <div>
        <SectionTitle>Histórico</SectionTitle>
        <Card>
          <CardContent className="pt-5">
            <div className="space-y-2">
              {transactions.map((tx) => {
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
                        <p className="truncate">{isEarned ? 'Cashback recebido' : 'Cashback usado'}</p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(tx.created_at).toLocaleDateString('pt-BR')}
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
        </div>
      )}
    </div>
  );
}
