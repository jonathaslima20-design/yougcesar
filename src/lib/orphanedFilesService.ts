import { supabase } from './supabase';

export interface OrphanedFile {
  name: string;
  path: string;
  size: number;
  createdAt: string;
  bucket: string;
  isProductImage: boolean;
  isUserImage: boolean;
  publicUrl: string;
}

export interface ScanStatus {
  status: 'idle' | 'scanning' | 'ready' | 'error';
  startedAt?: string;
  completedAt?: string;
  totalFilesFound: number;
  totalSizeBytes: number;
  errorMessage?: string;
}

export interface ListOrphanedFilesResponse {
  success: boolean;
  files: OrphanedFile[];
  totalCount: number;
  totalSizeBytes: number;
  limit: number;
  offset: number;
  scanStatus: ScanStatus;
  error?: string;
}

export interface DeleteOrphanedFilesResponse {
  success: boolean;
  summary: {
    total: number;
    successful: number;
    failed: number;
    skipped: number;
    storageFreeUpMB: string;
  };
  error?: string;
}

async function getAuthToken(): Promise<string> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error('User not authenticated');
  return session.access_token;
}

export async function startScan(): Promise<{ success: boolean; error?: string }> {
  try {
    const token = await getAuthToken();
    const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/scan-orphaned-files`;
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({}),
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Failed to start scan');
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

export async function listOrphanedFiles(
  limit: number = 200,
  offset: number = 0,
  typeFilter?: 'product' | 'user' | 'all'
): Promise<ListOrphanedFilesResponse> {
  const defaultScanStatus: ScanStatus = {
    status: 'idle',
    totalFilesFound: 0,
    totalSizeBytes: 0,
  };

  try {
    const token = await getAuthToken();
    const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/list-orphaned-files`;

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        limit,
        offset,
        typeFilter: typeFilter === 'all' ? undefined : typeFilter,
      }),
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Failed to list orphaned files');
    return data;
  } catch (error) {
    return {
      success: false,
      files: [],
      totalCount: 0,
      totalSizeBytes: 0,
      limit,
      offset,
      scanStatus: defaultScanStatus,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

const CLIENT_BATCH_SIZE = 200;

export async function deleteOrphanedFiles(
  files: { bucket: string; path: string; name: string; size: number }[],
  onProgress?: (done: number, total: number) => void
): Promise<DeleteOrphanedFilesResponse> {
  const total = files.length;
  let successful = 0;
  let failed = 0;
  let skipped = 0;
  let totalSizeBytes = 0;

  try {
    const token = await getAuthToken();
    const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/delete-orphaned-files`;

    for (let i = 0; i < files.length; i += CLIENT_BATCH_SIZE) {
      const batch = files.slice(i, i + CLIENT_BATCH_SIZE);

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ files: batch }),
      });

      const data: DeleteOrphanedFilesResponse = await response.json();

      if (!response.ok) {
        failed += batch.length;
      } else if (data.success && data.summary) {
        successful += data.summary.successful;
        failed += data.summary.failed;
        skipped += data.summary.skipped;
        totalSizeBytes += parseFloat(data.summary.storageFreeUpMB) * 1024 * 1024;
      } else {
        failed += batch.length;
      }

      onProgress?.(Math.min(i + CLIENT_BATCH_SIZE, total), total);
    }

    return {
      success: true,
      summary: {
        total,
        successful,
        failed,
        skipped,
        storageFreeUpMB: (totalSizeBytes / 1024 / 1024).toFixed(2),
      },
    };
  } catch (error) {
    return {
      success: false,
      summary: { total, successful, failed: total - successful, skipped, storageFreeUpMB: '0' },
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

export async function deleteAllOrphanedFiles(): Promise<DeleteOrphanedFilesResponse> {
  try {
    const token = await getAuthToken();
    const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/delete-orphaned-files`;

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ deleteAll: true }),
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Failed to delete all orphaned files');
    return data;
  } catch (error) {
    return {
      success: false,
      summary: { total: 0, successful: 0, failed: 0, skipped: 0, storageFreeUpMB: '0' },
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}

export function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}
