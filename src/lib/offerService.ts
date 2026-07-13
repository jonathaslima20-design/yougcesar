import { supabase } from './supabase';
import type {
  PromotionalOffer,
  OfferTargetingRule,
  OfferUserAssignment,
  OfferDisplayConfig,
  OfferFormData,
  OfferDisplayConfigFormData,
  OfferWithConfig,
  OfferImpressionAction,
  OfferAnalytics,
  OfferRecipientSummary,
  OfferTimelineEvent,
  OfferAssignmentStatus,
} from '../types/offers';

// --- Image Upload ---

export async function uploadOfferImage(file: File, offerId?: string): Promise<string> {
  const MAX_WIDTH = 1200;
  const QUALITY = 0.85;

  const compressed = await compressOfferImage(file, MAX_WIDTH, QUALITY);
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  const filePath = `offers/${offerId || 'new'}/${timestamp}-${random}.jpg`;

  const { error: uploadError } = await supabase.storage
    .from('public')
    .upload(filePath, compressed, {
      cacheControl: '3600',
      upsert: false,
    });

  if (uploadError) throw uploadError;

  const { data: { publicUrl } } = supabase.storage
    .from('public')
    .getPublicUrl(filePath);

  return publicUrl;
}

async function compressOfferImage(file: File, maxWidth: number, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      let { width, height } = img;

      if (width > maxWidth) {
        height = Math.round((height * maxWidth) / width);
        width = maxWidth;
      }

      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) { reject(new Error('No 2d context')); return; }

      ctx.drawImage(img, 0, 0, width, height);
      canvas.toBlob(
        (blob) => blob ? resolve(blob) : reject(new Error('Failed to compress')),
        'image/jpeg',
        quality
      );
    };
    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = URL.createObjectURL(file);
  });
}

// --- Admin CRUD Operations ---

export async function fetchOffers(): Promise<PromotionalOffer[]> {
  const { data, error } = await supabase
    .from('promotional_offers')
    .select('*')
    .order('prioridade', { ascending: true })
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
}

export async function fetchOfferById(id: string): Promise<OfferWithConfig | null> {
  const { data: offer, error } = await supabase
    .from('promotional_offers')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (error) throw error;
  if (!offer) return null;

  const [rulesResult, configResult, impressionsResult] = await Promise.all([
    supabase.from('offer_targeting_rules').select('*').eq('offer_id', id).order('grupo_logico').order('created_at'),
    supabase.from('offer_display_config').select('*').eq('offer_id', id).maybeSingle(),
    supabase.from('offer_impressions').select('action').eq('offer_id', id),
  ]);

  if (rulesResult.error) throw rulesResult.error;
  if (configResult.error) throw configResult.error;
  if (impressionsResult.error) throw impressionsResult.error;

  const assignmentCountResult = await supabase
    .from('offer_user_assignments')
    .select('id', { count: 'exact', head: true })
    .eq('offer_id', id);

  const impressions = impressionsResult.data || [];

  return {
    ...offer,
    targeting_rules: rulesResult.data || [],
    display_config: configResult.data || null,
    assignments_count: assignmentCountResult.count || 0,
    impressions_count: impressions.filter(i => i.action === 'exibida').length,
    clicks_count: impressions.filter(i => i.action === 'clicada').length,
    conversions_count: impressions.filter(i => i.action === 'convertida').length,
  };
}

export async function createOffer(data: OfferFormData): Promise<PromotionalOffer> {
  const { data: offer, error } = await supabase
    .from('promotional_offers')
    .insert(data)
    .select()
    .single();

  if (error) throw error;
  return offer;
}

export async function updateOffer(id: string, data: Partial<OfferFormData & { is_active: boolean }>): Promise<PromotionalOffer> {
  const { data: offer, error } = await supabase
    .from('promotional_offers')
    .update(data)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return offer;
}

