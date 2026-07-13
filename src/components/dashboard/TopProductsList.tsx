import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader as Loader2, Eye, MessageSquare, Flame, Trophy } from 'lucide-react';
import { useProductRanking, RankedProduct } from '@/hooks/useProductRanking';

function Sparkline({ data }: { data: number[] }) {
  const max = Math.max(...data, 1);
  const height = 24;
  const width = 56;
  const step = width / (data.length - 1);

  const points = data.map((val, i) => {
    const x = i * step;
    const y = height - (val / max) * height;
    return `${x},${y}`;
  }).join(' ');

  return (
    <svg width={width} height={height} className="shrink-0">
      <polyline
        points={points}
        fill="none"
        stroke="hsl(var(--primary))"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ProductRankItem({ product, rank }: { product: RankedProduct; rank: number }) {
  return (
    <div className="flex items-center gap-3 py-2.5 border-b last:border-0 border-border/50">
      <span className="text-xs font-bold text-muted-foreground w-5 text-center">{rank}</span>

      <div className="h-9 w-9 rounded-md bg-muted overflow-hidden shrink-0">
        {product.featured_image_url ? (
          <img
            src={product.featured_image_url}
            alt={product.title}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="h-full w-full flex items-center justify-center">
            <Trophy className="h-4 w-4 text-muted-foreground" />
          </div>
        )}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 min-w-0">
          <p className="text-sm font-medium truncate">{product.title}</p>
          {product.trending && (
            <Flame className="h-3.5 w-3.5 text-sky-500 shrink-0" />
          )}
        </div>
        <div className="flex items-center gap-3 mt-0.5">
          <span className="text-xs text-muted-foreground flex items-center gap-0.5">
            <Eye className="h-3 w-3" /> {product.views}
          </span>
          <span className="text-xs text-muted-foreground flex items-center gap-0.5">
            <MessageSquare className="h-3 w-3" /> {product.leads}
          </span>
          <span className="text-xs text-emerald-600 font-medium">
            {product.conversionRate.toFixed(1)}%
          </span>
        </div>
      </div>

      <div className="hidden sm:block">
        <Sparkline data={product.weeklyViews} />
      </div>
    </div>
  );
}

interface TopProductsListProps {
  periodDays?: number;
}

export function TopProductsList({ periodDays = 30 }: TopProductsListProps) {
  const { topProducts, loading } = useProductRanking(periodDays);

  if (!loading && topProducts.length === 0) return null;

  return (
    <Card className="flex-1 overflow-hidden min-w-0">
      <CardHeader>
        <CardTitle className="text-lg font-semibold flex items-center gap-2">
          <Trophy className="h-5 w-5 text-muted-foreground" />
          Top Produtos
        </CardTitle>
        <p className="text-sm text-muted-foreground">Mais visualizados nos últimos {periodDays} dias</p>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="divide-y-0">
            {topProducts.map((product, i) => (
              <ProductRankItem key={product.id} product={product} rank={i + 1} />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
