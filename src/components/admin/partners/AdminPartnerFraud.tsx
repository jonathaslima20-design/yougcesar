import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { ShieldAlert } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { EmptyState, ToneBadge, formatDate } from '@/components/partners/PartnerUi';

interface Flag {
  id: string;
  partner_id: string;
  kind: string;
  details: Record<string, unknown>;
  status: 'open' | 'dismissed' | 'confirmed';
  created_at: string;
}

const KIND_LABELS: Record<string, string> = {
  self_referral: 'Possível autoindicação (WhatsApp igual ao do parceiro)',
  signup_burst: 'Vários cadastros do mesmo visitante em 24h',
  high_reversal_ratio: 'Muitos estornos em 90 dias (saques congelados)',
};

export default function AdminPartnerFraud() {
  const { user } = useAuth();
  const [flags, setFlags] = useState<Flag[] | null>(null);
  const [names, setNames] = useState<Map<string, string>>(new Map());
  const [showAll, setShowAll] = useState(false);

  const load = useCallback(async () => {
    let q = supabase.from('partner_fraud_flags').select('*').order('created_at', { ascending: false }).limit(200);
    if (!showAll) q = q.eq('status', 'open');
    const { data } = await q;
    const list = (data as Flag[]) ?? [];
    setFlags(list);
    const ids = [...new Set(list.map((f) => f.partner_id))];
    if (ids.length) {
      const { data: u } = await supabase.from('users').select('id, name').in('id', ids);
      setNames(new Map((u ?? []).map((x) => [x.id, x.name])));
    }
  }, [showAll]);

  useEffect(() => {
    load();
  }, [load]);

  const resolve = async (f: Flag, status: 'dismissed' | 'confirmed') => {
    const { error } = await supabase.from('partner_fraud_flags').update({ status, resolved_at: new Date().toISOString(), resolved_by: user?.id }).eq('id', f.id);
    if (error) toast.error(error.message);
    else {
      toast.success(status === 'confirmed' ? 'Marcado como fraude. Revise as comissões na aba Financeiro.' : 'Alerta descartado');
      load();
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">Alertas gerados pela rotina diária. Confirmar não estorna nada automaticamente.</p>
        <Button size="sm" variant="outline" onClick={() => setShowAll(!showAll)}>{showAll ? 'Só abertos' : 'Ver todos'}</Button>
      </div>
      <Card>
        <CardContent className="p-0">
          {flags && flags.length === 0 ? (
            <EmptyState icon={ShieldAlert} title="Nenhum alerta" />
          ) : (
            <ul className="divide-y">
              {(flags ?? []).map((f) => (
                <li key={f.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{names.get(f.partner_id) ?? 'Parceiro'}</p>
                    <p className="text-sm">{KIND_LABELS[f.kind] ?? f.kind}</p>
                    <p className="text-xs text-muted-foreground break-all">{formatDate(f.created_at)} · {JSON.stringify(f.details)}</p>
                  </div>
                  {f.status === 'open' ? (
                    <div className="flex gap-2 shrink-0">
                      <Button size="sm" variant="outline" onClick={() => resolve(f, 'dismissed')}>Descartar</Button>
                      <Button size="sm" variant="destructive" onClick={() => resolve(f, 'confirmed')}>Confirmar</Button>
                    </div>
                  ) : (
                    <ToneBadge tone={f.status === 'confirmed' ? 'red' : 'muted'}>{f.status === 'confirmed' ? 'Confirmado' : 'Descartado'}</ToneBadge>
                  )}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