export async function deleteOffer(id: string): Promise<void> {
  const { error } = await supabase
    .from('promotional_offers')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

export async function toggleOfferActive(id: string, is_active: boolean): Promise<void> {
  const { error } = await supabase
    .from('promotional_offers')
    .update({ is_active })
    .eq('id', id);

  if (error) throw error;
}

export async function updateOfferPriorities(updates: { id: string; prioridade: number }[]): Promise<void> {
  for (const update of updates) {
    const { error } = await supabase
      .from('promotional_offers')
      .update({ prioridade: update.prioridade })
      .eq('id', update.id);
    if (error) throw error;
  }
}

// --- Targeting Rules ---

export async function saveTargetingRules(offerId: string, rules: Omit<OfferTargetingRule, 'id' | 'offer_id' | 'created_at'>[]): Promise<void> {
  const { error: deleteError } = await supabase
    .from('offer_targeting_rules')
    .delete()
    .eq('offer_id', offerId);

  if (deleteError) throw deleteError;

  if (rules.length === 0) return;

  const { error } = await supabase
    .from('offer_targeting_rules')
    .insert(rules.map(r => ({ ...r, offer_id: offerId })));

  if (error) throw error;
}

// --- Display Config ---

export async function saveDisplayConfig(offerId: string, config: OfferDisplayConfigFormData): Promise<void> {
  const { data: existing } = await supabase
    .from('offer_display_config')
    .select('id')
    .eq('offer_id', offerId)
    .maybeSingle();

  if (existing) {
    const { error } = await supabase
      .from('offer_display_config')
      .update(config)
      .eq('offer_id', offerId);
    if (error) throw error;
  } else {
    const { error } = await supabase
      .from('offer_display_config')
      .insert({ ...config, offer_id: offerId });
    if (error) throw error;
  }
}

// --- User Assignments ---

export async function fetchAssignments(offerId: string): Promise<(OfferUserAssignment & { user?: { name: string; email: string } })[]> {
  const { data, error } = await supabase
    .from('offer_user_assignments')
    .select('*, user:users(name, email)')
    .eq('offer_id', offerId)
    .order('assigned_at', { ascending: false });

  if (error) throw error;
  return data || [];
}

export async function assignOfferToUsers(offerId: string, userIds: string[], assignedBy: string, notes?: string): Promise<void> {
  const assignments = userIds.map(userId => ({
    offer_id: offerId,
    user_id: userId,
    assigned_by: assignedBy,
    status: 'pendente' as const,
    notes: notes || '',
  }));

  const { error } = await supabase
    .from('offer_user_assignments')
    .insert(assignments);

  if (error) throw error;

  // Create notifications for assigned users
  const notifications = userIds.map(userId => ({
    user_id: userId,
    type: 'system',
    title: 'Nova oferta disponivel',
    message: 'Voce recebeu uma oferta promocional exclusiva! Confira agora.',
    related_entity_id: offerId,
    related_entity_type: 'promotional_offer',
  }));

  await supabase.from('notifications').insert(notifications);
}

export async function removeAssignment(assignmentId: string): Promise<void> {
  const { error } = await supabase
    .from('offer_user_assignments')
    .delete()
    .eq('id', assignmentId);

  if (error) throw error;
}

// --- User-facing: Fetch eligible offers ---

export async function fetchUserEligibleOffers(userId: string): Promise<PromotionalOffer[]> {
  const now = new Date().toISOString();

  // Fetch manually assigned offers
  const { data: assignments } = await supabase
    .from('offer_user_assignments')
    .select('offer_id')
    .eq('user_id', userId)
    .in('status', ['pendente', 'visualizada']);

  const assignedOfferIds = (assignments || []).map(a => a.offer_id);

  // Fetch active offers (both auto-targeted and manually assigned)
  const { data: offers, error } = await supabase
    .from('promotional_offers')
    .select('*')
    .eq('is_active', true)
    .lte('data_inicio', now)
    .or(`data_fim.is.null,data_fim.gte.${now}`)
    .order('prioridade', { ascending: true });

  if (error) throw error;
  if (!offers || offers.length === 0) return [];

  // Include offers that are manually assigned to this user
  // or that have auto-targeting rules (evaluated client-side)
  const manualOffers = offers.filter(o => assignedOfferIds.includes(o.id));
  const autoOffers = offers.filter(o => !assignedOfferIds.includes(o.id));

  return [...manualOffers, ...autoOffers];
}

export async function fetchOfferDisplayConfigs(offerIds: string[]): Promise<OfferDisplayConfig[]> {
  if (offerIds.length === 0) return [];
  const { data, error } = await supabase
    .from('offer_display_config')
    .select('*')
    .in('offer_id', offerIds);

  if (error) throw error;
  return data || [];
}

export async function fetchUserOfferImpressions(userId: string, offerIds: string[]): Promise<{ offer_id: string; action: string; created_at: string }[]> {
  if (offerIds.length === 0) return [];
  const { data, error } = await supabase
    .from('offer_impressions')
    .select('offer_id, action, created_at')
    .eq('user_id', userId)
    .in('offer_id', offerIds)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
}

// --- Impression Tracking ---

export async function trackImpression(offerId: string, userId: string, action: OfferImpressionAction, context?: Record<string, unknown>): Promise<void> {
  const { error } = await supabase
    .from('offer_impressions')
    .insert({
      offer_id: offerId,
      user_id: userId,
      action,
      session_context: context || {},
    });

  if (error) console.error('Failed to track impression:', error);
}

export async function updateAssignmentStatus(offerId: string, userId: string, status: OfferAssignmentStatus): Promise<void> {
  const update: Record<string, unknown> = { status, status_updated_at: new Date().toISOString() };
  if (status === 'aceita') update.converted_at = new Date().toISOString();

  const { error } = await supabase
    .from('offer_user_assignments')
    .update(update)
    .eq('offer_id', offerId)
    .eq('user_id', userId);

  if (error) console.error('Failed to update assignment status:', error);
}

// --- Recipients & Timeline (admin) ---

export async function fetchOfferRecipients(offerId: string): Promise<OfferRecipientSummary[]> {
  const { data: assignments, error: assignErr } = await supabase
    .from('offer_user_assignments')
    .select('id, user_id, status, assigned_at, status_updated_at, converted_at, user:users!fk_offer_assignments_user_id(name, email, avatar_url)')
    .eq('offer_id', offerId)
    .order('assigned_at', { ascending: false });

  if (assignErr) throw assignErr;
  const assigned = assignments || [];
  if (assigned.length === 0) return [];

  const userIds = assigned.map((a: any) => a.user_id);

  // Fallback: if the FK-based join returned null user data, fetch users separately
  const needsFallback = assigned.some((a: any) => !a.user);
  let userMap = new Map<string, { name: string; email: string; avatar_url: string | null }>();
  if (needsFallback) {
    const { data: usersData } = await supabase
      .from('users')
      .select('id, name, email, avatar_url')
      .in('id', userIds);
    for (const u of usersData || []) {
      userMap.set(u.id, { name: u.name, email: u.email, avatar_url: u.avatar_url });
    }
  }

  const { data: impressions, error: impErr } = await supabase
    .from('offer_impressions')
    .select('user_id, action, created_at')
    .eq('offer_id', offerId)
    .in('user_id', userIds);

  if (impErr) throw impErr;

  const impByUser = new Map<string, { action: string; created_at: string }[]>();
  for (const imp of impressions || []) {
    const arr = impByUser.get(imp.user_id) || [];
    arr.push({ action: imp.action, created_at: imp.created_at });
    impByUser.set(imp.user_id, arr);
  }

  return assigned.map((a: any) => {
    const imps = impByUser.get(a.user_id) || [];
    const sortedDesc = [...imps].sort((x, y) => y.created_at.localeCompare(x.created_at));
    const sortedAsc = [...imps].sort((x, y) => x.created_at.localeCompare(y.created_at));
    const firstView = sortedAsc.find(i => i.action === 'exibida')?.created_at || null;
    const firstClick = sortedAsc.find(i => i.action === 'clicada')?.created_at || null;
    const timeToClick = firstView && firstClick
      ? Math.max(0, Math.round((new Date(firstClick).getTime() - new Date(firstView).getTime()) / 1000))
      : null;
    const userFallback = userMap.get(a.user_id);
    const userData = a.user || userFallback;
    return {
      assignment_id: a.id,
      user_id: a.user_id,
      user_name: userData?.name || 'Usuario',
      user_email: userData?.email || '',
      user_avatar_url: userData?.avatar_url || null,
      status: a.status,
      assigned_at: a.assigned_at,
      status_updated_at: a.status_updated_at,
      converted_at: a.converted_at,
      views_count: imps.filter(i => i.action === 'exibida').length,
      clicks_count: imps.filter(i => i.action === 'clicada').length,
      conversions_count: imps.filter(i => i.action === 'convertida').length,
      dismissals_count: imps.filter(i => i.action === 'fechada').length,
      last_action_at: sortedDesc[0]?.created_at || null,
      first_view_at: firstView,
      first_click_at: firstClick,
      time_to_click_seconds: timeToClick,
    } as OfferRecipientSummary;
  });
}

export async function fetchOfferUserTimeline(offerId: string, userId: string): Promise<OfferTimelineEvent[]> {
  const [assignmentResult, impressionsResult] = await Promise.all([
    supabase
      .from('offer_user_assignments')
      .select('assigned_at, status, status_updated_at, converted_at')
      .eq('offer_id', offerId)
      .eq('user_id', userId)
      .maybeSingle(),
    supabase
      .from('offer_impressions')
      .select('action, created_at, session_context')
      .eq('offer_id', offerId)
      .eq('user_id', userId)
      .order('created_at', { ascending: true }),
  ]);

  const events: OfferTimelineEvent[] = [];

  const assignment = assignmentResult.data;
  if (assignment) {
    events.push({ type: 'assigned', at: assignment.assigned_at });
  }

  for (const imp of impressionsResult.data || []) {
    events.push({
      type: imp.action as OfferTimelineEvent['type'],
      at: imp.created_at,
      context: imp.session_context as Record<string, unknown> | null,
    });
  }

  if (assignment && assignment.converted_at) {
    if (!events.some(e => e.type === 'convertida')) {
      events.push({ type: 'convertida', at: assignment.converted_at });
    }
  }

  events.sort((a, b) => a.at.localeCompare(b.at));
  return events;
}

// --- Analytics ---

export async function fetchOfferAnalytics(offerId: string, days: number = 30): Promise<OfferAnalytics> {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  const { data: impressions, error } = await supabase
    .from('offer_impressions')
    .select('action, created_at')
    .eq('offer_id', offerId)
    .gte('created_at', startDate.toISOString())
    .order('created_at', { ascending: true });

  if (error) throw error;

  const all = impressions || [];
  const total_impressions = all.filter(i => i.action === 'exibida').length;
  const total_clicks = all.filter(i => i.action === 'clicada').length;
  const total_conversions = all.filter(i => i.action === 'convertida').length;
  const total_dismissals = all.filter(i => i.action === 'fechada').length;

  // Build daily data
  const dailyMap = new Map<string, { impressions: number; clicks: number; conversions: number }>();
  for (const imp of all) {
    const date = imp.created_at.split('T')[0];
    const existing = dailyMap.get(date) || { impressions: 0, clicks: 0, conversions: 0 };
    if (imp.action === 'exibida') existing.impressions++;
    else if (imp.action === 'clicada') existing.clicks++;
    else if (imp.action === 'convertida') existing.conversions++;
    dailyMap.set(date, existing);
  }

  const daily_data = Array.from(dailyMap.entries()).map(([date, data]) => ({ date, ...data }));

  return {
    total_impressions,
    total_clicks,
    total_conversions,
    total_dismissals,
    ctr: total_impressions > 0 ? (total_clicks / total_impressions) * 100 : 0,
    conversion_rate: total_clicks > 0 ? (total_conversions / total_clicks) * 100 : 0,
    daily_data,
  };
}

// --- Targeting evaluation (client-side) ---

export function evaluateTargetingRules(
  rules: OfferTargetingRule[],
  userContext: {
    plan_status?: string;
    dias_cadastro: number;
    qtd_produtos: number;
    billing_cycle?: string;
    dias_ate_vencimento?: number;
    ultima_atividade_dias?: number;
    plano_nome?: string;
  }
): boolean {
  if (rules.length === 0) return true;

  // Group rules by grupo_logico (AND within group, OR between groups)
  const groups = new Map<number, OfferTargetingRule[]>();
  for (const rule of rules) {
    const existing = groups.get(rule.grupo_logico) || [];
    existing.push(rule);
    groups.set(rule.grupo_logico, existing);
  }

  // OR between groups: at least one group must pass
  for (const [, groupRules] of groups) {
    const groupPasses = groupRules.every(rule => evaluateSingleRule(rule, userContext));
    if (groupPasses) return true;
  }

  return false;
}

function evaluateSingleRule(
  rule: OfferTargetingRule,
  ctx: {
    plan_status?: string;
    dias_cadastro: number;
    qtd_produtos: number;
    billing_cycle?: string;
    dias_ate_vencimento?: number;
    ultima_atividade_dias?: number;
    plano_nome?: string;
  }
): boolean {
  let fieldValue: string | number | undefined;

  switch (rule.tipo_regra) {
    case 'plan_status':
      fieldValue = ctx.plan_status || 'free';
      break;
    case 'dias_cadastro':
      fieldValue = ctx.dias_cadastro;
      break;
    case 'qtd_produtos':
      fieldValue = ctx.qtd_produtos;
      break;
    case 'billing_cycle':
      fieldValue = ctx.billing_cycle || '';
      break;
    case 'dias_ate_vencimento':
      fieldValue = ctx.dias_ate_vencimento ?? 999;
      break;
    case 'atividade_recente':
      fieldValue = ctx.ultima_atividade_dias ?? 0;
      break;
    case 'plano_especifico':
      fieldValue = ctx.plano_nome || '';
      break;
    default:
      return false;
  }

  const numValue = typeof fieldValue === 'number' ? fieldValue : parseFloat(fieldValue);
  const ruleNum = parseFloat(rule.valor);
  const ruleNum2 = parseFloat(rule.valor_secundario);

  switch (rule.operador) {
    case 'igual':
      return String(fieldValue) === rule.valor;
    case 'diferente':
      return String(fieldValue) !== rule.valor;
    case 'maior_que':
      return !isNaN(numValue) && !isNaN(ruleNum) && numValue > ruleNum;
    case 'menor_que':
      return !isNaN(numValue) && !isNaN(ruleNum) && numValue < ruleNum;
    case 'entre':
      return !isNaN(numValue) && !isNaN(ruleNum) && !isNaN(ruleNum2) && numValue >= ruleNum && numValue <= ruleNum2;
    case 'contem':
      return String(fieldValue).toLowerCase().includes(rule.valor.toLowerCase());
    default:
      return false;
  }
}

// --- Count eligible users for targeting preview ---

export async function countEligibleUsers(rules: Omit<OfferTargetingRule, 'id' | 'offer_id' | 'created_at'>[]): Promise<number> {
  if (rules.length === 0) {
    const { count } = await supabase
      .from('users')
      .select('id', { count: 'exact', head: true })
      .neq('role', 'admin');
    return count || 0;
  }

  // Fetch all non-admin users with relevant data
  const { data: users } = await supabase
    .from('users')
    .select('id, plan_status, billing_cycle, created_at, subscription_end_date, subscription_plan_name, last_login_at')
    .neq('role', 'admin');

  if (!users) return 0;

  // For product counts, batch fetch
  const userIds = users.map(u => u.id);
  const { data: productCounts } = await supabase
    .from('products')
    .select('user_id')
    .in('user_id', userIds);

  const productCountMap = new Map<string, number>();
  for (const p of productCounts || []) {
    productCountMap.set(p.user_id, (productCountMap.get(p.user_id) || 0) + 1);
  }

  const now = new Date();
  let eligible = 0;

  for (const user of users) {
    const createdAt = new Date(user.created_at);
    const diasCadastro = Math.floor((now.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24));
    const endDate = user.subscription_end_date ? new Date(user.subscription_end_date) : null;
    const diasAteVencimento = endDate ? Math.floor((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)) : undefined;
    const lastLogin = user.last_login_at ? new Date(user.last_login_at) : null;
    const ultimaAtividadeDias = lastLogin ? Math.floor((now.getTime() - lastLogin.getTime()) / (1000 * 60 * 60 * 24)) : undefined;

    const ctx = {
      plan_status: user.plan_status || 'free',
      dias_cadastro: diasCadastro,
      qtd_produtos: productCountMap.get(user.id) || 0,
      billing_cycle: user.billing_cycle || '',
      dias_ate_vencimento: diasAteVencimento,
      ultima_atividade_dias: ultimaAtividadeDias,
      plano_nome: user.subscription_plan_name || '',
    };

    const passes = evaluateTargetingRules(rules as OfferTargetingRule[], ctx);
    if (passes) eligible++;
  }

  return eligible;
}

// --- Checkout helpers ---

export interface OfferCheckoutInfo {
  offer: PromotionalOffer;
  plan_id: string | null;
  discount_type: 'percent' | 'fixed' | null;
  discount_value: number;
  coupon: {
    id: string;
    code: string;
    discount_type: string;
    discount_value: number;
    max_discount_amount: number | null;
  } | null;
}

export async function fetchOfferForCheckout(offerId: string, userId: string): Promise<OfferCheckoutInfo | null> {
  const now = new Date().toISOString();

  const { data: offer, error } = await supabase
    .from('promotional_offers')
    .select('*')
    .eq('id', offerId)
    .eq('is_active', true)
    .lte('data_inicio', now)
    .or(`data_fim.is.null,data_fim.gte.${now}`)
    .maybeSingle();

  if (error || !offer) return null;

  const { data: assignment } = await supabase
    .from('offer_user_assignments')
    .select('id, status')
    .eq('offer_id', offerId)
    .eq('user_id', userId)
    .maybeSingle();

  const hasManualAssignment = !!assignment && assignment.status !== 'expirada';

  if (!hasManualAssignment) {
    const { data: rules } = await supabase
      .from('offer_targeting_rules')
      .select('*')
      .eq('offer_id', offerId);

    if (!rules || rules.length === 0) return null;
  }

  let coupon: OfferCheckoutInfo['coupon'] = null;
  if (offer.cupom_id) {
    const { data: couponRow } = await supabase
      .from('coupons')
      .select('id, code, discount_type, discount_value, max_discount_amount, is_active')
      .eq('id', offer.cupom_id)
      .maybeSingle();
    if (couponRow && couponRow.is_active) {
      coupon = {
        id: couponRow.id,
        code: couponRow.code,
        discount_type: couponRow.discount_type,
        discount_value: Number(couponRow.discount_value) || 0,
        max_discount_amount: couponRow.max_discount_amount ? Number(couponRow.max_discount_amount) : null,
      };
    }
  }

  let discount_type: 'percent' | 'fixed' | null = null;
  let discount_value = 0;

  if (coupon) {
    discount_type = coupon.discount_type === 'percentage' || coupon.discount_type === 'percent' ? 'percent' : 'fixed';
    discount_value = coupon.discount_value;
  } else if (offer.desconto_percentual > 0) {
    discount_type = 'percent';
    discount_value = offer.desconto_percentual;
  } else if (offer.desconto_valor_fixo > 0) {
    discount_type = 'fixed';
    discount_value = offer.desconto_valor_fixo;
  }

  return {
    offer: offer as PromotionalOffer,
    plan_id: offer.plano_alvo_id || null,
    discount_type,
    discount_value,
    coupon,
  };
}

export function calculateDiscountedPrice(
  basePrice: number,
  discountType: 'percent' | 'fixed' | null,
  discountValue: number,
  maxDiscountAmount: number | null = null
): { discount: number; finalPrice: number } {
  if (!discountType || discountValue <= 0) {
    return { discount: 0, finalPrice: basePrice };
  }
  let discount = discountType === 'percent' ? (basePrice * discountValue) / 100 : discountValue;
  if (maxDiscountAmount && discount > maxDiscountAmount) discount = maxDiscountAmount;
  if (discount > basePrice) discount = basePrice;
  const finalPrice = Math.max(0, basePrice - discount);
  return { discount, finalPrice };
}

// --- Realtime broadcast for "send now" ---

export const OFFER_PUSH_CHANNEL = 'offer_push';

export interface OfferPushPayload {
  offer_id: string;
  user_ids: string[];
  sent_at: string;
}

export async function broadcastOfferPush(offerId: string, userIds: string[]): Promise<void> {
  const channel = supabase.channel(OFFER_PUSH_CHANNEL);
  await new Promise<void>((resolve) => {
    channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') resolve();
    });
  });
  await channel.send({
    type: 'broadcast',
    event: 'new_offer',
    payload: {
      offer_id: offerId,
      user_ids: userIds,
      sent_at: new Date().toISOString(),
    } as OfferPushPayload,
  });
  await supabase.removeChannel(channel);
}
