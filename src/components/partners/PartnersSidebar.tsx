import { NavLink, useLocation } from 'react-router-dom';
import { LayoutDashboard, Users, UserPlus, Link2, Wallet, CircleHelp as HelpCircle, LogOut, Menu, X, Target, BarChart3, Megaphone, UsersRound, IdCard } from 'lucide-react';
import { usePartner } from '@/contexts/PartnerContext';
import { Button } from '@/components/ui/button';
import Logo from '@/components/Logo';
import { useAuth } from '@/contexts/AuthContext';
import { cn, getInitials } from '@/lib/utils';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

interface PartnersSidebarProps {
  mobileOpen?: boolean;
  onMobileToggle?: () => void;
}

interface NavItem {
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
}

type TeamRole = 'owner' | 'manager' | 'operator';

const NAV_SECTIONS: { title?: string; items: (NavItem & { roles?: TeamRole[] })[] }[] = [
  {
    items: [
      { name: 'Início', href: '/partners', icon: LayoutDashboard },
      { name: 'Clientes', href: '/partners/clients', icon: Users },
      { name: 'Nova loja', href: '/partners/new-store', icon: UserPlus, roles: ['owner', 'manager'] },
      { name: 'Oportunidades', href: '/partners/leads', icon: Target, roles: ['owner', 'manager'] },
    ],
  },
  {
    title: 'Crescer',
    items: [
      { name: 'Links & Campanhas', href: '/partners/links', icon: Link2 },
      { name: 'Desempenho', href: '/partners/performance', icon: BarChart3 },
      { name: 'Materiais', href: '/partners/materials', icon: Megaphone },
    ],
  },
  {
    title: 'Conta',
    items: [
      { name: 'Financeiro', href: '/partners/finance', icon: Wallet, roles: ['owner'] },
      { name: 'Equipe', href: '/partners/team', icon: UsersRound, roles: ['owner'] },
      { name: 'Perfil público', href: '/partners/profile', icon: IdCard, roles: ['owner'] },
      { name: 'Ajuda', href: '/partners/help', icon: HelpCircle },
    ],
  },
];

const ROLE_LABELS: Record<TeamRole, string> = { owner: 'Parceiro', manager: 'Gestor da equipe', operator: 'Operador da equipe' };

export default function PartnersSidebar({ mobileOpen = false, onMobileToggle }: PartnersSidebarProps) {
  const { signOut, user } = useAuth();
  const { overview } = usePartner();
  const role: TeamRole = overview?.team_role ?? 'owner';

  const sidebarContent = (isMobile: boolean) => (
    <>
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-5">
        <div className="flex items-center gap-2">
          <Logo showText={false} size="sm" />
          <span className="font-serif italic text-lg text-foreground/90 tracking-tight">Partners</span>
        </div>
        {isMobile && (
          <button
            onClick={onMobileToggle}
            className="h-8 w-8 flex items-center justify-center hover:bg-foreground/5 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Navigation */}
      <div className="flex-1 overflow-y-auto px-3 py-2">
        <nav className="space-y-4">
          {NAV_SECTIONS.map((section, idx) => {
            const items = section.items.filter((item) => !item.roles || item.roles.includes(role));
            if (items.length === 0) return null;
            return (
              <div key={section.title ?? idx} className="space-y-0.5">
                {section.title && (
                  <p className="px-3 pb-1 text-[11px] font-medium uppercase tracking-wider text-muted-foreground/70">{section.title}</p>
                )}
                {items.map((item) => (
                  <PartnersNavItem
                    key={item.name}
                    name={item.name}
                    href={item.href}
                    icon={item.icon}
                    end={item.href === '/partners'}
                    onClick={() => isMobile && onMobileToggle?.()}
                  />
                ))}
              </div>
            );
          })}
        </nav>
      </div>

      {/* Footer */}
      <div className="mt-auto px-3 pb-4 pt-2">
        <div className="border-t border-foreground/[0.06] pt-3 mt-1">
          <div className="flex items-center gap-3 w-full p-2.5">
            <Avatar className="h-9 w-9 shrink-0 ring-1 ring-foreground/10">
              <AvatarImage src={user?.avatar_url} alt={user?.name} />
              <AvatarFallback className="text-xs font-bold bg-foreground text-background tracking-tight">
                {getInitials(user?.name || '')}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-[15px] truncate leading-tight tracking-tight">{user?.name}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{overview?.level && role === 'owner' ? `Parceiro ${overview.level.name}` : ROLE_LABELS[role]}</p>
            </div>
          </div>
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

  return (
    <>
      {/* Mobile trigger */}
      <Button
        variant="outline"
        size="icon"
        className="fixed top-3 left-4 z-50 md:hidden rounded-none border-foreground/20"
        onClick={onMobileToggle}
      >
        <Menu className="h-5 w-5" />
      </Button>

      {/* Mobile overlay */}
      <div
        className={cn(
          "fixed inset-0 bg-background/80 z-40 md:hidden transition-opacity duration-200",
          mobileOpen ? "opacity-100" : "opacity-0 pointer-events-none"
        )}
        onClick={onMobileToggle}
      />

      {/* Mobile sidebar */}
      <div
        className={cn(
          "fixed inset-y-0 left-0 w-[272px] z-50 transition-transform duration-250 ease-out md:hidden flex flex-col bg-background border-r border-foreground/[0.08]",
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        )}
        aria-hidden={!mobileOpen}
        {...(!mobileOpen ? ({ inert: '' } as React.HTMLAttributes<HTMLDivElement>) : {})}
      >
        {sidebarContent(true)}
      </div>

      {/* Desktop sidebar */}
      <div className="hidden md:flex flex-col h-screen w-[256px] bg-background border-r border-foreground/[0.08]">
        {sidebarContent(false)}
      </div>
    </>
  );
}

interface PartnersNavItemProps {
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  end?: boolean;
  onClick?: () => void;
}

function PartnersNavItem({ name, href, icon: Icon, end, onClick }: PartnersNavItemProps) {
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
