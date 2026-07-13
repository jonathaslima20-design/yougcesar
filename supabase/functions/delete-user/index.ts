import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

interface DeleteUserRequest {
  userId?: string;
  userIds?: string[];
}

interface CleanupStats {
  filesDeleted: number;
  filesFailed: number;
  orphanRowsDeleted: number;
  paths: string[];
  errors: { path: string; error: string }[];
}

interface UserDeleteResult {
  userId: string;
  success: boolean;
  error?: string;
  cleanup: CleanupStats;
}

function extractPathFromUrl(url: string): string | null {
  try {
    const urlObj = new URL(url);
    const path = urlObj.pathname.split('/storage/v1/object/public/')[1] || urlObj.pathname.split('/public/')[1];
    return path || null;
  } catch {
    return null;
  }
}

async function getStoragePathsForUser(supabaseAdmin: any, userId: string): Promise<string[]> {
  const paths: string[] = [];

  try {
    const { data: userData } = await supabaseAdmin
      .from('users')
      .select('avatar_url, cover_url_desktop, cover_url_mobile, promotional_banner_url_desktop, promotional_banner_url_mobile')
      .eq('id', userId)
      .maybeSingle();

    if (userData) {
      const urlFields = [
        userData.avatar_url,
        userData.cover_url_desktop,
        userData.cover_url_mobile,
        userData.promotional_banner_url_desktop,
        userData.promotional_banner_url_mobile,
      ];
      for (const url of urlFields) {
        if (url) {
          const path = extractPathFromUrl(url);
          if (path) paths.push(path);
        }
      }
    }
  } catch (error) {
    console.error('Error getting user profile image paths:', error);
  }

  try {
    const { data: products } = await supabaseAdmin
      .from('products')
      .select('id, featured_image_url, video_url')
      .eq('user_id', userId);

    if (products && products.length > 0) {
      for (const product of products) {
        if (product.featured_image_url) {
          const path = extractPathFromUrl(product.featured_image_url);
          if (path) paths.push(path);
        }
        if (product.video_url) {
          const path = extractPathFromUrl(product.video_url);
          if (path) paths.push(path);
        }
      }

      const productIds = products.map((p: any) => p.id);
      const { data: productImages } = await supabaseAdmin
        .from('product_images')
        .select('url')
        .in('product_id', productIds);

      if (productImages) {
        for (const image of productImages) {
          if (image.url) {
            const path = extractPathFromUrl(image.url);
            if (path) paths.push(path);
          }
        }
      }
    }
  } catch (error) {
    console.error('Error getting product image paths:', error);
  }

  return [...new Set(paths)];
}

async function cleanupStorageFiles(supabaseAdmin: any, paths: string[]): Promise<{ deleted: number; failed: number; errors: { path: string; error: string }[] }> {
  if (paths.length === 0) {
    return { deleted: 0, failed: 0, errors: [] };
  }

  const BATCH_SIZE = 100;
  let deleted = 0;
  let failed = 0;
  const errors: { path: string; error: string }[] = [];

  for (let i = 0; i < paths.length; i += BATCH_SIZE) {
    const batch = paths.slice(i, i + BATCH_SIZE);
    try {
      const { error } = await supabaseAdmin.storage
        .from('public')
        .remove(batch);

      if (error) {
        failed += batch.length;
        errors.push({ path: `batch ${i / BATCH_SIZE + 1}`, error: error.message });
      } else {
        deleted += batch.length;
      }
    } catch (error) {
      failed += batch.length;
      const msg = error instanceof Error ? error.message : 'Unknown error';
      errors.push({ path: `batch ${i / BATCH_SIZE + 1}`, error: msg });
    }
  }

  return { deleted, failed, errors };
}

async function cleanupOrphanTables(supabaseAdmin: any, userId: string): Promise<number> {
  const tables = [
    'coupons',
    'notifications',
    'product_tags',
    'storefront_appearance',
    'user_custom_flavors',
    'user_image_settings',
    'user_promotional_phrases',
  ];

  let totalDeleted = 0;

  for (const table of tables) {
    try {
      const { data, error } = await supabaseAdmin
        .from(table)
        .delete()
        .eq('user_id', userId)
        .select('id');

      if (!error && data) {
        totalDeleted += data.length;
      }
    } catch (error) {
      console.error(`Error cleaning up ${table}:`, error);
    }
  }

  return totalDeleted;
}

