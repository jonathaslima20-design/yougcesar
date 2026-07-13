import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { LogIn, LogOut, Package, Pencil, Trash2, FolderPlus, Folder as FolderEdit, FolderMinus, UserCog, Camera, Link2, Palette, ShoppingCart, CreditCard, Clock, Loader as Loader2, Activity, Filter } from 'lucide-react';
import { formatDistanceToNow, subDays, format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { ActivityLog, ActivityAction } from '@/types';

const PAGE_SIZE = 50;

const ACTION_CONFIG: Record<string, { icon: typeof Package; color: string; label: string }> = {
  'auth.login': { icon: LogIn, color: 'text-blue-500 bg-blue-50 dark:bg-blue-950', label: 'Autenticação' },
  'auth.logout': { icon: LogOut, color: 'text-slate-500 bg-slate-50 dark:bg-slate-950', label: 'Autenticação' },
  'product.create': { icon: Package, color: 'text-green-500 bg-green-50 dark:bg-green-950', label: 'Produtos' },
  'product.update': { icon: Pencil, color: 'text-amber-500 bg-amber-50 dark:bg-amber-950', label: 'Produtos' },
  'product.delete': { icon: Trash2, color: 'text-red-500 bg-red-50 dark:bg-red-950', label: 'Produtos' },
  'product.status_change': { icon: Package, color: 'text-teal-500 bg-teal-50 dark:bg-teal-950', label: 'Produtos' },
  'category.create': { icon: FolderPlus, color: 'text-green-500 bg-green-50 dark:bg-green-950', label: 'Categorias' },
  'category.update': { icon: FolderEdit, color: 'text-amber-500 bg-amber-50 dark:bg-amber-950', label: 'Categorias' },
  'category.delete': { icon: FolderMinus, color: 'text-red-500 bg-red-50 dark:bg-red-950', label: 'Categorias' },
  'profile.update': { icon: UserCog, color: 'text-sky-500 bg-sky-50 dark:bg-sky-950', label: 'Perfil' },
  'profile.avatar': { icon: Camera, color: 'text-sky-500 bg-sky-50 dark:bg-sky-950', label: 'Perfil' },
  'profile.slug': { icon: Link2, color: 'text-sky-500 bg-sky-50 dark:bg-sky-950', label: 'Perfil' },
  'appearance.update': { icon: Palette, color: 'text-pink-500 bg-pink-50 dark:bg-pink-950', label: 'Aparência' },
  'order.status_change': { icon: ShoppingCart, color: 'text-orange-500 bg-orange-50 dark:bg-orange-950', label: 'Pedidos' },
  'subscription.activated': { icon: CreditCard, color: 'text-emerald-500 bg-emerald-50 dark:bg-emerald-950', label: 'Assinatura' },
  'subscription.expired': { icon: Clock, color: 'text-red-500 bg-red-50 dark:bg-red-950', label: 'Assinatura' },
};

const CATEGORY_FILTERS = [
  { value: 'all', label: 'Todas as ações' },
  { value: 'auth', label: 'Autenticação' },
  { value: 'product', label: 'Produtos' },
  { value: 'category', label: 'Categorias' },
  { value: 'profile', label: 'Perfil' },
  { value: 'appearance', label: 'Aparência' },
  { value: 'order', label: 'Pedidos' },
  { value: 'subscription', label: 'Assinatura' },
];

const PERIOD_FILTERS = [
  { value: 'all', label: 'Últimos 60 dias' },
  { value: 'today', label: 'Hoje' },
  { value: '7d', label: 'Últimos 7 dias' },
  { value: '30d', label: 'Últimos 30 dias' },
];

interface UserActivityLogProps {
  userId: string;
}

export default function UserActivityLog({ userId }: UserActivityLogProps) {
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [periodFilter, setPeriodFilter] = useState('all');

  const fetchLogs = useCallback(async (offset = 0, append = false) => {
    if (!append) setLoading(true);
    else setLoadingMore(true);

    try {
      let query = supabase
        .from('user_activity_logs')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .range(offset, offset + PAGE_SIZE - 1);

      if (categoryFilter !== 'all') {
        query = query.like('action', `${categoryFilter}.%`);
      }

      if (periodFilter !== 'all') {
        const daysMap: Record<string, number> = { today: 0, '7d': 7, '30d': 30 };
        const days = daysMap[periodFilter] ?? 60;
        const from = periodFilter === 'today'
          ? new Date(new Date().setHours(0, 0, 0, 0)).toISOString()
          : subDays(new Date(), days).toISOString();
        query = query.gte('created_at', from);
      }

      const { data, error } = await query;
      if (error) throw error;

      const fetched = (data || []) as ActivityLog[];
      setHasMore(fetched.length === PAGE_SIZE);

      if (append) {
        setLogs(prev => [...prev, ...fetched]);
      } else {
        setLogs(fetched);
      }
    } catch (err) {
      console.error('Error fetching activity logs:', err);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [userId, categoryFilter, periodFilter]);

  useEffect(() => {
    fetchLogs(0, false);
  }, [fetchLogs]);

  const getConfig = (action: string) => {
    return ACTION_CONFIG[action] || { icon: Activity, color: 'text-gray-500 bg-gray-50 dark:bg-gray-950', label: 'Outro' };
  };

  const parseDevice = (ua?: string): string => {
    if (!ua) return '';
    let browser = 'Navegador';
    if (ua.includes('Chrome') && !ua.includes('Edg')) browser = 'Chrome';
    else if (ua.includes('Safari') && !ua.includes('Chrome')) browser = 'Safari';
    else if (ua.includes('Firefox')) browser = 'Firefox';
    else if (ua.includes('Edg')) browser = 'Edge';

    let os = '';
    if (ua.includes('Windows')) os = 'Windows';
    else if (ua.includes('Mac')) os = 'Mac';
    else if (ua.includes('Android')) os = 'Android';
    else if (ua.includes('iPhone') || ua.includes('iPad')) os = 'iOS';
    else if (ua.includes('Linux')) os = 'Linux';

    return os ? `${browser}, ${os}` : browser;
  };

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <Filter className="h-4 w-4" />
          <span>Filtrar:</span>
        </div>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-[180px] h-9">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {CATEGORY_FILTERS.map(f => (
              <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={periodFilter} onValueChange={setPeriodFilter}>
          <SelectTrigger className="w-[180px] h-9">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PERIOD_FILTERS.map(f => (
              <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Log List */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : logs.length === 0 ? (
        <div className="text-center py-12">
          <Activity className="h-10 w-10 mx-auto text-muted-foreground/40 mb-3" />
          <p className="text-sm text-muted-foreground">Nenhuma atividade registrada</p>
        </div>
      ) : (
        <div className="space-y-1">
          {logs.map(log => {
            const config = getConfig(log.action);
            const Icon = config.icon;
            const device = parseDevice(log.user_agent);

            return (
              <div
                key={log.id}
                className="flex items-start gap-3 p-3 rounded-lg hover:bg-muted/50 transition-colors group"
              >
                <div className={`shrink-0 p-2 rounded-lg ${config.color}`}>
                  <Icon className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm leading-snug">{log.description}</p>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    <span className="text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(log.created_at), { locale: ptBR, addSuffix: true })}
                    </span>
                    <span className="text-xs text-muted-foreground/40">-</span>
                    <span className="text-xs text-muted-foreground">
                      {format(new Date(log.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                    </span>
                    {device && (
                      <>
                        <span className="text-xs text-muted-foreground/40">-</span>
                        <span className="text-xs text-muted-foreground">{device}</span>
                      </>
                    )}
                  </div>
                </div>
                <Badge variant="secondary" className="text-[10px] shrink-0 opacity-60 group-hover:opacity-100 transition-opacity">
                  {config.label}
                </Badge>
              </div>
            );
          })}

          {hasMore && (
            <div className="pt-3 text-center">
              <Button
                variant="outline"
                size="sm"
                onClick={() => fetchLogs(logs.length, true)}
                disabled={loadingMore}
              >
                {loadingMore ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : null}
                Carregar mais
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
