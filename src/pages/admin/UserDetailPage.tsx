import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Separator } from '@/components/ui/separator';
import { ArrowLeft, ExternalLink, Ban, Phone, Calendar, Key, Lock, Trash2, Eye, DollarSign, Image as ImageIcon, Gift, Copy, Package, ShoppingCart, ChartBar as BarChart3, Users, TrendingUp, Globe, ChevronRight, ClipboardCopy, LogIn, Loader as Loader2, Activity, Monitor, FileCheck, Megaphone, Link2, MousePointerClick, Wallet, UserPlus, Award, MessageCircle } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { EditImageLimitDialog } from '@/components/admin/EditImageLimitDialog';
import { CloneUserDialog } from '@/components/admin/CloneUserDialog';
import { SimpleCopyProductsDialog } from '@/components/admin/SimpleCopyProductsDialog';
import { ChangePasswordDialog } from '@/components/admin/ChangePasswordDialog';
import { toast } from 'sonner';
import { format, formatDistanceToNow, subDays, startOfDay, endOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useUserSubscription } from '@/hooks/useUserSubscription';
import { usePartnerDashboardStats } from '@/hooks/usePartnerDashboardStats';
import { usePartnerCommissionStats } from '@/hooks/usePartnerCommissionStats';
import SubscriptionManagement from '@/components/admin/SubscriptionManagement';
import UserActivityLog from '@/components/admin/UserActivityLog';
import PlanStatusBadge from '@/components/subscription/PlanStatusBadge';
import { generateReferralLink } from '@/lib/referralUtils';
import { formatCurrencyI18n } from '@/lib/i18n';
import OrderStatusBadge from '@/components/orders/OrderStatusBadge';
import { fetchOrders, getOrderStats } from '@/lib/orderService';
import type { Order, PlanStatus, BillingCycle } from '@/types';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, BarChart, Bar, Legend,
} from 'recharts';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader,
  AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

interface AggregatedStats {
  totalProducts: number;
  activeProducts: number;
  soldProducts: number;
  reservedProducts: number;
  totalValue: number;
  totalViews: number;
  totalLeads: number;
  conversionRate: number;
  topCategories: { name: string; count: number }[];
}

