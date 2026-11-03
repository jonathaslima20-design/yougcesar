import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { ShieldCheck } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { Card, CardContent } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';

interface StorePartner {
  partner_name: string;
  partner_whatsapp: string | null;
  granted: boolean;
}

/** Merchant-side consent: lets the store owner allow/revoke manager access for their partner. */
export default function PartnerAccessCard() {
  const [info, setInfo] = useState<StorePartner | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    supabase.rpc('my_store_partner').then(({ data, error }) => {
      if (!error && data) setInfo(data as StorePartner);
    });
  }, []);

  if (!info) return null;

  const toggle = async (grant: boolean) => {
    setSaving(true);
    const { error } = await supabase.rpc('set_partner_store_access', { p_grant: grant });
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setInfo({ ...info, granted: grant });
    toast.success(grant ? 'Acesso liberado para o seu parceiro' : 'Acesso do parceiro revogado');
  };

  return (
    <Card>
      <CardContent className="p-6">
        <h3 className="text-base font-semibold mb-1 flex items-center gap-2"><ShieldCheck className="h-4 w-4" />Parceiro da sua loja</h3>
        <p className="text-sm text-muted-foreground">
          Sua loja é acompanhada por <strong className="text-foreground">{info.partner_name}</strong>, parceiro oficial VitrineTurbo.
        </p>
        <label className="flex items-start gap-3 mt-4 cursor-pointer">
          <Switch checked={info.granted} onCheckedChange={toggle} disabled={saving} className="mt-0.5" />
          <span className="text-sm">
            <span className="font-medium">Permitir que o parceiro gerencie a minha loja</span>
            <span className="block text-muted-foreground mt-0.5">
              Ele poderá entrar no seu painel para configurar produtos, aparência e pedidos. Você pode revogar quando quiser.
            </span>
          </span>
        </label>
      </CardContent>
    </Card>
  );
}
