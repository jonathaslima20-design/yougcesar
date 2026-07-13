import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { useLegalDocument } from '@/hooks/useLegalDocument';
import { Skeleton } from '@/components/ui/skeleton';

const LAST_UPDATED = '28 de maio de 2026';

const sections = [
  { id: 'aceitacao', title: '1. Aceitação dos Termos' },
  { id: 'definicoes', title: '2. Definições' },
  { id: 'cadastro', title: '3. Cadastro e Conta' },
  { id: 'planos', title: '4. Planos e Pagamentos' },
  { id: 'uso-aceitavel', title: '5. Uso Aceitável' },
  { id: 'conteudo', title: '6. Conteúdo do Usuário' },
  { id: 'propriedade', title: '7. Propriedade Intelectual' },
  { id: 'responsabilidade', title: '8. Limitação de Responsabilidade' },
  { id: 'disponibilidade', title: '9. Disponibilidade do Serviço' },
  { id: 'rescisao', title: '10. Rescisão' },
  { id: 'relacao-vendedores', title: '11. Relação com Vendedores e Clientes Finais' },
  { id: 'lei', title: '12. Lei Aplicável e Foro' },
  { id: 'alteracoes', title: '13. Alterações nos Termos' },
  { id: 'contato', title: '14. Contato' },
];

export default function TermsOfUsePage() {
  const { document, loading } = useLegalDocument('terms_of_use');

  const updatedAt = document?.updated_at
    ? new Date(document.updated_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })
    : LAST_UPDATED;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="max-w-5xl mx-auto px-4 py-12 lg:py-16">
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-10 group"
        >
          <ArrowLeft className="h-4 w-4 group-hover:-translate-x-0.5 transition-transform" />
          Voltar ao início
        </Link>

        <div className="lg:grid lg:grid-cols-[240px_1fr] lg:gap-12">
          <aside className="hidden lg:block">
            <div className="sticky top-8">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-4">
                Nesta página
              </p>
              <nav aria-label="Sumário dos Termos de Uso">
                <ul className="space-y-1">
                  {sections.map((s) => (
                    <li key={s.id}>
                      <a
                        href={`#${s.id}`}
                        className="block text-sm text-muted-foreground hover:text-foreground py-1 transition-colors"
                      >
                        {s.title}
                      </a>
                    </li>
                  ))}
                </ul>
              </nav>
            </div>
          </aside>

          <main>
            <header className="mb-10 pb-8 border-b border-border">
              <h1 className="text-3xl sm:text-4xl font-bold tracking-tight mb-3">
                Termos de Uso
              </h1>
              <p className="text-sm text-muted-foreground">
                Última atualização: {updatedAt}
              </p>
            </header>

            <details className="lg:hidden mb-8 p-4 rounded-lg border border-border bg-muted/40">
              <summary className="cursor-pointer text-sm font-semibold">Ver sumário</summary>
              <nav className="mt-3" aria-label="Sumário">
                <ul className="space-y-1">
                  {sections.map((s) => (
                    <li key={s.id}>
                      <a href={`#${s.id}`} className="text-sm text-muted-foreground hover:text-foreground">
                        {s.title}
                      </a>
                    </li>
                  ))}
                </ul>
              </nav>
            </details>

            {loading ? (
              <ContentSkeleton />
            ) : document?.content ? (
              <article
                className="legal-content text-[0.9375rem] leading-relaxed text-foreground/80
                  [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:mb-4 [&_h2]:mt-10 [&_h2]:text-foreground [&_h2:first-child]:mt-0
                  [&_h3]:font-semibold [&_h3]:text-foreground [&_h3]:mt-5 [&_h3]:mb-2
                  [&_p]:mb-3
                  [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-1.5 [&_ul]:mb-3
                  [&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:space-y-1.5 [&_ol]:mb-3
                  [&_strong]:text-foreground [&_em]:italic
                  [&_a]:text-primary [&_a]:underline [&_a]:underline-offset-2"
                dangerouslySetInnerHTML={{ __html: document.content }}
              />
            ) : (
              <StaticContent />
            )}

            <div className="mt-12 pt-8 border-t border-border flex flex-wrap gap-4 text-sm text-muted-foreground">
              <Link to="/politica-de-privacidade" className="hover:text-foreground transition-colors">
                Política de Privacidade
              </Link>
              <Link to="/politica-de-cookies" className="hover:text-foreground transition-colors">
                Política de Cookies
              </Link>
            </div>
          </main>
        </div>
      </div>

      <footer className="border-t border-border mt-16 py-6 text-center text-sm text-muted-foreground">
        © {new Date().getFullYear()} VitrineTurbo. Todos os direitos reservados.
      </footer>
    </div>
  );
}

function ContentSkeleton() {
  return (
    <div className="space-y-8">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="space-y-3">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
        </div>
      ))}
    </div>
  );
}

