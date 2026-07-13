import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader as Loader2, TrendingUp, TrendingDown, Filter } from 'lucide-react';
import { useSalesFunnel, FunnelStage } from '@/hooks/useSalesFunnel';

function FunnelBar({ stage, maxValue, index }: { stage: FunnelStage; maxValue: number; index: number }) {
  const widthPercent = maxValue > 0 ? Math.max((stage.value / maxValue) * 100, 8) : 8;

  const colors = [
    'bg-primary',
    'bg-primary/80',
    'bg-primary/60',
    'bg-primary/45',
    'bg-primary/30',
  ];

  return (
    <div className="flex items-center gap-2 sm:gap-3">
      <div className="w-20 sm:w-24 shrink-0">
        <p className="text-[11px] sm:text-xs font-medium text-foreground truncate">{stage.label}</p>
      </div>
      <div className="flex-1">
        <div className="relative h-6 sm:h-7 bg-muted/50 rounded-md overflow-hidden">
          <div
            className={`absolute left-0 top-0 h-full ${colors[index]} rounded-md transition-all duration-700 ease-out flex items-center justify-end pr-2`}
            style={{ width: `${widthPercent}%` }}
          >
            <span className="text-[11px] sm:text-xs font-bold text-white">
              {stage.value}
            </span>
          </div>
        </div>
      </div>
      <div className="hidden sm:block w-16 shrink-0 text-right">
        {stage.change !== 0 && (
          <div className="flex items-center justify-end gap-0.5">
            {stage.change > 0 ? (
              <TrendingUp className="h-3 w-3 text-muted-foreground" />
            ) : (
              <TrendingDown className="h-3 w-3 text-muted-foreground" />
            )}
            <span className="text-xs font-medium text-muted-foreground">
              {stage.change > 0 ? '+' : ''}{stage.change.toFixed(0)}%
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

function ConversionRate({ from, to }: { from: FunnelStage; to: FunnelStage }) {
  const rate = from.value > 0 ? ((to.value / from.value) * 100).toFixed(1) : '0.0';

  return (
    <div className="flex items-center justify-center pl-20 sm:pl-24 ml-2 sm:ml-3">
      <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-muted/80">
        <span className="text-[10px] text-muted-foreground">{rate}%</span>
      </div>
    </div>
  );
}

interface SalesFunnelProps {
  periodDays?: number;
}

export function SalesFunnel({ periodDays = 30 }: SalesFunnelProps) {
  const { stages, loading } = useSalesFunnel(periodDays);

  const maxValue = stages.length > 0 ? Math.max(...stages.map(s => s.value), 1) : 1;

  // Find bottleneck
  let bottleneckIndex = -1;
  let worstConversion = 100;
  for (let i = 0; i < stages.length - 1; i++) {
    if (stages[i].value > 0) {
      const rate = (stages[i + 1].value / stages[i].value) * 100;
      if (rate < worstConversion) {
        worstConversion = rate;
        bottleneckIndex = i;
      }
    }
  }

  return (
    <Card className="flex-1 overflow-hidden min-w-0">
      <CardHeader>
        <CardTitle className="text-lg font-semibold flex items-center gap-2">
          <Filter className="h-5 w-5 text-muted-foreground" />
          Funil de Vendas
        </CardTitle>
        <p className="text-sm text-muted-foreground">Últimos {periodDays} dias vs período anterior</p>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-1">
            {stages.map((stage, i) => (
              <div key={stage.label}>
                <FunnelBar stage={stage} maxValue={maxValue} index={i} />
                {i < stages.length - 1 && (
                  <ConversionRate from={stages[i]} to={stages[i + 1]} />
                )}
              </div>
            ))}

            {bottleneckIndex >= 0 && worstConversion < 50 && (
              <div className="mt-4 pt-3 border-t">
                <p className="text-xs text-muted-foreground">
                  <span className="font-semibold text-foreground">Gargalo:</span>{' '}
                  A maior perda está entre {stages[bottleneckIndex].label} e {stages[bottleneckIndex + 1].label} ({worstConversion.toFixed(1)}% de conversão)
                </p>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
