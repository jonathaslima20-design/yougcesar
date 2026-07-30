import { supabaseBuyer } from './supabaseBuyer';

export async function uploadBuyerAvatar(file: File, customerId: string): Promise<string> {
  const fileExt = file.name.split('.').pop();
  const fileName = `${customerId}-${Date.now()}.${fileExt}`;
  const filePath = `avatars-comprador/${customerId}/${fileName}`;

  const { error: uploadError } = await supabaseBuyer.storage
    .from('public')
    .upload(filePath, file, {
      cacheControl: '3600',
      upsert: true,
    });

  if (uploadError) throw uploadError;

  const {
    data: { publicUrl },
  } = supabaseBuyer.storage.from('public').getPublicUrl(filePath);

  const { error: updateError } = await supabaseBuyer
    .from('customers')
    .update({ avatar_url: publicUrl })
    .eq('id', customerId);

  if (updateError) throw updateError;

  return publicUrl;
}
