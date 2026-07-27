import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { OrderPaymentStatus } from '@/types';

const PAYMENT_STATUS_CONFIG: Record<OrderPaymentStatus, { label: string; className: string }> = {
  not_applicable: { label: 'Sem pagamento online', className: 'bg-muted text-muted-foreground border-border' },
  pending: { label: 'Pagamento pendente', className: 'bg-amber-500/10 text-amber-600 border-amber-500/20' },
  approved: { label: 'Pagamento aprovado', className: 'bg-green-500/10 text-green-600 border-green-500/20' },
  rejected: { label: 'Pagamento recusado', className: 'bg-destructive/10 text-destructive border-destructive/20' },
  refunded: { label: 'Reembolsado', className: 'bg-muted text-muted-foreground border-border' },
  cancelled: { label: 'Cancelado', className: 'bg-destructive/10 text-destructive border-destructive/20' },
};

interface PaymentStatusBadgeProps {
  status?: OrderPaymentStatus | null;
  className?: string;
}

export default function PaymentStatusBadge({ status, className }: PaymentStatusBadgeProps) {
  const config = PAYMENT_STATUS_CONFIG[status || 'not_applicable'];

  return (
    <Badge variant="outline" className={cn('font-medium', config.className, className)}>
      {config.label}
    </Badge>
  );
}

export { PAYMENT_STATUS_CONFIG };
