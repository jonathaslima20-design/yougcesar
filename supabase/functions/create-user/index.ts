/*
  # Create User Edge Function

  This function handles admin user creation with proper authentication.

  1. Features
    - Creates new user account with provided credentials
    - Sets user metadata (name, whatsapp, role)
    - Auto-confirms email (no confirmation required)
    - Initializes user profile in the database

  2. Security
    - Requires JWT authentication (admin only)
    - Validates input data
    - Uses service role key for admin operations

  3. Usage
    - Header required: Authorization with valid JWT
    - Admin users only
*/

import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface CreateUserRequest {
  email: string;
  password: string;
  name: string;
  country_code?: string;
  whatsapp?: string;
  role: string;
  plan_id?: string;
}

const DURATION_MONTHS: Record<string, number> = {
  Mensal: 1,
  Trimestral: 3,
  Semestral: 6,
  Anual: 12,
};

const MONTHS_TO_BILLING_CYCLE: Record<number, string> = {
  1: 'monthly',
  3: 'quarterly',
  6: 'semiannually',
  12: 'annually',
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (req.method !== 'POST') {
      return new Response(
        JSON.stringify({ error: 'Method not allowed' }),
        {
          status: 405,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: authHeader },
        },
      }
    );

    const { data: { user: requestingUser }, error: authError } = await supabaseClient.auth.getUser();

    if (authError || !requestingUser) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    const { data: userProfile, error: profileError } = await supabaseClient
      .from('users')
      .select('role')
      .eq('id', requestingUser.id)
      .maybeSingle();

    if (profileError) {
      console.error('Error fetching user profile:', profileError);
      return new Response(
        JSON.stringify({ error: 'Error verifying user permissions' }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    const requestingRole = userProfile?.role;
    if (requestingRole !== 'admin' && requestingRole !== 'partner') {
      return new Response(
        JSON.stringify({ error: 'Forbidden: Admin access required' }),
        {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { email: rawEmail, password, name, country_code, whatsapp, role: requestedRole, plan_id: planId }: CreateUserRequest = await req.json();
    const email = rawEmail?.trim().toLowerCase();

    // Partners can only ever create corretor accounts — never trust the role
    // field from a partner caller, force it regardless of what was sent.
    const role = requestingRole === 'partner' ? 'corretor' : requestedRole;

    if (!email || !password || !name || !role) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: email, password, name, role' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return new Response(
        JSON.stringify({ error: 'Invalid email format' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    if (password.length < 6) {
      return new Response(
        JSON.stringify({ error: 'Password must be at least 6 characters long' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    const allowedRolesForCaller = requestingRole === 'partner' ? ['corretor'] : ['admin', 'corretor', 'partner'];
    if (!allowedRolesForCaller.includes(role)) {
      return new Response(
        JSON.stringify({ error: `Invalid role. Must be one of: ${allowedRolesForCaller.join(', ')}` }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Partners must assign a paid plan directly — Free accounts are only
    // reachable via self-registration through the partner's referral link.
    if (requestingRole === 'partner' && !planId) {
      return new Response(
        JSON.stringify({ error: 'Selecione um plano para o usuário' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    const { data: existingUser } = await supabaseAdmin
      .from('users')
      .select('id')
      .eq('email', email)
      .maybeSingle();

    if (existingUser) {
      return new Response(
        JSON.stringify({ error: 'Email already exists' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    console.log('Creating new user:', { email, name, role });

    const { data: authData, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        name,
        whatsapp: whatsapp || '',
        role,
      }
    });

    if (createError || !authData.user) {
      console.error('Error creating user:', createError);
      return new Response(
        JSON.stringify({ error: createError?.message || 'Failed to create user' }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    const userId = authData.user.id;
    console.log('User created successfully:', userId);

    const slug = email.split('@')[0].toLowerCase().replace(/[^a-z0-9]/g, '-');

    const { error: profileError2 } = await supabaseAdmin
      .from('users')
      .upsert({
        id: userId,
        email,
        name,
        country_code: country_code || '55',
        whatsapp: whatsapp || '',
        role,
        slug,
        plan_status: 'free',
        is_blocked: false,
        ...(requestingRole === 'partner' ? { managed_by_partner_id: requestingUser.id } : {}),
      });

    if (profileError2) {
      console.error('Error creating user profile:', profileError2);
      await supabaseAdmin.auth.admin.deleteUser(userId);
      return new Response(
        JSON.stringify({ error: 'Failed to create user profile' }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Enable inventory control by default for new users
    await supabaseAdmin
      .from('user_storefront_settings')
      .upsert({ user_id: userId, settings: { enableInventory: true } }, { onConflict: 'user_id' });

    // Partner-assigned plan: grant immediate access while payment is pending,
    // with an admin-configurable deadline (in hours) before auto-block.
    if (requestingRole === 'partner' && planId) {
      const { data: plan } = await supabaseAdmin
        .from('subscription_plans')
        .select('name, duration, price')
        .eq('id', planId)
        .maybeSingle();

      if (plan) {
        const months = DURATION_MONTHS[plan.duration] || 1;
        const billingCycleDb = MONTHS_TO_BILLING_CYCLE[months] || 'monthly';

        const { data: partnerSettings } = await supabaseAdmin
          .from('partner_settings')
          .select('payment_deadline_hours')
          .limit(1)
          .maybeSingle();

        const deadlineHours = partnerSettings?.payment_deadline_hours ?? 6;
        const now = new Date();
        const paymentDueAt = new Date(now.getTime() + deadlineHours * 60 * 60 * 1000);

        await supabaseAdmin.from('subscriptions').insert({
          user_id: userId,
          plan_name: plan.name,
          plan_price: plan.price,
          billing_cycle: billingCycleDb,
          status: 'pending',
          payment_status: 'pending',
          start_date: now.toISOString().split('T')[0],
          next_payment_date: paymentDueAt.toISOString().split('T')[0],
          payment_due_at: paymentDueAt.toISOString(),
        });

        await supabaseAdmin
          .from('users')
          .update({
            plan_status: 'active',
            billing_cycle: billingCycleDb,
          })
          .eq('id', userId);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        userId,
        message: 'User created successfully'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error('Unexpected error in create-user function:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
