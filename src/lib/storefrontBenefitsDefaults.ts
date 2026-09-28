import {
  CreditCard, Truck, MessageCircle, ShieldCheck, Sparkles, Package, Gift, Clock,
  Star, ThumbsUp, Lock, Percent, Heart, Headphones, MapPin, BadgeCheck,
  type LucideIcon,
} from 'lucide-react';

export interface BenefitIconOption {
  key: string;
  label: string;
  icon: LucideIcon;
}

export const BENEFIT_ICON_OPTIONS: BenefitIconOption[] = [
  { key: 'credit-card', label: 'Cartão', icon: CreditCard },
  { key: 'truck', label: 'Caminhão', icon: Truck },
  { key: 'message-circle', label: 'Chat', icon: MessageCircle },
  { key: 'shield-check', label: 'Escudo', icon: ShieldCheck },
  { key: 'sparkles', label: 'Brilho', icon: Sparkles },
  { key: 'package', label: 'Pacote', icon: Package },
  { key: 'gift', label: 'Presente', icon: Gift },
  { key: 'clock', label: 'Relógio', icon: Clock },
  { key: 'star', label: 'Estrela', icon: Star },
  { key: 'thumbs-up', label: 'Aprovação', icon: ThumbsUp },
  { key: 'lock', label: 'Cadeado', icon: Lock },
  { key: 'percent', label: 'Desconto', icon: Percent },
  { key: 'heart', label: 'Coração', icon: Heart },
  { key: 'headphones', label: 'Suporte', icon: Headphones },
  { key: 'map-pin', label: 'Localização', icon: MapPin },
  { key: 'badge-check', label: 'Selo', icon: BadgeCheck },
];

export function getBenefitIcon(key: string): LucideIcon {
  return BENEFIT_ICON_OPTIONS.find((o) => o.key === key)?.icon || CreditCard;
}

export interface DefaultBenefit {
  icon: string;
  title: string;
  subtitle: string;
}

// The benefits bar's original hardcoded content — still used as the storefront's
// fallback for any store that has zero rows in storefront_benefits (never customized).
export const DEFAULT_BENEFITS: DefaultBenefit[] = [
  { icon: 'credit-card', title: 'Parcelamento', subtitle: 'No cartão de crédito' },
  { icon: 'truck', title: 'Envios', subtitle: 'Para todo o Brasil' },
  { icon: 'message-circle', title: 'Atendimento', subtitle: 'Direto pelo WhatsApp' },
  { icon: 'shield-check', title: 'Compra segura', subtitle: 'Seus dados protegidos' },
  { icon: 'sparkles', title: 'Novidades', subtitle: 'Toda semana' },
];
