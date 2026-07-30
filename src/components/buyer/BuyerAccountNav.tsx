import { NavLink, useNavigate } from 'react-router-dom';
import { LogOut } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useBuyerAuth } from '@/contexts/BuyerAuthContext';
import { getLastVisitedStore } from '@/lib/lastVisitedStore';
import BuyerNotificationBell from '@/components/notifications/BuyerNotificationBell';

const NAV_ITEMS = [
  { to: '/conta/pedidos', label: 'Pedidos' },
  { to: '/conta/enderecos', label: 'Endereços' },
  { to: '/conta/perfil', label: 'Perfil' },
];

export function BuyerAccountNav() {
  const navigate = useNavigate();
  const { signOut } = useBuyerAuth();

  const handleSignOut = () => {
    // Navigate first, then sign out — both calls land in the same React 18
    // batch, so the route has already changed away from /conta/* by the
    // time customer becomes null. Doing it the other way around races each
    // page's own "redirect to /conta/entrar if signed out" guard, which can
    // overwrite this navigation and strand the buyer on the login page
    // instead of back at the catalog.
    const lastStore = getLastVisitedStore();
    navigate(lastStore ? `/${lastStore}` : '/');
    signOut();
  };

  return (
    <div className="flex items-center justify-between mb-6">
      <div className="flex-1" />
      <nav className="flex gap-1 text-sm">
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              cn(
                'px-3 py-1.5 rounded-md font-medium transition-colors',
                isActive ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'
              )
            }
          >
            {item.label}
          </NavLink>
        ))}
      </nav>
      <div className="flex-1 flex justify-end items-center gap-1">
        <BuyerNotificationBell />
        <button
          type="button"
          onClick={handleSignOut}
          aria-label="Sair da conta"
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium text-muted-foreground hover:bg-muted hover:text-destructive transition-colors"
        >
          <LogOut className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Sair</span>
        </button>
      </div>
    </div>
  );
}
