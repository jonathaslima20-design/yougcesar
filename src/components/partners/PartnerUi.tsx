import { useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

export function PageHeader({ title, description, actions }: { title: string; description?: string; actions?: React.ReactNode }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
      <div className="min-w-0">
        <h1 className="text-2xl font-semibold text-foreground">{title}</h1>
        {description && <p className="text-sm text-muted-foreground mt-1">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function StatCard({
  title,
  value,
  hint,
  icon: Icon,
  loading,
  accent,
}: {
  title: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  icon?: React.ComponentType<{ className?: string }>;
  loading?: boolean;
  accent?: 'green' | 'amber' | 'blue';
}) {
  const accentCls = accent === 'green' ? 'text-emerald-600 dark:text-emerald-400' : accent === 'amber' ? 'text-amber-600 dark:text-amber-400' : accent === 'blue' ? 'text-sky-600 dark:text-sky-400' : '';
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        {Icon && <Icon className="h-4 w-4 text-muted-foreground" />}
      </CardHeader>
      <CardContent>
        {loading ? <Skeleton className="h-8 w-24" /> : <p className={cn('text-2xl font-bold tabular-nums', accentCls)}>{value}</p>}
        {hint && !loading && <p className="text-xs text-muted-foreground mt-1">{hint}</p>}
      </CardContent>
    </Card>
  );
}

const TONES = {
  green: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20',
  amber: 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/20',
  red: 'bg-red-500/10 text-red-700 dark:text-red-300 border-red-500/20',
  blue: 'bg-sky-500/10 text-sky-700 dark:text-sky-300 border-sky-500/20',
  muted: 'bg-muted text-muted-foreground border-border',
} as const;

export function ToneBadge({ tone, children, className }: { tone: keyof typeof TONES; children: React.ReactNode; className?: string }) {
  return <span className={cn('inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium whitespace-nowrap', TONES[tone], className)}>{children}</span>;
}

export function CopyButton({ value, label, size = 'sm', variant = 'outline' }: { value: string; label?: string; size?: 'sm' | 'icon' | 'default'; variant?: 'outline' | 'default' | 'ghost' | 'secondary' }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      toast.success('Copiado!');
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error('Não foi possível copiar');
    }
  };
  return (
    <Button type="button" variant={variant} size={label ? size : 'icon'} onClick={copy} aria-label={label ?? 'Copiar'}>
      {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
      {label && <span className="ml-2">{label}</span>}
    </Button>
  );
}

export function EmptyState({ icon: Icon, title, description, action }: { icon: React.ComponentType<{ className?: string }>; title: string; description?: string; action?: React.ReactNode }) {
  return (
    <div className="text-center py-12 px-4">
      <div className="mx-auto h-12 w-12 rounded-2xl bg-muted flex items-center justify-center">
        <Icon className="h-5 w-5 text-muted-foreground" />
      </div>
      <p className="font-medium mt-4">{title}</p>
      {description && <p className="text-sm text-muted-foreground mt-1 max-w-sm mx-auto">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function formatDate(value: string | null | undefined, opts: Intl.DateTimeFormatOptions = { day: '2-digit', month: '2-digit', year: 'numeric' }) {
  if (!value) return '—';
  return new Date(value).toLocaleDateString('pt-BR', opts);
}

export function daysUntil(value: string | null | undefined) {
  if (!value) return null;
  return Math.ceil((new Date(value).getTime() - Date.now()) / 86400000);
}
