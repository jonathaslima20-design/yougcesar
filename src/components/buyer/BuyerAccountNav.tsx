import { NavLink } from 'react-router-dom';
import { cn } from '@/lib/utils';

const NAV_ITEMS = [
  { to: '/conta/pedidos', label: 'Pedidos' },
  { to: '/conta/enderecos', label: 'Endereços' },
  { to: '/conta/perfil', label: 'Perfil' },
];

export function BuyerAccountNav() {
  return (
    <nav className="flex gap-1 justify-center mb-6 text-sm">
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
  );
}
