import { supabaseBuyer } from './supabaseBuyer';

export interface CustomerAddress {
  id: string;
  customer_id: string;
  label: string;
  street: string;
  number: string;
  complement: string | null;
  neighborhood: string;
  city: string;
  state: string;
  zip_code: string;
  is_default: boolean;
  created_at?: string;
  updated_at?: string;
}

export type CustomerAddressInput = Omit<CustomerAddress, 'id' | 'customer_id' | 'created_at' | 'updated_at'>;

export async function fetchCustomerAddresses(customerId: string): Promise<CustomerAddress[]> {
  const { data, error } = await supabaseBuyer
    .from('customer_addresses')
    .select('*')
    .eq('customer_id', customerId)
    .order('is_default', { ascending: false })
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
}

export async function createCustomerAddress(
  customerId: string,
  input: CustomerAddressInput
): Promise<CustomerAddress> {
  if (input.is_default) {
    await supabaseBuyer.from('customer_addresses').update({ is_default: false }).eq('customer_id', customerId);
  }

  const { data, error } = await supabaseBuyer
    .from('customer_addresses')
    .insert({ ...input, customer_id: customerId })
    .select()
    .single();

  if (error || !data) throw error || new Error('Erro ao criar endereço');
  return data;
}

export async function updateCustomerAddress(
  customerId: string,
  addressId: string,
  input: CustomerAddressInput
): Promise<CustomerAddress> {
  if (input.is_default) {
    await supabaseBuyer.from('customer_addresses').update({ is_default: false }).eq('customer_id', customerId);
  }

  const { data, error } = await supabaseBuyer
    .from('customer_addresses')
    .update(input)
    .eq('id', addressId)
    .eq('customer_id', customerId)
    .select()
    .single();

  if (error || !data) throw error || new Error('Erro ao atualizar endereço');
  return data;
}

export async function deleteCustomerAddress(customerId: string, addressId: string): Promise<void> {
  const { error } = await supabaseBuyer
    .from('customer_addresses')
    .delete()
    .eq('id', addressId)
    .eq('customer_id', customerId);

  if (error) throw error;
}