export default function UserDetailPage() {
  const { userId } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [stats, setStats] = useState<AggregatedStats>({
    totalProducts: 0, activeProducts: 0, soldProducts: 0, reservedProducts: 0,
    totalValue: 0, totalViews: 0, totalLeads: 0, conversionRate: 0, topCategories: [],
  });
  const [activeTab, setActiveTab] = useState('visao-geral');

  const [showImageLimitDialog, setShowImageLimitDialog] = useState(false);
  const [showCloneDialog, setShowCloneDialog] = useState(false);
  const [showCopyDialog, setShowCopyDialog] = useState(false);
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);
  const [impersonating, setImpersonating] = useState(false);
  const [lastActivity, setLastActivity] = useState<{ description: string; created_at: string } | null>(null);
  const [lastLoginDevice, setLastLoginDevice] = useState<string>('');

  const { subscription, recentPayments, loading: subscriptionLoading, refetch: refetchSubscription } = useUserSubscription(userId);

  useEffect(() => {
    fetchUserData();
  }, [userId]);

  const fetchUserData = async () => {
    if (!userId) return;
    try {
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (userError) throw userError;
      if (!userData) {
        toast.error('Usuário não encontrado');
        navigate('/admin/users');
        return;
      }
      setUser(userData);

      // Partners don't sell products themselves — none of the storefront stats apply.
      if (userData.role !== 'partner') {
        const [
          { count: totalProducts },
          { count: activeProducts },
          { count: soldProducts },
          { count: reservedProducts },
        ] = await Promise.all([
          supabase.from('products').select('id', { count: 'exact', head: true }).eq('user_id', userId),
          supabase.from('products').select('id', { count: 'exact', head: true }).eq('user_id', userId).eq('status', 'disponivel'),
          supabase.from('products').select('id', { count: 'exact', head: true }).eq('user_id', userId).eq('status', 'vendido'),
          supabase.from('products').select('id', { count: 'exact', head: true }).eq('user_id', userId).eq('status', 'reservado'),
        ]);

        const { data: productIds } = await supabase
          .from('products')
          .select('id')
          .eq('user_id', userId);
        const ids = productIds?.map(p => p.id) || [];

        let totalViews = 0;
        let totalLeads = 0;
        if (ids.length > 0) {
          const [viewsRes, leadsRes] = await Promise.all([
            supabase.from('property_views').select('id', { count: 'exact', head: true }).in('property_id', ids),
            supabase.from('leads').select('id', { count: 'exact', head: true }).in('property_id', ids),
          ]);
          totalViews = viewsRes.count || 0;
          totalLeads = leadsRes.count || 0;
        }

        const { data: categoryData } = await supabase
          .from('products')
          .select('category')
          .eq('user_id', userId);

        const catCounts: Record<string, number> = {};
        categoryData?.forEach(p => {
          const cat = p.category?.[0] || 'Sem categoria';
          catCounts[cat] = (catCounts[cat] || 0) + 1;
        });
        const topCategories = Object.entries(catCounts)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5)
          .map(([name, count]) => ({ name, count }));

        const { data: valueData } = await supabase
          .from('products')
          .select('price, discounted_price')
          .eq('user_id', userId)
          .eq('status', 'disponivel');
        const totalValue = valueData?.reduce((sum, p) => sum + (p.discounted_price || p.price || 0), 0) || 0;

        const conversionRate = totalViews > 0 ? (totalLeads / totalViews) * 100 : 0;

        setStats({
          totalProducts: totalProducts || 0,
          activeProducts: activeProducts || 0,
          soldProducts: soldProducts || 0,
          reservedProducts: reservedProducts || 0,
          totalValue,
          totalViews,
          totalLeads,
          conversionRate,
          topCategories,
        });
      }

      // Fetch last activity and last login device
      const [lastActRes, lastLoginRes] = await Promise.all([
        supabase
          .from('user_activity_logs')
          .select('description, created_at')
          .eq('user_id', userId)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase
          .from('user_activity_logs')
          .select('user_agent')
          .eq('user_id', userId)
          .eq('action', 'auth.login')
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);
      if (lastActRes.data) setLastActivity(lastActRes.data);
      if (lastLoginRes.data?.user_agent) {
        const ua = lastLoginRes.data.user_agent;
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
        setLastLoginDevice(os ? `${browser}, ${os}` : browser);
      }
    } catch (error) {
      console.error('Error fetching user data:', error);
      toast.error('Erro ao carregar dados do usuário');
    } finally {
      setLoading(false);
    }
  };

  const handleBlockUser = async () => {
    if (!user) return;
    try {
      const { error } = await supabase
        .from('users')
        .update({ is_blocked: !user.is_blocked })
        .eq('id', user.id);
      if (error) throw error;
      setUser({ ...user, is_blocked: !user.is_blocked });
      toast.success(user.is_blocked ? 'Usuário desbloqueado' : 'Usuário bloqueado');
    } catch (error) {
      console.error('Error blocking user:', error);
      toast.error('Erro ao bloquear/desbloquear usuário');
    }
  };

  const handleDeleteUser = async () => {
    if (!user) return;
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
          body: JSON.stringify({ userId: user.id }),
        }
      );
      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.results?.[0]?.error || result.error?.message || 'Erro ao excluir usuário');
      }
      toast.success('Usuário excluído com sucesso');
      navigate('/admin/users');
    } catch (error: any) {
      console.error('Error deleting user:', error);
      toast.error(error.message || 'Erro ao excluir usuário');
    }
  };

  const handleImpersonate = async () => {
    if (!user) return;
    setImpersonating(true);
    try {
      const { data: session } = await supabase.auth.getSession();
      const token = session?.session?.access_token;
      if (!token) throw new Error('Not authenticated');

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/impersonate-user`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
            'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
          },
          body: JSON.stringify({ targetUserId: user.id }),
        }
      );
      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Erro ao gerar link de impersonação');
      }

      const redirectUrl = `${window.location.origin}/auth/callback?impersonate_token=${encodeURIComponent(result.hashedToken)}`;
      window.open(redirectUrl, '_blank');
      toast.success(`Sessão aberta como ${user.name} em nova aba`);
    } catch (error: any) {
      console.error('Error impersonating user:', error);
      toast.error(error.message || 'Erro ao impersonar usuário');
    } finally {
      setImpersonating(false);
    }
  };

  const handleToggleWhatsappMessage = async (enabled: boolean) => {
    if (!user) return;
    try {
      const { error } = await supabase
        .from('users')
        .update({ whatsapp_message_enabled: enabled })
        .eq('id', user.id);
      if (error) throw error;
      setUser({ ...user, whatsapp_message_enabled: enabled });
      toast.success(enabled ? 'Mensagem pré-definida ativada' : 'Mensagem pré-definida desativada');
    } catch (error) {
      console.error('Error toggling WhatsApp message:', error);
      toast.error('Erro ao atualizar mensagem pré-definida do WhatsApp');
    }
  };

  const handleTogglePaymentsTestOverride = async (enabled: boolean) => {
    if (!user) return;
    try {
      const { error } = await supabase
        .from('users')
        .update({ payments_test_override: enabled })
        .eq('id', user.id);
      if (error) throw error;
      setUser({ ...user, payments_test_override: enabled });
      toast.success(enabled ? 'Pagamento online liberado para este usuário' : 'Pagamento online (teste) desativado');
    } catch (error) {
      console.error('Error toggling payments test override:', error);
      toast.error('Erro ao atualizar liberação de pagamento online');
    }
  };

  const handleImageLimitUpdate = async (maxImages: number) => {
    if (!user) return;
    try {
      const { error } = await supabase
        .from('users')
        .update({ max_images_per_product: maxImages })
        .eq('id', user.id);
      if (error) throw error;
      setUser({ ...user, max_images_per_product: maxImages });
      toast.success('Limite de imagens atualizado');
      setShowImageLimitDialog(false);
    } catch (error) {
      console.error('Error updating image limit:', error);
      toast.error('Erro ao atualizar limite de imagens');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!user) return null;

  const isPartnerAccount = user.role === 'partner';
  const memberSince = formatDistanceToNow(new Date(user.created_at), { locale: ptBR, addSuffix: false });

  return (
    <div className="container mx-auto p-4 md:p-6 space-y-6 max-w-[1400px]">
      {/* Breadcrumb */}
      <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
        <Link to="/admin/users" className="hover:text-foreground transition-colors">Admin</Link>
        <ChevronRight className="h-3.5 w-3.5" />
        <Link to="/admin/users" className="hover:text-foreground transition-colors">Usuários</Link>
        <ChevronRight className="h-3.5 w-3.5" />
        <span className="text-foreground font-medium truncate max-w-[200px]">{user.name}</span>
      </div>

      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-start gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate('/admin/users')} className="mt-0.5 shrink-0">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight">{user.name}</h1>
            <p className="text-muted-foreground text-sm mt-0.5">
              Membro ha {memberSince}
            </p>
          </div>
        </div>
        <div className="flex gap-2 flex-wrap">
          {user.slug && (
            <Button variant="outline" size="sm" onClick={() => window.open(`/${user.slug}`, '_blank')} className="gap-1.5">
              <ExternalLink className="h-3.5 w-3.5" />
              Ver Vitrine
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={handleImpersonate}
            disabled={impersonating || user.is_blocked}
            className="gap-1.5"
          >
            {impersonating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <LogIn className="h-3.5 w-3.5" />}
            Login como Usuário
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[340px_1fr]">
        {/* Sidebar Profile Card */}
        <div className="space-y-4">
          <Card>
            <CardContent className="pt-6 pb-6 space-y-5">
              {/* Avatar & Identity */}
              <div className="text-center space-y-3">
                {user.avatar_url ? (
                  <div className="mx-auto w-20 h-20 rounded-full overflow-hidden ring-2 ring-border">
                    <img src={user.avatar_url} alt={user.name} className="w-full h-full object-cover" />
                  </div>
                ) : (
                  <div className="mx-auto w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center ring-2 ring-border">
                    <span className="text-2xl font-bold text-primary">{user.name?.charAt(0).toUpperCase()}</span>
                  </div>
                )}
                <div>
                  <p className="font-semibold text-lg">{user.name}</p>
                  {user.owner_name && user.owner_name !== user.name && (
                    <p className="text-xs text-muted-foreground">{user.owner_name}</p>
                  )}
                  <p className="text-sm text-muted-foreground">{user.email}</p>
                </div>
                <div className="flex items-center justify-center gap-1.5 flex-wrap">
                  <Badge variant="secondary" className="text-xs">
                    {user.role === 'admin'
                      ? 'Administrador'
                      : user.role === 'parceiro'
                      ? 'Parceiro'
                      : user.role === 'partner'
                      ? 'Parceiro (Partners)'
                      : 'Vendedor'}
                  </Badge>
                  <Badge
                    variant={user.plan_status === 'active' ? 'default' : 'secondary'}
                    className={`text-xs gap-1 ${user.plan_status === 'free' ? 'border-blue-300 text-blue-700 bg-blue-50 dark:border-blue-600 dark:text-blue-400 dark:bg-blue-950' : ''}`}
                  >
                    <div className={`w-1.5 h-1.5 rounded-full ${
                      user.plan_status === 'active' ? 'bg-green-500' :
                      user.plan_status === 'free' ? 'bg-blue-400' :
                      user.plan_status === 'suspended' ? 'bg-orange-400' : 'bg-gray-400'
                    }`} />
                    {user.plan_status === 'active' ? 'Ativo' : user.plan_status === 'free' ? 'Free' : user.plan_status === 'suspended' ? 'Suspenso' : 'Inativo'}
                  </Badge>
                  {user.is_blocked && (
                    <Badge variant="destructive" className="text-xs gap-1">
                      <Ban className="h-3 w-3" /> Bloqueado
                    </Badge>
                  )}
                </div>
              </div>

              <Separator />

              {/* Contact & Details */}
              <div className="space-y-2.5 text-sm">
                {user.whatsapp && (
                  <div className="flex items-center gap-2.5">
                    <Phone className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    <span>{user.country_code ? `+${user.country_code} ` : ''}{user.whatsapp}</span>
                  </div>
                )}
                {user.slug && (
                  <div className="flex items-center gap-2.5">
                    <Globe className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    <span className="truncate">/{user.slug}</span>
                  </div>
                )}
                {user.custom_domain && (
                  <div className="flex items-center gap-2.5">
                    <Globe className="h-3.5 w-3.5 text-green-500 shrink-0" />
                    <span className="truncate text-green-600 dark:text-green-400">{user.custom_domain}</span>
                  </div>
                )}
                {user.instagram && (
                  <div className="flex items-center gap-2.5">
                    <svg className="h-3.5 w-3.5 text-muted-foreground shrink-0" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/>
                    </svg>
                    <span>@{user.instagram}</span>
                  </div>
                )}
                <div className="flex items-center gap-2.5">
                  <Calendar className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <span className="text-muted-foreground">
                    {format(new Date(user.created_at), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                  </span>
                </div>
                {user.referral_code && (
                  <div className="flex items-center gap-2.5">
                    <Key className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    <code className="text-xs bg-muted px-1.5 py-0.5 rounded truncate">{user.referral_code}</code>
                  </div>
                )}
              </div>

              {user.bio && (
                <>
                  <Separator />
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-1">Biografia</p>
                    <p className="text-sm text-muted-foreground leading-relaxed line-clamp-4">{user.bio}</p>
                  </div>
                </>
              )}

              <Separator />

              {/* Account Info */}
              <div className="space-y-2.5">
                <p className="text-xs font-medium text-muted-foreground mb-2">Informações da Conta</p>
                <div className="space-y-2">
                  {/* Last Access */}
                  <div className="flex items-center gap-2.5">
                    <Activity className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="text-sm text-muted-foreground truncate">Último acesso:</span>
                      {user.last_login_at ? (
                        <div className="flex items-center gap-1.5">
                          <div className={`w-2 h-2 rounded-full shrink-0 ${
                            (() => {
                              const hours = (Date.now() - new Date(user.last_login_at).getTime()) / 3600000;
                              if (hours < 24) return 'bg-green-500';
                              if (hours < 168) return 'bg-yellow-500';
                              return 'bg-red-500';
                            })()
                          }`} />
                          <span className="text-sm font-medium truncate">
                            {formatDistanceToNow(new Date(user.last_login_at), { locale: ptBR, addSuffix: true })}
                          </span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5">
                          <div className="w-2 h-2 rounded-full bg-gray-400 shrink-0" />
                          <span className="text-sm text-muted-foreground">Nunca</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Login Count */}
                  <div className="flex items-center gap-2.5">
                    <LogIn className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    <span className="text-sm text-muted-foreground">Total de logins:</span>
                    <span className="text-sm font-medium">{user.login_count || 0}</span>
                  </div>

                  {/* Last Action */}
                  {lastActivity && (
                    <div className="flex items-start gap-2.5">
                      <Eye className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" />
                      <div className="min-w-0">
                        <span className="text-sm text-muted-foreground block">Última ação:</span>
                        <span className="text-xs text-foreground line-clamp-1">{lastActivity.description}</span>
                        <span className="text-xs text-muted-foreground">
                          {formatDistanceToNow(new Date(lastActivity.created_at), { locale: ptBR, addSuffix: true })}
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Last Device */}
                  {lastLoginDevice && (
                    <div className="flex items-center gap-2.5">
                      <Monitor className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      <span className="text-sm text-muted-foreground">Dispositivo:</span>
                      <span className="text-sm font-medium">{lastLoginDevice}</span>
                    </div>
                  )}

                  {/* Terms Acceptance */}
                  {user.accepted_terms_at && (
                    <div className="flex items-center gap-2.5">
                      <FileCheck className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      <span className="text-sm text-muted-foreground">Termos aceitos:</span>
                      <span className="text-sm font-medium">
                        {format(new Date(user.accepted_terms_at), 'dd/MM/yyyy', { locale: ptBR })}
                      </span>
                    </div>
                  )}

                  {/* Signup Source */}
                  {(user.gclid || user.fbclid || user.utm_source || user.referred_by) && (
                    <div className="flex items-start gap-2.5">
                      <Megaphone className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" />
                      <div className="min-w-0">
                        <span className="text-sm text-muted-foreground block">Origem do cadastro:</span>
                        <span className="text-sm font-medium">
                          {user.gclid
                            ? 'Google Ads'
                            : user.fbclid
                            ? 'Meta Ads (Facebook/Instagram)'
                            : user.utm_source
                            ? user.utm_source
                            : 'Indicação'}
                        </span>
                        {user.utm_campaign && (
                          <span className="text-xs text-muted-foreground block truncate">
                            Campanha: {user.utm_campaign}
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <Separator />

              {/* Management Actions */}
              <div className="space-y-1.5">
                <p className="text-xs font-medium text-muted-foreground mb-2">Gestão</p>
                {!isPartnerAccount && (
                  <>
                    <Button variant="outline" size="sm" className="w-full justify-start gap-2" onClick={() => setShowCloneDialog(true)}>
                      <ClipboardCopy className="h-3.5 w-3.5" /> Clonar Usuário
                    </Button>
                    <Button variant="outline" size="sm" className="w-full justify-start gap-2" onClick={() => setShowCopyDialog(true)}>
                      <Copy className="h-3.5 w-3.5" /> Copiar Produtos
                    </Button>
                  </>
                )}
                <Button variant="outline" size="sm" className="w-full justify-start gap-2" onClick={() => setShowPasswordDialog(true)}>
                  <Lock className="h-3.5 w-3.5" /> Alterar Senha
                </Button>
                {!isPartnerAccount && (
                  <Button variant="outline" size="sm" className="w-full justify-start gap-2" onClick={() => setShowImageLimitDialog(true)}>
                    <ImageIcon className="h-3.5 w-3.5" /> Limite de Imagens ({user.max_images_per_product || 10})
                  </Button>
                )}
              </div>

              {!isPartnerAccount && (
                <>
                  <Separator />
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-muted-foreground mb-2">Vitrine</p>
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <MessageCircle className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        <span className="text-sm truncate">Mensagem pré-definida no WhatsApp</span>
                      </div>
                      <Switch
                        checked={user.whatsapp_message_enabled !== false}
                        onCheckedChange={handleToggleWhatsappMessage}
                        disabled={user.whatsapp_mode === 'link'}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {user.whatsapp_mode === 'link'
                        ? 'Sem efeito: esse usuário está no modo "link direto", que nunca envia mensagem pré-definida.'
                        : 'Quando desabilitado, o botão "Falar no WhatsApp" da página de produto abre uma conversa direta, sem mencionar o produto.'}
                    </p>
                  </div>

                  <Separator />
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <Wallet className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        <span className="text-sm truncate">Pagamento online (teste)</span>
                      </div>
                      <Switch
                        checked={!!user.payments_test_override}
                        onCheckedChange={handleTogglePaymentsTestOverride}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Libera pagamento online (aba Pagamento, ativação de credenciais e checkout na vitrine) só para esse usuário, mesmo com a chave geral da plataforma desligada. Use para finalizar e testar a funcionalidade em uma conta real.
                    </p>
                  </div>
                </>
              )}

              <Separator />

              {/* Destructive Actions */}
              <div className="space-y-1.5">
                <p className="text-xs font-medium text-destructive/70 mb-2">Zona de Perigo</p>
                <Button
                  variant={user.is_blocked ? 'outline' : 'destructive'}
                  size="sm"
                  onClick={handleBlockUser}
                  className="w-full justify-start gap-2"
                >
                  <Ban className="h-3.5 w-3.5" />
                  {user.is_blocked ? 'Desbloquear Usuário' : 'Bloquear Usuário'}
                </Button>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive" size="sm" className="w-full justify-start gap-2">
                      <Trash2 className="h-3.5 w-3.5" /> Excluir Usuário
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
                      <AlertDialogDescription>
                        Tem certeza que deseja excluir <strong>{user.name}</strong>? Esta ação não pode ser desfeita.
                        Todos os produtos e dados relacionados serão removidos.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                      <AlertDialogAction onClick={handleDeleteUser} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                        Excluir
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Content */}
        <div className="space-y-6 min-w-0">
          {isPartnerAccount ? (
            <PartnerDetailContent userId={userId!} activeTab={activeTab} setActiveTab={setActiveTab} />
          ) : (
            <>
              {/* Quick Stats */}
              <div className="grid gap-3 grid-cols-2 xl:grid-cols-4">
                <QuickStatCard icon={Package} label="Produtos" value={stats.totalProducts} color="text-blue-600" bg="bg-blue-50 dark:bg-blue-950" />
                <QuickStatCard icon={Eye} label="Visualizações" value={stats.totalViews.toLocaleString('pt-BR')} color="text-emerald-600" bg="bg-emerald-50 dark:bg-emerald-950" />
                <QuickStatCard icon={Users} label="Leads" value={stats.totalLeads.toLocaleString('pt-BR')} color="text-amber-600" bg="bg-amber-50 dark:bg-amber-950" />
                <QuickStatCard icon={TrendingUp} label="Conversão" value={`${stats.conversionRate.toFixed(1)}%`} color="text-rose-600" bg="bg-rose-50 dark:bg-rose-950" />
              </div>

              <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <TabsList className="w-full grid grid-cols-5 h-10">
                  <TabsTrigger value="visao-geral" className="text-xs sm:text-sm">Visão Geral</TabsTrigger>
                  <TabsTrigger value="pedidos" className="text-xs sm:text-sm">Pedidos</TabsTrigger>
                  <TabsTrigger value="assinatura" className="text-xs sm:text-sm">Assinatura</TabsTrigger>
                  <TabsTrigger value="indicacoes" className="text-xs sm:text-sm">Indicações</TabsTrigger>
                  <TabsTrigger value="atividade" className="text-xs sm:text-sm">Atividade</TabsTrigger>
                </TabsList>

                <TabsContent value="visao-geral" className="mt-5 space-y-5">
                  <OverviewTab userId={userId!} stats={stats} userSlug={user.slug} />
                </TabsContent>

                <TabsContent value="pedidos" className="mt-5">
                  <OrdersTab userId={userId!} />
                </TabsContent>

                <TabsContent value="assinatura" className="mt-5 space-y-5">
                  <SubscriptionTab
                    subscription={subscription}
                    subscriptionLoading={subscriptionLoading}
                    recentPayments={recentPayments}
                    userId={userId}
                    userName={user.name}
                    refetchSubscription={refetchSubscription}
                    refetchUser={fetchUserData}
                  />
                </TabsContent>

                <TabsContent value="indicacoes" className="mt-5">
                  <ReferralsTab userId={userId!} referralCode={user?.referral_code} />
                </TabsContent>

                <TabsContent value="atividade" className="mt-5">
                  <Card>
                    <CardContent className="pt-6">
                      <UserActivityLog userId={userId!} />
                    </CardContent>
                  </Card>
                </TabsContent>
              </Tabs>
            </>
          )}
        </div>
      </div>

      {/* Dialogs */}
      <EditImageLimitDialog
        open={showImageLimitDialog}
        onOpenChange={setShowImageLimitDialog}
        userId={user.id}
        userName={user.name}
        currentLimit={user.max_images_per_product || 10}
        onUpdate={handleImageLimitUpdate}
      />
      <CloneUserDialog
        open={showCloneDialog}
        onOpenChange={setShowCloneDialog}
        sourceUserId={user.id}
      />
      <SimpleCopyProductsDialog
        open={showCopyDialog}
        onOpenChange={setShowCopyDialog}
        defaultSourceUserId={user.id}
      />
      <ChangePasswordDialog
        open={showPasswordDialog}
        onOpenChange={setShowPasswordDialog}
        userId={user.id}
        userName={user.name}
      />
    </div>
  );
}

/* ─── Partner Detail Content (role === 'partner') ─── */
function PartnerDetailContent({ userId, activeTab, setActiveTab }: { userId: string; activeTab: string; setActiveTab: (v: string) => void }) {
  const { totalUsers, newUsers30Days, clickCount, recentUsers, loading: dashLoading } = usePartnerDashboardStats(userId);
  const {
    totalEarned, pendingAmount, paidAmount, monthlySeries, tiers, currentTier, nextTier,
    progressToNextTier, activeUserCount, minimumWithdrawalAmount, loading: commissionsLoading,
  } = usePartnerCommissionStats(userId);

  const conversionRate = clickCount > 0 ? Math.round((totalUsers / clickCount) * 100) : 0;

  return (
    <>
      {/* Quick Stats */}
      <div className="grid gap-3 grid-cols-2 xl:grid-cols-4">
        <QuickStatCard icon={UserPlus} label="Usuários Indicados" value={totalUsers} color="text-blue-600" bg="bg-blue-50 dark:bg-blue-950" />
        <QuickStatCard icon={Users} label="Novos (30 dias)" value={newUsers30Days} color="text-emerald-600" bg="bg-emerald-50 dark:bg-emerald-950" />
        <QuickStatCard icon={MousePointerClick} label="Acessos ao Link" value={clickCount} color="text-amber-600" bg="bg-amber-50 dark:bg-amber-950" />
        <QuickStatCard icon={TrendingUp} label="Conversão" value={`${conversionRate}%`} color="text-rose-600" bg="bg-rose-50 dark:bg-rose-950" />
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="w-full grid grid-cols-5 h-10">
          <TabsTrigger value="visao-geral" className="text-xs sm:text-sm">Visão Geral</TabsTrigger>
          <TabsTrigger value="usuarios-geridos" className="text-xs sm:text-sm">Usuários</TabsTrigger>
          <TabsTrigger value="comissoes" className="text-xs sm:text-sm">Comissões</TabsTrigger>
          <TabsTrigger value="link" className="text-xs sm:text-sm">Meu Link</TabsTrigger>
          <TabsTrigger value="atividade" className="text-xs sm:text-sm">Atividade</TabsTrigger>
        </TabsList>

        <TabsContent value="visao-geral" className="mt-5 space-y-5">
          <div className="grid gap-4 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle className="text-base">Comissões (últimos 12 meses)</CardTitle>
              </CardHeader>
              <CardContent>
                {commissionsLoading ? (
                  <div className="flex items-center justify-center h-[220px]"><Skeleton className="h-full w-full" /></div>
                ) : (
                  <ResponsiveContainer width="100%" height={240}>
                    <BarChart data={monthlySeries} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" vertical={false} />
                      <XAxis dataKey="month" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} axisLine={false} tickLine={false} />
                      <YAxis
                        tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                        axisLine={false}
                        tickLine={false}
                        tickFormatter={(v) => (v >= 1000 ? `R$${(v / 1000).toFixed(1)}k` : `R$${v}`)}
                      />
                      <Tooltip
                        contentStyle={{ backgroundColor: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))', borderRadius: '8px', color: 'hsl(var(--popover-foreground))' }}
                        formatter={(value: number) => formatCurrencyI18n(value, 'BRL', 'pt-BR')}
                      />
                      <Bar dataKey="new" name="Novas" stackId="a" fill="hsl(var(--chart-1))" maxBarSize={32} />
                      <Bar dataKey="renewal" name="Renovações" stackId="a" fill="hsl(var(--chart-2))" radius={[4, 4, 0, 0]} maxBarSize={32} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            <div className="space-y-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <Award className="h-4 w-4" /> Tier Atual
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {commissionsLoading ? (
                    <Skeleton className="h-16 w-full" />
                  ) : (
                    <>
                      <p className="text-2xl font-bold">{currentTier ? `${currentTier.commission_percentage}%` : '—'}</p>
                      {nextTier ? (
                        <>
                          <Progress value={progressToNextTier * 100} />
                          <p className="text-xs text-muted-foreground">
                            {activeUserCount} de {nextTier.min_active_users} usuários ativos para atingir {nextTier.commission_percentage}%
                          </p>
                        </>
                      ) : (
                        <p className="text-xs text-muted-foreground">Já está no maior nível de comissão.</p>
                      )}
                    </>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <Wallet className="h-4 w-4" /> Disponível para saque
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {commissionsLoading ? (
                    <Skeleton className="h-8 w-24" />
                  ) : (
                    <>
                      <p className="text-2xl font-bold">{formatCurrencyI18n(pendingAmount, 'BRL', 'pt-BR')}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Total ganho: {formatCurrencyI18n(totalEarned, 'BRL', 'pt-BR')} · pago: {formatCurrencyI18n(paidAmount, 'BRL', 'pt-BR')} · mínimo p/ saque {formatCurrencyI18n(minimumWithdrawalAmount, 'BRL', 'pt-BR')}
                      </p>
                    </>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>

          <Card>
            <CardHeader><CardTitle className="text-base">Cadastros recentes</CardTitle></CardHeader>
            <CardContent>
              {dashLoading ? (
                <div className="space-y-2">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
              ) : recentUsers.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">Nenhum usuário cadastrado ainda.</p>
              ) : (
                <div className="space-y-2">
                  {recentUsers.map((u) => (
                    <Link key={u.id} to={`/admin/users/${u.id}`} className="flex items-center justify-between border rounded-lg p-3 hover:bg-muted/40 transition-colors">
                      <div>
                        <p className="font-medium text-sm">{u.name}</p>
                        <p className="text-xs text-muted-foreground">{u.email}</p>
                      </div>
                      <p className="text-xs text-muted-foreground">{new Date(u.created_at).toLocaleDateString('pt-BR')}</p>
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="usuarios-geridos" className="mt-5">
          <PartnerManagedUsersTab partnerId={userId} />
        </TabsContent>

        <TabsContent value="comissoes" className="mt-5 space-y-5">
          <Card>
            <CardHeader><CardTitle className="text-base">Faixas de Comissão</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {tiers.map((tier) => (
                <div key={tier.id} className={`flex items-center justify-between rounded-lg border p-3 ${currentTier?.id === tier.id ? 'border-foreground/30 bg-foreground/[0.03]' : 'border-border'}`}>
                  <p className="text-sm font-medium">
                    A partir de {tier.min_active_users} usuários ativos{tier.label && <span className="text-muted-foreground"> — {tier.label}</span>}
                  </p>
                  <Badge variant={currentTier?.id === tier.id ? 'default' : 'outline'}>{tier.commission_percentage}%</Badge>
                </div>
              ))}
            </CardContent>
          </Card>
          <PartnerCommissionsHistoryTab partnerId={userId} />
        </TabsContent>

        <TabsContent value="link" className="mt-5">
          <PartnerReferralLinkTab partnerId={userId} clickCount={clickCount} clickLoading={dashLoading} />
        </TabsContent>

        <TabsContent value="atividade" className="mt-5">
          <Card>
            <CardContent className="pt-6">
              <UserActivityLog userId={userId} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </>
  );
}

/* ─── Partner: Managed Users Tab ─── */
function PartnerManagedUsersTab({ partnerId }: { partnerId: string }) {
  const [users, setUsers] = useState<any[]>([]);
  const [pendingPaymentIds, setPendingPaymentIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from('users')
        .select('id, name, email, whatsapp, is_blocked, plan_status, billing_cycle, slug, created_at')
        .eq('managed_by_partner_id', partnerId)
        .order('created_at', { ascending: false });
      setUsers(data || []);

      const ids = (data || []).map((u) => u.id);
      if (ids.length > 0) {
        const { data: pendingSubs } = await supabase
          .from('subscriptions')
          .select('user_id')
          .in('user_id', ids)
          .eq('status', 'pending')
          .not('payment_due_at', 'is', null);
        setPendingPaymentIds(new Set((pendingSubs || []).map((s) => s.user_id)));
      }
      setLoading(false);
    })();
  }, [partnerId]);

  if (loading) {
    return <Card><CardContent className="py-12 flex items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></CardContent></Card>;
  }

  return (
    <Card>
      <CardContent className="pt-6">
        {users.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">Nenhum usuário gerido por este parceiro</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Usuário</TableHead>
                <TableHead>Plano</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Cadastro</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((u) => (
                <TableRow key={u.id}>
                  <TableCell>
                    <Link to={`/admin/users/${u.id}`} className="hover:underline">
                      <p className="text-sm font-medium">{u.name}</p>
                      <p className="text-xs text-muted-foreground">{u.email}</p>
                    </Link>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1.5">
                      <PlanStatusBadge status={u.plan_status as PlanStatus} billingCycle={u.billing_cycle as BillingCycle | undefined} />
                      {pendingPaymentIds.has(u.id) && (
                        <Badge variant="outline" className="text-xs border-amber-300 bg-amber-50 text-amber-800">Pagamento Pendente</Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={u.is_blocked ? 'destructive' : 'default'} className="text-xs">{u.is_blocked ? 'Bloqueado' : 'Ativo'}</Badge>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">{new Date(u.created_at).toLocaleDateString('pt-BR')}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

/* ─── Partner: Commissions History Tab ─── */
function PartnerCommissionsHistoryTab({ partnerId }: { partnerId: string }) {
  const [commissions, setCommissions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from('partner_commissions')
        .select('id, managed_user_id, plan_name, amount, type, status, created_at')
        .eq('partner_id', partnerId)
        .order('created_at', { ascending: false });

      const commissionsData = data || [];
      const managedUserIds = [...new Set(commissionsData.map((c) => c.managed_user_id))];
      const usersMap = new Map<string, string>();
      if (managedUserIds.length > 0) {
        const { data: usersData } = await supabase.from('users').select('id, name').in('id', managedUserIds);
        for (const u of usersData || []) usersMap.set(u.id, u.name);
      }
      setCommissions(commissionsData.map((c) => ({ ...c, managed_user_name: usersMap.get(c.managed_user_id) || 'Desconhecido' })));
      setLoading(false);
    })();
  }, [partnerId]);

  if (loading) {
    return <Card><CardContent className="py-12 flex items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></CardContent></Card>;
  }

  return (
    <Card>
      <CardHeader><CardTitle className="text-base">Histórico de Comissões</CardTitle></CardHeader>
      <CardContent>
        {commissions.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">Nenhuma comissão encontrada</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Usuário</TableHead>
                <TableHead>Plano</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Valor</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Data</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {commissions.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="text-sm font-medium">{c.managed_user_name}</TableCell>
                  <TableCell className="text-sm">{c.plan_name || '-'}</TableCell>
                  <TableCell><Badge variant="outline" className="text-xs">{c.type === 'renewal' ? 'Renovação' : 'Nova assinatura'}</Badge></TableCell>
                  <TableCell className="font-medium">{formatCurrencyI18n(c.amount, 'BRL', 'pt-BR')}</TableCell>
                  <TableCell>
                    {c.status === 'pending'
                      ? <Badge variant="outline" className="text-xs border-amber-300 text-amber-600">Pendente</Badge>
                      : c.status === 'paid'
                      ? <Badge className="bg-green-500 text-xs">Pago</Badge>
                      : <Badge variant="destructive" className="text-xs">Revertido</Badge>}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">{new Date(c.created_at).toLocaleDateString('pt-BR')}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

/* ─── Partner: Referral Link Tab ─── */
function PartnerReferralLinkTab({ partnerId, clickCount, clickLoading }: { partnerId: string; clickCount: number; clickLoading: boolean }) {
  const [referralCode, setReferralCode] = useState<string | null>(null);
  const [referredUsers, setReferredUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data: userData } = await supabase.from('users').select('referral_code').eq('id', partnerId).maybeSingle();
      setReferralCode(userData?.referral_code || null);

      const { data } = await supabase
        .from('users')
        .select('id, name, email, created_at')
        .eq('managed_by_partner_id', partnerId)
        .eq('referred_by', partnerId)
        .order('created_at', { ascending: false });
      setReferredUsers(data || []);
      setLoading(false);
    })();
  }, [partnerId]);

  const referralLink = referralCode ? generateReferralLink(referralCode) : null;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader><CardTitle className="text-base">Link de Indicação</CardTitle></CardHeader>
        <CardContent>
          {loading ? (
            <Skeleton className="h-9 w-full" />
          ) : referralLink ? (
            <div className="flex items-center gap-2">
              <code className="flex-1 text-xs bg-muted px-3 py-2 rounded truncate">{referralLink}</code>
              <Button variant="outline" size="sm" onClick={() => { navigator.clipboard.writeText(referralLink); toast.success('Link copiado'); }}>
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Nenhum código de indicação gerado ainda.</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium flex items-center gap-2"><MousePointerClick className="h-4 w-4" /> Acessos ao link</CardTitle>
        </CardHeader>
        <CardContent>
          {clickLoading ? <Skeleton className="h-8 w-16" /> : <p className="text-2xl font-bold">{clickCount}</p>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-sm font-medium flex items-center gap-2"><Link2 className="h-4 w-4" /> Cadastrados pelo link</CardTitle></CardHeader>
        <CardContent>
          {loading ? (
            <Skeleton className="h-16 w-full" />
          ) : referredUsers.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">Ninguém se cadastrou pelo link ainda.</p>
          ) : (
            <div className="space-y-2">
              {referredUsers.map((u) => (
                <Link key={u.id} to={`/admin/users/${u.id}`} className="flex items-center justify-between border rounded-lg p-3 hover:bg-muted/40 transition-colors">
                  <div>
                    <p className="font-medium text-sm">{u.name}</p>
                    <p className="text-xs text-muted-foreground">{u.email}</p>
                  </div>
                  <p className="text-xs text-muted-foreground">{new Date(u.created_at).toLocaleDateString('pt-BR')}</p>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

/* ─── Quick Stat Card ─── */
function QuickStatCard({ icon: Icon, label, value, color, bg }: {
  icon: any; label: string; value: string | number; color: string; bg: string;
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-3">
          <div className={`rounded-lg p-2 shrink-0 ${bg}`}>
            <Icon className={`h-4 w-4 ${color}`} />
          </div>
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground truncate">{label}</p>
            <p className="text-xl font-bold truncate" title={String(value)}>{value}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/* ─── Status Bar ─── */
function StatusBar({ label, count, total, color }: { label: string; count: number; total: number; color: string }) {
  const pct = total > 0 ? (count / total) * 100 : 0;
  return (
    <div className="flex items-center gap-3">
      <span className="text-sm w-24 text-muted-foreground">{label}</span>
      <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
        <div className={`h-full rounded-full ${color} transition-all`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-sm font-medium w-10 text-right">{count}</span>
    </div>
  );
}

/* ─── Overview Tab ─── */
function OverviewTab({ userId, stats, userSlug }: { userId: string; stats: AggregatedStats; userSlug?: string }) {
  const [chartData, setChartData] = useState<{ date: string; views: number; leads: number }[]>([]);
  const [leadsBySource, setLeadsBySource] = useState<{ source: string; count: number }[]>([]);
  const [topProducts, setTopProducts] = useState<{ id: string; title: string; image?: string; views: number }[]>([]);
  const [chartsLoading, setChartsLoading] = useState(true);

  useEffect(() => {
    fetchChartData();
  }, [userId]);

  const fetchChartData = async () => {
    try {
      const { data: products } = await supabase
        .from('products')
        .select('id')
        .eq('user_id', userId);
      const ids = products?.map(p => p.id) || [];
      if (ids.length === 0) { setChartsLoading(false); return; }

      const days = 30;
      const startDate = startOfDay(subDays(new Date(), days - 1));
      const endDate = endOfDay(new Date());

      const [viewsRes, leadsRes] = await Promise.all([
        supabase.from('property_views').select('viewed_at').in('property_id', ids)
          .gte('viewed_at', startDate.toISOString()).lte('viewed_at', endDate.toISOString()),
        supabase.from('leads').select('created_at, source').in('property_id', ids)
          .gte('created_at', startDate.toISOString()).lte('created_at', endDate.toISOString()),
      ]);

      const viewsByDate = new Map<string, number>();
      (viewsRes.data || []).forEach(v => {
        const key = format(new Date(v.viewed_at), 'dd/MM');
        viewsByDate.set(key, (viewsByDate.get(key) || 0) + 1);
      });

      const leadsByDate = new Map<string, number>();
      const sourceCount: Record<string, number> = {};
      (leadsRes.data || []).forEach(l => {
        const key = format(new Date(l.created_at), 'dd/MM');
        leadsByDate.set(key, (leadsByDate.get(key) || 0) + 1);
        const src = l.source || 'direto';
        sourceCount[src] = (sourceCount[src] || 0) + 1;
      });

      const chart: { date: string; views: number; leads: number }[] = [];
      for (let i = days - 1; i >= 0; i--) {
        const d = subDays(new Date(), i);
        const key = format(d, 'dd/MM');
        chart.push({ date: key, views: viewsByDate.get(key) || 0, leads: leadsByDate.get(key) || 0 });
      }
      setChartData(chart);
      setLeadsBySource(Object.entries(sourceCount).map(([source, count]) => ({ source, count })));

      const { data: viewCounts } = await supabase
        .from('property_views')
        .select('property_id')
        .in('property_id', ids);

      const productViewCounts: Record<string, number> = {};
      (viewCounts || []).forEach(v => {
        productViewCounts[v.property_id] = (productViewCounts[v.property_id] || 0) + 1;
      });

      const topIds = Object.entries(productViewCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5);

      if (topIds.length > 0) {
        const { data: topProds } = await supabase
          .from('products')
          .select('id, title, featured_image_url')
          .in('id', topIds.map(t => t[0]));

        const prodMap = new Map((topProds || []).map(p => [p.id, p]));
        setTopProducts(topIds.map(([id, views]) => {
          const p = prodMap.get(id);
          return { id, title: p?.title || 'Produto', image: p?.featured_image_url, views };
        }));
      }
    } catch (error) {
      console.error('Error fetching chart data:', error);
    } finally {
      setChartsLoading(false);
    }
  };

  return (
    <>
      {/* Product Distribution */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Package className="h-4 w-4" /> Distribuição de Produtos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <StatusBar label="Disponiveis" count={stats.activeProducts} total={stats.totalProducts} color="bg-emerald-500" />
              <StatusBar label="Vendidos" count={stats.soldProducts} total={stats.totalProducts} color="bg-blue-500" />
              <StatusBar label="Reservados" count={stats.reservedProducts} total={stats.totalProducts} color="bg-amber-500" />
            </div>
            <div className="mt-4 pt-3 border-t flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Valor total em estoque</span>
              <span className="font-semibold">R$ {stats.totalValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <BarChart3 className="h-4 w-4" /> Top Categorias
            </CardTitle>
          </CardHeader>
          <CardContent>
            {stats.topCategories.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">Nenhuma categoria</p>
            ) : (
              <div className="space-y-3">
                {stats.topCategories.map((cat) => (
                  <div key={cat.name} className="flex items-center justify-between">
                    <span className="text-sm truncate max-w-[180px]">{cat.name}</span>
                    <div className="flex items-center gap-2">
                      <div className="w-20 h-1.5 rounded-full bg-muted overflow-hidden">
                        <div
                          className="h-full rounded-full bg-primary/60"
                          style={{ width: `${Math.min(100, (cat.count / (stats.topCategories[0]?.count || 1)) * 100)}%` }}
                        />
                      </div>
                      <span className="text-xs text-muted-foreground w-8 text-right">{cat.count}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
            {userSlug && (
              <div className="mt-4 pt-3 border-t">
                <Button variant="outline" size="sm" className="w-full gap-1.5" onClick={() => window.open(`/${userSlug}`, '_blank')}>
                  <ExternalLink className="h-3.5 w-3.5" /> Ver Vitrine Completa
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      {chartsLoading ? (
        <Card>
          <CardContent className="py-12 flex items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Visualizações e Leads</CardTitle>
              <CardDescription className="text-xs">Últimos 30 dias</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[260px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="date" tick={{ fontSize: 11 }} interval={4} stroke="hsl(var(--muted-foreground))" />
                    <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'hsl(var(--popover))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px',
                        fontSize: '12px',
                        color: 'hsl(var(--popover-foreground))',
                      }}
                    />
                    <Legend wrapperStyle={{ fontSize: '12px' }} />
                    <Line type="monotone" dataKey="views" stroke="hsl(var(--primary))" name="Visualizações" strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="leads" stroke="#10b981" name="Leads" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Leads por Origem</CardTitle>
              <CardDescription className="text-xs">Últimos 30 dias</CardDescription>
            </CardHeader>
            <CardContent>
              {leadsBySource.length === 0 ? (
                <div className="h-[260px] flex items-center justify-center text-sm text-muted-foreground">
                  Sem dados de leads no período
                </div>
              ) : (
                <div className="h-[260px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={leadsBySource}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="source" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                      <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: 'hsl(var(--popover))',
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '8px',
                          fontSize: '12px',
                          color: 'hsl(var(--popover-foreground))',
                        }}
                      />
                      <Bar dataKey="count" fill="hsl(var(--primary))" name="Leads" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Top Products */}
      {topProducts.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <TrendingUp className="h-4 w-4" /> Produtos Mais Visualizados
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2.5">
              {topProducts.map((p, i) => (
                <div key={p.id} className="flex items-center gap-3">
                  <span className="text-xs font-bold text-muted-foreground w-5 text-right">{i + 1}</span>
                  <div className="w-9 h-9 rounded overflow-hidden bg-muted shrink-0">
                    {p.image ? (
                      <img src={p.image} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center"><Package className="h-4 w-4 text-muted-foreground" /></div>
                    )}
                  </div>
                  <span className="text-sm truncate flex-1">{p.title}</span>
                  <span className="text-xs text-muted-foreground">{p.views.toLocaleString('pt-BR')} views</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </>
  );
}

/* ─── Orders Tab ─── */
function OrdersTab({ userId }: { userId: string }) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [orderStats, setOrderStats] = useState({ total: 0, pending: 0, delivered: 0, totalRevenue: 0 });
  const [loading, setLoading] = useState(true);
  const [offset, setOffset] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const PAGE_SIZE = 10;

  useEffect(() => { fetchData(); }, [userId]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [ordersResult, stats] = await Promise.all([
        fetchOrders(userId, PAGE_SIZE, 0),
        getOrderStats(userId),
      ]);
      setOrders(ordersResult.data);
      setTotalCount(ordersResult.count);
      setOffset(PAGE_SIZE);
      setOrderStats({
        total: stats.total,
        pending: stats.pending,
        delivered: stats.delivered,
        totalRevenue: stats.totalRevenue,
      });
    } catch (error) {
      console.error('Error fetching orders:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadMore = async () => {
    const result = await fetchOrders(userId, PAGE_SIZE, offset);
    setOrders(prev => [...prev, ...result.data]);
    setOffset(prev => prev + PAGE_SIZE);
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="py-12 flex items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 grid-cols-2 xl:grid-cols-4">
        <QuickStatCard icon={ShoppingCart} label="Total (30d)" value={orderStats.total} color="text-blue-600" bg="bg-blue-50 dark:bg-blue-950" />
        <QuickStatCard icon={Package} label="Pendentes" value={orderStats.pending} color="text-amber-600" bg="bg-amber-50 dark:bg-amber-950" />
        <QuickStatCard icon={Package} label="Entregues" value={orderStats.delivered} color="text-emerald-600" bg="bg-emerald-50 dark:bg-emerald-950" />
        <QuickStatCard icon={DollarSign} label="Receita (30d)" value={`R$ ${orderStats.totalRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`} color="text-green-600" bg="bg-green-50 dark:bg-green-950" />
      </div>

      <Card>
        <CardContent className="pt-5">
          {orders.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground text-sm">
              Nenhum pedido recebido
            </div>
          ) : (
            <>
              <div className="border rounded-lg overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-muted/50">
                      <tr className="border-b">
                        <th className="px-4 py-2.5 text-left text-xs font-medium">Cliente</th>
                        <th className="px-4 py-2.5 text-left text-xs font-medium">Status</th>
                        <th className="px-4 py-2.5 text-left text-xs font-medium">Pagamento</th>
                        <th className="px-4 py-2.5 text-right text-xs font-medium">Total</th>
                        <th className="px-4 py-2.5 text-right text-xs font-medium">Data</th>
                      </tr>
                    </thead>
                    <tbody>
                      {orders.map((order) => (
                        <tr key={order.id} className="border-b last:border-b-0 hover:bg-muted/30 transition-colors">
                          <td className="px-4 py-2.5">
                            <p className="text-sm font-medium">{order.customer_name}</p>
                            <p className="text-xs text-muted-foreground">{order.order_items?.length || 0} itens</p>
                          </td>
                          <td className="px-4 py-2.5">
                            <OrderStatusBadge status={order.status} />
                          </td>
                          <td className="px-4 py-2.5">
                            {order.payment_method ? (
                              <Badge variant="outline" className="text-xs">{order.payment_method}</Badge>
                            ) : (
                              <span className="text-xs text-muted-foreground">-</span>
                            )}
                          </td>
                          <td className="px-4 py-2.5 text-right">
                            <span className="text-sm font-medium">
                              R$ {Number(order.total).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                            </span>
                          </td>
                          <td className="px-4 py-2.5 text-right text-xs text-muted-foreground">
                            {format(new Date(order.created_at), 'dd/MM/yy', { locale: ptBR })}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
              {offset < totalCount && (
                <div className="mt-3 text-center">
                  <Button variant="outline" size="sm" onClick={loadMore}>
                    Carregar mais ({totalCount - offset} restantes)
                  </Button>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

/* ─── Subscription Tab ─── */
function SubscriptionTab({ subscription, subscriptionLoading, recentPayments, userId, userName, refetchSubscription, refetchUser }: {
  subscription: any; subscriptionLoading: boolean; recentPayments: any[];
  userId?: string; userName: string; refetchSubscription: () => void; refetchUser: () => void;
}) {
  if (subscriptionLoading) {
    return (
      <Card>
        <CardContent className="py-12 flex items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  const handleSubscriptionUpdate = () => {
    refetchSubscription();
    refetchUser();
  };

  return (
    <div className="space-y-5">
      <SubscriptionManagement
        subscription={subscription}
        userId={userId}
        userName={userName}
        onSubscriptionUpdate={handleSubscriptionUpdate}
      />

      {recentPayments.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Histórico de Pagamentos</CardTitle>
            <CardDescription className="text-xs">
              Últimos {recentPayments.length} pagamentos registrados
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="border rounded-lg overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-muted/50">
                    <tr className="border-b">
                      <th className="px-4 py-2.5 text-left text-xs font-medium">Data</th>
                      <th className="px-4 py-2.5 text-left text-xs font-medium">Valor</th>
                      <th className="px-4 py-2.5 text-left text-xs font-medium">Metodo</th>
                      <th className="px-4 py-2.5 text-left text-xs font-medium">Status</th>
                      <th className="px-4 py-2.5 text-left text-xs font-medium">Obs</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentPayments.map((payment) => (
                      <tr key={payment.id} className="border-b last:border-b-0 hover:bg-muted/30 transition-colors">
                        <td className="px-4 py-2.5 text-sm">
                          {format(new Date(payment.payment_date), 'dd/MM/yyyy', { locale: ptBR })}
                        </td>
                        <td className="px-4 py-2.5">
                          <span className="text-sm font-medium">
                            R$ {payment.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </span>
                        </td>
                        <td className="px-4 py-2.5">
                          <Badge variant="outline" className="text-xs">{payment.payment_method}</Badge>
                        </td>
                        <td className="px-4 py-2.5">
                          <Badge
                            variant={payment.status === 'completed' ? 'default' : 'secondary'}
                            className="text-xs"
                          >
                            {payment.status === 'completed' ? 'Concluído' :
                             payment.status === 'pending' ? 'Pendente' :
                             payment.status === 'failed' ? 'Falhou' : 'Reembolsado'}
                          </Badge>
                        </td>
                        <td className="px-4 py-2.5 text-xs text-muted-foreground max-w-[150px] truncate">
                          {payment.notes || '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

/* ─── Referrals Tab ─── */
function ReferralsTab({ userId, referralCode }: { userId: string; referralCode?: string }) {
  const [commissions, setCommissions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [referralStats, setReferralStats] = useState({ total: 0, pending: 0, paid: 0 });

  const fetchReferrals = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await supabase
        .from('referral_commissions')
        .select('*')
        .eq('referrer_id', userId)
        .order('created_at', { ascending: false });

      const commissionsData = data || [];
      const referredIds = commissionsData.map(c => c.referred_user_id);

      const usersMap = new Map<string, { name: string; email: string }>();
      if (referredIds.length > 0) {
        const { data: usersData } = await supabase.from('users').select('id, name, email').in('id', referredIds);
        for (const u of usersData || []) usersMap.set(u.id, { name: u.name, email: u.email });
      }

      const enriched = commissionsData.map(c => ({
        ...c,
        referred_name: usersMap.get(c.referred_user_id)?.name || 'Desconhecido',
        referred_email: usersMap.get(c.referred_user_id)?.email || '',
      }));

      setCommissions(enriched);
      setReferralStats({
        total: enriched.length,
        pending: enriched.filter(c => c.status === 'pending').reduce((s: number, c: any) => s + c.amount, 0),
        paid: enriched.filter(c => c.status === 'paid').reduce((s: number, c: any) => s + c.amount, 0),
      });
    } catch (error) {
      console.error('Error fetching user referrals:', error);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => { fetchReferrals(); }, [fetchReferrals]);

  const referralLink = referralCode ? generateReferralLink(referralCode) : null;

  if (loading) {
    return (
      <Card><CardContent className="py-12 flex items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></CardContent></Card>
    );
  }

  return (
    <div className="space-y-4">
      {referralLink && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Link de Indicação</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <code className="flex-1 text-xs bg-muted px-3 py-2 rounded truncate">{referralLink}</code>
              <Button variant="outline" size="sm" onClick={() => { navigator.clipboard.writeText(referralLink); toast.success('Link copiado'); }}>
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-3 gap-3">
        <Card>
          <CardContent className="pt-4 pb-4 px-4">
            <p className="text-xs text-muted-foreground">Indicações</p>
            <p className="text-xl font-bold mt-1">{referralStats.total}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4 px-4">
            <p className="text-xs text-muted-foreground">Pendente</p>
            <p className="text-xl font-bold mt-1 text-amber-600">R$ {referralStats.pending.toFixed(2)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4 px-4">
            <p className="text-xs text-muted-foreground">Pago</p>
            <p className="text-xl font-bold mt-1 text-green-600">R$ {referralStats.paid.toFixed(2)}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2"><Gift className="h-4 w-4" /> Usuários Indicados</CardTitle>
        </CardHeader>
        <CardContent>
          {commissions.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">Nenhuma indicação realizada</p>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Indicado</TableHead>
                    <TableHead>Plano</TableHead>
                    <TableHead>Comissão</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Data</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {commissions.map((c: any) => (
                    <TableRow key={c.id}>
                      <TableCell>
                        <div>
                          <p className="text-sm font-medium">{c.referred_name}</p>
                          <p className="text-xs text-muted-foreground">{c.referred_email}</p>
                        </div>
                      </TableCell>
                      <TableCell><Badge variant="outline" className="text-xs">{c.plan_type}</Badge></TableCell>
                      <TableCell className="font-medium">R$ {c.amount.toFixed(2)}</TableCell>
                      <TableCell>
                        {c.status === 'pending'
                          ? <Badge variant="outline" className="text-xs border-amber-300 text-amber-600">Pendente</Badge>
                          : <Badge className="bg-green-500 text-xs">Pago</Badge>}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {format(new Date(c.created_at), 'dd/MM/yy', { locale: ptBR })}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
