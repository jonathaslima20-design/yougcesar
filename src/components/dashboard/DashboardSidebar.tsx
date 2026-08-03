import { useState, useEffect } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { LayoutDashboard, Package, LogOut, Menu, X, Settings, FolderTree, Gift, CircleHelp as HelpCircle, ShoppingBag, ClipboardList, ChevronDown, BookOpen, ArrowLeftRight, Warehouse, ChartBar as BarChart3, Ticket, TriangleAlert as AlertTriangle, LineChart, Handshake, MessageCircle, Users, LayoutGrid } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { useAuth } from '@/contexts/AuthContext';
import { cn, getInitials } from '@/lib/utils';
import { supabase } from '@/lib/supabase';
import Logo from '@/components/Logo';
import PlanStatusBadge from '@/components/subscription/PlanStatusBadge';
import PlanUsageIndicator from '@/components/dashboard/PlanUsageIndicator';
import { getPendingOrderCount } from '@/lib/orderService';
import { logAffiliateTeaserEvent } from '@/lib/affiliateUtils';

export default function DashboardSidebar() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [openGroup, setOpenGroup] = useState<'catalog' | 'stock' | 'sales' | null>(null);
  const [pendingOrders, setPendingOrders] = useState(0);
  const [pendingPayment, setPendingPayment] = useState<{ plan_name: string; payment_due_at: string } | null>(null);
  const [showAffiliateTeaser, setShowAffiliateTeaser] = useState(false);
  const { signOut, user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const isCatalogSection = location.pathname.startsWith('/dashboard/listings') || location.pathname.startsWith('/dashboard/categories');
  const isStockSection = location.pathname.startsWith('/dashboard/inventory') || location.pathname.startsWith('/dashboard/stock-movements');
  const isSalesSection = location.pathname.startsWith('/dashboard/orders') || location.pathname.startsWith('/dashboard/sales') || location.pathname.startsWith('/dashboard/coupons');

  useEffect(() => {
    if (isCatalogSection) setOpenGroup('catalog');
    else if (isStockSection) setOpenGroup('stock');
    else if (isSalesSection) setOpenGroup('sales');
  }, [isCatalogSection, isStockSection, isSalesSection]);

  const toggleGroup = (group: 'catalog' | 'stock' | 'sales') => {
    setOpenGroup((prev) => (prev === group ? null : group));
  };

  useEffect(() => {
    if (!user?.id) return;
    getPendingOrderCount(user.id).then(setPendingOrders);
  }, [user?.id]);

  // Partner-assigned accounts start with plan_status 'active' while payment is still
  // pending — surface it here so the user can pay before the deadline auto-blocks them.
  useEffect(() => {
    if (!user?.id || user.plan_status !== 'active') {
      setPendingPayment(null);
      return;
    }
    (async () => {
      const { data } = await supabase
        .from('subscriptions')
        .select('plan_name, payment_due_at')
        .eq('user_id', user.id)
        .eq('status', 'pending')
        .not('payment_due_at', 'is', null)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      setPendingPayment(data || null);
    })();
  }, [user?.id, user?.plan_status]);

  const handlePayPendingPlan = async (isMobile: boolean) => {
    if (!pendingPayment?.plan_name) return;
    const { data: plan } = await supabase
      .from('subscription_plans')
      .select('id, duration')
      .eq('name', pendingPayment.plan_name)
      .maybeSingle();
    if (plan) {
      navigate(`/dashboard/checkout?plan=${plan.id}&cycle=${plan.duration}`);
      if (isMobile) toggleMobileSidebar();
    }
  };

  const catalogSubItems = [
    { name: 'Produtos', href: '/dashboard/listings', icon: Package },
    { name: 'Categorias', href: '/dashboard/categories', icon: FolderTree },
  ];

  const stockSubItems = [
    { name: 'Visão Geral', href: '/dashboard/inventory', icon: BarChart3 },
    { name: 'Movimentações', href: '/dashboard/stock-movements', icon: ArrowLeftRight },
  ];

  const salesSubItems = [
    { name: 'Pedidos', href: '/dashboard/orders', icon: ClipboardList, badge: pendingOrders },
    { name: 'Cupons', href: '/dashboard/coupons', icon: Ticket },
  ];

  const toggleMobileSidebar = () => setMobileOpen(!mobileOpen);

  const sidebarContent = (isMobile: boolean) => {
    return (
      <>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-5">
          <div className="flex items-center gap-3">
            <Logo showText size="md" />
          </div>
          {isMobile && (
            <button onClick={toggleMobileSidebar} className="h-8 w-8 flex items-center justify-center hover:bg-foreground/5 transition-colors">
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Navigation */}
        <div className="flex-1 overflow-y-auto px-3 py-2">
          <nav className="space-y-0.5">
            <InkNavItem
              name="Dashboard"
              href="/dashboard"
              icon={LayoutDashboard}
              end
              isExpanded
              onClick={() => isMobile && toggleMobileSidebar()}
            />
            <InkNavItem
              name="Relatórios"
              href="/dashboard/reports"
              icon={LineChart}
              end
              isExpanded
              onClick={() => isMobile && toggleMobileSidebar()}
            />
            <InkGroupItem
              label="Catálogo"
              icon={BookOpen}
              isGroupActive={isCatalogSection}
              isOpen={openGroup === 'catalog'}
              onToggle={() => toggleGroup('catalog')}
              isExpanded
              items={catalogSubItems}
              onItemClick={() => isMobile && toggleMobileSidebar()}
            />
            <InkGroupItem
              label="Estoque"
              icon={Warehouse}
              isGroupActive={isStockSection}
              isOpen={openGroup === 'stock'}
              onToggle={() => toggleGroup('stock')}
              isExpanded
              items={stockSubItems}
              onItemClick={() => isMobile && toggleMobileSidebar()}
            />
            <InkGroupItem
              label="Vendas"
              icon={ShoppingBag}
              isGroupActive={isSalesSection}
              isOpen={openGroup === 'sales'}
              onToggle={() => toggleGroup('sales')}
              isExpanded
              items={salesSubItems}
              onItemClick={() => isMobile && toggleMobileSidebar()}
              badge={pendingOrders}
            />
            {user?.affiliate_program_enabled ? (
              <InkNavItem
                name="Afiliados"
                href="/dashboard/affiliates"
                icon={Handshake}
                end
                isExpanded
                onClick={() => isMobile && toggleMobileSidebar()}
              />
            ) : !user?.affiliate_teaser_hidden ? (
              <AffiliateTeaserNavItem onClick={() => setShowAffiliateTeaser(true)} />
            ) : null}
            <div className="h-px bg-foreground/[0.06] my-3 mx-2" />

            <InkNavItem
              name="Configurações"
              href="/dashboard/settings"
              icon={Settings}
              end
              isExpanded
              onClick={() => isMobile && toggleMobileSidebar()}
            />
            <InkNavItem
              name="Central de Ajuda"
              href="/help"
              icon={HelpCircle}
              end
              isExpanded
              onClick={() => isMobile && toggleMobileSidebar()}
            />
          </nav>
        </div>

        {/* Footer */}
        <div className="mt-auto px-3 pb-4 pt-2">
          <PlanUsageIndicator expanded />
          <div className="py-2">
            <InkNavItem
              name="Indique e Ganhe"
              href="/dashboard/referral"
              icon={Gift}
              end
              isExpanded
              onClick={() => isMobile && toggleMobileSidebar()}
            />
          </div>
          <div className="border-t border-foreground/[0.06] pt-3 mt-1">
            <button
              className="flex items-center gap-3 w-full p-2.5 hover:bg-foreground/[0.03] transition-colors duration-150 text-left group"
              onClick={() => {
                if (pendingPayment) {
                  handlePayPendingPlan(isMobile);
                  return;
                }
                navigate('/dashboard/account');
                if (isMobile) toggleMobileSidebar();
              }}
            >
              <Avatar className="h-9 w-9 shrink-0 ring-1 ring-foreground/10">
                <AvatarImage src={user?.avatar_url} alt={user?.owner_name || user?.name} />
                <AvatarFallback className="text-xs font-bold bg-foreground text-background tracking-tight">
                  {getInitials(user?.owner_name || user?.name || '')}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-[15px] truncate leading-tight tracking-tight">{user?.name}</p>
                <div className="mt-0.5">
                  <PlanStatusBadge status={user?.plan_status} billingCycle={user?.billing_cycle} />
                </div>
              </div>
            </button>
            {pendingPayment && (
              <button
                onClick={() => handlePayPendingPlan(isMobile)}
                title={`Pagamento pendente até ${new Date(pendingPayment.payment_due_at).toLocaleString('pt-BR')} — clique para pagar`}
                className="flex items-center gap-1.5 w-full px-2.5 py-1.5 mt-1 text-[11px] font-medium text-amber-800 bg-amber-50 border border-amber-200 rounded-md hover:bg-amber-100 transition-colors text-left"
              >
                <AlertTriangle className="h-3 w-3 shrink-0" />
                <span className="flex-1">Pagamento Pendente</span>
              </button>
            )}
            <button
              onClick={() => signOut()}
              className="flex items-center gap-2.5 py-2.5 px-2.5 w-full text-left text-muted-foreground hover:text-foreground transition-colors duration-150 mt-1 text-[15px] tracking-tight"
            >
              <LogOut className="h-4 w-4 shrink-0" />
              <span>Sair</span>
            </button>
          </div>
        </div>
      </>
    );
  };

  return (
    <>
      {/* Mobile trigger */}
      <Button
        variant="outline"
        size="icon"
        className="fixed top-3 left-4 z-50 md:hidden rounded-none border-foreground/20"
        onClick={toggleMobileSidebar}
      >
        <Menu className="h-5 w-5" />
      </Button>

      {/* Mobile overlay */}
      <div
        className={cn(
          "fixed inset-0 bg-background/80 z-40 md:hidden transition-opacity duration-200",
          mobileOpen ? "opacity-100" : "opacity-0 pointer-events-none"
        )}
        onClick={toggleMobileSidebar}
      />

      {/* Mobile sidebar */}
      <div
        className={cn(
          "fixed inset-y-0 left-0 w-[272px] z-50 transition-transform duration-250 ease-out md:hidden flex flex-col bg-background border-r border-foreground/[0.08]",
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {sidebarContent(true)}
      </div>

      {/* Desktop sidebar - Ink Mono */}
      <div className="hidden md:flex flex-col h-screen w-[256px] bg-background border-r border-foreground/[0.08]">
        {sidebarContent(false)}
      </div>

      <AffiliateTeaserDialog open={showAffiliateTeaser} onOpenChange={setShowAffiliateTeaser} userId={user?.id} />
    </>
  );
}

const AFFILIATE_TEASER_WHATSAPP_URL = `https://wa.me/5591982465495?text=${encodeURIComponent('Tenho interesse em ativar o módulo de afiliados em meu painel')}`;

function AffiliateTeaserNavItem({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex flex-row items-center gap-3 py-2.5 px-3 text-[15px] tracking-tight transition-colors duration-150 relative w-full text-left text-muted-foreground hover:text-foreground"
    >
      <span className="relative shrink-0 flex items-center justify-center">
        <Handshake className="h-[19px] w-[19px]" />
        <span className="absolute -top-1 -right-1 flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500" />
        </span>
      </span>
      <span className="whitespace-nowrap flex-1">Afiliados</span>
      <span className="text-[10px] font-bold uppercase tracking-widest text-amber-600">novo</span>
    </button>
  );
}

function AffiliateTeaserDialog({ open, onOpenChange, userId }: { open: boolean; onOpenChange: (open: boolean) => void; userId?: string }) {
  useEffect(() => {
    if (open && userId) {
      logAffiliateTeaserEvent(userId, 'view');
    }
  }, [open, userId]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            🚀 Afiliados: venda através de outras pessoas
          </DialogTitle>
        </DialogHeader>

        <p className="text-sm text-muted-foreground leading-relaxed">
          Cadastre afiliados e vendedores ilimitados, cada um com o próprio catálogo personalizado, e multiplique seus canais de venda sem multiplicar seu trabalho.
        </p>

        <ul className="space-y-2.5 text-sm">
          <li className="flex items-start gap-2.5">
            <Users className="h-4 w-4 mt-0.5 shrink-0 text-emerald-600" />
            <span>Afiliados e vendedores ilimitados</span>
          </li>
          <li className="flex items-start gap-2.5">
            <LayoutGrid className="h-4 w-4 mt-0.5 shrink-0 text-emerald-600" />
            <span>Catálogo individual e personalizado para cada um</span>
          </li>
          <li className="flex items-start gap-2.5">
            <LayoutDashboard className="h-4 w-4 mt-0.5 shrink-0 text-emerald-600" />
            <span>Você acompanha tudo direto do seu painel</span>
          </li>
        </ul>

        <p className="text-sm text-muted-foreground leading-relaxed">
          Fale conosco e saiba como ativar este recurso em sua conta.
        </p>

        <DialogFooter>
          <Button asChild className="w-full gap-2 bg-emerald-600 hover:bg-emerald-700 text-white">
            <a
              href={AFFILIATE_TEASER_WHATSAPP_URL}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => userId && logAffiliateTeaserEvent(userId, 'whatsapp_click')}
            >
              <MessageCircle className="h-4 w-4" />
              Tenho interesse em ativar o módulo de afiliados
            </a>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface InkNavItemProps {
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  isExpanded?: boolean;
  end?: boolean;
  onClick?: () => void;
}

function InkNavItem({ name, href, icon: Icon, end, onClick }: InkNavItemProps) {
  const location = useLocation();
  const isActive = end
    ? location.pathname === href
    : location.pathname.startsWith(href);

  return (
    <NavLink
      to={href}
      end={end}
      onClick={onClick}
      className={cn(
        "flex flex-row items-center gap-3 py-2.5 px-3 text-[15px] tracking-tight transition-colors duration-150 relative",
        isActive
          ? "text-foreground font-semibold bg-foreground/[0.04]"
          : "text-muted-foreground hover:text-foreground"
      )}
    >
      {isActive && (
        <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[2px] h-5 bg-foreground" />
      )}
      <Icon className="h-[19px] w-[19px] shrink-0" />
      <span className="whitespace-nowrap">{name}</span>
    </NavLink>
  );
}

interface InkGroupItemProps {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  isGroupActive: boolean;
  isOpen: boolean;
  onToggle: () => void;
  isExpanded?: boolean;
  items: Array<{ name: string; href: string; icon: React.ComponentType<{ className?: string }>; badge?: number; comingSoon?: boolean }>;
  onItemClick: () => void;
  badge?: number;
}

function InkGroupItem({ label, icon: Icon, isGroupActive, isOpen, onToggle, items, onItemClick, badge }: InkGroupItemProps) {
  return (
    <div>
      <button
        onClick={onToggle}
        className={cn(
          "flex flex-row items-center gap-3 py-2.5 px-3 text-[15px] tracking-tight transition-colors duration-150 w-full text-left relative",
          isGroupActive
            ? "text-foreground font-semibold bg-foreground/[0.04]"
            : "text-muted-foreground hover:text-foreground"
        )}
      >
        {isGroupActive && (
          <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[2px] h-5 bg-foreground" />
        )}
        <Icon className="h-[19px] w-[19px] shrink-0" />
        <span className="flex-1 whitespace-nowrap">{label}</span>
        {badge !== undefined && badge > 0 && (
          <span className="text-[11px] font-bold tabular-nums text-foreground">
            {badge > 99 ? '99+' : badge}
          </span>
        )}
        <ChevronDown className={cn(
          "h-3 w-3 transition-transform duration-150 opacity-40",
          isOpen && "rotate-180"
        )} />
      </button>

      {isOpen && (
        <div className="ml-[22px] border-l border-foreground/[0.08] space-y-0 py-0.5">
          {items.map((item) => (
            <NavLink
              key={item.name}
              to={item.href}
              onClick={onItemClick}
              className={({ isActive }) => cn(
                "flex flex-row items-center gap-2.5 py-2 pl-4 pr-3 text-sm tracking-tight transition-colors duration-150",
                isActive
                  ? "text-foreground font-semibold"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <item.icon className="h-4 w-4 shrink-0" />
              <span className="flex-1 whitespace-nowrap">{item.name}</span>
              {item.badge !== undefined && item.badge > 0 && (
                <span className="text-[10px] font-bold tabular-nums bg-foreground text-background px-1.5 py-0.5">
                  {item.badge > 99 ? '99+' : item.badge}
                </span>
              )}
              {item.comingSoon && (
                <span className="text-[10px] uppercase tracking-widest text-muted-foreground/50">breve</span>
              )}
            </NavLink>
          ))}
        </div>
      )}
    </div>
  );
}
