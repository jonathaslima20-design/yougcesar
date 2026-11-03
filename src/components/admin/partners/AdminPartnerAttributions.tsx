import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Loader2, Search } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { partnerAdminApi } from '@/lib/partners/partnerApi';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { formatDate } from '@/components/partners/PartnerUi';

interface FoundUser {
  id: string;
  name: string;
  email: string;
  managed_by_partner_id: string | null;
  created_at: string;
}

interface Attribution {
  partner_id: string;
  source: string;
  attributed_at: string;
  change_reason: string | null;
}

const SOURCE_LABELS: Record<string, string> = {
  link: 'Link', coupon: 'Cupom', lead: 'Oportunidade', created: 'Criada pelo parceiro', manual: 'Ajuste manual', legacy: 'Programa anterior', directory: 'Diretório',
};

export default function AdminPartnerAttributions() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<FoundUser[]>([]);
  const [searching, setSearching] = useState(false);
  const [partners, setPartners] = useState<{ user_id: string; label: string }[]>([]);
  const [selected, setSelected] = useState<FoundUser | null>(null);
  const [attribution, setAttribution] = useState<Attribution | null>(null);
  const [target, setTarget] = useState<string>('none');
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    supabase.rpc('admin_partner_list').then(({ data }) =>
      setPartners(((data as { user_id: string; name: string; company_name: string | null }[]) ?? []).map((p) => ({ user_id: p.user_id, label: p.company_name || p.name }))),
    );
  }, []);

  const search = async (e: React.FormEvent) => {
    e.preventDefault();
    const q = query.trim();
    if (q.length < 3) return;
    setSearching(true);
    const { data } = await supabase
      .from('users')
      .select('id, name, email, managed_by_partner_id, created_at')
      .eq('role', 'corretor')
      .or(`email.ilike.%${q.replace(/[,%()]/g, '')}%,name.ilike.%${q.replace(/[,%()]/g, '')}%`)
      .limit(10);
    setResults((data as FoundUser[]) ?? []);
    setSearching(false);
  };

  const pick = async (u: FoundUser) => {
    setSelected(u);
    setTarget(u.managed_by_partner_id ?? 'none');
    setReason('');
    const { data } = await supabase.from('partner_attributions').select('partner_id, source, attributed_at, change_reason').eq('user_id', u.id).maybeSingle();
    setAttribution((data as Attribution) ?? null);
  };

  const save = async () => {
    if (!selected) return;
    setSaving(true);
    try {
      await partnerAdminApi.reassignClient(selected.id, target === 'none' ? null : target, reason);
      toast.success('Atribuição atualizada');
      const updated = { ...selected, managed_by_partner_id: target === 'none' ? null : target };
      setSelected(updated);
      setResults((r) => r.map((x) => (x.id === updated.id ? updated : x)));
      await pick(updated);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const partnerName = (id: string | null) => partners.find((p) => p.user_id === id)?.label ?? (id ? 'Parceiro' : 'Nenhum');

  return (
    <div className="grid lg:grid-cols-2 gap-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Buscar lojista</CardTitle>
          <CardDescription>Corrija a atribuição em caso de erro, disputa entre parceiros ou pedido do cliente. Toda mudança fica registrada.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <form onSubmit={search} className="flex gap-2">
            <Input placeholder="E-mail ou nome da loja" value={query} onChange={(e) => setQuery(e.target.value)} />
            <Button type="submit" variant="outline" disabled={searching}>{searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}</Button>
          </form>
          <ul className="divide-y rounded-lg border">
            {results.map((u) => (
              <li key={u.id}>
                <button className={`w-full text-left p-3 text-sm hover:bg-muted/40 ${selected?.id === u.id ? 'bg-muted/60' : ''}`} onClick={() => pick(u)}>
                  <p className="font-medium">{u.name}</p>
                  <p className="text-xs text-muted-foreground">{u.email} · parceiro: {partnerName(u.managed_by_partner_id)}</p>
                </button>
              </li>
            ))}
            {results.length === 0 && <li className="p-3 text-sm text-muted-foreground">Nenhum resultado.</li>}
          </ul>
        </CardContent>
      </Card>

      {selected && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{selected.name}</CardTitle>
            <CardDescription>
              Cadastro em {formatDate(selected.created_at)} · atual: {partnerName(selected.managed_by_partner_id)}
              {attribution && ` · origem ${SOURCE_LABELS[attribution.source] ?? attribution.source} em ${formatDate(attribution.attributed_at)}`}
              {attribution?.change_reason && ` · último ajuste: ${attribution.change_reason}`}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1.5">
              <Label>Parceiro responsável</Label>
              <Select value={target} onValueChange={setTarget}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhum (cliente direto)</SelectItem>
                  {partners.map((p) => <SelectItem key={p.user_id} value={p.user_id}>{p.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5"><Label>Motivo *</Label><Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Ex.: lead protegido do parceiro X" /></div>
            <p className="text-xs text-muted-foreground">Comissões já geradas continuam com o parceiro anterior. As próximas vão para o novo responsável.</p>
            <Button onClick={save} disabled={saving || !reason.trim() || target === (selected.managed_by_partner_id ?? 'none')}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Salvar atribuição
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