async function deleteOneUser(supabaseAdmin: any, userId: string, callerId: string): Promise<UserDeleteResult> {
  const cleanup: CleanupStats = {
    filesDeleted: 0,
    filesFailed: 0,
    orphanRowsDeleted: 0,
    paths: [],
    errors: [],
  };

  try {
    const { data: targetUser } = await supabaseAdmin
      .from('users')
      .select('role, created_by')
      .eq('id', userId)
      .maybeSingle();

    if (!targetUser) {
      return { userId, success: false, error: 'User not found', cleanup };
    }

    if (targetUser.role === 'admin') {
      return { userId, success: false, error: 'Cannot delete admin users', cleanup };
    }

    const { data: callerProfile } = await supabaseAdmin
      .from('users')
      .select('role')
      .eq('id', callerId)
      .maybeSingle();

    if (!callerProfile) {
      return { userId, success: false, error: 'Unable to verify permissions', cleanup };
    }

    const canDelete =
      callerProfile.role === 'admin' ||
      (callerProfile.role === 'parceiro' && targetUser.created_by === callerId);

    if (!canDelete) {
      return { userId, success: false, error: 'Insufficient permissions', cleanup };
    }

    // Step 1: Gather storage paths before any deletion
    const storagePaths = await getStoragePathsForUser(supabaseAdmin, userId);
    console.log(`User ${userId}: Found ${storagePaths.length} storage files`);

    // Step 2: Clean up storage files
    const storageResult = await cleanupStorageFiles(supabaseAdmin, storagePaths);
    cleanup.filesDeleted = storageResult.deleted;
    cleanup.filesFailed = storageResult.failed;
    cleanup.paths = storagePaths;
    cleanup.errors = storageResult.errors;

    // Step 3: Clean up orphan-prone tables (no FK constraint)
    cleanup.orphanRowsDeleted = await cleanupOrphanTables(supabaseAdmin, userId);

    // Step 4: Delete from public.users FIRST (cascading handles related tables)
    const { error: deleteDbError } = await supabaseAdmin
      .from('users')
      .delete()
      .eq('id', userId);

    if (deleteDbError) {
      console.error(`User ${userId}: Database delete failed:`, deleteDbError);
      return { userId, success: false, error: `Database delete failed: ${deleteDbError.message}`, cleanup };
    }

    // Step 5: Delete from auth.users AFTER public.users succeeds
    const { error: deleteAuthError } = await supabaseAdmin.auth.admin.deleteUser(userId);
    if (deleteAuthError) {
      console.error(`User ${userId}: Auth delete warning:`, deleteAuthError);
    }

    return { userId, success: true, cleanup };
  } catch (error) {
    console.error(`User ${userId}: Unexpected error:`, error);
    const msg = error instanceof Error ? error.message : 'Internal server error';
    return { userId, success: false, error: msg, cleanup };
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    if (req.method !== 'DELETE' && req.method !== 'POST') {
      return new Response(
        JSON.stringify({ error: { message: 'Method not allowed' } }),
        { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: { message: 'Missing authorization header' } }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const supabaseUser = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await supabaseUser.auth.getUser();
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: { message: 'Unauthorized' } }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const body: DeleteUserRequest = await req.json();
    const userIds = body.userIds || (body.userId ? [body.userId] : []);

    if (userIds.length === 0) {
      return new Response(
        JSON.stringify({ error: { message: 'userId or userIds is required' } }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const results: UserDeleteResult[] = [];
    for (const id of userIds) {
      const result = await deleteOneUser(supabaseAdmin, id, user.id);
      results.push(result);
    }

    const succeeded = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;
    const totalFilesDeleted = results.reduce((sum, r) => sum + r.cleanup.filesDeleted, 0);
    const totalOrphanRows = results.reduce((sum, r) => sum + r.cleanup.orphanRowsDeleted, 0);

    return new Response(
      JSON.stringify({
        success: failed === 0,
        summary: {
          total: userIds.length,
          succeeded,
          failed,
          totalFilesDeleted,
          totalOrphanRowsCleaned: totalOrphanRows,
        },
        results,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Unexpected error in delete-user function:', error);
    return new Response(
      JSON.stringify({ error: { message: 'Internal server error' } }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
