/*
  # partner-invites

  Redeems a one-time invite link (/convite/:token) created for a new partner,
  a client taking over a store built by a partner, or agency staff.

  POST { action: 'inspect', token }  -> who/what the invite is for (no login)
  POST { action: 'redeem', token }   -> marks it used and returns a magic-link
                                        hashed token the browser verifies with
                                        supabase.auth.verifyOtp({ type: 'magiclink' }),
                                        after which the page asks for a password.

  Tokens are random UUIDs valid for 7 days; only the latest one per user is
  valid (older ones are expired when a new one is issued).
*/

import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 200, headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  try {
    const { action, token } = await req.json();
    if (typeof token !== 'string' || !UUID_RE.test(token)) return json({ error: 'Convite inválido.' }, 400);

    const admin = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');

    const { data: invite } = await admin
      .from('partner_invites')
      .select('token, kind, user_id, partner_id, expires_at, used_at')
      .eq('token', token)
      .maybeSingle();

    if (!invite) return json({ error: 'Convite não encontrado.' }, 404);
    if (invite.used_at) return json({ error: 'Este convite já foi usado. Entre com seu e-mail e senha.', used: true }, 410);
    if (new Date(invite.expires_at) < new Date()) return json({ error: 'Este convite expirou. Peça um novo link.', expired: true }, 410);

    const { data: user } = await admin.from('users').select('id, email, name, is_blocked').eq('id', invite.user_id).maybeSingle();
    if (!user || user.is_blocked) return json({ error: 'Conta indisponível. Fale com o suporte.' }, 410);

    let partnerName: string | null = null;
    if (invite.partner_id) {
      const { data: partner } = await admin
        .from('users')
        .select('name, partner_profiles(company_name)')
        .eq('id', invite.partner_id)
        .maybeSingle();
      const company = (partner as { partner_profiles?: { company_name?: string | null } | null } | null)?.partner_profiles?.company_name;
      partnerName = company || partner?.name || null;
    }

    if (action === 'inspect') {
      return json({ kind: invite.kind, name: user.name, email: user.email, partner_name: partnerName });
    }

    if (action !== 'redeem') return json({ error: 'Ação inválida' }, 400);

    const { data: claimed } = await admin
      .from('partner_invites')
      .update({ used_at: new Date().toISOString() })
      .eq('token', token)
      .is('used_at', null)
      .select('token')
      .maybeSingle();
    if (!claimed) return json({ error: 'Este convite já foi usado.', used: true }, 410);

    const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({ type: 'magiclink', email: user.email });
    const hashedToken = linkData?.properties?.hashed_token;
    if (linkError || !hashedToken) {
      await admin.from('partner_invites').update({ used_at: null }).eq('token', token);
      console.error('partner-invites generateLink error', linkError);
      return json({ error: 'Não foi possível validar o convite agora. Tente de novo.' }, 500);
    }

    return json({ hashedToken, kind: invite.kind, email: user.email, name: user.name, partner_name: partnerName });
  } catch (error) {
    console.error('partner-invites error', error);
    return json({ error: 'Erro inesperado' }, 500);
  }
});
