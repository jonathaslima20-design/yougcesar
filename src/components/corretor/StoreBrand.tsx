import { useEffect, useState } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { getInitials } from '@/lib/utils';
import { supabaseBuyer } from '@/lib/supabaseBuyer';

interface StoreBrandInfo {
  name: string;
  avatar_url: string | null;
}

interface StoreBrandProps {
  storeSlug?: string;
  size?: 'md' | 'lg';
}

// Shows the merchant's own store logo on buyer-facing auth pages instead of
// generic VitrineTurbo branding. Renders nothing when there's no store
// context or the lookup fails, rather than falling back to VitrineTurbo.
export function StoreBrand({ storeSlug, size = 'lg' }: StoreBrandProps) {
  const [store, setStore] = useState<StoreBrandInfo | null>(null);

  useEffect(() => {
    if (!storeSlug) {
      setStore(null);
      return;
    }

    let cancelled = false;
    (async () => {
      const { data } = await supabaseBuyer
        .from('users')
        .select('name, avatar_url')
        .eq('slug', storeSlug)
        .maybeSingle();
      if (!cancelled) setStore(data);
    })();

    return () => {
      cancelled = true;
    };
  }, [storeSlug]);

  if (!store) return null;

  const avatarSize = size === 'lg' ? 'w-24 h-24' : 'w-16 h-16';

  return (
    <div className="flex flex-col items-center gap-2">
      <Avatar className={`${avatarSize} border-4 border-background bg-muted shadow-lg`}>
        <AvatarImage src={store.avatar_url || undefined} alt={store.name} className="object-cover" />
        <AvatarFallback className="text-xl">{getInitials(store.name)}</AvatarFallback>
      </Avatar>
      <p className="text-sm font-medium text-muted-foreground">{store.name}</p>
    </div>
  );
}
