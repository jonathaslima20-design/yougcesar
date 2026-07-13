import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

interface FileToDelete {
  bucket: string;
  path: string;
  name: string;
  size: number;
  publicUrl?: string;
}

const STORAGE_BATCH_SIZE = 100;
const CONCURRENCY = 5;

async function deleteBatch(
  supabase: ReturnType<typeof createClient>,
  bucket: string,
  names: string[]
): Promise<{ deleted: string[]; failed: { name: string; error: string }[] }> {
  const { error } = await supabase.storage.from(bucket).remove(names);
  if (error) {
    return {
      deleted: [],
      failed: names.map(name => ({ name, error: error.message })),
    };
  }
  return { deleted: names, failed: [] };
}

async function performDeletion(
  supabase: ReturnType<typeof createClient>,
  filesToDelete: FileToDelete[]
): Promise<{ successCount: number; failedCount: number; skippedCount: number; totalSize: number }> {
  const [productImages, products, users] = await Promise.all([
    supabase.from('product_images').select('url'),
    supabase.from('products').select('featured_image_url').not('featured_image_url', 'is', null),
    supabase.from('users').select('avatar_url, cover_url_desktop, cover_url_mobile, promotional_banner_url_desktop, promotional_banner_url_mobile'),
  ]);

  const allReferencedUrls = new Set<string>();
  (productImages.data || []).forEach(img => { if (img.url) allReferencedUrls.add(img.url); });
  (products.data || []).forEach(p => { if (p.featured_image_url) allReferencedUrls.add(p.featured_image_url); });
  (users.data || []).forEach(u => {
    if (u.avatar_url) allReferencedUrls.add(u.avatar_url);
    if (u.cover_url_desktop) allReferencedUrls.add(u.cover_url_desktop);
    if (u.cover_url_mobile) allReferencedUrls.add(u.cover_url_mobile);
    if (u.promotional_banner_url_desktop) allReferencedUrls.add(u.promotional_banner_url_desktop);
    if (u.promotional_banner_url_mobile) allReferencedUrls.add(u.promotional_banner_url_mobile);
  });

  const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';

  const safeToDelete = filesToDelete.filter(file => {
    if (file.bucket !== 'public') return false;
    const publicUrl = file.publicUrl ||
      `${supabaseUrl}/storage/v1/object/public/${file.bucket}/${file.name}`;
    return !allReferencedUrls.has(publicUrl);
  });

  const skippedCount = filesToDelete.length - safeToDelete.length;
  if (skippedCount > 0) {
    console.log(`Skipping ${skippedCount} files that are still referenced or in invalid buckets`);
  }

  const byBucket = new Map<string, string[]>();
  for (const file of safeToDelete) {
    if (!byBucket.has(file.bucket)) byBucket.set(file.bucket, []);
    byBucket.get(file.bucket)!.push(file.name);
  }

  let successCount = 0;
  let failedCount = 0;
  let totalSize = 0;
  const failedPaths: string[] = [];

  for (const [bucket, names] of byBucket.entries()) {
    const batches: string[][] = [];
    for (let i = 0; i < names.length; i += STORAGE_BATCH_SIZE) {
      batches.push(names.slice(i, i + STORAGE_BATCH_SIZE));
    }

    for (let i = 0; i < batches.length; i += CONCURRENCY) {
      const concurrentBatches = batches.slice(i, i + CONCURRENCY);
      const results = await Promise.all(
        concurrentBatches.map(batch => deleteBatch(supabase, bucket, batch))
      );

      for (const result of results) {
        successCount += result.deleted.length;
        failedCount += result.failed.length;
        result.failed.forEach(f => failedPaths.push(f.name));

        const deletedSet = new Set(result.deleted);
        for (const file of safeToDelete) {
          if (deletedSet.has(file.name)) {
            totalSize += file.size;
          }
        }
      }
    }
  }

  if (successCount > 0) {
    const deletedNames = safeToDelete
      .filter(f => !failedPaths.includes(f.name))
      .map(f => f.name);

    const CACHE_DELETE_BATCH = 500;
    for (let i = 0; i < deletedNames.length; i += CACHE_DELETE_BATCH) {
      const batch = deletedNames.slice(i, i + CACHE_DELETE_BATCH);
      await supabase
        .from('orphaned_files_cache')
        .delete()
        .in('name', batch);
    }

    const { count: remainingCount } = await supabase
      .from('orphaned_files_cache')
      .select('*', { count: 'exact', head: true });

    await supabase
      .from('orphaned_files_scan_status')
      .update({
        total_files_found: remainingCount ?? 0,
      })
      .eq('id', 1);
  }

  return { successCount, failedCount, skippedCount, totalSize };
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    if (req.method !== 'POST') {
      return new Response(
        JSON.stringify({ error: 'Method not allowed' }),
        { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const body = await req.json();
    const { files, deleteAll = false } = body as { files?: FileToDelete[]; deleteAll?: boolean };

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') || '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
    );

    const supabaseUser = createClient(
      Deno.env.get('SUPABASE_URL') || '',
      Deno.env.get('SUPABASE_ANON_KEY') || '',
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await supabaseUser.auth.getUser();
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: userRecord } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .maybeSingle();

    if (!userRecord || userRecord.role !== 'admin') {
      return new Response(
        JSON.stringify({ error: 'Admin access required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let filesToDelete: FileToDelete[] = [];

    if (deleteAll) {
      const { data: cachedFiles } = await supabase
        .from('orphaned_files_cache')
        .select('name, path, size, bucket, public_url');

      filesToDelete = (cachedFiles || []).map(f => ({
        bucket: f.bucket,
        path: f.path,
        name: f.name,
        size: f.size,
        publicUrl: f.public_url,
      }));
    } else {
      if (!files || !Array.isArray(files) || files.length === 0) {
        return new Response(
          JSON.stringify({ error: 'No files provided for deletion' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      filesToDelete = files;
    }

    const totalCount = filesToDelete.length;

    const { successCount, failedCount, skippedCount, totalSize } = await performDeletion(supabase, filesToDelete);

    return new Response(
      JSON.stringify({
        success: true,
        summary: {
          total: totalCount,
          successful: successCount,
          failed: failedCount,
          skipped: skippedCount,
          storageFreeUpMB: (totalSize / 1024 / 1024).toFixed(2),
        },
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error deleting orphaned files:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
