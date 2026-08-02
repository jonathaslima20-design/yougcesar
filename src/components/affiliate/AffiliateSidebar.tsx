import { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { Menu, X, LogOut, LayoutDashboard, LineChart, Package, User, Handshake } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ThemeToggle } from '@/components/ui/theme-toggle';
import AffiliateNotificationBell from '@/components/notifications/AffiliateNotificationBell';
import { useAffiliateAuth } from '@/contexts/AffiliateAuthContext';
import { cn } from '@/lib/utils';

const NAV_ITEMS = [
  { name: 'Painel', href: '/afiliado/painel', icon: LayoutDashboard },
  { name: 'Relatórios', href: '/afiliado/relatorios', icon: LineChart },
  { name: 'Catálogo', href: '/afiliado/catalogo', icon: Package },
  { name: 'Perfil', href: '/afiliado/perfil', icon: User },
];

export default function AffiliateSidebar() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const navigate = useNavigate();
  const { signOut } = useAffiliateAuth();

  const toggleMobileSidebar = () => setMobileOpen((v) => !v);

  const handleSignOut = () => {
    navigate('/afiliado/entrar');
    signOut();
  };

  const content = (isMobile: boolean) => (
    <>
      <div className="flex items-center justify-between px-5 py-5">
        <div className="flex items-center gap-2 font-semibold tracking-tight">
          <Handshake className="h-5 w-5 text-primary" />
          Painel do Afiliado
        </div>
        {isMobile && (
          <button onClick={toggleMobileSidebar} className="h-8 w-8 flex items-center justify-center hover:bg-foreground/5 transition-colors">
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-2">
        <nav className="space-y-0.5">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.href}
              to={item.href}
              end
              onClick={() => isMobile && toggleMobileSidebar()}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-2.5 py-2.5 px-2.5 text-[15px] tracking-tight transition-colors duration-150 rounded-md',
                  isActive ? 'bg-foreground text-background' : 'text-foreground/80 hover:bg-foreground/5'
                )
              }
            >
              <item.icon className="h-4 w-4 shrink-0" />
              <span>{item.name}</span>
            </NavLink>
          ))}
        </nav>
      </div>

      <div className="mt-auto px-3 pb-4 pt-2 border-t border-foreground/[0.06] space-y-1">
        <div className="flex items-center justify-between px-2.5 py-1">
          <ThemeToggle />
          <AffiliateNotificationBell />
        </div>
        <button
          onClick={handleSignOut}
          className="flex items-center gap-2.5 py-2.5 px-2.5 w-full text-left text-muted-foreground hover:text-foreground transition-colors duration-150 text-[15px] tracking-tight"
        >
          <LogOut className="h-4 w-4 shrink-0" />
          <span>Sair</span>
        </button>
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
        {content(true)}
      </div>

      <div className="hidden md:flex flex-col h-screen w-[256px] bg-background border-r border-foreground/[0.08] sticky top-0">
        {content(false)}
      </div>
    </>
  );
}
