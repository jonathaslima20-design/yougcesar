import { supabase } from './supabase';
import type { BulkImportGroup } from './bulkImportUtils';

const IMPORT_ENDPOINT = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/product-bulk-import`;

export interface BulkImportGroupResult {
  grupo_id: string;
  status: 'created' | 'updated' | 'failed';
  product_id?: string;
  variant_count?: number;
  images_imported?: number;
  error?: string;
}

export interface BulkImportBatchResponse {
  results: BulkImportGroupResult[];
  summary: { created: number; updated: number; failed: number };
}

export async function importBulkProductBatch(
  groups: BulkImportGroup[],
  options: { update_images_on_existing: boolean }
): Promise<BulkImportBatchResponse> {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  const resp = await fetch(IMPORT_ENDPOINT, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${session?.access_token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ action: 'importBatch', payload: { groups, options } }),
  });

  const data = await resp.json();
  if (!resp.ok) throw new Error(data?.error || 'Falha na importação');
  return data as BulkImportBatchResponse;
}
