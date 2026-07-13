import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

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
    const { limit = 200, offset = 0, typeFilter } = body;

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

    const [scanStatusResult, filesResult, countResult] = await Promise.all([
      supabase
        .from('orphaned_files_scan_status')
        .select('*')
        .eq('id', 1)
        .maybeSingle(),
      (() => {
        let query = supabase
          .from('orphaned_files_cache')
          .select('name, path, size, created_at_storage, bucket, is_product_image, is_user_image, public_url')
          .order('scanned_at', { ascending: false })
          .range(offset, offset + limit - 1);

        if (typeFilter === 'product') {
          query = query.eq('is_product_image', true);
        } else if (typeFilter === 'user') {
          query = query.eq('is_user_image', true);
        }

        return query;
      })(),
      (() => {
        let query = supabase
          .from('orphaned_files_cache')
          .select('*', { count: 'exact', head: true });

        if (typeFilter === 'product') {
          query = query.eq('is_product_image', true);
        } else if (typeFilter === 'user') {
          query = query.eq('is_user_image', true);
        }

        return query;
      })(),
    ]);

    const scanStatus = scanStatusResult.data;
    const files = (filesResult.data || []).map(f => ({
      name: f.name,
      path: f.path,
      size: f.size,
      createdAt: f.created_at_storage,
      bucket: f.bucket,
      isProductImage: f.is_product_image,
      isUserImage: f.is_user_image,
      publicUrl: f.public_url,
    }));

    return new Response(
      JSON.stringify({
        success: true,
        files,
        totalCount: countResult.count ?? 0,
        totalSizeBytes: scanStatus?.total_size_bytes ?? 0,
        limit,
        offset,
        scanStatus: {
          status: scanStatus?.status ?? 'idle',
          startedAt: scanStatus?.started_at,
          completedAt: scanStatus?.completed_at,
          totalFilesFound: scanStatus?.total_files_found ?? 0,
          totalSizeBytes: scanStatus?.total_size_bytes ?? 0,
          errorMessage: scanStatus?.error_message,
        },
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error listing orphaned files:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
