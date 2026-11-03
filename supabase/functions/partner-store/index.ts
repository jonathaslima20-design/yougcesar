/*
  # partner-store

  Partner-panel actions that need the service role. Every action resolves
  the caller's partner scope (the owning partner for agency staff) and checks
  the team role before touching anything.

  Actions (POST { action, ... }):
    - create_store   owner|manager   Creates a client account (trial) managed
                                     by the partner, with manager access granted,
                                     and returns a 7-day invite link.
    - send_invite    owner|manager   New invite link for a client that hasn't
                                     taken over the account yet.
    - open_store     any team role   Magic-link token to manage a client's store
                                     (requires the client's consent).
    - team_invite    owner           Creates an agency staff login + invite link.
    - team_remove    owner           Removes a staff member and blocks the login.
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

const REFERRAL_CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function randomCode(prefix: string, length: number) {
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  return prefix + Array.from(bytes, (b) => REFERRAL_CODE_CHARS[b % REFERRAL_CODE_CHARS.length]).join('');
}

function slugify(value: string) {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40) || 'loja';
}

function siteUrl(req: Request) {
  const origin = req.headers.get('origin');
  if (origin && /^https?:\/\/(localhost(:\d+)?|[a-z0-9.-]*vitrineturbo\.com)$/i.test(origin)) return origin;
  return Deno.env.get('SITE_URL') ?? 'https://vitrineturbo.com';
}

async function uniqueSlug(admin: SupabaseClient, base: string) {
  let slug = slugify(base);
  for (let i = 0; i < 5; i++) {
    const { data } = await admin.from('users').select('id').eq('slug', slug).maybeSingle();
    if (!data) return slug;
    slug = `${slugify(base).slice(0, 34)}-${randomCode('', 4).toLowerCase()}`;
  }
  return `${slugify(base).slice(0, 30)}-${crypto.randomUUID().slice(0, 8)}`;
}

async function createInvite(admin: SupabaseClient, kind: 'client' | 'team', userId: string, partnerId: string, createdBy: string) {
  // Only the latest invite for a user stays valid.
  await admin.from('partner_invites').update({ expires_at: new Date().toISOString() }).eq('user_id', userId).is('used_at', null);
  const { data, error } = await admin
    .from('partner_invites')
    .insert({ kind, user_id: userId, partner_id: partnerId, created_by: createdBy })
    .select('token, expires_at')
    .single();
  if (error) throw error;
  return data as { token: string; expires_at: string };
}

async function createLogin(admin: SupabaseClient, email: string, name: string) {
  const { data: existing } = await admin.from('users').select('id').ilike('email', email).maybeSingle();
  if (existing) throw new Error('Este e-mail já tem uma conta no VitrineTurbo.');
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: crypto.randomUUID() + crypto.randomUUID(),
    email_confirm: true,
    user_metadata: { name },
  });
  if (error || !data.user) {
    if (error?.message?.toLowerCase().includes('already')) throw new Error('Este e-mail já tem uma conta no VitrineTurbo.');
    throw new Error(error?.message || 'Não foi possível criar o acesso.');
  }
  return data.user.id;
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

    const { data: callerRow } = await admin.from('users').select('id, role, is_blocked').eq('id', caller.id).maybeSingle();
    if (!callerRow || callerRow.role !== 'partner' || callerRow.is_blocked) return json({ error: 'Acesso restrito a parceiros' }, 403);

    const { data: membership } = await admin.from('partner_team_members').select('partner_id, team_role').eq('user_id', caller.id).maybeSingle();
    const partnerId: string = membership?.partner_id ?? caller.id;
    const teamRole: 'owner' | 'manager' | 'operator' = (membership?.team_role as 'manager' | 'operator') ?? 'owner';

    const { data: profile } = await admin.from('partner_profiles').select('status').eq('user_id', partnerId).maybeSingle();
    if (!profile || profile.status !== 'approved') return json({ error: 'Sua conta de parceiro não está ativa.' }, 403);

    const body = await req.json();
    const action: string = body.action;
    const site = siteUrl(req);

    const audit = (act: string, target: string | null, details: Record<string, unknown> = {}) =>
      admin.from('partner_audit_log').insert({ partner_id: partnerId, actor_id: caller.id, action: act, target_user_id: target, details });

    const requireRole = (...roles: string[]) => {
      if (!roles.includes(teamRole)) throw Object.assign(new Error('Seu papel na equipe não permite esta ação.'), { status: 403 });
    };

    const loadManagedClient = async (userId: string) => {
      const { data } = await admin
        .from('users')
        .select('id, email, name, role, managed_by_partner_id, is_blocked, last_login_at')
        .eq('id', userId)
        .maybeSingle();
      if (!data || data.role !== 'corretor' || data.managed_by_partner_id !== partnerId) {
        throw Object.assign(new Error('Cliente não encontrado na sua carteira.'), { status: 404 });
      }
      return data;
    };

    if (action === 'create_store') {
      requireRole('owner', 'manager');
      const name = String(body.name ?? '').trim();
      const email = String(body.email ?? '').trim().toLowerCase();
      const whatsapp = String(body.whatsapp ?? '').replace(/\D/g, '');
      const storeName = String(body.store_name ?? '').trim() || name;
      const countryCode = String(body.country_code ?? '55').replace(/\D/g, '') || '55';
      const niche = String(body.niche ?? 'diversos').trim() || 'diversos';
      if (!name || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return json({ error: 'Informe nome e e-mail válidos do cliente.' }, 400);
      if (whatsapp.length < 10) return json({ error: 'Informe o WhatsApp do cliente com DDD.' }, 400);

      const { data: settings } = await admin.from('partner_settings').select('store_trial_days').limit(1).maybeSingle();
      const trialDays = settings?.store_trial_days ?? 15;

      // A lead protected by another partner wins (same rule as signups).
      const { data: protectedLeads } = await admin
        .from('partner_leads')
        .select('partner_id, email, whatsapp')
        .neq('partner_id', partnerId)
        .gt('protected_until', new Date().toISOString())
        .not('stage', 'in', '(lost,won)')
        .or(`email.eq."${email.replace(/"/g, '')}",whatsapp.eq.${whatsapp}`);
      if ((protectedLeads ?? []).length > 0) return json({ error: 'Este contato está protegido por outro parceiro.' }, 409);

      const userId = await createLogin(admin, email, name);
      const slug = await uniqueSlug(admin, storeName);

      const { error: insertError } = await admin.from('users').upsert({
        id: userId,
        email,
        name: storeName,
        owner_name: name,
        country_code: countryCode,
        whatsapp,
        role: 'corretor',
        slug,
        niche_type: niche,
        plan_status: 'trial',
        trial_ends_at: new Date(Date.now() + trialDays * 86400000).toISOString(),
        is_blocked: false,
        managed_by_partner_id: partnerId,
        referred_by: partnerId,
        created_by: caller.id,
        referral_code: randomCode('VT', 5),
      });
      if (insertError) {
        await admin.auth.admin.deleteUser(userId);
        console.error('create_store insert error', insertError);
        return json({ error: 'Não foi possível criar a loja. Tente novamente.' }, 500);
      }

      await admin.from('user_storefront_settings').upsert({ user_id: userId, settings: { enableInventory: true } }, { onConflict: 'user_id' });
      await admin.from('partner_store_access').upsert({ store_user_id: userId, partner_id: partnerId, granted: true });
      await admin.from('partner_attributions').upsert({ user_id: userId, partner_id: partnerId, source: 'created', attributed_at: new Date().toISOString() });
      if (body.lead_id) {
        await admin.from('partner_leads').update({ stage: 'trial', converted_user_id: userId }).eq('id', body.lead_id).eq('partner_id', partnerId);
      }

      const invite = await createInvite(admin, 'client', userId, partnerId, caller.id);
      await audit('store_created', userId, { email, slug });
      return json({ user_id: userId, slug, invite_url: `${site}/convite/${invite.token}`, invite_expires_at: invite.expires_at, trial_days: trialDays });
    }

    if (action === 'send_invite') {
      requireRole('owner', 'manager');
      const client = await loadManagedClient(String(body.user_id));
      const { data: access } = await admin.from('partner_store_access').select('client_accepted_at').eq('store_user_id', client.id).maybeSingle();
      if (access?.client_accepted_at) return json({ error: 'O cliente já assumiu esta loja.' }, 400);
      const invite = await createInvite(admin, 'client', client.id, partnerId, caller.id);
      await audit('invite_sent', client.id);
      return json({ invite_url: `${site}/convite/${invite.token}`, invite_expires_at: invite.expires_at });
    }

    if (action === 'open_store') {
      const client = await loadManagedClient(String(body.user_id));
      if (client.is_blocked) return json({ error: 'Esta loja está bloqueada.' }, 400);
      const { data: access } = await admin.from('partner_store_access').select('granted').eq('store_user_id', client.id).maybeSingle();
      if (!access?.granted) return json({ error: 'O cliente não liberou o acesso de gestor para você.' }, 403);

      const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({ type: 'magiclink', email: client.email });
      const hashedToken = linkData?.properties?.hashed_token;
      if (linkError || !hashedToken) {
        console.error('open_store generateLink error', linkError);
        return json({ error: 'Não foi possível abrir a loja agora.' }, 500);
      }
      await audit('store_opened', client.id);
      return json({ hashedToken, store_name: client.name });
    }

    if (action === 'team_invite') {
      requireRole('owner');
      const name = String(body.name ?? '').trim();
      const email = String(body.email ?? '').trim().toLowerCase();
      const role = body.team_role === 'manager' ? 'manager' : 'operator';
      if (!name || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return json({ error: 'Informe nome e e-mail válidos.' }, 400);
      const { count } = await admin.from('partner_team_members').select('id', { count: 'exact', head: true }).eq('partner_id', partnerId);
      if ((count ?? 0) >= 20) return json({ error: 'Limite de 20 pessoas na equipe.' }, 400);

      const userId = await createLogin(admin, email, name);
      const { error: insertError } = await admin.from('users').upsert({
        id: userId,
        email,
        name,
        role: 'partner',
        plan_status: 'free',
        is_blocked: false,
        created_by: caller.id,
      });
      if (insertError) {
        await admin.auth.admin.deleteUser(userId);
        return json({ error: 'Não foi possível criar o acesso.' }, 500);
      }
      await admin.from('partner_team_members').insert({ partner_id: partnerId, user_id: userId, team_role: role });
      const invite = await createInvite(admin, 'team', userId, partnerId, caller.id);
      await audit('team_member_added', userId, { email, role });
      return json({ user_id: userId, invite_url: `${site}/convite/${invite.token}`, invite_expires_at: invite.expires_at });
    }

    if (action === 'team_remove') {
      requireRole('owner');
      const memberId = String(body.user_id);
      const { data: member } = await admin.from('partner_team_members').select('user_id').eq('user_id', memberId).eq('partner_id', partnerId).maybeSingle();
      if (!member) return json({ error: 'Pessoa não encontrada na sua equipe.' }, 404);
      await admin.from('partner_team_members').delete().eq('user_id', memberId);
      await admin.from('users').update({ is_blocked: true }).eq('id', memberId);
      await audit('team_member_removed', memberId);
      return json({ success: true });
    }

    return json({ error: 'Ação inválida' }, 400);
  } catch (error) {
    const status = (error as { status?: number }).status ?? 400;
    console.error('partner-store error', error);
    return json({ error: (error as Error).message || 'Erro inesperado' }, status);
  }
});
