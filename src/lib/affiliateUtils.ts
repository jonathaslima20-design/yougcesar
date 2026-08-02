import { supabase } from './supabase';

const AFFILIATE_CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function generateAffiliateCode(): string {
  let code = 'AF';
  for (let i = 0; i < 6; i++) code += AFFILIATE_CODE_CHARS[Math.floor(Math.random() * AFFILIATE_CODE_CHARS.length)];
  return code;
}

export function generateAffiliateLink(storeSlug: string, affiliateCode: string): string {
  return `https://vitrineturbo.com/${storeSlug}?aff=${affiliateCode}`;
}

/**
 * Deep link straight to a product's page, carrying the affiliate's code.
 * Works with the same attribution capture already wired into
 * ProductDetailsPage.tsx (?aff= is read there independent of other params).
 */
export function generateAffiliateProductLink(storeSlug: string, productId: string, affiliateCode: string): string {
  return `https://vitrineturbo.com/${storeSlug}/produtos/${productId}?aff=${affiliateCode}`;
}

/**
 * Deep link to the store's category filter (?category=NAME, same query param
 * ShareCategoryButton.tsx already uses for the merchant's own "share this
 * category" button), with the affiliate's code appended.
 */
export function generateAffiliateCategoryLink(storeSlug: string, categoryName: string, affiliateCode: string): string {
  return `https://vitrineturbo.com/${storeSlug}?category=${encodeURIComponent(categoryName)}&aff=${affiliateCode}`;
}

interface StoredAffiliateAttribution {
  affiliateId: string;
  code: string;
  clickedAt: number;
}

function attributionStorageKey(storeOwnerId: string): string {
  return `vt_affiliate_attribution_${storeOwnerId}`;
}

function getSessionVisitorId(): string {
  const key = 'vt_affiliate_visitor_id';
  let id = sessionStorage.getItem(key);
  if (!id) {
    id = crypto.randomUUID();
    sessionStorage.setItem(key, id);
  }
  return id;
}

/**
 * Resolves ?aff=CODE against the store's active affiliates and, if valid,
 * persists last-click attribution in localStorage (raw clickedAt, no
 * pre-baked expiry — the attribution window is evaluated live against that
 * specific affiliate's own current setting by resolveAttributedAffiliateId)
 * and logs the click. Silent on any failure: never blocks storefront
 * rendering.
 */
export async function captureAffiliateClick(storeOwnerId: string, code: string, landingPath: string): Promise<void> {
  try {
    // affiliates has no anon SELECT policy (by design — email/pix_key/rates
    // must never be exposed to storefront visitors), so this resolves the
    // code through a narrow SECURITY DEFINER RPC rather than a direct query
    // — a plain .from('affiliates').select() here returns nothing for an
    // anonymous visitor and silently drops every real click.
    const { data: affiliateId } = await supabase.rpc('resolve_affiliate_by_code', {
      p_store_owner_id: storeOwnerId,
      p_code: code,
    });

    if (!affiliateId) return;

    const attribution: StoredAffiliateAttribution = {
      affiliateId,
      code,
      clickedAt: Date.now(),
    };
    localStorage.setItem(attributionStorageKey(storeOwnerId), JSON.stringify(attribution));

    await supabase.from('affiliate_clicks').insert({
      affiliate_id: affiliateId,
      visitor_id: getSessionVisitorId(),
      landing_path: landingPath,
    });
  } catch {
    /* silent */
  }
}

const DEFAULT_ATTRIBUTION_WINDOW_DAYS = 30;

/**
 * Reads stored attribution for a store, then looks up THAT SPECIFIC
 * affiliate's own currently configured attribution window (and active
 * status — a deactivated affiliate never gets attributed a sale even if the
 * localStorage entry hasn't expired) before returning their id. Used at
 * order-submission time (not on every render), so the extra query is a
 * non-issue.
 *
 * The window is a per-affiliate setting (confirmed product decision — a
 * store can have affiliates with different attribution windows), so this
 * can't be resolved from raw localStorage alone; it always needs a live
 * lookup of the specific affiliate the click was attributed to.
 */
export async function resolveAttributedAffiliateId(storeOwnerId: string): Promise<string | null> {
  try {
    const raw = localStorage.getItem(attributionStorageKey(storeOwnerId));
    if (!raw) return null;

    const attribution: StoredAffiliateAttribution = JSON.parse(raw);

    // Same anon-RLS constraint as captureAffiliateClick — resolve through the
    // SECURITY DEFINER RPC, not a direct table select.
    const { data: rows } = await supabase.rpc('get_affiliate_attribution_status', {
      p_affiliate_id: attribution.affiliateId,
    });
    const affiliate = rows?.[0];

    if (!affiliate || affiliate.status !== 'active') {
      localStorage.removeItem(attributionStorageKey(storeOwnerId));
      return null;
    }

    const windowDays = affiliate.attribution_window_days || DEFAULT_ATTRIBUTION_WINDOW_DAYS;
    const ageMs = Date.now() - attribution.clickedAt;
    const windowMs = windowDays * 24 * 60 * 60 * 1000;

    if (ageMs > windowMs) {
      localStorage.removeItem(attributionStorageKey(storeOwnerId));
      return null;
    }

    return attribution.affiliateId;
  } catch {
    return null;
  }
}

export interface WhatsAppContactOverride {
  whatsapp: string;
  country_code: string;
  whatsapp_mode: 'phone';
}

/**
 * If the current visitor is attributed to an affiliate who opted in to using
 * their own number on the storefront (whatsapp_contact_mode='own_whatsapp'),
 * returns a contact object shaped for getWhatsAppContactUrl() (utils.ts) so
 * callers can swap it in for the store owner's own contact info. Returns
 * null on anything else (no attribution, expired, deactivated affiliate,
 * store-default mode, or affiliate has no number on file) — callers should
 * fall back to the store's own contact in that case.
 */
export async function resolveAffiliateWhatsAppOverride(storeOwnerId: string): Promise<WhatsAppContactOverride | null> {
  try {
    const affiliateId = await resolveAttributedAffiliateId(storeOwnerId);
    if (!affiliateId) return null;

    const { data: rows } = await supabase.rpc('get_affiliate_contact', { p_affiliate_id: affiliateId });
    const contact = rows?.[0];
    if (!contact || contact.whatsapp_contact_mode !== 'own_whatsapp' || !contact.whatsapp) return null;

    return {
      whatsapp: contact.whatsapp,
      country_code: contact.country_code || '55',
      whatsapp_mode: 'phone',
    };
  } catch {
    return null;
  }
}
