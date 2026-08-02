import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Copy, MousePointerClick, ShoppingBag, Wallet, TrendingUp, Loader, MessageCircle, Download } from 'lucide-react';
import { toast } from 'sonner';
import QRCode from 'qrcode';
import { useAffiliateAuth } from '@/contexts/AffiliateAuthContext';
import { supabaseAffiliate } from '@/lib/supabaseAffiliate';
import { generateAffiliateLink } from '@/lib/affiliateUtils';
import { downloadCSV } from '@/lib/csvUtils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

interface CommissionRow {
  id: string;
  product_name_snapshot: string | null;
  category_matched: string | null;
  commission_amount: number;
  status: 'pending' | 'paid' | 'reversed';
  created_at: string;
}

function escapeCsv(val: string): string {
  if (val.includes(',') || val.includes('"') || val.includes('\n')) {
    return `"${val.replace(/"/g, '""')}"`;
  }
  return val;
}

export default function AffiliateDashboardPage() {
  const { affiliate } = useAffiliateAuth();
  const [storeSlug, setStoreSlug] = useState<string | null>(null);
  const [storeName, setStoreName] = useState<string>('');
  const [clicksCount, setClicksCount] = useState(0);
  const [ordersCount, setOrdersCount] = useState(0);
  const [commissions, setCommissions] = useState<CommissionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!affiliate) return;

    const load = async () => {
      setLoading(true);
      try {
        const [storeRes, clicksRes, ordersRes, commissionsRes] = await Promise.all([
          supabaseAffiliate.from('users').select('slug, name').eq('id', affiliate.store_owner_id).maybeSingle(),
          supabaseAffiliate.from('affiliate_clicks').select('id', { count: 'exact', head: true }).eq('affiliate_id', affiliate.id),
          supabaseAffiliate.from('orders').select('id', { count: 'exact', head: true }).eq('affiliate_id', affiliate.id),
          supabaseAffiliate
            .from('affiliate_commissions')
            .select('id, product_name_snapshot, category_matched, commission_amount, status, created_at')
            .eq('affiliate_id', affiliate.id)
            .order('created_at', { ascending: false })
            .limit(50),
        ]);

        setStoreSlug(storeRes.data?.slug || null);
        setStoreName(storeRes.data?.name || '');
        setClicksCount(clicksRes.count || 0);
        setOrdersCount(ordersRes.count || 0);
        setCommissions(commissionsRes.data || []);
      } catch (err) {
        console.error('Error loading affiliate dashboard:', err);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [affiliate]);

  const link = affiliate && storeSlug ? generateAffiliateLink(storeSlug, affiliate.affiliate_code) : '';

  useEffect(() => {
    if (!link) {
      setQrDataUrl(null);
      return;
    }
    QRCode.toDataURL(link, { width: 160, margin: 1 })
      .then(setQrDataUrl)
      .catch((err) => console.error('Error generating QR code:', err));
  }, [link]);

  const pendingCommissions = useMemo(() => commissions.filter(c => c.status === 'pending'), [commissions]);
  const paidCommissions = useMemo(() => commissions.filter(c => c.status === 'paid'), [commissions]);

  if (!affiliate) return null;

  const pending = pendingCommissions.reduce((sum, c) => sum + Number(c.commission_amount), 0);
  const paid = paidCommissions.reduce((sum, c) => sum + Number(c.commission_amount), 0);
  const conversionRate = clicksCount > 0 ? (ordersCount / clicksCount) * 100 : 0;

  const handleCopyLink = () => {
    if (!link) return;
    navigator.clipboard.writeText(link);
    toast.success('Link copiado');
  };

  const handleShareWhatsApp = () => {
    if (!link) return;
    const message = `Confira ${storeName ? `a loja ${storeName}` : 'essa loja'}! ${link}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, '_blank');
  };

  const handleExportCSV = (rows: CommissionRow[], filename: string) => {
    const headers = ['produto', 'categoria', 'valor', 'status', 'data'];
    const csvRows = rows.map(c => [
      escapeCsv(c.product_name_snapshot || 'Produto'),
      escapeCsv(c.category_matched || 'comissão geral'),
      String(c.commission_amount),
      c.status,
      format(new Date(c.created_at), 'yyyy-MM-dd'),
    ]);
    const csv = [headers.join(','), ...csvRows.map(r => r.join(','))].join('\n');
    downloadCSV(csv, filename);
  };

  return (
    <div className="w-full px-4 sm:px-6 lg:px-8 py-6 max-w-3xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Olá, {affiliate.name.split(' ')[0]}</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {storeName ? `Painel de afiliado da loja ${storeName}` : 'Painel de afiliado'}
          </p>
        </div>

        {affiliate.status === 'inactive' && (
          <Card className="border-destructive/40">
            <CardContent className="pt-4 pb-4 text-sm text-destructive">
              Sua conta de afiliado está desativada pelo lojista. Novos cliques no seu link não geram comissão até ela ser reativada.
            </CardContent>
          </Card>
        )}

        <Card>
          <CardContent className="pt-5 pb-5">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium mb-2">Seu link de indicação</p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 text-xs sm:text-sm bg-muted px-3 py-2 rounded truncate">{link || 'carregando...'}</code>
                  <Button size="icon" variant="outline" onClick={handleCopyLink} disabled={!link}>
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
                <Button variant="outline" className="mt-3 w-full sm:w-auto" onClick={handleShareWhatsApp} disabled={!link}>
                  <MessageCircle className="h-4 w-4 mr-2" />
                  Compartilhar no WhatsApp
                </Button>
              </div>
              {qrDataUrl && (
                <div className="flex flex-col items-center gap-1 shrink-0">
                  <img src={qrDataUrl} alt="QR code do link de afiliado" className="rounded border" width={120} height={120} />
                  <span className="text-[11px] text-muted-foreground">QR code do link</span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Card>
            <CardContent className="pt-4 pb-4">
              <MousePointerClick className="h-4 w-4 text-muted-foreground mb-1" />
              <p className="text-xl font-bold">{clicksCount}</p>
              <p className="text-xs text-muted-foreground">Cliques</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-4">
              <ShoppingBag className="h-4 w-4 text-muted-foreground mb-1" />
              <p className="text-xl font-bold">{ordersCount}</p>
              <p className="text-xs text-muted-foreground">Pedidos</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-4">
              <TrendingUp className="h-4 w-4 text-muted-foreground mb-1" />
              <p className="text-xl font-bold">{conversionRate.toFixed(1)}%</p>
              <p className="text-xs text-muted-foreground">Conversão</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-4">
              <Wallet className="h-4 w-4 text-muted-foreground mb-1" />
              <p className="text-xl font-bold">{formatCurrency(pending)}</p>
              <p className="text-xs text-muted-foreground">A receber</p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Extrato de comissões</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex justify-center py-8">
                <Loader className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : commissions.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                Nenhuma comissão ainda. Compartilhe seu link para começar a vender.
              </p>
            ) : (
              <Tabs defaultValue="pending">
                <div className="flex items-center justify-between gap-2 mb-3">
                  <TabsList>
                    <TabsTrigger value="pending">Pendente ({pendingCommissions.length})</TabsTrigger>
                    <TabsTrigger value="paid">Histórico de pagamentos ({paidCommissions.length})</TabsTrigger>
                  </TabsList>
                </div>

                <TabsContent value="pending" className="space-y-2 mt-0">
                  {pendingCommissions.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-6">Nenhuma comissão pendente.</p>
                  ) : (
                    <>
                      <div className="flex justify-end">
                        <Button variant="ghost" size="sm" className="text-xs gap-1.5" onClick={() => handleExportCSV(pendingCommissions, 'comissoes_pendentes.csv')}>
                          <Download className="h-3.5 w-3.5" /> Exportar CSV
                        </Button>
                      </div>
                      {pendingCommissions.map((c) => (
                        <CommissionRowItem key={c.id} commission={c} />
                      ))}
                    </>
                  )}
                </TabsContent>

                <TabsContent value="paid" className="space-y-2 mt-0">
                  {paidCommissions.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-6">Nenhum pagamento registrado ainda.</p>
                  ) : (
                    <>
                      <div className="flex justify-end">
                        <Button variant="ghost" size="sm" className="text-xs gap-1.5" onClick={() => handleExportCSV(paidCommissions, 'comissoes_pagas.csv')}>
                          <Download className="h-3.5 w-3.5" /> Exportar CSV
                        </Button>
                      </div>
                      {paidCommissions.map((c) => (
                        <CommissionRowItem key={c.id} commission={c} />
                      ))}
                    </>
                  )}
                </TabsContent>
              </Tabs>
            )}
          </CardContent>
        </Card>

        <p className="text-xs text-center text-muted-foreground">
          Total já pago: {formatCurrency(paid)} · <Link to="/afiliado/perfil" className="underline">Editar perfil</Link>
        </p>
    </div>
  );
}

function CommissionRowItem({ commission: c }: { commission: CommissionRow }) {
  return (
    <div className="flex items-center justify-between py-2 border-b last:border-0 text-sm">
      <div className="min-w-0">
        <p className="font-medium truncate">{c.product_name_snapshot || 'Produto'}</p>
        <p className="text-xs text-muted-foreground">
          {c.category_matched || 'comissão geral'} · {format(new Date(c.created_at), "dd/MM/yyyy", { locale: ptBR })}
        </p>
      </div>
      <div className="text-right shrink-0 ml-3">
        <p className="font-semibold">{formatCurrency(c.commission_amount)}</p>
        <Badge
          variant={c.status === 'paid' ? 'default' : c.status === 'reversed' ? 'secondary' : 'outline'}
          className="text-xs"
        >
          {c.status === 'paid' ? 'Paga' : c.status === 'reversed' ? 'Estornada' : 'Pendente'}
        </Badge>
      </div>
    </div>
  );
}
