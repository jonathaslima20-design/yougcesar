import { useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, FileText, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { usePartner } from '@/contexts/PartnerContext';
import { partnerApi } from '@/lib/partners/partnerApi';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';

/**
 * Blocks the panel until the partner owner accepts the current program terms,
 * and explains suspended/terminated accounts instead of showing broken pages.
 */
export default function PartnerTermsGate({ children }: { children: React.ReactNode }) {
  const { loading, error, overview, profile, settings, isOwner, partnerId, refresh } = usePartner();
  const [accepted, setAccepted] = useState(false);
  const [saving, setSaving] = useState(false);

  if (loading) {
    return (
      <div className="flex justify-center py-24">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !overview || !profile) {
    return (
      <div className="container mx-auto p-6 max-w-xl">
        <Card>
          <CardHeader>
            <CardTitle>Perfil de parceiro indisponível</CardTitle>
            <CardDescription>
              Não encontramos o seu cadastro no programa de parceiros. Fale com o suporte para regularizar o acesso.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  if (overview.status && overview.status !== 'approved') {
    return (
      <div className="container mx-auto p-6 max-w-xl">
        <Card>
          <CardHeader>
            <AlertTriangle className="h-6 w-6 text-amber-500" />
            <CardTitle>{overview.status === 'suspended' ? 'Conta de parceiro suspensa' : 'Parceria encerrada'}</CardTitle>
            <CardDescription>
              {overview.status === 'suspended'
                ? 'Sua conta está em revisão. Novas lojas, links e saques ficam indisponíveis até a revisão terminar.'
                : 'Sua participação no programa foi encerrada.'}{' '}
              {settings?.support_whatsapp && (
                <a className="underline" href={`https://wa.me/${settings.support_whatsapp.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer">
                  Fale com o suporte de parceiros.
                </a>
              )}
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  const needsTerms = isOwner && settings && profile.terms_version !== settings.terms_version;
  if (!needsTerms) return <>{children}</>;

  const accept = async () => {
    if (!partnerId || !settings) return;
    setSaving(true);
    try {
      await partnerApi.updateProfile(partnerId, { terms_version: settings.terms_version, terms_accepted_at: new Date().toISOString() });
      await refresh();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="container mx-auto p-6 max-w-2xl">
      <Card>
        <CardHeader>
          <FileText className="h-6 w-6 text-primary" />
          <CardTitle>{profile.terms_version ? 'Os termos do programa foram atualizados' : 'Bem-vindo ao novo VitrineTurbo Partners'}</CardTitle>
          <CardDescription>Antes de continuar, leia e aceite os termos do programa (versão {settings.terms_version}).</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <ul className="list-disc pl-5 space-y-1.5 text-muted-foreground">
            <li>Comissão recorrente pelo seu nível, enquanto o cliente pagar e você estiver ativo.</li>
            <li>Carência de {settings.holding_days} dias antes do saque; reembolsos e contestações estornam a comissão.</li>
            <li>Planos anuais pagam a comissão em 12 parcelas mensais.</li>
            <li>Contatos registrados ficam protegidos por {settings.lead_protection_days} dias.</li>
            <li>Proibido usar a marca VitrineTurbo em anúncios, spam ou autoindicação.</li>
            <li>Acesso às lojas só com permissão do cliente, e uso dos dados conforme a LGPD.</li>
          </ul>
          <Link to="/parceiros/termos" target="_blank" className="underline inline-block">Ler os termos completos</Link>
          <label className="flex items-start gap-3 cursor-pointer">
            <Checkbox checked={accepted} onCheckedChange={(v) => setAccepted(v === true)} className="mt-0.5" />
            <span>Li e aceito os termos do programa de parceiros.</span>
          </label>
          <Button onClick={accept} disabled={!accepted || saving}>
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Aceitar e continuar
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
