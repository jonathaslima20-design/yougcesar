import { ThemeToggle } from '@/components/ui/theme-toggle';
import BuyerNotificationBell from '@/components/notifications/BuyerNotificationBell';
import { useBuyerAuth } from '@/contexts/BuyerAuthContext';

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Bom dia';
  if (hour < 18) return 'Boa tarde';
  return 'Boa noite';
}

export default function BuyerAccountHeader() {
  const { customer } = useBuyerAuth();
  const firstName = customer?.full_name?.trim().split(' ')[0];

  return (
    <header className="sticky top-0 z-30 glass-header py-3 pl-16 pr-4 md:px-4 lg:px-8 flex items-center justify-between">
      <p className="text-sm font-medium text-muted-foreground truncate">
        {firstName ? `${getGreeting()}, ${firstName}` : ''}
      </p>

      <div className="flex items-center gap-1 md:gap-2">
        <ThemeToggle />
        <BuyerNotificationBell />
      </div>
    </header>
  );
}
