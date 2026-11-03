import { useState } from 'react';
import { Link } from 'react-router-dom';
import { BookOpen, ChevronDown, FileText, MessageCircle, Users } from 'lucide-react';
import { usePartner } from '@/contexts/PartnerContext';
import { formatBRL } from '@/lib/partners/partnerApi';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { PageHeader } from '@/components/partners/PartnerUi';

export default function PartnersHelpPage() {
  const { settings } = usePartner();
  const [open, setOpen] = useState<number | null>(0);

  const faq = [
    {
      q: 'Como é calculada a minha comissão?',
      a: 'Cada mensalidade paga pelos seus clientes gera uma comissão com a taxa do seu nível naquele momento. A taxa vale para toda a carteira, inclusive clientes antigos.',
    },
    {
      q: 'Quando posso sacar?',
      a: `Cada comissão fica ${settings?.holding_days ?? 30} dias em carência e depois aparece como disponível. O saque mínimo é ${formatBRL(settings?.minimum_withdrawal_amount)} e o pagamento é feito via PIX, normalmente até o dia ${settings?.payout_day ?? 10} do mês.`,
    },
    {
      q: 'O que acontece se o cliente pedir reembolso?',
      a: 'A comissão daquele pagamento é estornada. Se ela já tiver sido paga, o valor é descontado das próximas comissões.',
    },
    {
      q: 'E se o cliente assinar o plano anual?',
      a: 'A comissão do anual é paga em 12 parcelas mensais, cada uma com a sua própria carência.',
    },
    {
      q: 'Como garanto que o cliente é meu?',
      a: `Registre o contato em Oportunidades assim que começar a conversa: ele fica protegido por ${settings?.lead_protection_days ?? 60} dias. Quem se cadastra pelo seu link em até ${settings?.attribution_window_days ?? 90} dias, ou usa o seu cupom, também entra na sua carteira.`,
    },
    {
      q: 'Como entro na loja de um cliente?',
      a: 'Em Clientes, abra o cliente e clique em "Gerenciar loja". Isso só funciona se o cliente tiver liberado o acesso de gestor. Você entra como o cliente nesta aba; para voltar ao painel Partners, use o aviso no topo da loja.',
    },
    {
      q: 'Preciso emitir nota fiscal?',
      a: `Se você recebe por CNPJ, sim: anexe a nota fiscal de serviço em cada saque. Como pessoa física, você recebe até ${formatBRL(settings?.max_pf_monthly_payout)} por mês sem nota.`,
    },
    {
      q: 'Posso perder o meu nível?',
      a: 'Só se a carteira ficar abaixo do critério do nível por 2 meses seguidos. E, se você passar 12 meses sem trazer nenhum cliente novo, a taxa volta para o nível inicial até a próxima venda.',
    },
  ];

  return (
    <div className="container mx-auto p-4 sm:p-6 space-y-6 max-w-4xl">
      <PageHeader title="Ajuda" description="Regras do programa, dúvidas frequentes e como falar com a gente." />

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {settings?.support_whatsapp && (
          <Card><CardContent className="pt-5 space-y-2"><MessageCircle className="h-5 w-5" /><p className="font-medium text-sm">Suporte de parceiros</p>
            <Button size="sm" variant="outline" asChild><a href={`https://wa.me/${settings.support_whatsapp.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer">WhatsApp</a></Button></CardContent></Card>
        )}
        {settings?.community_url && (
          <Card><CardContent className="pt-5 space-y-2"><Users className="h-5 w-5" /><p className="font-medium text-sm">Comunidade</p>
            <Button size="sm" variant="outline" asChild><a href={settings.community_url} target="_blank" rel="noopener noreferrer">Entrar</a></Button></CardContent></Card>
        )}
        <Card><CardContent className="pt-5 space-y-2"><BookOpen className="h-5 w-5" /><p className="font-medium text-sm">Academia</p>
          <Button size="sm" variant="outline" asChild><Link to="/partners/academy">Ver aulas</Link></Button></CardContent></Card>
        <Card><CardContent className="pt-5 space-y-2"><FileText className="h-5 w-5" /><p className="font-medium text-sm">Termos do programa</p>
          <Button size="sm" variant="outline" asChild><Link to="/parceiros/termos" target="_blank">Ler termos</Link></Button></CardContent></Card>
      </div>

      <Card>
        <CardContent className="p-0 divide-y">
          {faq.map((item, idx) => (
            <div key={item.q}>
              <button type="button" className="w-full flex items-center justify-between gap-4 p-4 text-left" onClick={() => setOpen(open === idx ? null : idx)} aria-expanded={open === idx}>
                <span className="font-medium text-sm">{item.q}</span>
                <ChevronDown className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${open === idx ? 'rotate-180' : ''}`} />
              </button>
              {open === idx && <p className="px-4 pb-4 text-sm text-muted-foreground leading-relaxed">{item.a}</p>}
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
