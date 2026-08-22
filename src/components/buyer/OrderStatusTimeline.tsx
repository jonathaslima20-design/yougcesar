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

export function OrderStatusTimeline({ status }: { status: OrderStatus }) {
  if (status === 'cancelled') {
    return <Badge variant="destructive">Pedido cancelado</Badge>;
  }

  const currentStepIndex = STEPS.findIndex((s) => s.status === status);

  return (
    <div className="flex items-center justify-between">
      {STEPS.map((step, index) => {
        const isDone = index <= currentStepIndex;
        return (
          <div key={step.status} className="flex-1 flex flex-col items-center text-center">
            <div className="flex items-center w-full">
              <div
                className={cn(
                  'h-full flex-1 border-t-2',
                  index === 0 ? 'border-transparent' : isDone ? 'border-primary' : 'border-border'
                )}
              />
              <div
                className={cn(
                  'h-6 w-6 rounded-full flex items-center justify-center shrink-0 border-2',
                  isDone ? 'bg-primary border-primary text-primary-foreground' : 'border-border text-muted-foreground'
                )}
              >
                {isDone && <Check className="h-3.5 w-3.5" />}
              </div>
              <div
                className={cn(
                  'h-full flex-1 border-t-2',
                  index === STEPS.length - 1 ? 'border-transparent' : isDone ? 'border-primary' : 'border-border'
                )}
              />
            </div>
            <span className={cn('text-[11px] mt-1.5', isDone ? 'text-foreground font-medium' : 'text-muted-foreground')}>
              {step.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}
