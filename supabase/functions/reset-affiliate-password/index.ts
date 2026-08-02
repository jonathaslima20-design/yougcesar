/*
  # Reset Affiliate Password Edge Function

  Lets a store owner set a new password for one of their own affiliates
  directly (mirrors the merchant-facing create-affiliate function's rationale:
  no transactional email is configured in this project, so there is no
  "forgot password" email flow — the merchant is the only recovery path for
  an affiliate who forgets their password).

  1. Security
    - Requires JWT authentication.
    - Caller must be the affiliate's own store_owner_id — verified by joining
      affiliates.store_owner_id against the caller's auth.uid(), not just
      checking role='corretor' in isolation (a lojista can't reset another
      lojista's affiliate).
*/

import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface ResetAffiliatePasswordRequest {
  affiliateId: string;
  password: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
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

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user: requestingUser }, error: authError } = await supabaseClient.auth.getUser();
    if (authError || !requestingUser) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { affiliateId, password }: ResetAffiliatePasswordRequest = await req.json();

    if (!affiliateId || !password) {
      return new Response(
        JSON.stringify({ error: 'Campos obrigatórios: affiliateId, password' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (password.length < 6) {
      return new Response(
        JSON.stringify({ error: 'A senha deve ter pelo menos 6 caracteres' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: affiliate, error: affiliateError } = await supabaseClient
      .from('affiliates')
      .select('id, store_owner_id')
      .eq('id', affiliateId)
      .maybeSingle();

    if (affiliateError || !affiliate) {
      return new Response(
        JSON.stringify({ error: 'Afiliado não encontrado' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (affiliate.store_owner_id !== requestingUser.id) {
      return new Response(
        JSON.stringify({ error: 'Você não tem permissão para redefinir a senha deste afiliado' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(affiliateId, { password });

    if (updateError) {
      console.error('Error resetting affiliate password:', updateError);
      return new Response(
        JSON.stringify({ error: 'Falha ao redefinir a senha' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Unexpected error in reset-affiliate-password function:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
