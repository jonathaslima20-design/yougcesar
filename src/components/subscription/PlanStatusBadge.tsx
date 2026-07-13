import { Badge } from '@/components/ui/badge';
import { Gem, CircleAlert as AlertCircle, Ban, Package, Clock } from 'lucide-react';
import type { BillingCycle, PlanStatus } from '@/types';

interface PlanStatusBadgeProps {
  status?: PlanStatus;
  billingCycle?: BillingCycle;
  className?: string;
}

function getBillingCycleLabel(cycle: BillingCycle): string {
  switch (cycle) {
    case 'monthly': return 'Mensal';
    case 'quarterly': return 'Trimestral';
    case 'semiannually': return 'Semestral';
    case 'annually': return 'Anual';
  }
}

export default function PlanStatusBadge({ status, billingCycle, className }: PlanStatusBadgeProps) {
  const label = billingCycle ? getBillingCycleLabel(billingCycle) : undefined;

  switch (status) {
    case 'active':
      return (
        <Badge className={`bg-foreground text-background hover:bg-foreground/90 ${className || ''}`}>
          <Gem className="h-3 w-3 mr-1" />
          {label ?? 'Ativo'}
        </Badge>
      );
    case 'free':
      return (
        <Badge variant="outline" className={className}>
          <Package className="h-3 w-3 mr-1" />
          Free
        </Badge>
      );
    case 'expired':
      return (
        <Badge variant="outline" className={`border-amber-300 bg-amber-50 text-amber-800 ${className || ''}`}>
          <Clock className="h-3 w-3 mr-1" />
          {label ? `${label} (Expirado)` : 'Expirado'}
        </Badge>
      );
    case 'suspended':
      return (
        <Badge variant="destructive" className={className}>
          <Ban className="h-3 w-3 mr-1" />
          {label ? `${label} (Suspenso)` : 'Suspenso'}
        </Badge>
      );
    default:
      return (
        <Badge variant="outline" className={className}>
          <AlertCircle className="h-3 w-3 mr-1" />
          Sem Plano
        </Badge>
      );
  }
}
