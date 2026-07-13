import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { useLegalDocument } from '@/hooks/useLegalDocument';
import { Skeleton } from '@/components/ui/skeleton';

const LAST_UPDATED = '28 de maio de 2026';

const sections = [
  { id: 'o-que-sao', title: '1. O que são Cookies?' },
  { id: 'tipos', title: '2. Tipos de Cookies que Usamos' },
  { id: 'terceiros', title: '3. Cookies de Terceiros' },
  { id: 'controle', title: '4. Como Controlar Cookies' },
  { id: 'recusa', title: '5. Consequências da Recusa' },
  { id: 'retencao', title: '6. Retenção de Cookies' },
  { id: 'alteracoes', title: '7. Alterações nesta Política' },
  { id: 'contato', title: '8. Contato' },
];

export default function CookiesPolicyPage() {
  const { document, loading } = useLegalDocument('cookies_policy');

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
              <nav aria-label="Sumário da Política de Cookies">
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
                Política de Cookies
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
      <Section id="o-que-sao" title="1. O que são Cookies?">
        <p>
          Cookies são pequenos arquivos de texto armazenados no seu dispositivo quando você acessa um site.
        </p>
      </Section>
      <Section id="tipos" title="2. Tipos de Cookies que Usamos">
        <CookieTable
          rows={[
            { name: 'Essenciais / Necessários', purpose: 'Garantem o funcionamento básico da Plataforma.', duration: 'Sessão ou até 1 ano', canOptOut: 'Não — necessários para o serviço' },
            { name: 'Funcionais', purpose: 'Lembram preferências como tema e idioma.', duration: 'Até 1 ano', canOptOut: 'Sim, via configurações do navegador' },
            { name: 'Analytics (plataforma)', purpose: 'Dados agregados sobre uso da Plataforma.', duration: 'Até 2 anos', canOptOut: 'Sim, via configurações do navegador' },
            { name: 'Analytics (vitrine do vendedor)', purpose: 'Ferramentas configuradas pelo vendedor (ex.: Google Analytics, Meta Pixel).', duration: 'Definida pelo vendedor', canOptOut: 'Sim, via configurações do navegador' },
          ]}
        />
      </Section>
      <Section id="terceiros" title="3. Cookies de Terceiros">
        <ul>
          <li><strong>Supabase:</strong> cookies de sessão JWT para login seguro.</li>
          <li><strong>Mercado Pago:</strong> cookies de segurança antifraude.</li>
          <li><strong>Google Analytics / Meta Pixel (opcional):</strong> definidos nas vitrines onde o vendedor os configurou.</li>
        </ul>
      </Section>
      <Section id="controle" title="4. Como Controlar Cookies">
        <p>Você pode gerenciar cookies pelas configurações do seu navegador.</p>
      </Section>
      <Section id="recusa" title="5. Consequências da Recusa">
        <p>Bloquear cookies essenciais pode impedir o funcionamento correto da Plataforma.</p>
      </Section>
      <Section id="retencao" title="6. Retenção de Cookies">
        <p>Os cookies são retidos pelos prazos indicados na seção 2.</p>
      </Section>
      <Section id="alteracoes" title="7. Alterações nesta Política">
        <p>Esta Política pode ser atualizada. Alterações relevantes serão comunicadas.</p>
      </Section>
      <Section id="contato" title="8. Contato">
        <ul>
          <li><strong>Plataforma:</strong> VitrineTurbo</li>
          <li><strong>E-mail:</strong> privacidade@vitrine.app</li>
        </ul>
        <p>
          Consulte também nossa{' '}
          <Link to="/politica-de-privacidade" className="text-primary underline underline-offset-2">
            Política de Privacidade
          </Link>.
        </p>
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
      <div className="space-y-3 text-[0.9375rem] leading-relaxed text-foreground/80 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-1.5 [&_strong]:text-foreground [&_em]:italic [&_a]:text-primary [&_a]:underline [&_a]:underline-offset-2">
        {children}
      </div>
    </section>
  );
}

function CookieTable({
  rows,
}: {
  rows: { name: string; purpose: string; duration: string; canOptOut: string }[];
}) {
  return (
    <div className="overflow-x-auto rounded-lg border border-border mt-2">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-muted/60 text-left">
            <th className="px-4 py-3 font-semibold text-foreground w-[160px]">Categoria</th>
            <th className="px-4 py-3 font-semibold text-foreground">Finalidade</th>
            <th className="px-4 py-3 font-semibold text-foreground w-[120px]">Duração</th>
            <th className="px-4 py-3 font-semibold text-foreground w-[180px]">Opt-out</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-t border-border align-top">
              <td className="px-4 py-3 font-medium text-foreground">{row.name}</td>
              <td className="px-4 py-3 text-foreground/80">{row.purpose}</td>
              <td className="px-4 py-3 text-foreground/80">{row.duration}</td>
              <td className="px-4 py-3 text-foreground/80">{row.canOptOut}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
