import { Check } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { OrderStatus } from '@/types';

const STEPS: { status: OrderStatus; label: string }[] = [
  { status: 'pending', label: 'Recebido' },
  { status: 'confirmed', label: 'Confirmado' },
  { status: 'preparing', label: 'Preparando' },
  { status: 'shipped', label: 'Enviado' },
  { status: 'delivered', label: 'Entregue' },
];

// The first and last dots sit flush with the card's content edges; each step but
// the last owns the connector that leads to the next one, so a connector is a single
// color (filled once the next step is reached). Labels hang under their dot without
// taking layout width, aligned left/center/right so the end labels never overflow.
export function OrderStatusTimeline({ status }: { status: OrderStatus }) {
  if (status === 'cancelled') {
    return <Badge variant="destructive">Pedido cancelado</Badge>;
  }

  const currentStepIndex = STEPS.findIndex((s) => s.status === status);
  const lastIndex = STEPS.length - 1;

  return (
    <ol className="flex items-start pb-7" aria-label="Andamento do pedido">
      {STEPS.map((step, index) => {
        const isDone = index <= currentStepIndex;
        const isCurrent = index === currentStepIndex;
        const isLast = index === lastIndex;
        return (
          <li key={step.status} className={cn('flex items-start', !isLast && 'flex-1')} aria-current={isCurrent ? 'step' : undefined}>
            <div className="relative h-6 w-6 shrink-0">
              <div
                className={cn(
                  'h-6 w-6 rounded-full flex items-center justify-center border-2',
                  isDone ? 'bg-primary border-primary text-primary-foreground' : 'border-border text-muted-foreground bg-background'
                )}
              >
                {isDone && <Check className="h-3.5 w-3.5" />}
              </div>
              {/* Narrow screens: five labels don't fit side by side, so only the current step is named. */}
              <span
                className={cn(
                  'absolute top-7 whitespace-nowrap text-[11px] leading-tight',
                  index === 0 ? 'left-0' : isLast ? 'right-0' : 'left-1/2 -translate-x-1/2',
                  isCurrent ? 'block' : 'hidden sm:block',
                  isDone ? 'text-foreground font-medium' : 'text-muted-foreground'
                )}
              >
                {step.label}
              </span>
            </div>
            {!isLast && (
              <div className={cn('flex-1 h-0.5 mt-[11px] mx-1 rounded-full', index < currentStepIndex ? 'bg-primary' : 'bg-border')} />
            )}
          </li>
        );
      })}
    </ol>
  );
}
