import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { Package, MapPin, User, Heart, Ticket, LogOut, Menu, X } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { useBuyerAuth } from '@/contexts/BuyerAuthContext';
import { getLastVisitedStore } from '@/lib/lastVisitedStore';
import { supabaseBuyer } from '@/lib/supabaseBuyer';
import { cn, getInitials } from '@/lib/utils';
import Logo from '@/components/Logo';
import { useEffect, useState } from 'react';

interface LastStoreInfo {
  slug: string;
  name: string;
  avatar_url: string | null;
}

// Mirrors DashboardSidebar.tsx's "Ink Mono" visual language for the buyer
// account area (Pedidos/Endereços/Perfil), so the buyer environment reads as
// the same product as the merchant dashboard instead of a bolted-on afterthought.

const NAV_ITEMS = [
  { name: 'Pedidos', href: '/conta/pedidos', icon: Package },
  { name: 'Favoritos', href: '/conta/favoritos', icon: Heart },
  { name: 'Cupons', href: '/conta/cupons', icon: Ticket },
  { name: 'Endereços', href: '/conta/enderecos', icon: MapPin },
  { name: 'Perfil', href: '/conta/perfil', icon: User },
];

export default function BuyerAccountSidebar() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [lastStore, setLastStore] = useState<LastStoreInfo | null>(null);
  const { customer, signOut } = useBuyerAuth();
  const navigate = useNavigate();

  // A conta do comprador não pertence a uma loja só (ele pode ter pedidos em
  // várias) — não existe "a" logo do lojista para fixar aqui. Em vez disso,
  // mostra a loja que o levou até esta área: a última visitada, atualizada a
  // cada acesso a uma vitrine (inclusive a que originou o login), com queda
  // para a marca do VitrineTurbo quando não houver nenhuma.
  useEffect(() => {
    const slug = getLastVisitedStore();
    if (!slug) return;
    let cancelled = false;
    supabaseBuyer
      .from('users')
      .select('slug, name, avatar_url')
      .eq('slug', slug)
      .maybeSingle()
      .then(({ data }) => {
        if (!cancelled && data) setLastStore(data);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const toggleMobileSidebar = () => setMobileOpen((prev) => !prev);

  const handleSignOut = () => {
    // Navigate first, then sign out — both land in the same React 18 batch,
    // so the route has already changed away from /conta/* by the time
    // customer becomes null (avoids racing each page's own signed-out guard).
    const lastStore = getLastVisitedStore();
    navigate(lastStore ? `/${lastStore}` : '/');
    signOut();
  };

  const sidebarContent = (isMobile: boolean) => (
    <>
      <div className="flex items-center justify-between px-5 py-5">
        {lastStore ? (
          <Link to={`/${lastStore.slug}`} className="flex items-center gap-2.5 min-w-0">
            <Avatar className="h-9 w-9 shrink-0 ring-1 ring-foreground/10">
              <AvatarImage src={lastStore.avatar_url || undefined} alt={lastStore.name} />
              <AvatarFallback className="text-xs font-bold bg-foreground text-background tracking-tight">
                {getInitials(lastStore.name)}
              </AvatarFallback>
            </Avatar>
            <span className="font-semibold text-[15px] tracking-tight truncate">{lastStore.name}</span>
          </Link>
        ) : (
          <Logo showText size="md" />
        )}
        {isMobile && (
          <button
            onClick={toggleMobileSidebar}
            className="h-8 w-8 flex items-center justify-center hover:bg-foreground/5 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-2">
        <nav className="space-y-0.5">
          {NAV_ITEMS.map((item) => (
            <InkNavItem
              key={item.href}
              name={item.name}
              href={item.href}
              icon={item.icon}
              onClick={() => isMobile && toggleMobileSidebar()}
            />
          ))}
        </nav>
      </div>

      <div className="mt-auto px-3 pb-4 pt-2">
        <div className="border-t border-foreground/[0.06] pt-3 mt-1">
          <button
            className="flex items-center gap-3 w-full p-2.5 hover:bg-foreground/[0.03] transition-colors duration-150 text-left"
            onClick={() => {
              navigate('/conta/perfil');
              if (isMobile) toggleMobileSidebar();
            }}
          >
            <Avatar className="h-9 w-9 shrink-0 ring-1 ring-foreground/10">
              <AvatarImage src={customer?.avatar_url || undefined} alt={customer?.full_name} />
              <AvatarFallback className="text-xs font-bold bg-foreground text-background tracking-tight">
                {getInitials(customer?.full_name || '')}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-[15px] truncate leading-tight tracking-tight">
                {customer?.full_name}
              </p>
            </div>
          </button>
          <button
            onClick={handleSignOut}
            className="flex items-center gap-2.5 py-2.5 px-2.5 w-full text-left text-muted-foreground hover:text-foreground transition-colors duration-150 mt-1 text-[15px] tracking-tight"
          >
            <LogOut className="h-4 w-4 shrink-0" />
            <span>Sair</span>
          </button>
        </div>
      </div>
    </>
  );

  return (
    <>
      <Button
        variant="outline"
        size="icon"
        className="fixed top-3 left-4 z-50 md:hidden rounded-none border-foreground/20"
        onClick={toggleMobileSidebar}
      >
        <Menu className="h-5 w-5" />
      </Button>

      <div
        className={cn(
          'fixed inset-0 bg-background/80 z-40 md:hidden transition-opacity duration-200',
          mobileOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        )}
        onClick={toggleMobileSidebar}
      />

      <div
        className={cn(
          'fixed inset-y-0 left-0 w-[272px] z-50 transition-transform duration-250 ease-out md:hidden flex flex-col bg-background border-r border-foreground/[0.08]',
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        {sidebarContent(true)}
      </div>

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
  onClick?: () => void;
}

function InkNavItem({ name, href, icon: Icon, onClick }: InkNavItemProps) {
  const location = useLocation();
  const isActive = location.pathname.startsWith(href);

  return (
    <NavLink
      to={href}
      onClick={onClick}
      className={cn(
        'flex flex-row items-center gap-3 py-2.5 px-3 text-[15px] tracking-tight transition-colors duration-150 relative',
        isActive
          ? 'text-foreground font-semibold bg-foreground/[0.04]'
          : 'text-muted-foreground hover:text-foreground'
      )}
    >
      {isActive && <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[2px] h-5 bg-foreground" />}
      <Icon className="h-[19px] w-[19px] shrink-0" />
      <span className="whitespace-nowrap">{name}</span>
    </NavLink>
  );
}
