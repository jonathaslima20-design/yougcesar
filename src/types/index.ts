export type UserRole = 'corretor' | 'admin' | 'parceiro';
export type NicheType = 'diversos';
export type PlanStatus = 'active' | 'expired' | 'suspended' | 'free';

export type BillingCycle = 'monthly' | 'quarterly' | 'semiannually' | 'annually';

export type CustomDomainStatus = 'pending_dns' | 'dns_verified' | 'active' | 'error';

export interface CustomDomain {
  id: string;
  user_id: string;
  domain: string;
  status: CustomDomainStatus;
  verification_token: string;
  error_message?: string | null;
  activated_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface User {
  id: string;
  email: string;
  role: UserRole;
  name: string;
  owner_name?: string;
  phone?: string;
  country_code?: string;
  avatar_url?: string;
  cover_url_desktop?: string;
  cover_url_mobile?: string;
  promotional_banner_url?: string;
  promotional_banner_url_desktop?: string;
  promotional_banner_url_mobile?: string;
  slug?: string;
  custom_domain?: string;
  listing_limit: number;
  is_blocked: boolean;
  created_at: string;
  updated_at?: string;
  bio?: string;
  whatsapp?: string;
  instagram?: string;
  location_url?: string;
  created_by?: string;
  theme?: 'light' | 'dark';
  niche_type?: NicheType;
  currency?: string;
  language?: string;
  plan_status?: PlanStatus;
  billing_cycle?: BillingCycle;
  next_payment_date?: string;
  subscription_end_date?: string;
  subscription_plan_name?: string;
  referral_code?: string;
  referred_by?: string;
  max_images_per_product?: number;
  last_login_at?: string;
  login_count?: number;
  onboarding_completed_steps?: string[];
  onboarding_dismissed?: boolean;
  onboarding_storefront_viewed?: boolean;
}

export type ActivityAction =
  | 'auth.login'
  | 'auth.logout'
  | 'product.create'
  | 'product.update'
  | 'product.delete'
  | 'product.status_change'
  | 'category.create'
  | 'category.update'
  | 'category.delete'
  | 'profile.update'
  | 'profile.avatar'
  | 'profile.slug'
  | 'appearance.update'
  | 'order.status_change'
  | 'subscription.activated'
  | 'subscription.expired'
  | 'referral.copy_link'
  | 'referral.copy_code';

export interface ActivityLog {
  id: string;
  user_id: string;
  action: ActivityAction;
  entity_type?: string;
  entity_id?: string;
  description: string;
  ip_address?: string;
  user_agent?: string;
  created_at: string;
}

export interface UserImageSettings {
  id: string;
  user_id: string;
  max_images_per_product: number;
  created_at: string;
  updated_at: string;
}

export type ProductStatus = 'disponivel' | 'vendido' | 'reservado';
export type ProductGender = 'masculino' | 'feminino' | 'unissex';

export type MediaType = 'image' | 'video';

export interface ProductImage {
  id: string;
  url: string;
  is_featured: boolean;
  media_type?: MediaType;
  display_order?: number;
  associated_color?: string | null;
}

export type WeightUnitType = 'kg' | 'g' | 'ml' | 'l' | 'un' | 'cps';

export interface WeightVariant {
  id?: string;
  product_id?: string;
  label: string;
  unit_value: number;
  unit_type: WeightUnitType;
  price: number;
  discounted_price?: number | null;
  display_order: number;
  created_at?: string;
  updated_at?: string;
}

export interface PriceTier {
  id?: string;
  product_id?: string;
  min_quantity: number;
  max_quantity?: number | null;
  unit_price: number;
  discounted_unit_price?: number | null;
  created_at?: string;
  updated_at?: string;
}

export interface Product {
  id: string;
  user_id: string;
  title: string;
  description: string;
  price?: number;
  discounted_price?: number;
  status: ProductStatus;
  category: string[];
  brand?: string;
  model?: string;
  gender?: ProductGender;
  condition: 'novo' | 'usado' | 'seminovo';
  featured_image_url?: string;
  video_url?: string;
  featured_offer_price?: number;
  featured_offer_installment?: number;
  featured_offer_description?: string;
  is_starting_price?: boolean;
  short_description?: string;
  is_visible_on_storefront?: boolean;
  external_checkout_url?: string;
  has_tiered_pricing?: boolean;
  min_tiered_price?: number;
  max_tiered_price?: number;
  has_weight_variants?: boolean;
  min_variant_price?: number;
  max_variant_price?: number;
  created_at: string;
  updated_at?: string;
  product_images?: ProductImage[];
  colors?: string[];
  sizes?: string[];
  flavors?: string[];
  price_tiers?: PriceTier[];
  weight_variants?: WeightVariant[];
  track_inventory?: boolean;
  stock_quantity?: number | null;
  low_stock_threshold?: number;
}

export interface ProductCategory {
  id: string;
  user_id: string;
  name: string;
  created_at: string;
  updated_at?: string;
}

export interface CategoryDisplaySetting {
  category: string;
  order: number;
  enabled: boolean;
}

export interface StorefrontSettings {
  id: string;
  user_id: string;
  settings: {
    filters?: {
      showFilters?: boolean;
      showSearch?: boolean;
      showPriceRange?: boolean;
      showCategories?: boolean;
      showBrands?: boolean;
      showGender?: boolean;
      showStatus?: boolean;
      showCondition?: boolean;
      showSizes?: boolean;
    };
    itemsPerPage?: number;
    categoryDisplaySettings?: CategoryDisplaySetting[];
    enableInventory?: boolean;
    showStockOnStorefront?: boolean;
    autoDeductStock?: boolean;
    blockZeroStock?: boolean;
    reservationMinutes?: number;
    checkout?: CheckoutSettings;
  };
  created_at: string;
  updated_at?: string;
}

export type SubscriptionStatus = 'active' | 'pending' | 'cancelled' | 'suspended';
export type PaymentStatus = 'paid' | 'pending' | 'overdue';
export type PaymentMethodStatus = 'completed' | 'pending' | 'failed' | 'refunded';
export type BillingCycle = 'monthly' | 'quarterly' | 'semiannually' | 'annually';

export interface Subscription {
  id: string;
  user_id: string;
  plan_name: string;
  plan_price: number;
  billing_cycle: BillingCycle;
  status: SubscriptionStatus;
  payment_status: PaymentStatus;
  start_date: string;
  end_date?: string;
  next_payment_date: string;
  created_at: string;
  updated_at?: string;
  user?: {
    name: string;
    email: string;
  };
}

export interface Payment {
  id: string;
  subscription_id: string;
  amount: number;
  payment_date: string;
  payment_method: string;
  status: PaymentMethodStatus;
  notes?: string;
  created_at: string;
  subscription?: {
    user?: {
      name: string;
      email: string;
    };
  };
}

export interface CartItem {
  id: string;
  title: string;
  price: number;
  discounted_price?: number;
  quantity: number;
  featured_image_url?: string;
  short_description?: string;
  is_starting_price?: boolean;
  notes?: string;
  selectedColor?: string;
  selectedSize?: string;
  selectedFlavor?: string;
  availableColors?: string[];
  availableSizes?: string[];
  availableFlavors?: string[];
  variantId?: string;
  has_tiered_pricing?: boolean;
  applied_tier_price?: number;
  selectedVariantId?: string;
  selectedVariantLabel?: string;
  variantPrice?: number;
}

export interface DistributionItem {
  id: string;
  distribution_id: string;
  color?: string;
  size?: string;
  quantity: number;
  created_at?: string;
}

export interface VariantDistribution {
  id: string;
  user_id: string;
  product_id: string;
  total_quantity: number;
  applied_tier_price: number;
  metadata?: {
    tier_id?: string;
    quantity?: number;
    original_price?: number;
  };
  created_at?: string;
  updated_at?: string;
  items?: DistributionItem[];
}

export interface CartDistribution {
  distribution: VariantDistribution;
  product: Product;
  items: DistributionItem[];
}

export interface CartState {
  items: CartItem[];
  distributions: CartDistribution[];
  total: number;
  itemCount: number;
}

// Referral System Types
export interface ReferralCommission {
  id: string;
  referrer_id: string;
  referred_user_id: string;
  subscription_id: string;
  plan_type: string;
  amount: number;
  status: 'pending' | 'paid';
  created_at: string;
  paid_at?: string;
  referred_user?: {
    name: string;
    email: string;
  };
  subscription?: {
    plan_name: string;
    status: string;
  };
}

export interface WithdrawalRequest {
  id: string;
  user_id: string;
  amount: number;
  pix_key: string;
  pix_key_type: 'cpf' | 'cnpj' | 'email' | 'phone' | 'random';
  status: 'pending' | 'approved' | 'rejected' | 'paid';
  admin_notes?: string;
  created_at: string;
  processed_at?: string;
  processed_by?: string;
  user?: {
    name: string;
    email: string;
  };
}

export interface UserPixKey {
  id: string;
  user_id: string;
  pix_key: string;
  pix_key_type: 'cpf' | 'cnpj' | 'email' | 'phone' | 'random';
  holder_name: string;
  created_at: string;
  updated_at: string;
}

export interface ReferralStats {
  totalReferrals: number;
  activeReferrals: number;
  totalCommissions: number;
  pendingCommissions: number;
  paidCommissions: number;
  availableForWithdrawal: number;
}

export interface SubscriptionPlan {
  id: string;
  name: string;
  duration: 'Mensal' | 'Trimestral' | 'Semestral' | 'Anual' | 'Free';
  price: number;
  checkout_url?: string;
  is_active: boolean;
  display_order: number;
  product_limit?: number | null;
  category_limit?: number | null;
  created_at: string;
  updated_at: string;
}

export type LimitReason = 'products' | 'categories' | null;

// Order System Types
export type OrderStatus = 'pending' | 'confirmed' | 'preparing' | 'shipped' | 'delivered' | 'cancelled';
export type OrderType = 'whatsapp' | 'ecommerce';
export type OrderSource = 'cart' | 'product_page';

export interface Order {
  id: string;
  store_owner_id: string;
  customer_name: string;
  customer_whatsapp: string;
  customer_country_code: string;
  status: OrderStatus;
  order_type: OrderType;
  subtotal: number;
  total: number;
  notes: string;
  whatsapp_message: string;
  source: OrderSource;
  created_at: string;
  updated_at: string;
  order_items?: OrderItem[];
  inventory_deducted?: boolean;
  coupon_id?: string | null;
  coupon_code?: string | null;
  discount_amount?: number;
  payment_method?: string | null;
  payment_method_discount?: number;
  delivery_fee?: number;
  delivery_option?: string | null;
}

export interface OrderItem {
  id: string;
  order_id: string;
  product_id: string;
  product_title: string;
  product_image_url: string;
  quantity: number;
  unit_price: number;
  selected_color?: string | null;
  selected_size?: string | null;
  selected_flavor?: string | null;
  selected_variant_label?: string | null;
  item_notes: string;
  subtotal: number;
}

// Variant Stock Types
export interface ProductVariantStock {
  id: string;
  product_id: string;
  color?: string | null;
  size?: string | null;
  flavor?: string | null;
  weight_variant_id?: string | null;
  quantity: number;
  reserved_quantity: number;
  created_at: string;
  updated_at: string;
}

export type StockMovementType = 'entrada' | 'saida' | 'ajuste' | 'reserva' | 'cancelamento';
export type StockReferenceType = 'order' | 'manual' | 'system';

export interface StockMovement {
  id: string;
  product_id: string;
  variant_stock_id?: string | null;
  movement_type: StockMovementType;
  quantity: number;
  previous_quantity: number;
  new_quantity: number;
  reference_type?: StockReferenceType | null;
  reference_id?: string | null;
  reason?: string | null;
  performed_by?: string | null;
  created_at: string;
  product?: { title: string; featured_image_url?: string };
  variant_stock?: ProductVariantStock | null;
}

export type StockReservationStatus = 'active' | 'expired' | 'converted';

export interface StockReservation {
  id: string;
  product_id: string;
  variant_stock_id?: string | null;
  session_id: string;
  quantity: number;
  expires_at: string;
  status: StockReservationStatus;
  created_at: string;
}

// Notification System Types
export type NotificationType =
  | 'new_lead'
  | 'whatsapp_click'
  | 'view_milestone'
  | 'subscription_expiring'
  | 'subscription_expired'
  | 'product_sold'
  | 'new_order'
  | 'low_stock'
  | 'out_of_stock'
  | 'referral_signup'
  | 'referral_upgrade'
  | 'promotional_offer'
  | 'novidades'
  | 'system';

export interface AppNotification {
  id: string;
  user_id: string;
  type: NotificationType;
  title: string;
  message: string;
  related_entity_id?: string | null;
  related_entity_type?: string | null;
  cta_label?: string | null;
  cta_url?: string | null;
  is_read: boolean;
  created_at: string;
}

// Notification Management System Types
export type NotificationCategory = 'vencimento' | 'indicacao' | 'ofertas' | 'sistema' | 'novidades';
export type BroadcastStatus = 'draft' | 'scheduled' | 'sending' | 'sent' | 'failed';
export type RuleType = 'days_before_expiry' | 'days_after_expiry' | 'on_referral_signup' | 'on_referral_upgrade' | 'on_plan_change' | 'periodic';
export type TargetAudience = 'all' | 'active' | 'expired' | 'free' | 'specific';

export interface NotificationTemplate {
  id: string;
  slug: string;
  category: NotificationCategory;
  notification_type: NotificationType;
  title_template: string;
  message_template: string;
  cta_label?: string | null;
  cta_url?: string | null;
  is_enabled: boolean;
  is_system: boolean;
  created_at: string;
  updated_at: string;
}

export interface NotificationRule {
  id: string;
  template_id: string;
  rule_type: RuleType;
  rule_config: Record<string, unknown>;
  target_audience: TargetAudience;
  cooldown_hours: number;
  is_enabled: boolean;
  last_executed_at?: string | null;
  created_at: string;
  updated_at: string;
  notification_templates?: NotificationTemplate;
}

export interface NotificationBroadcast {
  id: string;
  template_id?: string | null;
  title: string;
  message: string;
  notification_type: NotificationType;
  cta_label?: string | null;
  cta_url?: string | null;
  target_audience: TargetAudience;
  target_user_ids?: string[] | null;
  scheduled_at?: string | null;
  sent_at?: string | null;
  recipients_count: number;
  status: BroadcastStatus;
  sent_by?: string | null;
  created_at: string;
  updated_at: string;
}

// Coupon System Types
export type CouponDiscountType = 'percentage' | 'fixed_amount';
export type CouponAppliesTo = 'all_products' | 'specific_products' | 'specific_categories';

export interface Coupon {
  id: string;
  user_id: string;
  code: string;
  name: string;
  discount_type: CouponDiscountType;
  discount_value: number;
  min_order_value: number;
  max_discount_amount?: number | null;
  max_uses?: number | null;
  max_uses_per_customer?: number | null;
  current_uses: number;
  valid_from: string;
  valid_until?: string | null;
  is_active: boolean;
  applies_to: CouponAppliesTo;
  created_at: string;
  updated_at: string;
}

export interface CouponProduct {
  id: string;
  coupon_id: string;
  product_id: string;
}

export interface CouponCategory {
  id: string;
  coupon_id: string;
  category_id: string;
}

export interface CouponUsage {
  id: string;
  coupon_id: string;
  order_id: string;
  customer_whatsapp: string;
  discount_applied: number;
  order_type: string;
  used_at: string;
}

export interface AppliedCoupon {
  couponId: string;
  code: string;
  name: string;
  discountType: CouponDiscountType;
  discountValue: number;
  calculatedDiscount: number;
}

// Checkout Settings Types (Payment Methods & Delivery)
export type PaymentMethodDiscountType = 'percentage' | 'fixed_amount';

export interface PaymentMethodConfig {
  id: string;
  name: string;
  enabled: boolean;
  discountType?: PaymentMethodDiscountType;
  discountValue?: number;
}

export interface DeliveryOption {
  id: string;
  name: string;
  fee: number;
  enabled: boolean;
  freeAbove?: number | null;
}

export interface CheckoutSettings {
  paymentMethods: PaymentMethodConfig[];
  deliveryOptions: DeliveryOption[];
  requirePaymentMethod: boolean;
  requireDeliveryOption: boolean;
  cartEnabled?: boolean;
}