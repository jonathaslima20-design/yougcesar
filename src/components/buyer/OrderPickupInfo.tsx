export interface PickupInfo {
  delivery_option?: string | null;
  pickup_instructions?: string | null;
}

export interface PickupStoreInfo {
  city?: string | null;
  state?: string | null;
}

export function OrderPickupInfo({ order, store }: { order: PickupInfo; store?: PickupStoreInfo }) {
  return (
    <div className="text-sm space-y-1">
      {order.delivery_option && <p className="font-medium">{order.delivery_option}</p>}
      {(store?.city || store?.state) && (
        <p className="text-muted-foreground">{[store?.city, store?.state].filter(Boolean).join(' - ')}</p>
      )}
      {order.pickup_instructions && (
        <p className="text-muted-foreground whitespace-pre-line">{order.pickup_instructions}</p>
      )}
    </div>
  );
}
