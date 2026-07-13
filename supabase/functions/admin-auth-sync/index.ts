import { createClient } from 'npm:@supabase/supabase-js@2.46.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

interface DiagnosticResult {
  success: boolean;
  message: string;
  adminUser?: any;
  authUser?: any;
  issues: string[];
  actions_taken: string[];
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') || '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
    );

    const result: DiagnosticResult = {
      success: false,
      message: '',
      issues: [],
      actions_taken: [],
    };

    // Get admin user from users table
    const { data: adminUsers, error: adminError } = await supabase
      .from('users')
      .select('*')
      .eq('role', 'admin')
      .limit(1);

    if (adminError) {
      result.issues.push(`Error fetching admin from users table: ${adminError.message}`);
      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!adminUsers || adminUsers.length === 0) {
      result.issues.push('No admin user found in users table');
      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const adminUser = adminUsers[0];
    result.adminUser = adminUser;

    console.log('Found admin user:', adminUser.email);

    // Check if admin exists in auth.users
    const { data: { users: authUsers }, error: authError } = await supabase.auth.admin.listUsers();

    if (authError) {
      result.issues.push(`Error listing auth users: ${authError.message}`);
      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const authAdmin = authUsers.find(u => u.email === adminUser.email);

    if (!authAdmin) {
      result.issues.push(`Admin user ${adminUser.email} exists in users table but NOT in auth.users`);
      result.message = `🔴 MISMATCH: Admin exists in database but not in Supabase Auth`;
      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    result.authUser = {
      id: authAdmin.id,
      email: authAdmin.email,
      email_confirmed_at: authAdmin.email_confirmed_at,
      created_at: authAdmin.created_at,
    };

    // Check if emails match
    if (adminUser.email !== authAdmin.email) {
      result.issues.push(`Email mismatch: database="${adminUser.email}" vs auth="${authAdmin.email}"`);
    }

    // Check if user is confirmed
    if (!authAdmin.email_confirmed_at) {
      result.issues.push('Admin email NOT confirmed in Supabase Auth');
    }

    if (result.issues.length === 0) {
      result.success = true;
      result.message = '✅ All checks passed. Admin user is properly synchronized.';
    } else {
      result.message = `⚠️ Found ${result.issues.length} issue(s) with admin account`;
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: result.success ? 200 : 400,
    });
  } catch (error) {
    console.error('Error in admin-auth-sync:', error);
    return new Response(
      JSON.stringify({
        success: false,
        message: 'Error processing request',
        error: error instanceof Error ? error.message : 'Unknown error',
        issues: [],
        actions_taken: [],
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
