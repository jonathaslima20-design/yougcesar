import React from 'react';
import { Users, Shield, Ban, Crown, TrendingUp, Calendar, Circle as XCircle, TriangleAlert as AlertTriangle, Sparkles } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface SummaryCounts {
  total: number;
  active: number;
  blocked: number;
  activePlans: number;
  freePlans: number;
  suspendedPlans: number;
  noPlans: number;
  recent7: number;
  recent30: number;
}

interface FilterAction {
  plan?: string;
  status?: string;
  date?: string;
}

interface UserSummaryCardsProps {
  counts: SummaryCounts;
  onFilterClick?: (filter: FilterAction) => void;
}

type Tone = 'neutral' | 'green' | 'amber' | 'red';

const toneStyles: Record<Tone, { color: string; bg: string }> = {
  neutral: { color: 'text-muted-foreground', bg: 'bg-muted' },
  green: { color: 'text-green-600', bg: 'bg-green-50 dark:bg-green-950/20' },
  amber: { color: 'text-amber-600', bg: 'bg-amber-50 dark:bg-amber-950/20' },
  red: { color: 'text-red-600', bg: 'bg-red-50 dark:bg-red-950/20' },
};

interface SummaryCardData {
  title: string;
  value: number;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  tone: Tone;
  filter: FilterAction;
}

export const UserSummaryCards = React.memo(function UserSummaryCards({ counts, onFilterClick }: UserSummaryCardsProps) {
  // Primary cards are the ones an admin needs at a glance; tone is only
  // colored when the number itself signals something (healthy revenue base
  // or an actual problem) — plain counts stay neutral.
  const primaryCards: SummaryCardData[] = [
    { title: 'Total de Usuários', value: counts.total, description: 'Usuários cadastrados', icon: Users, tone: 'neutral', filter: {} },
    { title: 'Planos Ativos', value: counts.activePlans, description: 'Com assinatura paga', icon: Crown, tone: 'green', filter: { plan: 'active' } },
    { title: 'Plano Free', value: counts.freePlans, description: 'Oportunidade de conversão', icon: Sparkles, tone: 'neutral', filter: { plan: 'free' } },
    { title: 'Usuários Bloqueados', value: counts.blocked, description: 'Acesso suspenso', icon: Ban, tone: counts.blocked > 0 ? 'red' : 'neutral', filter: { status: 'blocked' } },
  ];

  const secondaryCards: SummaryCardData[] = [
    { title: 'Usuários Ativos', value: counts.active, description: 'Não bloqueados', icon: Shield, tone: 'neutral', filter: { status: 'active' } },
    { title: 'Sem Plano', value: counts.noPlans, description: 'Sem assinatura', icon: XCircle, tone: counts.noPlans > 0 ? 'amber' : 'neutral', filter: { plan: 'no-plan' } },
    { title: 'Planos Suspensos', value: counts.suspendedPlans, description: 'Assinatura suspensa', icon: AlertTriangle, tone: counts.suspendedPlans > 0 ? 'amber' : 'neutral', filter: { plan: 'suspended' } },
    { title: 'Cadastros (7 dias)', value: counts.recent7, description: 'Últimos 7 dias', icon: TrendingUp, tone: 'neutral', filter: { date: 'last7days' } },
    { title: 'Cadastros (30 dias)', value: counts.recent30, description: 'Últimos 30 dias', icon: Calendar, tone: 'neutral', filter: { date: 'last30days' } },
  ];

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-sm font-semibold text-muted-foreground mb-2">Visão Geral</h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {primaryCards.map((card) => (
            <SummaryCard key={card.title} card={card} onFilterClick={onFilterClick} />
          ))}
        </div>
      </div>

      <div>
        <h2 className="text-sm font-semibold text-muted-foreground mb-2">Detalhamento</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
          {secondaryCards.map((card) => (
            <SummaryCard key={card.title} card={card} onFilterClick={onFilterClick} compact />
          ))}
        </div>
      </div>
    </div>
  );
});

function SummaryCard({
  card, onFilterClick, compact,
}: {
  card: SummaryCardData;
  onFilterClick?: (filter: FilterAction) => void;
  compact?: boolean;
}) {
  const { color, bg } = toneStyles[card.tone];

  return (
    <Card
      className={`transition-all ${onFilterClick ? 'cursor-pointer hover:shadow-md hover:border-foreground/20' : 'hover:shadow-md'}`}
      onClick={onFilterClick ? () => onFilterClick(card.filter) : undefined}
    >
      <CardHeader className={`flex flex-row items-center justify-between pb-2 ${compact ? 'p-3' : 'p-4'}`}>
        <CardTitle className="text-xs font-medium text-muted-foreground">
          {card.title}
        </CardTitle>
        <div className={`p-1.5 rounded-lg ${bg}`}>
          <card.icon className={`h-3.5 w-3.5 ${color}`} />
        </div>
      </CardHeader>
      <CardContent className={`pt-0 ${compact ? 'px-3 pb-3' : 'px-4 pb-4'}`}>
        <div className={`font-bold ${compact ? 'text-lg' : 'text-xl'}`}>{card.value}</div>
        <p className="text-[11px] text-muted-foreground mt-0.5">{card.description}</p>
      </CardContent>
    </Card>
  );
}
