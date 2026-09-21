import { supabase } from './supabase';

const LABEL_ENDPOINT = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/merchant-shipping-label`;

export type ShippingLabelStatus = 'pending' | 'released' | 'posted' | 'delivered' | 'cancelled' | 'error';

export interface OrderShippingLabel {
  id: string;
  order_id: string;
  superfrete_order_id: string | null;
  service_id: string | null;
  status: ShippingLabelStatus;
  price: number | null;
  tracking_code: string | null;
  label_pdf_url: string | null;
  error_message: string | null;
  purchased_at: string | null;
  cancelled_at: string | null;
  created_at: string;
}

async function getMerchantAuthHeaders(): Promise<Record<string, string>> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  return {
    Authorization: `Bearer ${session?.access_token}`,
    'Content-Type': 'application/json',
  };
}

async function callShippingLabel(action: string, order_id: string) {
  const headers = await getMerchantAuthHeaders();
  const resp = await fetch(LABEL_ENDPOINT, {
    method: 'POST',
    headers,
    body: JSON.stringify({ action, payload: { order_id } }),
  });
  const data = await resp.json();
  if (!resp.ok) throw new Error(data?.error || 'Falha no processamento');
  return data;
}

export async function getOrderShippingLabel(orderId: string): Promise<OrderShippingLabel | null> {
  const { label } = await callShippingLabel('getLabel', orderId);
  return label || null;
}

export async function purchaseOrderShippingLabel(orderId: string): Promise<OrderShippingLabel> {
  const { label } = await callShippingLabel('purchaseLabel', orderId);
  return label;
}

export async function cancelOrderShippingLabel(orderId: string): Promise<void> {
  await callShippingLabel('cancelLabel', orderId);
}
