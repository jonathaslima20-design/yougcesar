import { Package, FolderOpen, CircleArrowUp as ArrowUpCircle } from 'lucide-react';
import { usePlanLimits } from '@/hooks/usePlanLimits';
import { useSubscriptionModal } from '@/contexts/SubscriptionModalContext';

interface PlanUsageIndicatorProps {
  expanded?: boolean;
}

export default function PlanUsageIndicator({ expanded = true }: PlanUsageIndicatorProps) {
  const { isFreePlan, productCount, productLimit, categoryCount, categoryLimit, loading } = usePlanLimits();
  const { openModal } = useSubscriptionModal();

  if (!isFreePlan || loading) return null;

  const productPct = productLimit ? Math.min((productCount / productLimit) * 100, 100) : 0;
  const categoryPct = categoryLimit ? Math.min((categoryCount / categoryLimit) * 100, 100) : 0;

  const barColor = (pct: number) => {
    if (pct >= 100) return 'bg-red-500';
    if (pct >= 70) return 'bg-amber-400';
    return 'bg-primary';
  };

  const countColor = (pct: number) => {
    if (pct >= 100) return 'text-red-500';
    if (pct >= 70) return 'text-amber-500';
    return 'text-muted-foreground';
  };

  if (!expanded) {
    return (
      <button
        onClick={() => openModal(false)}
        className="w-full flex justify-center py-2 rounded-md hover:bg-muted/60 transition-colors group"
        title="Plano Free — ver limites"
      >
        <ArrowUpCircle className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
      </button>
    );
  }

  return (
    <div className="px-3 pb-3">
      <div className="rounded-lg border border-border bg-muted/50 p-3 space-y-2.5">

        <div className="flex items-center justify-between">
          <span className="section-label">Plano Free</span>
          <button
            onClick={() => openModal(false)}
            className="inline-flex items-center gap-1 rounded-full bg-primary px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary-foreground hover:bg-primary/80 transition-colors"
          >
            <ArrowUpCircle className="h-2.5 w-2.5" />
            Upgrade
          </button>
        </div>

        <div className="border-t border-border" />

        <div className="space-y-2">
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                <Package className="h-3 w-3 shrink-0" />
                Produtos
              </span>
              <span className={`text-[11px] font-semibold tabular-nums ${countColor(productPct)}`}>
                {productCount}<span className="font-normal opacity-50">/{productLimit}</span>
              </span>
            </div>
            <div className="h-1 w-full bg-muted rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${barColor(productPct)}`}
                style={{ width: `${productPct}%` }}
              />
            </div>
          </div>

          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                <FolderOpen className="h-3 w-3 shrink-0" />
                Categorias
              </span>
              <span className={`text-[11px] font-semibold tabular-nums ${countColor(categoryPct)}`}>
                {categoryCount}<span className="font-normal opacity-50">/{categoryLimit}</span>
              </span>
            </div>
            <div className="h-1 w-full bg-muted rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${barColor(categoryPct)}`}
                style={{ width: `${categoryPct}%` }}
              />
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
