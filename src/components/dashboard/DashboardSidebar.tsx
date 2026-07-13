import { useState, useEffect } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { LayoutDashboard, Package, LogOut, Menu, X, Settings, Settings2, FolderTree, Gift, CircleHelp as HelpCircle, ShoppingBag, ClipboardList, CreditCard, ChevronDown, BookOpen, ArrowLeftRight, Warehouse, ChartBar as BarChart3, Ticket, Plug } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useAuth } from '@/contexts/AuthContext';
import { cn, getInitials } from '@/lib/utils';
import Logo from '@/components/Logo';
import PlanStatusBadge from '@/components/subscription/PlanStatusBadge';
import PlanUsageIndicator from '@/components/dashboard/PlanUsageIndicator';
import { getPendingOrderCount } from '@/lib/orderService';

export default function DashboardSidebar() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [openGroup, setOpenGroup] = useState<'catalog' | 'stock' | 'sales' | null>(null);
  const [pendingOrders, setPendingOrders] = useState(0);
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

  const catalogSubItems = [
    { name: 'Produtos', href: '/dashboard/listings', icon: Package },
    { name: 'Categorias', href: '/dashboard/categories', icon: FolderTree },
  ];

  const stockSubItems = [
    { name: 'Visão Geral', href: '/dashboard/inventory', icon: BarChart3 },
    { name: 'Movimentações', href: '/dashboard/stock-movements', icon: ArrowLeftRight },
    { name: 'Configurações', href: '/dashboard/inventory/settings', icon: Settings2 },
  ];

  const salesSubItems = [
    { name: 'Pedidos', href: '/dashboard/orders', icon: ClipboardList, badge: pendingOrders },
    { name: 'Cupons', href: '/dashboard/coupons', icon: Ticket },
    { name: 'Vendas Online', href: '/dashboard/sales', icon: CreditCard, comingSoon: true },
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
            {user?.billing_cycle === 'annually' && user?.plan_status === 'active' && (
              <InkNavItem
                name="Integrações"
                href="/dashboard/integrations"
                icon={Plug}
                end
                isExpanded
                onClick={() => isMobile && toggleMobileSidebar()}
              />
            )}

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
              onClick={() => { navigate('/dashboard/account'); if (isMobile) toggleMobileSidebar(); }}
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

    </>
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
