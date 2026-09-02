/*
  # Create Affiliate Edge Function

  Lets a store owner (merchant, role='corretor') register a new affiliate
  account for their own store, mirroring create-user's shape (service role
  key creates the Auth user + email_confirm:true, no transactional email
  dependency — the merchant sets the password directly, or the dashboard
  generates one and shows it once).

  1. Security
    - Requires JWT authentication.
    - Caller must be a 'corretor' whose users.affiliate_program_enabled is
      true — the admin-controlled gate is re-checked here server-side, not
      just hidden in the UI.
  2. Behavior
    - The store owner picks the affiliate's `slug` (validated here too, not
      just client-side): it becomes the storefront link's path segment,
      https://vitrineturbo.com/{storeSlug}/{slug} — checked for availability
      within the store before the Auth user is even created.
    - Still generates a random `affiliate_code` scoped to the caller's store
      (retrying on a rare collision) — kept for backward compatibility with
      the ?aff=CODE deep-link functions (per-product/category share links).
    - Rolls back the created Auth user if the `affiliates` profile insert
      fails, mirroring create-user's own rollback-on-failure behavior.
*/

import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface CreateAffiliateRequest {
  email: string;
  password: string;
  name: string;
  slug: string;
  whatsapp?: string;
  country_code?: string;
  default_commission_percentage: number;
  commission_trigger?: 'confirmed' | 'delivered';
  attribution_window_days?: 7 | 15 | 30;
  payment_frequency?: 'weekly' | 'biweekly' | 'monthly';
  whatsapp_contact_mode?: 'store_default' | 'own_whatsapp';
}

const AFFILIATE_CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const SLUG_REGEX = /^[a-z0-9][a-z0-9-]{1,28}[a-z0-9]$/;
const RESERVED_SLUGS = new Set(['produtos', 'pedido', 'carrinho', 'checkout', 'afiliado', 'admin', 'dashboard', 'conta', 'partners', 'blog', 'login', 'register', 'planos']);

function generateAffiliateCode(): string {
  let code = 'AF';
  for (let i = 0; i < 6; i++) code += AFFILIATE_CODE_CHARS[Math.floor(Math.random() * AFFILIATE_CODE_CHARS.length)];
  return code;
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

    const { data: storeOwner, error: storeOwnerError } = await supabaseClient
      .from('users')
      .select('role, affiliate_program_enabled')
      .eq('id', requestingUser.id)
      .maybeSingle();

    if (storeOwnerError) {
      console.error('Error fetching requesting user profile:', storeOwnerError);
      return new Response(
        JSON.stringify({ error: 'Error verifying user permissions' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (storeOwner?.role !== 'corretor') {
      return new Response(
        JSON.stringify({ error: 'Apenas lojistas podem cadastrar afiliados' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!storeOwner.affiliate_program_enabled) {
      return new Response(
        JSON.stringify({ error: 'Programa de afiliados não está liberado para esta conta' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const {
      email: rawEmail,
      password,
      name,
      slug: rawSlug,
      whatsapp,
      country_code,
      default_commission_percentage,
      commission_trigger,
      attribution_window_days,
      payment_frequency,
      whatsapp_contact_mode,
    }: CreateAffiliateRequest = await req.json();
    const email = rawEmail?.trim().toLowerCase();
    const slug = rawSlug?.trim().toLowerCase();

    if (!email || !password || !name || !slug || default_commission_percentage === undefined || default_commission_percentage === null) {
      return new Response(
        JSON.stringify({ error: 'Campos obrigatórios: email, password, name, slug, default_commission_percentage' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!SLUG_REGEX.test(slug) || RESERVED_SLUGS.has(slug)) {
      return new Response(
        JSON.stringify({ error: 'Slug inválido. Use apenas letras minúsculas, números e hífens (sem começar ou terminar com hífen).' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return new Response(
        JSON.stringify({ error: 'Formato de e-mail inválido' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (password.length < 6) {
      return new Response(
        JSON.stringify({ error: 'A senha deve ter pelo menos 6 caracteres' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (default_commission_percentage < 0 || default_commission_percentage > 100) {
      return new Response(
        JSON.stringify({ error: 'A comissão geral deve estar entre 0 e 100' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const resolvedCommissionTrigger = commission_trigger || 'delivered';
    if (!['confirmed', 'delivered'].includes(resolvedCommissionTrigger)) {
      return new Response(
        JSON.stringify({ error: 'Gatilho de comissão inválido' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const resolvedAttributionWindow = attribution_window_days || 30;
    if (![7, 15, 30].includes(resolvedAttributionWindow)) {
      return new Response(
        JSON.stringify({ error: 'Janela de atribuição inválida' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const resolvedPaymentFrequency = payment_frequency || 'monthly';
    if (!['weekly', 'biweekly', 'monthly'].includes(resolvedPaymentFrequency)) {
      return new Response(
        JSON.stringify({ error: 'Frequência de pagamento inválida' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const resolvedWhatsappContactMode = whatsapp_contact_mode || 'store_default';
    if (!['store_default', 'own_whatsapp'].includes(resolvedWhatsappContactMode)) {
      return new Response(
        JSON.stringify({ error: 'Modo de WhatsApp inválido' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (resolvedWhatsappContactMode === 'own_whatsapp' && !whatsapp?.trim()) {
      return new Response(
        JSON.stringify({ error: 'Informe o WhatsApp do afiliado para usar o número dele na vitrine' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: existingSlug } = await supabaseAdmin
      .from('affiliates')
      .select('id')
      .eq('store_owner_id', requestingUser.id)
      .eq('slug', slug)
      .maybeSingle();

    if (existingSlug) {
      return new Response(
        JSON.stringify({ error: 'Esse link já está em uso por outro afiliado. Escolha outro.' }),
        { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: authData, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { name, role: 'affiliate' },
    });

    if (createError || !authData.user) {
      console.error('Error creating affiliate auth user:', createError);
      const message = createError?.message?.includes('already registered')
        ? 'Este e-mail já está em uso por outra conta'
        : (createError?.message || 'Falha ao criar o afiliado');
      return new Response(
        JSON.stringify({ error: message }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const affiliateId = authData.user.id;

    let affiliateCode = '';
    let inserted = false;
    let lastInsertError: { code?: string; message?: string } | null = null;

    for (let attempt = 0; attempt < 5 && !inserted; attempt++) {
      affiliateCode = generateAffiliateCode();
      const { error: insertError } = await supabaseAdmin.from('affiliates').insert({
        id: affiliateId,
        store_owner_id: requestingUser.id,
        email,
        name,
        slug,
        whatsapp: whatsapp || null,
        country_code: country_code || '55',
        affiliate_code: affiliateCode,
        default_commission_percentage,
        commission_trigger: resolvedCommissionTrigger,
        attribution_window_days: resolvedAttributionWindow,
        payment_frequency: resolvedPaymentFrequency,
        whatsapp_contact_mode: resolvedWhatsappContactMode,
        status: 'active',
      });

      if (!insertError) {
        inserted = true;
      } else if (insertError.code === '23505') {
        lastInsertError = insertError;
        continue;
      } else {
        lastInsertError = insertError;
        break;
      }
    }

    if (!inserted) {
      console.error('Error creating affiliate profile:', lastInsertError);
      await supabaseAdmin.auth.admin.deleteUser(affiliateId);
      return new Response(
        JSON.stringify({ error: 'Falha ao criar o perfil do afiliado' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, affiliateId, affiliateCode, slug }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Unexpected error in create-affiliate function:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
