import { Badge } from '@/components/ui/badge';
import type { BillingCycle } from '@/types';

interface PlanTypeBadgeProps {
  billingCycle?: BillingCycle;
  className?: string;
}

export default function PlanTypeBadge({ billingCycle, className }: PlanTypeBadgeProps) {
  if (!billingCycle) {
    return (
      <Badge variant="outline" className={className}>
        Sem Plano
      </Badge>
    );
  }

  switch (billingCycle) {
    case 'monthly':
      return (
        <Badge className={`bg-blue-500 hover:bg-blue-600 text-white ${className}`}>
          Mensal
        </Badge>
      );
    case 'quarterly':
      return (
        <Badge className={`bg-amber-500 hover:bg-amber-600 text-white ${className}`}>
          Trimestral
        </Badge>
      );
    case 'semiannually':
      return (
        <Badge className={`bg-cyan-500 hover:bg-cyan-600 text-white ${className}`}>
          Semestral
        </Badge>
      );
    case 'annually':
      return (
        <Badge className={`bg-green-600 hover:bg-green-700 text-white ${className}`}>
          Anual
        </Badge>
      );
    default:
      return (
        <Badge variant="outline" className={className}>
          {billingCycle}
        </Badge>
      );
  }
}
