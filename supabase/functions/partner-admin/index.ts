/*
  # partner-admin

  Admin-only Partners actions that need the service role.

  POST { action: 'approve_application', application_id, level_slug?, founder? }
    Creates the partner login (role 'partner'), profile, default link and a
    7-day activation link (returned so the admin can send it by WhatsApp).
  POST { action: 'regenerate_invite', user_id }
    New activation link for a partner, client or team member who hasn't
    finished signing up yet.
*/

import { createClient, SupabaseClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
function randomCode(prefix: string, length: number) {
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  return prefix + Array.from(bytes, (b) => CODE_CHARS[b % CODE_CHARS.length]).join('');
}

function slugify(value: string) {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 30);
}

function siteUrl(req: Request) {
  const origin = req.headers.get('origin');
  if (origin && /^https?:\/\/(localhost(:\d+)?|[a-z0-9.-]*vitrineturbo\.com)$/i.test(origin)) return origin;
  return Deno.env.get('SITE_URL') ?? 'https://vitrineturbo.com';
}

async function uniquePublicSlug(admin: SupabaseClient, base: string) {
  const root = slugify(base) || 'parceiro';
  let slug = root.length >= 3 ? root : `${root}-parceiro`;
  for (let i = 0; i < 6; i++) {
    const { data } = await admin.from('partner_profiles').select('user_id').eq('public_slug', slug).maybeSingle();
    if (!data) return slug;
    slug = `${root.slice(0, 25)}-${randomCode('', 4).toLowerCase()}`;
  }
  return `${root.slice(0, 20)}-${crypto.randomUUID().slice(0, 8)}`;
}

