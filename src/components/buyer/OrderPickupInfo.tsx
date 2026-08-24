import { ExternalLink } from 'lucide-react';

export interface PickupInfo {
  delivery_option?: string | null;
  pickup_instructions?: string | null;
}

export interface PickupStoreInfo {
  city?: string | null;
  state?: string | null;
}

// The instructions/hours/map link the merchant configured are folded into
// this single free-text column at order-creation time (see
// buildPickupInstructionsSnapshot in lib/localDelivery.ts) — this just picks
// the "Ver no mapa: <url>" line back out so it renders as a clickable link
// instead of raw text.
const MAP_LINE_PREFIX = 'Ver no mapa: ';

export function OrderPickupInfo({ order, store }: { order: PickupInfo; store?: PickupStoreInfo }) {
  const lines = (order.pickup_instructions || '').split('\n').filter(Boolean);

  return (
    <div className="text-sm space-y-1">
      {order.delivery_option && <p className="font-medium">{order.delivery_option}</p>}
      {(store?.city || store?.state) && (
        <p className="text-muted-foreground">{[store?.city, store?.state].filter(Boolean).join(' - ')}</p>
      )}
      {lines.map((line, i) =>
        line.startsWith(MAP_LINE_PREFIX) ? (
          <a
            key={i}
            href={line.slice(MAP_LINE_PREFIX.length)}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-primary hover:underline"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            Ver no mapa
          </a>
        ) : (
          <p key={i} className="text-muted-foreground whitespace-pre-line">{line}</p>
        )
      )}
    </div>
  );
}
