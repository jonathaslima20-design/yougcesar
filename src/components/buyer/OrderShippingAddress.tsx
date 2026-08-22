export interface ShippingAddress {
  shipping_street: string | null;
  shipping_number: string | null;
  shipping_complement: string | null;
  shipping_neighborhood: string | null;
  shipping_city: string | null;
  shipping_state: string | null;
  shipping_zip_code: string | null;
}

export function hasShippingAddress(address: ShippingAddress): boolean {
  return !!(address.shipping_street || address.shipping_city);
}

export function OrderShippingAddress({ address }: { address: ShippingAddress }) {
  return (
    <p className="text-sm text-muted-foreground">
      {address.shipping_street}, {address.shipping_number}
      {address.shipping_complement ? ` - ${address.shipping_complement}` : ''}
      <br />
      {address.shipping_neighborhood ? `${address.shipping_neighborhood}, ` : ''}
      {address.shipping_city} - {address.shipping_state}
      <br />
      CEP {address.shipping_zip_code}
    </p>
  );
}
