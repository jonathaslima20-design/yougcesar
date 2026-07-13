import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';

interface BannerClient {
  id: string;
  corretor_page_url: string;
  business_name: string;
  avatar_url: string | null;
  display_order: number;
}

function ClientCard({ client }: { client: BannerClient }) {
  const initials = client.business_name
    .split(' ')
    .slice(0, 2)
    .map((w) => w.charAt(0).toUpperCase())
    .join('');

  return (
    <a
      href={client.corretor_page_url}
      target="_blank"
      rel="noopener noreferrer"
      className="flex flex-col items-center gap-2 px-3 group"
      style={{ minWidth: '80px' }}
      draggable={false}
    >
      <div className="h-14 w-14 rounded-full overflow-hidden bg-muted flex items-center justify-center ring-2 ring-transparent group-hover:ring-primary/30 transition-all duration-200 group-hover:scale-110 shadow-sm flex-shrink-0">
        {client.avatar_url ? (
          <img
            src={client.avatar_url}
            alt={client.business_name}
            className="h-full w-full object-cover"
            draggable={false}
            onError={(e) => {
              const target = e.target as HTMLImageElement;
              target.style.display = 'none';
              const parent = target.parentElement;
              if (parent) {
                parent.innerHTML = `<span class="text-base font-semibold text-muted-foreground">${initials}</span>`;
              }
            }}
          />
        ) : (
          <span className="text-base font-semibold text-muted-foreground">{initials}</span>
        )}
      </div>
      <span className="text-xs text-center font-medium text-foreground/70 group-hover:text-foreground transition-colors line-clamp-2 max-w-[80px] leading-tight">
        {client.business_name}
      </span>
    </a>
  );
}

function CounterCard() {
  return (
    <div
      className="flex flex-col items-center gap-2 px-3"
      style={{ minWidth: '80px' }}
    >
      <div className="h-14 w-14 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-sm flex-shrink-0">
        <span className="text-white font-bold text-sm leading-tight text-center">+3K</span>
      </div>
      <span className="text-xs text-center font-medium text-amber-600 max-w-[80px] leading-tight">
        usuários ativos
      </span>
    </div>
  );
}

export default function BannerClients() {
  const [clients, setClients] = useState<BannerClient[]>([]);
  const [loaded, setLoaded] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const fetchClients = async () => {
      try {
        const { data, error } = await supabase
          .from('banner_clients')
          .select('id, corretor_page_url, business_name, avatar_url, display_order')
          .eq('is_active', true)
          .order('display_order', { ascending: true });

        if (error) throw error;
        setClients(data || []);
      } catch (error) {
        console.error('Error fetching banner clients:', error);
      } finally {
        setLoaded(true);
      }
    };

    fetchClients();
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (!loaded || !container || clients.length === 0) return;

    const step = () => {
      if (container) {
        container.scrollLeft += 0.6;
        const half = container.scrollWidth / 2;
        if (container.scrollLeft >= half) {
          container.scrollLeft = 0;
        }
      }
      rafRef.current = requestAnimationFrame(step);
    };

    rafRef.current = requestAnimationFrame(step);

    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, [loaded, clients.length]);

  if (!loaded || clients.length === 0) return null;

  const itemsWithCounter = [...clients, null];
  const duplicated = [...itemsWithCounter, ...itemsWithCounter];

  return (
    <div className="rounded-xl border bg-muted/30 py-5 overflow-hidden">
      <p className="text-center text-sm font-semibold text-foreground/80 mb-4 px-4">
        Junte-se a milhares de usuários do VitrineTurbo!
      </p>

      <div
        className="relative"
        style={{ maskImage: 'linear-gradient(to right, transparent, black 10%, black 90%, transparent)' }}
      >
        <style>{`.banner-scroll-track::-webkit-scrollbar { display: none; }`}</style>
        <div
          ref={containerRef}
          className="banner-scroll-track flex items-start overflow-x-scroll"
          style={{
            scrollbarWidth: 'none',
            msOverflowStyle: 'none',
          }}
        >
          {duplicated.map((client, index) =>
            client === null ? (
              <CounterCard key={`counter-${index}`} />
            ) : (
              <ClientCard key={`${client.id}-${index}`} client={client} />
            )
          )}
        </div>
      </div>
    </div>
  );
}
