import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import { UserTable } from '@/components/admin/UserTable';
import { UserListControls } from '@/components/admin/UserListControls';
import { UserSummaryCards } from '@/components/admin/UserSummaryCards';
import { FloatingUserBulkActions } from '@/components/admin/FloatingUserBulkActions';
import { CloneUserDialog } from '@/components/admin/CloneUserDialog';
import { SimpleCopyProductsDialog } from '@/components/admin/SimpleCopyProductsDialog';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { updateUserImageLimitBulk } from '@/lib/adminApi';
import { toast } from 'sonner';
import type { User } from '@/types';

export type DateFilterType = 'all' | 'today' | 'last7days' | 'last30days' | 'last3months' | 'custom';
export type PlanTypeFilterType = 'all' | 'monthly' | 'quarterly' | 'semiannually' | 'annually' | 'no-plan';
export type ExpirationFilterType = 'all' | 'expiring-today' | 'expiring-7days' | 'expiring-30days' | 'expired' | 'custom';
export type ActivityFilterType = 'all' | 'active-7d' | 'inactive-30d' | 'never';

const PAGE_SIZE = 50;

interface SummaryCounts {
  total: number;
  active: number;
  blocked: number;
  activePlans: number;
  freePlans: number;
  suspendedPlans: number;
  noPlans: number;
  recent7: number;
  recent30: number;
}

