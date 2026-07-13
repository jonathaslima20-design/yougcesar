import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { useLegalDocument } from '@/hooks/useLegalDocument';
import { Skeleton } from '@/components/ui/skeleton';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

export default function ReferralTermsPage() {
  const { document, loading } = useLegalDocument('referral_terms');

  const updatedAt = document?.updated_at
    ? new Date(document.updated_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })
    : '';

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="max-w-4xl mx-auto px-4 py-12 lg:py-16">
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-10 group"
        >
          <ArrowLeft className="h-4 w-4 group-hover:-translate-x-0.5 transition-transform" />
          Voltar ao inicio
        </Link>

        {loading ? (
          <div className="space-y-4">
            <Skeleton className="h-10 w-3/4" />
            <Skeleton className="h-4 w-1/4" />
            <Skeleton className="h-64 w-full" />
          </div>
        ) : document?.content ? (
          <article className="prose prose-slate dark:prose-invert max-w-none">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {document.content}
            </ReactMarkdown>
            {updatedAt && (
              <p className="text-sm text-muted-foreground mt-8 pt-4 border-t">
                Ultima atualizacao: {updatedAt}
              </p>
            )}
          </article>
        ) : (
          <div className="text-center py-20 text-muted-foreground">
            <p>Documento nao encontrado.</p>
          </div>
        )}
      </div>
    </div>
  );
}
