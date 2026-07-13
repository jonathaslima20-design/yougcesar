import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { useLegalDocument } from '@/hooks/useLegalDocument';
import { Skeleton } from '@/components/ui/skeleton';

const LAST_UPDATED = '28 de maio de 2026';

const sections = [
  { id: 'introducao', title: '1. Introdução' },
  { id: 'dados-coletados', title: '2. Dados Coletados' },
  { id: 'finalidade', title: '3. Finalidade do Tratamento' },
  { id: 'compartilhamento', title: '4. Compartilhamento de Dados' },
  { id: 'retencao', title: '5. Retenção de Dados' },
  { id: 'direitos', title: '6. Seus Direitos' },
  { id: 'seguranca', title: '7. Segurança' },
  { id: 'cookies', title: '8. Cookies' },
  { id: 'menores', title: '9. Menores de Idade' },
  { id: 'alteracoes', title: '10. Alterações nesta Política' },
  { id: 'contato', title: '11. Contato' },
];

export default function PrivacyPolicyPage() {
  const { document, loading } = useLegalDocument('privacy_policy');

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
              <nav aria-label="Sumário da Política de Privacidade">
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
                Política de Privacidade
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
              <Link to="/politica-de-cookies" className="hover:text-foreground transition-colors">
                Política de Cookies
              </Link>
              <Link to="/termos-de-uso" className="hover:text-foreground transition-colors">
                Termos de Uso
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
      <Section id="introducao" title="1. Introdução">
        <p>
          A <strong>VitrineTurbo</strong> valoriza a sua privacidade e está comprometida em proteger os seus dados pessoais, em conformidade com a LGPD (Lei nº 13.709/2018).
        </p>
      </Section>
      <Section id="dados-coletados" title="2. Dados Coletados">
        <p>Coletamos dados fornecidos por você e dados coletados automaticamente durante o uso da Plataforma.</p>
      </Section>
      <Section id="finalidade" title="3. Finalidade do Tratamento">
        <p>Utilizamos seus dados para prestação do serviço, pagamentos, comunicações, analytics, segurança e obrigações legais.</p>
      </Section>
      <Section id="compartilhamento" title="4. Compartilhamento de Dados">
        <p>Não vendemos seus dados pessoais. Podemos compartilhá-los com parceiros essenciais para a operação do serviço.</p>
      </Section>
      <Section id="retencao" title="5. Retenção de Dados">
        <p>Mantemos seus dados enquanto sua conta estiver ativa ou pelo período exigido por lei.</p>
      </Section>
      <Section id="direitos" title="6. Seus Direitos">
        <p>Nos termos da LGPD, você possui direitos de acesso, correção, exclusão, portabilidade e revogação do consentimento.</p>
      </Section>
      <Section id="seguranca" title="7. Segurança">
        <p>Adotamos medidas técnicas e organizacionais para proteger seus dados.</p>
      </Section>
      <Section id="cookies" title="8. Cookies">
        <p>
          Utilizamos cookies para funcionamento e analytics.{' '}
          <Link to="/politica-de-cookies" className="text-primary underline underline-offset-2">
            Consulte nossa Política de Cookies
          </Link>.
        </p>
      </Section>
      <Section id="menores" title="9. Menores de Idade">
        <p>A VitrineTurbo não é direcionada a menores de 18 anos.</p>
      </Section>
      <Section id="alteracoes" title="10. Alterações nesta Política">
        <p>Podemos atualizar esta Política com aviso prévio mínimo de 15 dias.</p>
      </Section>
      <Section id="contato" title="11. Contato">
        <ul>
          <li><strong>Plataforma:</strong> VitrineTurbo</li>
          <li><strong>E-mail:</strong> privacidade@vitrine.app</li>
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
