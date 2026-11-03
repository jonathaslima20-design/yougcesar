import { supabase } from '@/lib/supabase';

/*
  Partner attribution on the client.

  A partner link (/p/:code[/:link], ?ref=CODE on any page, or a coupon typed at
  signup) is resolved by the record_partner_click RPC. What it returns is kept
  for attribution_window_days in a first-party cookie (survives the
  localStorage being cleared by some in-app browsers) and in localStorage.

  The existing signup flow already reads `vitrineturbo_ref_code` /
  `vitrineturbo_ref_trial` (RegisterPage, completeGoogleProfile), so the
  partner's referral code is written there too; after signup,
  claimPendingPartnerAttribution() attaches the exact link/visitor.
*/

const COOKIE = 'vt_partner';
const STORAGE_KEY = 'vt_partner';
const VISITOR_KEY = 'vt_visitor_id';
export const PARTNER_COUPON_KEY = 'vt_partner_coupon';

export interface StoredPartnerAttribution {
  partner_id: string;
  referral_code: string | null;
  partner_name: string | null;
  link_id: string | null;
  offer: 'none' | 'trial';
  visitor_id: string;
  at: number;
  window_days: number;
}

interface ClickResult {
  partner_id: string;
  referral_code: string | null;
  partner_name: string | null;
  link_id: string | null;
  destination: string;
  offer: 'none' | 'trial';
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  window_days: number;
}

function safeLocal<T>(fn: () => T, fallback: T): T {
  try {
    return fn();
  } catch {
    return fallback;
  }
}

export function getVisitorId(): string {
  return safeLocal(() => {
    let id = localStorage.getItem(VISITOR_KEY);
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem(VISITOR_KEY, id);
    }
    return id;
  }, 'anonymous');
}

function readCookie(): string | null {
  const match = document.cookie.split('; ').find((c) => c.startsWith(`${COOKIE}=`));
  return match ? decodeURIComponent(match.slice(COOKIE.length + 1)) : null;
}

export function getStoredPartnerAttribution(): StoredPartnerAttribution | null {
  const raw = safeLocal(() => localStorage.getItem(STORAGE_KEY), null) ?? readCookie();
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as StoredPartnerAttribution;
    if (Date.now() - parsed.at > parsed.window_days * 86400000) {
      clearStoredPartnerAttribution();
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function clearStoredPartnerAttribution() {
  safeLocal(() => localStorage.removeItem(STORAGE_KEY), undefined);
  document.cookie = `${COOKIE}=; Max-Age=0; Path=/; SameSite=Lax`;
}

function store(result: ClickResult) {
  const value: StoredPartnerAttribution = {
    partner_id: result.partner_id,
    referral_code: result.referral_code,
    partner_name: result.partner_name,
    link_id: result.link_id,
    offer: result.offer,
    visitor_id: getVisitorId(),
    at: Date.now(),
    window_days: result.window_days || 90,
  };
  const json = JSON.stringify(value);
  safeLocal(() => localStorage.setItem(STORAGE_KEY, json), undefined);
  document.cookie = `${COOKIE}=${encodeURIComponent(json)}; Max-Age=${value.window_days * 86400}; Path=/; SameSite=Lax${
    location.protocol === 'https:' ? '; Secure' : ''
  }`;

  // Feed the existing signup flow (last partner click wins).
  if (result.referral_code) {
    safeLocal(() => {
      localStorage.setItem('vitrineturbo_ref_code', result.referral_code as string);
      if (result.offer === 'trial') localStorage.setItem('vitrineturbo_ref_trial', '1');
      else localStorage.removeItem('vitrineturbo_ref_trial');
    }, undefined);
  }
}

/** Resolves a partner code/link, records the click and remembers it. Returns null for non-partner codes. */
export async function trackPartnerClick(code: string, linkSlug?: string | null): Promise<ClickResult | null> {
  const params = new URLSearchParams(window.location.search);
  const utm: Record<string, string> = {};
  for (const key of ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content']) {
    const v = params.get(key);
    if (v) utm[key] = v.slice(0, 100);
  }
  const { data, error } = await supabase.rpc('record_partner_click', {
    p_code: code,
    // No explicit link means the partner's main link ('inicio', created for every partner).
    p_link_slug: linkSlug ?? 'inicio',
    p_visitor_id: getVisitorId(),
    p_landing: window.location.pathname,
    p_referrer: document.referrer || null,
    p_utm: utm,
    p_user_agent: navigator.userAgent,
  });
  if (error || !data) return null;
  const result = data as ClickResult;
  // Logged-in users never get re-attributed from the browser.
  const { data: session } = await supabase.auth.getSession();
  if (!session.session) store(result);
  return result;
}

/** Called once a corretor is logged in: links the signup to the exact partner link / coupon. */
export async function claimPendingPartnerAttribution(user: { id: string; role?: string; created_at?: string }) {
  if (user.role && user.role !== 'corretor') return;
  const stored = getStoredPartnerAttribution();
  const coupon = safeLocal(() => localStorage.getItem(PARTNER_COUPON_KEY), null);
  if (!stored && !coupon) return;

  const isNew = user.created_at ? Date.now() - new Date(user.created_at).getTime() < 2 * 86400000 : true;
  if (isNew) {
    await supabase
      .rpc('claim_partner_attribution', {
        p_link_id: stored?.link_id ?? null,
        p_visitor_id: stored?.visitor_id ?? getVisitorId(),
        p_coupon: coupon,
      })
      .then(({ error }) => {
        if (error) console.warn('[partner] claim attribution failed', error.message);
      });
  }
  clearStoredPartnerAttribution();
  safeLocal(() => localStorage.removeItem(PARTNER_COUPON_KEY), undefined);
}