async function issueInvite(admin: SupabaseClient, kind: string, userId: string, partnerId: string | null, createdBy: string) {
  await admin.from('partner_invites').update({ expires_at: new Date().toISOString() }).eq('user_id', userId).is('used_at', null);
  const { data, error } = await admin
    .from('partner_invites')
    .insert({ kind, user_id: userId, partner_id: partnerId, created_by: createdBy })
    .select('token, expires_at')
    .single();
  if (error) throw error;
  return data as { token: string; expires_at: string };
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 200, headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return json({ error: 'Não autenticado' }, 401);
    const url = Deno.env.get('SUPABASE_URL') ?? '';
    const userClient = createClient(url, Deno.env.get('SUPABASE_ANON_KEY') ?? '', { global: { headers: { Authorization: authHeader } } });
    const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');

    const { data: { user: caller } } = await userClient.auth.getUser();
    if (!caller) return json({ error: 'Não autenticado' }, 401);
    const { data: callerRow } = await admin.from('users').select('role').eq('id', caller.id).maybeSingle();
    if (callerRow?.role !== 'admin') return json({ error: 'Apenas administradores' }, 403);

    const body = await req.json();
    const site = siteUrl(req);

    if (body.action === 'approve_application') {
      const { data: app } = await admin.from('partner_applications').select('*').eq('id', body.application_id).maybeSingle();
      if (!app) return json({ error: 'Inscrição não encontrada.' }, 404);
      if (app.status === 'approved') return json({ error: 'Inscrição já aprovada.' }, 400);

      const email = String(app.email).toLowerCase();
      const { data: existing } = await admin.from('users').select('id, role').ilike('email', email).maybeSingle();
      if (existing) {
        return json({ error: existing.role === 'partner' ? 'Este e-mail já é de um parceiro.' : 'Este e-mail já tem uma conta de lojista. Peça outro e-mail para a conta de parceiro.' }, 409);
      }

      const { data: authData, error: authError } = await admin.auth.admin.createUser({
        email,
        password: crypto.randomUUID() + crypto.randomUUID(),
        email_confirm: true,
        user_metadata: { name: app.name, role: 'partner' },
      });
      if (authError || !authData.user) return json({ error: authError?.message || 'Não foi possível criar o acesso.' }, 500);
      const userId = authData.user.id;

      const { error: userError } = await admin.from('users').upsert({
        id: userId,
        email,
        name: app.name,
        whatsapp: app.whatsapp,
        country_code: '55',
        role: 'partner',
        plan_status: 'free',
        is_blocked: false,
        referral_code: randomCode('VT', 5),
        created_by: caller.id,
      });
      if (userError) {
        await admin.auth.admin.deleteUser(userId);
        console.error('approve users insert', userError);
        return json({ error: 'Não foi possível criar o parceiro.' }, 500);
      }

      const { data: settings } = await admin.from('partner_settings').select('founder_slots, founder_bonus_pp, founder_min_percentage').limit(1).maybeSingle();
      const { count: founders } = await admin.from('partner_profiles').select('user_id', { count: 'exact', head: true }).eq('is_founder', true);
      const founder = body.founder ?? ((founders ?? 0) < (settings?.founder_slots ?? 0));

      const { data: level } = await admin
        .from('partner_levels')
        .select('id')
        .eq(body.level_slug ? 'slug' : 'is_active', body.level_slug ?? true)
        .order('sort_order')
        .limit(1)
        .maybeSingle();

      const publicSlug = await uniquePublicSlug(admin, app.company_name || app.name);
      const { error: profileError } = await admin.from('partner_profiles').insert({
        user_id: userId,
        partner_type: app.partner_type,
        company_name: app.company_name,
        document: app.document,
        document_type: app.document_type,
        website: app.website,
        instagram: app.instagram,
        city: app.city,
        state: app.state,
        niches: app.niches ?? [],
        public_slug: publicSlug,
        level_id: level?.id ?? null,
        is_founder: founder,
        founder_bonus_pp: founder ? settings?.founder_bonus_pp ?? 0 : 0,
        min_commission_percentage: null,
        recruited_by_partner_id: app.recruited_by_partner_id,
        terms_version: app.accepted_terms_version,
        terms_accepted_at: app.created_at,
        approved_at: new Date().toISOString(),
      });
      if (profileError) {
        await admin.from('users').delete().eq('id', userId);
        await admin.auth.admin.deleteUser(userId);
        console.error('approve profile insert', profileError);
        return json({ error: 'Não foi possível criar o perfil do parceiro.' }, 500);
      }

      await admin.from('partner_links').insert({ partner_id: userId, slug: 'inicio', name: 'Link principal', destination: '/', offer: 'trial' });
      await admin
        .from('partner_applications')
        .update({ status: 'approved', reviewed_by: caller.id, reviewed_at: new Date().toISOString(), partner_user_id: userId })
        .eq('id', app.id);

      if (app.recruited_by_partner_id) {
        await admin.from('notifications').insert({
          user_id: app.recruited_by_partner_id,
          type: 'partner_recruit',
          title: 'Parceiro indicado aprovado!',
          message: `${app.name} entrou no programa pela sua indicação. Você ganha um bônus sobre as comissões dele nos próximos meses.`,
          related_entity_type: 'partner_recruit',
        });
      }

      const invite = await issueInvite(admin, 'partner', userId, null, caller.id);
      await admin.from('partner_audit_log').insert({ partner_id: userId, actor_id: caller.id, action: 'partner_approved', details: { application_id: app.id, founder } });

      return json({
        user_id: userId,
        invite_url: `${site}/convite/${invite.token}`,
        invite_expires_at: invite.expires_at,
        whatsapp: app.whatsapp,
        name: app.name,
        founder,
      });
    }

    if (body.action === 'regenerate_invite') {
      const { data: target } = await admin.from('users').select('id, role, managed_by_partner_id').eq('id', body.user_id).maybeSingle();
      if (!target) return json({ error: 'Usuário não encontrado.' }, 404);
      const { data: member } = await admin.from('partner_team_members').select('partner_id').eq('user_id', target.id).maybeSingle();
      const kind = member ? 'team' : target.role === 'partner' ? 'partner' : 'client';
      const invite = await issueInvite(admin, kind, target.id, member?.partner_id ?? target.managed_by_partner_id ?? null, caller.id);
      return json({ invite_url: `${site}/convite/${invite.token}`, invite_expires_at: invite.expires_at });
    }

    return json({ error: 'Ação inválida' }, 400);
  } catch (error) {
    console.error('partner-admin error', error);
    return json({ error: (error as Error).message || 'Erro inesperado' }, 500);
  }
});
