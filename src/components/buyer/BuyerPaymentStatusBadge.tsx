import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

const PAYMENT_CONFIG: Record<string, { label: string; dot: string; className: string }> = {
  not_applicable: {
    label: 'Sem pagamento online',
    dot: 'bg-muted-foreground',
    className: 'bg-muted text-muted-foreground border-border',
  },
  pending: {
    label: 'Pagamento pendente',
    dot: 'bg-amber-500',
    className: 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/25',
  },
  approved: {
    label: 'Pagamento aprovado',
    dot: 'bg-green-500',
    className: 'bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/25',
  },
  rejected: {
    label: 'Pagamento recusado',
    dot: 'bg-destructive',
    className: 'bg-destructive/10 text-destructive border-destructive/25',
  },
  refunded: {
    label: 'Reembolsado',
    dot: 'bg-muted-foreground',
    className: 'bg-muted text-muted-foreground border-border',
  },
  cancelled: {
    label: 'Pagamento cancelado',
    dot: 'bg-destructive',
    className: 'bg-destructive/10 text-destructive border-destructive/25',
  },
};

// Buyer-facing payment status with a colored dot (same language as OrderStatusBadge colorful mode).
// Separate from components/orders/PaymentStatusBadge, which the merchant dashboard uses.
export default function PaymentStatusBadge({ status, className }: { status: string; className?: string }) {
  const config = PAYMENT_CONFIG[status] || PAYMENT_CONFIG.not_applicable;
  return (
    <Badge variant="outline" className={cn('font-medium gap-1.5 whitespace-nowrap', config.className, className)}>
      <span className={cn('h-1.5 w-1.5 rounded-full shrink-0', config.dot)} aria-hidden />
      {config.label}
    </Badge>
  );
}
