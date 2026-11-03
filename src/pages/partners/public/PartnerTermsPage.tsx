import { useEffect } from 'react';
import { Link } from 'react-router-dom';

export const PARTNER_TERMS_VERSION = '2026-11-03';

const SECTIONS: { title: string; body: string[] }[] = [
  {
    title: '1. Sobre o programa',
    body: [
      'O VitrineTurbo Partners é um programa para profissionais e empresas que indicam, implantam e gerenciam lojas na plataforma VitrineTurbo ("Parceiro"). A participação é gratuita, depende de aprovação e não cria vínculo empregatício, societário ou de representação comercial exclusiva entre as partes.',
      'O Parceiro atua de forma independente, em nome próprio, e é o único responsável pelos serviços que presta aos seus clientes, inclusive pelos preços que cobra pela implantação e pela gestão das lojas.',
    ],
  },
  {
    title: '2. Comissões',
    body: [
      'O Parceiro recebe uma comissão recorrente sobre o valor de cada assinatura paga pelos lojistas atribuídos a ele ("Clientes"), conforme o percentual do seu nível vigente no momento do pagamento. Bônus, campanhas e multiplicadores seguem as condições divulgadas no painel.',
      'A comissão é devida enquanto o Cliente mantiver a assinatura paga e o Parceiro permanecer ativo no programa. É considerado ativo o Parceiro que trouxer ao menos um Cliente novo a cada 12 meses; caso contrário, o percentual volta ao nível inicial até a próxima venda.',
      'Planos com cobrança anual geram comissão paga em 12 parcelas mensais.',
      'Não há comissão sobre valores não pagos, reembolsados, contestados (chargeback), sobre tributos ou sobre contas do próprio Parceiro, de seus sócios ou de pessoas que atuem em conjunto com ele.',
    ],
  },
  {
    title: '3. Carência, estorno e saque',
    body: [
      'Cada comissão fica em carência por 30 dias a partir do pagamento do Cliente. Após esse prazo, fica disponível para saque no painel.',
      'Se o pagamento que originou a comissão for reembolsado, cancelado ou contestado, a comissão será estornada. Se já tiver sido paga, o valor será descontado das comissões futuras.',
      'O saque é feito via PIX para chave de titularidade do Parceiro, respeitado o valor mínimo informado no painel. Pessoas físicas podem receber até o limite mensal informado no painel; acima dele, é necessário CNPJ (MEI é aceito) e a emissão de nota fiscal de serviço em nome do VitrineTurbo a cada saque.',
      'O Parceiro é responsável pelos tributos incidentes sobre os valores que recebe.',
    ],
  },
  {
    title: '4. Níveis',
    body: [
      'O nível é definido pela receita mensal recorrente da carteira ou pelo número de Clientes ativos, conforme a tabela vigente no painel. A promoção é imediata; o rebaixamento ocorre após 2 meses consecutivos abaixo do critério do nível atual. Alguns níveis exigem a certificação do programa.',
      'Parceiros Fundadores mantêm as condições adicionais informadas no momento da adesão enquanto permanecerem no programa.',
    ],
  },
  {
    title: '5. Atribuição de Clientes',
    body: [
      'Um Cliente é atribuído ao Parceiro quando: (a) se cadastra até 90 dias depois de acessar um link do Parceiro, valendo o último link de parceiro acessado; (b) usa o cupom do Parceiro no cadastro; (c) tem a conta criada pelo Parceiro no painel; ou (d) consta como contato registrado pelo Parceiro no painel, dentro do prazo de proteção de 60 dias, o que prevalece sobre as demais formas.',
      'Depois do cadastro, a atribuição não muda, salvo por decisão do VitrineTurbo em caso de erro, fraude, disputa ou pedido fundamentado do Cliente.',
    ],
  },
  {
    title: '6. Práticas proibidas',
    body: [
      'É proibido: (a) anunciar em buscadores ou redes sociais usando a marca VitrineTurbo, suas variações ou erros de digitação como palavra-chave; (b) enviar mensagens em massa não solicitadas ou usar listas de contatos compradas; (c) prometer recursos, preços ou condições diferentes dos oficiais; (d) apresentar-se como funcionário ou representante oficial do VitrineTurbo; (e) indicar a si mesmo ou criar contas fictícias; (f) divulgar cupons em sites de cupons sem autorização.',
      'O descumprimento pode levar ao estorno de comissões, à suspensão de saques e ao encerramento da parceria, sem prejuízo de outras medidas cabíveis.',
    ],
  },
  {
    title: '7. Acesso às lojas e dados pessoais',
    body: [
      'O acesso de gestor às lojas dos Clientes depende do consentimento do próprio Cliente, que pode revogá-lo a qualquer momento. Os acessos ficam registrados.',
      'O Parceiro deve tratar os dados pessoais a que tiver acesso (dos Clientes e dos compradores das lojas) apenas para prestar os serviços contratados pelo Cliente, em conformidade com a Lei Geral de Proteção de Dados (Lei 13.709/2018), mantendo-os em sigilo e adotando medidas de segurança adequadas. É proibido extrair, vender ou usar esses dados para outras finalidades.',
    ],
  },
  {
    title: '8. Marca e materiais',
    body: [
      'O Parceiro pode usar a marca VitrineTurbo e os materiais disponibilizados no painel apenas para divulgar a plataforma, sem alterá-los de forma que induza a erro. O selo de nível e de certificação só pode ser usado enquanto válido.',
    ],
  },
  {
    title: '9. Alterações e encerramento',
    body: [
      'O VitrineTurbo pode alterar estes termos, os níveis e os percentuais com aviso prévio de 30 dias no painel. As comissões já geradas seguem as regras vigentes na data em que foram geradas.',
      'Qualquer das partes pode encerrar a parceria a qualquer momento. Em encerramento sem violação destes termos, as comissões já disponíveis serão pagas. Em caso de violação, as comissões em carência e disponíveis podem ser canceladas.',
    ],
  },
];

export default function PartnerTermsPage() {
  useEffect(() => {
    document.title = 'Termos do Programa de Parceiros | VitrineTurbo';
  }, []);

  return (
    <div className="bg-white min-h-screen">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-12 sm:py-16">
        <Link to="/parceiros" className="text-sm text-ink-500 hover:text-ink-900">← VitrineTurbo Partners</Link>
        <h1 className="font-display font-semibold text-[32px] sm:text-[40px] tracking-[-0.03em] mt-6 text-ink-900">Termos do Programa de Parceiros</h1>
        <p className="text-sm text-ink-500 mt-2">Versão {PARTNER_TERMS_VERSION}</p>
        <div className="mt-10 space-y-10">
          {SECTIONS.map((section) => (
            <section key={section.title}>
              <h2 className="font-display font-semibold text-[20px] text-ink-900">{section.title}</h2>
              <div className="mt-3 space-y-3 text-ink-700 leading-relaxed">
                {section.body.map((p) => (
                  <p key={p.slice(0, 40)}>{p}</p>
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
