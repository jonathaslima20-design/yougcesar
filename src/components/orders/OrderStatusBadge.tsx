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

interface OrderStatusBadgeProps {
  status: OrderStatus;
  className?: string;
}

export default function OrderStatusBadge({ status, className }: OrderStatusBadgeProps) {
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.pending;

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
