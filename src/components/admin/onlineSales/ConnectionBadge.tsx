import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { CONNECTION_LABELS, type ConnectionState } from '@/lib/adminOnlineSales';

const STYLES: Record<ConnectionState, string> = {
  connected: 'bg-green-500/10 text-green-600 dark:text-green-400',
  paused: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  expired: 'bg-red-500/10 text-red-600 dark:text-red-400',
  reconnect: 'bg-orange-500/10 text-orange-600 dark:text-orange-400',
  incomplete: 'bg-muted text-muted-foreground',
};

export function ConnectionBadge({ state }: { state: ConnectionState }) {
  return (
    <Badge variant="secondary" className={cn('border-transparent font-medium whitespace-nowrap', STYLES[state])}>
      {CONNECTION_LABELS[state]}
    </Badge>
  );
}
