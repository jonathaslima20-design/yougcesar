import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { OrderStatus } from '@/types';

const STATUS_CONFIG: Record<OrderStatus, { label: string; className: string }> = {
  pending: {
    label: 'Pendente',
    className: 'bg-muted text-muted-foreground border-border',
  },
  confirmed: {
    label: 'Confirmado',
    className: 'bg-primary/10 text-primary border-primary/20',
  },
  preparing: {
    label: 'Em preparo',
    className: 'bg-muted text-muted-foreground border-border',
  },
  shipped: {
    label: 'Enviado',
    className: 'bg-primary/10 text-primary border-primary/20',
  },
  delivered: {
    label: 'Entregue',
    className: 'bg-primary/15 text-primary border-primary/25',
  },
  cancelled: {
    label: 'Cancelado',
    className: 'bg-destructive/10 text-destructive border-destructive/20',
  },
};

// Semantic colors + a dot, used in the buyer area where status is the main thing
// the buyer scans for. The merchant dashboard keeps the neutral STATUS_CONFIG look.
const COLORFUL_CONFIG: Record<OrderStatus, { dot: string; className: string }> = {
  pending: {
    dot: 'bg-amber-500',
    className: 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/25',
  },
  confirmed: {
    dot: 'bg-blue-500',
    className: 'bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/25',
  },
  preparing: {
    dot: 'bg-blue-500',
    className: 'bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/25',
  },
  shipped: {
    dot: 'bg-indigo-500',
    className: 'bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 border-indigo-500/25',
  },
  delivered: {
    dot: 'bg-green-500',
    className: 'bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/25',
  },
  cancelled: {
    dot: 'bg-destructive',
    className: 'bg-destructive/10 text-destructive border-destructive/25',
  },
};

interface OrderStatusBadgeProps {
  status: OrderStatus;
  className?: string;
  colorful?: boolean;
}

export default function OrderStatusBadge({ status, className, colorful = false }: OrderStatusBadgeProps) {
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.pending;

  if (colorful) {
    const colors = COLORFUL_CONFIG[status] || COLORFUL_CONFIG.pending;
    return (
      <Badge variant="outline" className={cn('font-medium gap-1.5 whitespace-nowrap', colors.className, className)}>
        <span className={cn('h-1.5 w-1.5 rounded-full shrink-0', colors.dot)} aria-hidden />
        {config.label}
      </Badge>
    );
  }

  return (
    <Badge
      variant="outline"
      className={cn('font-medium', config.className, className)}
    >
      {config.label}
    </Badge>
  );
}

export { STATUS_CONFIG };