export default function UsersManagementPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(0);

  const initialPlan = searchParams.get('plan') || 'all';
  const initialDate = searchParams.get('date') || 'all';
  const initialExpiration = searchParams.get('expiration') || 'all';

  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [planFilter, setPlanFilter] = useState(initialPlan);
  const [planTypeFilter, setPlanTypeFilter] = useState<PlanTypeFilterType>('all');
  const [dateFilter, setDateFilter] = useState<DateFilterType>(initialDate as DateFilterType);
  const [customStartDate, setCustomStartDate] = useState<Date | undefined>(undefined);
  const [customEndDate, setCustomEndDate] = useState<Date | undefined>(undefined);
  const [expirationFilter, setExpirationFilter] = useState<ExpirationFilterType>(initialExpiration as ExpirationFilterType);
  const [customExpirationStartDate, setCustomExpirationStartDate] = useState<Date | undefined>(undefined);
  const [customExpirationEndDate, setCustomExpirationEndDate] = useState<Date | undefined>(undefined);
  const [activityFilter, setActivityFilter] = useState<ActivityFilterType>('all');
  const [cloneDialogOpen, setCloneDialogOpen] = useState(false);
  const [cloneSourceUserId, setCloneSourceUserId] = useState<string>('');
  const [copyProductsDialogOpen, setCopyProductsDialogOpen] = useState(false);
  const [copyProductsSourceUserId, setCopyProductsSourceUserId] = useState<string>('');
  const [summaryCounts, setSummaryCounts] = useState<SummaryCounts>({
    total: 0, active: 0, blocked: 0, activePlans: 0, freePlans: 0,
    suspendedPlans: 0, noPlans: 0, recent7: 0, recent30: 0,
  });

  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  const handleSearchChange = useCallback((value: string) => {
    setSearchTerm(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setDebouncedSearch(value);
      setPage(0);
    }, 300);
  }, []);

  const resetPage = useCallback(() => setPage(0), []);

  const handleRoleFilterChange = useCallback((v: string) => { setRoleFilter(v); resetPage(); }, [resetPage]);
  const handleStatusFilterChange = useCallback((v: string) => { setStatusFilter(v); resetPage(); }, [resetPage]);
  const handlePlanFilterChange = useCallback((v: string) => { setPlanFilter(v); resetPage(); }, [resetPage]);
  const handlePlanTypeFilterChange = useCallback((v: PlanTypeFilterType) => { setPlanTypeFilter(v); resetPage(); }, [resetPage]);
  const handleDateFilterChange = useCallback((v: DateFilterType) => { setDateFilter(v); resetPage(); }, [resetPage]);
  const handleCustomStartDateChange = useCallback((v: Date | undefined) => { setCustomStartDate(v); resetPage(); }, [resetPage]);
  const handleCustomEndDateChange = useCallback((v: Date | undefined) => { setCustomEndDate(v); resetPage(); }, [resetPage]);
  const handleExpirationFilterChange = useCallback((v: ExpirationFilterType) => { setExpirationFilter(v); resetPage(); }, [resetPage]);
  const handleCustomExpirationStartDateChange = useCallback((v: Date | undefined) => { setCustomExpirationStartDate(v); resetPage(); }, [resetPage]);
  const handleCustomExpirationEndDateChange = useCallback((v: Date | undefined) => { setCustomExpirationEndDate(v); resetPage(); }, [resetPage]);
  const handleActivityFilterChange = useCallback((v: ActivityFilterType) => { setActivityFilter(v); resetPage(); }, [resetPage]);

  const handleSummaryCardClick = useCallback((filter: { plan?: string; status?: string; date?: string }) => {
    if (filter.plan) { setPlanFilter(filter.plan); } else { setPlanFilter('all'); }
    if (filter.status) { setStatusFilter(filter.status); } else { setStatusFilter('all'); }
    if (filter.date) { setDateFilter(filter.date as DateFilterType); } else { setDateFilter('all'); }
    resetPage();
  }, [resetPage]);

  const fetchSummaryCounts = useCallback(async () => {
    try {
      const now = new Date();
      const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();

      const [totalRes, activeRes, blockedRes, activePlanRes, freePlanRes, suspendedRes, noPlanRes, recent7Res, recent30Res] = await Promise.all([
        supabase.from('users').select('id', { count: 'exact', head: true }),
        supabase.from('users').select('id', { count: 'exact', head: true }).eq('is_blocked', false),
        supabase.from('users').select('id', { count: 'exact', head: true }).eq('is_blocked', true),
        supabase.from('users').select('id', { count: 'exact', head: true }).eq('plan_status', 'active'),
        supabase.from('users').select('id', { count: 'exact', head: true }).eq('plan_status', 'free'),
        supabase.from('users').select('id', { count: 'exact', head: true }).eq('plan_status', 'suspended'),
        supabase.from('users').select('id', { count: 'exact', head: true }).or('plan_status.is.null,plan_status.eq.expired'),
        supabase.from('users').select('id', { count: 'exact', head: true }).gte('created_at', sevenDaysAgo),
        supabase.from('users').select('id', { count: 'exact', head: true }).gte('created_at', thirtyDaysAgo),
      ]);

      setSummaryCounts({
        total: totalRes.count || 0,
        active: activeRes.count || 0,
        blocked: blockedRes.count || 0,
        activePlans: activePlanRes.count || 0,
        freePlans: freePlanRes.count || 0,
        suspendedPlans: suspendedRes.count || 0,
        noPlans: noPlanRes.count || 0,
        recent7: recent7Res.count || 0,
        recent30: recent30Res.count || 0,
      });
    } catch (error) {
      console.error('Error fetching summary counts:', error);
    }
  }, []);

  const fetchUsers = useCallback(async () => {
    try {
      setLoading(true);

      let query = supabase
        .from('users')
        .select('*', { count: 'exact' });

      if (debouncedSearch) {
        query = query.or(`name.ilike.%${debouncedSearch}%,email.ilike.%${debouncedSearch}%,slug.ilike.%${debouncedSearch}%`);
      }
      if (roleFilter !== 'all') {
        query = query.eq('role', roleFilter);
      }
      if (statusFilter === 'active') {
        query = query.eq('is_blocked', false);
      } else if (statusFilter === 'blocked') {
        query = query.eq('is_blocked', true);
      }
      if (planFilter !== 'all') {
        if (planFilter === 'no-plan') {
          query = query.or('plan_status.is.null,plan_status.eq.expired');
        } else {
          query = query.eq('plan_status', planFilter);
        }
      }

      if (dateFilter !== 'all') {
        const now = new Date();
        let startDate: string | undefined;
        let endDate: string | undefined;

        switch (dateFilter) {
          case 'today':
            startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
            endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).toISOString();
            break;
          case 'last7days':
            startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
            break;
          case 'last30days':
            startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
            break;
          case 'last3months':
            startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000).toISOString();
            break;
          case 'custom':
            if (customStartDate) startDate = new Date(customStartDate.getFullYear(), customStartDate.getMonth(), customStartDate.getDate()).toISOString();
            if (customEndDate) endDate = new Date(customEndDate.getFullYear(), customEndDate.getMonth(), customEndDate.getDate() + 1).toISOString();
            break;
        }

        if (startDate) query = query.gte('created_at', startDate);
        if (endDate) query = query.lt('created_at', endDate);
      }

      if (activityFilter !== 'all') {
        const now = new Date();
        if (activityFilter === 'active-7d') {
          query = query.gte('last_login_at', new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString());
        } else if (activityFilter === 'inactive-30d') {
          query = query.lt('last_login_at', new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString());
        } else if (activityFilter === 'never') {
          query = query.is('last_login_at', null);
        }
      }

      query = query.order('created_at', { ascending: false });
      const from = page * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;
      query = query.range(from, to);

      const { data: usersData, error: usersError, count } = await query;
      if (usersError) throw usersError;

      setTotalCount(count || 0);

      if (!usersData || usersData.length === 0) {
        setUsers([]);
        setLoading(false);
        return;
      }

      const userIds = usersData.map(u => u.id);
      const { data: subscriptionsData } = await supabase
        .from('subscriptions')
        .select('user_id, billing_cycle, status, next_payment_date')
        .in('user_id', userIds)
        .order('created_at', { ascending: false });

      const subscriptionsByUser = new Map<string, typeof subscriptionsData extends (infer T)[] | null ? T : never>();
      for (const sub of subscriptionsData || []) {
        if (!subscriptionsByUser.has(sub.user_id)) {
          subscriptionsByUser.set(sub.user_id, sub);
        }
      }

      let enrichedUsers = usersData.map(user => ({
        ...user,
        billing_cycle: subscriptionsByUser.get(user.id)?.billing_cycle,
        next_payment_date: subscriptionsByUser.get(user.id)?.next_payment_date,
        subscription_end_date: subscriptionsByUser.get(user.id)?.next_payment_date,
      }));

      if (planTypeFilter !== 'all') {
        if (planTypeFilter === 'no-plan') {
          enrichedUsers = enrichedUsers.filter(u => !u.billing_cycle);
        } else {
          enrichedUsers = enrichedUsers.filter(u => u.billing_cycle === planTypeFilter);
        }
      }

      if (expirationFilter !== 'all') {
        const now = new Date();
        enrichedUsers = enrichedUsers.filter(user => {
          if (!user.next_payment_date) return false;
          const expDate = new Date(user.next_payment_date);
          const daysUntil = Math.ceil((expDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

          switch (expirationFilter) {
            case 'expiring-today': return daysUntil === 0;
            case 'expiring-7days': return daysUntil > 0 && daysUntil <= 7;
            case 'expiring-30days': return daysUntil > 0 && daysUntil <= 30;
            case 'expired': return daysUntil < 0;
            case 'custom':
              if (customExpirationStartDate && customExpirationEndDate) {
                return expDate >= customExpirationStartDate && expDate <= customExpirationEndDate;
              }
              return false;
            default: return true;
          }
        });
      }

      setUsers(enrichedUsers);
    } catch (error) {
      console.error('Error fetching users:', error);
      toast.error('Erro ao carregar usuários');
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, roleFilter, statusFilter, planFilter, planTypeFilter, dateFilter, customStartDate, customEndDate, expirationFilter, customExpirationStartDate, customExpirationEndDate, activityFilter, page]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  useEffect(() => {
    fetchSummaryCounts();
  }, [fetchSummaryCounts]);

  useEffect(() => {
    const handleOpenCloneDialog = (e: Event) => {
      const customEvent = e as CustomEvent<{ targetUserId: string }>;
      setCloneSourceUserId(customEvent.detail.targetUserId);
      setCloneDialogOpen(true);
    };
    const handleOpenCopyProducts = (e: Event) => {
      const customEvent = e as CustomEvent<{ targetUserId: string }>;
      setCopyProductsSourceUserId(customEvent.detail.targetUserId);
      setCopyProductsDialogOpen(true);
    };
    window.addEventListener('openCloneUserDialog', handleOpenCloneDialog);
    window.addEventListener('openCopyProducts', handleOpenCopyProducts);
    return () => {
      window.removeEventListener('openCloneUserDialog', handleOpenCloneDialog);
      window.removeEventListener('openCopyProducts', handleOpenCopyProducts);
    };
  }, []);

  const handleSelectUser = useCallback((userId: string, checked: boolean) => {
    setSelectedUsers(prev => {
      const next = new Set(prev);
      checked ? next.add(userId) : next.delete(userId);
      return next;
    });
  }, []);

  const handleSelectAll = useCallback((checked: boolean) => {
    if (checked) {
      setSelectedUsers(new Set(users.map(u => u.id)));
    } else {
      setSelectedUsers(new Set());
    }
  }, [users]);

  const handleToggleBlock = useCallback(async (userId: string, currentBlocked: boolean) => {
    try {
      const { error } = await supabase
        .from('users')
        .update({ is_blocked: !currentBlocked })
        .eq('id', userId);
      if (error) throw error;

      setUsers(prev => prev.map(u => u.id === userId ? { ...u, is_blocked: !currentBlocked } : u));
      toast.success(currentBlocked ? 'Usuário desbloqueado com sucesso' : 'Usuário bloqueado com sucesso');
      fetchSummaryCounts();
    } catch (error) {
      console.error('Error toggling user block status:', error);
      toast.error('Erro ao alterar status do usuário');
    }
  }, [fetchSummaryCounts]);

  const handleDeleteUser = useCallback(async (userId: string) => {
    try {
      const { data: session } = await supabase.auth.getSession();
      const token = session?.session?.access_token;
      if (!token) throw new Error('Not authenticated');

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/delete-user`,
        {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
            'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
          },
          body: JSON.stringify({ userId }),
        }
      );

      const result = await response.json();
      if (!response.ok || !result.success) {
        const errorMsg = result.results?.[0]?.error || result.error?.message || 'Erro ao excluir usuário';
        throw new Error(errorMsg);
      }

      const stats = result.results?.[0]?.cleanup;
      setUsers(prev => prev.filter(u => u.id !== userId));
      setSelectedUsers(prev => {
        const next = new Set(prev);
        next.delete(userId);
        return next;
      });

      const filesInfo = stats?.filesDeleted ? ` (${stats.filesDeleted} arquivo${stats.filesDeleted > 1 ? 's' : ''} removido${stats.filesDeleted > 1 ? 's' : ''})` : '';
      toast.success(`Usuário excluído com sucesso${filesInfo}`);
      fetchSummaryCounts();
    } catch (error: any) {
      console.error('Error deleting user:', error);
      toast.error(error.message || 'Erro ao excluir usuario');
    }
  }, [fetchSummaryCounts]);

  const handleBulkAction = useCallback(async (action: string, userIds: string[]) => {
    try {
      switch (action) {
        case 'block':
          await supabase.from('users').update({ is_blocked: true }).in('id', userIds);
          break;
        case 'unblock':
          await supabase.from('users').update({ is_blocked: false }).in('id', userIds);
          break;
        case 'delete': {
          const { data: session } = await supabase.auth.getSession();
          const token = session?.session?.access_token;
          if (!token) throw new Error('Not authenticated');

          const response = await fetch(
            `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/delete-user`,
            {
              method: 'DELETE',
              headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
                'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
              },
              body: JSON.stringify({ userIds }),
            }
          );

          const result = await response.json();
          if (!response.ok) {
            throw new Error(result.error?.message || 'Erro ao excluir usuários');
          }

          const { summary } = result;
          if (summary.failed > 0) {
            toast.warning(`${summary.succeeded} de ${summary.total} usuários excluídos. ${summary.failed} falharam.`);
          } else {
            const filesInfo = summary.totalFilesDeleted > 0 ? ` (${summary.totalFilesDeleted} arquivos removidos)` : '';
            toast.success(`${summary.succeeded} usuário${summary.succeeded > 1 ? 's' : ''} excluído${summary.succeeded > 1 ? 's' : ''} com sucesso${filesInfo}`);
          }
          break;
        }
      }
      await fetchUsers();
      await fetchSummaryCounts();
      setSelectedUsers(new Set());
      if (action !== 'delete') {
        toast.success('Ação executada com sucesso');
      }
    } catch (error: any) {
      console.error('Error executing bulk action:', error);
      toast.error(error.message || 'Erro ao executar ação em lote');
    }
  }, [fetchUsers, fetchSummaryCounts]);

  const handleBulkSetImageLimit = useCallback(async (maxImages: number) => {
    try {
      const userIds = Array.from(selectedUsers);
      const result = await updateUserImageLimitBulk(userIds, maxImages);
      setUsers(prev => prev.map(u =>
        selectedUsers.has(u.id) ? { ...u, max_images_per_product: maxImages } : u
      ));
      setSelectedUsers(new Set());
      toast.success(`Limite de ${maxImages} imagens definido para ${result.affectedCount} usuário${result.affectedCount > 1 ? 's' : ''}`);
    } catch (error: any) {
      console.error('Error setting bulk image limit:', error);
      toast.error(error.message || 'Erro ao definir limite de imagens em massa');
    }
  }, [selectedUsers]);

  const handleRefresh = useCallback(() => {
    fetchUsers();
    fetchSummaryCounts();
  }, [fetchUsers, fetchSummaryCounts]);

  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  const selectedUsersArray = useMemo(
    () => users.filter(u => selectedUsers.has(u.id)),
    [users, selectedUsers]
  );

  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl page-title">Gerenciamento de Usuários</h1>
          <p className="text-muted-foreground">Visualize e gerencie todos os usuários do sistema</p>
        </div>
        <Button onClick={() => navigate('/admin/users/new')}>
          <Plus className="h-4 w-4 mr-2" />
          Novo Usuário
        </Button>
      </div>

      <UserSummaryCards counts={summaryCounts} onFilterClick={handleSummaryCardClick} />

      <UserListControls
        searchTerm={searchTerm}
        onSearchChange={handleSearchChange}
        roleFilter={roleFilter}
        onRoleFilterChange={handleRoleFilterChange}
        statusFilter={statusFilter}
        onStatusFilterChange={handleStatusFilterChange}
        planFilter={planFilter}
        onPlanFilterChange={handlePlanFilterChange}
        planTypeFilter={planTypeFilter}
        onPlanTypeFilterChange={handlePlanTypeFilterChange}
        dateFilter={dateFilter}
        onDateFilterChange={handleDateFilterChange}
        customStartDate={customStartDate}
        onCustomStartDateChange={handleCustomStartDateChange}
        customEndDate={customEndDate}
        onCustomEndDateChange={handleCustomEndDateChange}
        expirationFilter={expirationFilter}
        onExpirationFilterChange={handleExpirationFilterChange}
        customExpirationStartDate={customExpirationStartDate}
        onCustomExpirationStartDateChange={handleCustomExpirationStartDateChange}
        customExpirationEndDate={customExpirationEndDate}
        onCustomExpirationEndDateChange={handleCustomExpirationEndDateChange}
        activityFilter={activityFilter}
        onActivityFilterChange={handleActivityFilterChange}
        totalUsers={summaryCounts.total}
        filteredUsers={totalCount}
        onRefresh={handleRefresh}
      />

      <UserTable
        users={users}
        selectedUsers={selectedUsers}
        onSelectUser={handleSelectUser}
        onSelectAll={handleSelectAll}
        onToggleBlock={handleToggleBlock}
        onDeleteUser={handleDeleteUser}
        loading={loading}
        currentUserRole={currentUser?.role || 'user'}
        page={page}
        totalPages={totalPages}
        onPageChange={setPage}
        pageSize={PAGE_SIZE}
        totalCount={totalCount}
      />

      {selectedUsers.size > 0 && (
        <FloatingUserBulkActions
          selectedCount={selectedUsers.size}
          selectedUsers={selectedUsersArray}
          onClearSelection={() => setSelectedUsers(new Set())}
          onBulkActivatePlan={async () => {}}
          onBulkBlockUsers={async () => {
            await handleBulkAction('block', Array.from(selectedUsers));
          }}
          onBulkUnblockUsers={async () => {
            await handleBulkAction('unblock', Array.from(selectedUsers));
          }}
          onBulkChangeRole={async () => {}}
          onBulkSetImageLimit={handleBulkSetImageLimit}
          loading={loading}
          subscriptionPlans={[]}
          currentUserRole={currentUser?.role || 'user'}
        />
      )}

      <CloneUserDialog
        open={cloneDialogOpen}
        onOpenChange={setCloneDialogOpen}
        sourceUserId={cloneSourceUserId}
        onSuccess={handleRefresh}
      />

      <SimpleCopyProductsDialog
        open={copyProductsDialogOpen}
        onOpenChange={setCopyProductsDialogOpen}
        defaultSourceUserId={copyProductsSourceUserId}
      />
    </div>
  );
}