function StaticContent() {
  return (
    <article>
      <Section id="aceitacao" title="1. Aceitação dos Termos">
        <p>
          Ao se cadastrar, acessar ou usar a plataforma <strong>VitrineTurbo</strong> ("Plataforma", "nós" ou "nosso"), você ("Usuário") concorda integralmente com estes Termos de Uso e com nossa{' '}
          <Link to="/politica-de-privacidade" className="text-primary underline underline-offset-2">
            Política de Privacidade
          </Link>
          . Se você não concordar com qualquer disposição destes Termos, não utilize a Plataforma.
        </p>
        <p>
          Estes Termos constituem o acordo integral entre você e a VitrineTurbo e prevalecem sobre qualquer comunicação anterior.
        </p>
      </Section>

      <Section id="definicoes" title="2. Definições">
        <ul>
          <li><strong>Plataforma:</strong> o conjunto de sistemas, aplicativos web e APIs disponibilizados pela VitrineTurbo.</li>
          <li><strong>Vendedor / Usuário Assinante:</strong> pessoa física ou jurídica que cria uma conta e utiliza a Plataforma para criar e gerenciar sua vitrine online.</li>
          <li><strong>Vitrine:</strong> o espaço digital personalizado criado pelo Vendedor para exibir seus produtos ao público.</li>
          <li><strong>Cliente Final / Visitante:</strong> o consumidor que acessa a vitrine de um Vendedor.</li>
          <li><strong>Conteúdo:</strong> textos, imagens, preços, descrições e quaisquer dados inseridos pelo Vendedor na Plataforma.</li>
          <li><strong>Plano:</strong> o nível de assinatura contratado, com funcionalidades e limites definidos.</li>
        </ul>
      </Section>

      <Section id="cadastro" title="3. Cadastro e Conta">
        <p>Para utilizar a Plataforma, o Vendedor deve:</p>
        <ul>
          <li>Ter capacidade civil plena (ser maior de 18 anos ou emancipado legalmente);</li>
          <li>Fornecer informações verdadeiras, precisas e atualizadas no cadastro;</li>
          <li>Manter a confidencialidade de sua senha e não compartilhá-la com terceiros;</li>
          <li>Notificar imediatamente a VitrineTurbo em caso de acesso não autorizado à sua conta.</li>
        </ul>
        <p>
          O Vendedor é o único responsável pelas ações realizadas em sua conta. A VitrineTurbo reserva-se o direito de recusar cadastros ou encerrar contas a qualquer momento, por violação destes Termos ou por razões de segurança.
        </p>
      </Section>

      <Section id="planos" title="4. Planos e Pagamentos">
        <h3>4.1 Assinatura</h3>
        <p>O uso completo da Plataforma está condicionado à contratação de um Plano de assinatura.</p>
        <h3>4.2 Cobrança</h3>
        <p>Os pagamentos são processados de forma segura via <strong>Mercado Pago</strong>.</p>
        <h3>4.3 Cancelamento e Reembolso</h3>
        <p>Você pode cancelar sua assinatura a qualquer momento pelo painel.</p>
        <h3>4.4 Inadimplência</h3>
        <p>Em caso de falha no pagamento, o acesso às funcionalidades pagas poderá ser suspenso.</p>
        <h3>4.5 Plano Gratuito</h3>
        <p>Quando disponível, o plano gratuito oferece funcionalidades limitadas.</p>
      </Section>

      <Section id="uso-aceitavel" title="5. Uso Aceitável">
        <p>O Vendedor compromete-se a NÃO utilizar a Plataforma para atividades ilegais ou prejudiciais.</p>
      </Section>

      <Section id="conteudo" title="6. Conteúdo do Usuário">
        <p>O Vendedor é inteiramente responsável por todo o Conteúdo inserido na Plataforma.</p>
      </Section>

      <Section id="propriedade" title="7. Propriedade Intelectual">
        <p>Todos os elementos da Plataforma são de propriedade exclusiva da VitrineTurbo ou de seus licenciadores.</p>
      </Section>

      <Section id="responsabilidade" title="8. Limitação de Responsabilidade">
        <p>Na máxima extensão permitida pela legislação aplicável, a VitrineTurbo limita sua responsabilidade conforme descrito nestes Termos.</p>
      </Section>

      <Section id="disponibilidade" title="9. Disponibilidade do Serviço">
        <p>Envidamos esforços razoáveis para manter a Plataforma disponível 24/7.</p>
      </Section>

      <Section id="rescisao" title="10. Rescisão">
        <p>Qualquer das partes pode encerrar o contrato a qualquer momento conforme descrito nestes Termos.</p>
      </Section>

      <Section id="relacao-vendedores" title="11. Relação com Vendedores e Clientes Finais">
        <p>A VitrineTurbo é uma plataforma de tecnologia que fornece infraestrutura para Vendedores criarem suas vitrines.</p>
      </Section>

      <Section id="lei" title="12. Lei Aplicável e Foro">
        <p>Estes Termos são regidos pelas leis da República Federativa do Brasil.</p>
      </Section>

      <Section id="alteracoes" title="13. Alterações nos Termos">
        <p>Podemos revisar estes Termos a qualquer momento com aviso prévio.</p>
      </Section>

      <Section id="contato" title="14. Contato">
        <ul>
          <li><strong>Plataforma:</strong> VitrineTurbo</li>
          <li><strong>E-mail:</strong> contato@vitrine.app</li>
        </ul>
      </Section>
    </article>
  );
}

function Section({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="mb-10 scroll-mt-8">
      <h2 className="text-xl font-semibold mb-4 text-foreground">{title}</h2>
      <div className="space-y-3 text-[0.9375rem] leading-relaxed text-foreground/80 [&_h3]:font-semibold [&_h3]:text-foreground [&_h3]:mt-5 [&_h3]:mb-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-1.5 [&_strong]:text-foreground [&_a]:text-primary [&_a]:underline [&_a]:underline-offset-2">
        {children}
      </div>
    </section>
  );
}
