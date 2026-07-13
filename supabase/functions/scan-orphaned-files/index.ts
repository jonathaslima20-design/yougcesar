import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

interface StorageFile {
  name: string;
  id: string;
  created_at: string;
  updated_at: string;
  metadata: {
    size: number;
  };
}

interface CacheEntry {
  name: string;
  path: string;
  size: number;
  created_at_storage: string;
  bucket: string;
  is_product_image: boolean;
  is_user_image: boolean;
  public_url: string;
  scanned_at: string;
}

async function listFolderFiles(
  supabase: ReturnType<typeof createClient>,
  bucket: string,
  folder: string
): Promise<StorageFile[]> {
  const allFiles: StorageFile[] = [];

  async function recurse(path: string) {
    const { data: files, error } = await supabase
      .storage
      .from(bucket)
      .list(path, { limit: 10000 });

    if (error || !files) {
      console.warn(`Error listing ${path}:`, error?.message);
      return;
    }

    const subfolderPromises: Promise<void>[] = [];

    for (const file of files) {
      const filePath = path ? `${path}/${file.name}` : file.name;
      if (file.id === null) {
        subfolderPromises.push(recurse(filePath));
      } else {
        allFiles.push({ ...file, name: filePath });
      }
    }

    await Promise.all(subfolderPromises);
  }

  await recurse(folder);
  return allFiles;
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

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') || '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
    );

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

    const { data: currentStatus } = await supabase
      .from('orphaned_files_scan_status')
      .select('status')
      .eq('id', 1)
      .maybeSingle();

    if (currentStatus?.status === 'scanning') {
      return new Response(
        JSON.stringify({ error: 'Scan already in progress' }),
        { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    await supabase
      .from('orphaned_files_scan_status')
      .update({
        status: 'scanning',
        started_at: new Date().toISOString(),
        completed_at: null,
        error_message: null,
        total_files_found: 0,
        total_size_bytes: 0,
        scanned_by: user.id,
      })
      .eq('id', 1);

    EdgeRuntime.waitUntil((async () => {
      try {
        const [productImages, products, users] = await Promise.all([
          supabase.from('product_images').select('url'),
          supabase.from('products').select('featured_image_url').not('featured_image_url', 'is', null),
          supabase.from('users').select('avatar_url, cover_url_desktop, cover_url_mobile, promotional_banner_url_desktop, promotional_banner_url_mobile'),
        ]);

        const allReferencedUrls = new Set<string>();

        (productImages.data || []).forEach(img => {
          if (img.url) allReferencedUrls.add(img.url);
        });
        (products.data || []).forEach(p => {
          if (p.featured_image_url) allReferencedUrls.add(p.featured_image_url);
        });
        (users.data || []).forEach(u => {
          if (u.avatar_url) allReferencedUrls.add(u.avatar_url);
          if (u.cover_url_desktop) allReferencedUrls.add(u.cover_url_desktop);
          if (u.cover_url_mobile) allReferencedUrls.add(u.cover_url_mobile);
          if (u.promotional_banner_url_desktop) allReferencedUrls.add(u.promotional_banner_url_desktop);
          if (u.promotional_banner_url_mobile) allReferencedUrls.add(u.promotional_banner_url_mobile);
        });

        console.log(`Found ${allReferencedUrls.size} referenced URLs in database`);

        const bucketName = 'public';
        const productSubfolders = ['products', 'product'];
        const userSubfolders = ['avatars', 'covers-desktop', 'covers-mobile', 'banners-desktop', 'banners-mobile'];
        const allSubfolders = [...productSubfolders, ...userSubfolders];

        const folderResults = await Promise.all(
          allSubfolders.map(subfolder =>
            listFolderFiles(supabase, bucketName, subfolder).then(files => ({
              subfolder,
              files,
              isProductFolder: productSubfolders.includes(subfolder),
              isUserFolder: userSubfolders.includes(subfolder),
            }))
          )
        );

        const scannedAt = new Date().toISOString();
        const cacheEntries: CacheEntry[] = [];

        for (const { subfolder, files, isProductFolder, isUserFolder } of folderResults) {
          console.log(`Folder ${subfolder}: ${files.length} files`);
          for (const file of files) {
            const { data: urlData } = supabase.storage.from(bucketName).getPublicUrl(file.name);
            const publicUrl = urlData?.publicUrl;
            if (publicUrl && !allReferencedUrls.has(publicUrl)) {
              cacheEntries.push({
                name: file.name,
                path: file.name,
                size: file.metadata?.size || 0,
                created_at_storage: file.created_at || scannedAt,
                bucket: bucketName,
                is_product_image: isProductFolder,
                is_user_image: isUserFolder,
                public_url: publicUrl,
                scanned_at: scannedAt,
              });
            }
          }
        }

        console.log(`Found ${cacheEntries.length} orphaned files total`);

        await supabase.from('orphaned_files_cache').delete().neq('id', '00000000-0000-0000-0000-000000000000');

        const BATCH_SIZE = 500;
        for (let i = 0; i < cacheEntries.length; i += BATCH_SIZE) {
          const batch = cacheEntries.slice(i, i + BATCH_SIZE);
          const { error: insertError } = await supabase.from('orphaned_files_cache').insert(batch);
          if (insertError) {
            console.error(`Error inserting batch ${i}-${i + BATCH_SIZE}:`, insertError.message);
          }
        }

        const totalSizeBytes = cacheEntries.reduce((sum, f) => sum + f.size, 0);

        await supabase
          .from('orphaned_files_scan_status')
          .update({
            status: 'ready',
            completed_at: new Date().toISOString(),
            total_files_found: cacheEntries.length,
            total_size_bytes: totalSizeBytes,
            error_message: null,
          })
          .eq('id', 1);

        console.log(`Scan complete. ${cacheEntries.length} orphaned files cached.`);
      } catch (err) {
        console.error('Scan background task failed:', err);
        await supabase
          .from('orphaned_files_scan_status')
          .update({
            status: 'error',
            completed_at: new Date().toISOString(),
            error_message: err instanceof Error ? err.message : 'Unknown error',
          })
          .eq('id', 1);
      }
    })());

    return new Response(
      JSON.stringify({ success: true, message: 'Scan started' }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error starting scan:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
