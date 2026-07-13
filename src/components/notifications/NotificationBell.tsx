import { useState } from 'react';
import { Bell } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useNotifications } from '@/contexts/NotificationContext';
import NotificationPanel from './NotificationPanel';
import { cn } from '@/lib/utils';

export default function NotificationBell() {
  const [open, setOpen] = useState(false);
  const { unreadCount } = useNotifications();

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative h-8 w-8 md:h-9 md:w-9">
          <Bell className="h-4 w-4 md:h-5 md:w-5" />
          {unreadCount > 0 && (
            <span
              className={cn(
                'absolute flex items-center justify-center rounded-full bg-destructive text-destructive-foreground font-bold',
                unreadCount > 9
                  ? 'top-0 right-0 h-4 w-4 md:h-[18px] md:w-[18px] text-[9px] md:text-[10px]'
                  : 'top-0.5 right-0.5 h-3.5 w-3.5 md:h-4 md:w-4 text-[9px] md:text-[10px]'
              )}
            >
              {unreadCount > 99 ? '99' : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        sideOffset={8}
        className="w-[calc(100vw-2rem)] sm:w-[400px] p-0 overflow-hidden"
      >
        <NotificationPanel onClose={() => setOpen(false)} />
      </PopoverContent>
    </Popover>
  );
}
