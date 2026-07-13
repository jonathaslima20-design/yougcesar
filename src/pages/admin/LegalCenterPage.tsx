import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { FileText, Cookie, ShieldCheck, Gift, ExternalLink, Copy, Check, RefreshCw, Loader as Loader2, Clock, Tag, Pencil } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/lib/supabase';
import { LegalDocumentEditorDialog } from '@/components/admin/LegalDocumentEditorDialog';

// ── Types ──────────────────────────────────────────────────────────────────────

interface LegalDocument {
  id: string;
  document_type: string;
  title: string;
  version: string;
  content: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// ── Static document definitions ───────────────────────────────────────────────

interface DocDef {
  type: string;
  title: string;
  description: string;
  publicPath: string;
  icon: React.ReactNode;
  accentClass: string;
  iconBgClass: string;
  defaultVersion: string;
}

const DOC_DEFINITIONS: DocDef[] = [
  {
    type: 'terms_of_use',
    title: 'Termos de Uso',
    description: 'Condições gerais de uso da plataforma VitrineTurbo.',
    publicPath: '/termos-de-uso',
    icon: <FileText className="h-5 w-5" />,
    accentClass: 'text-blue-600',
    iconBgClass: 'bg-blue-50 dark:bg-blue-950/40',
    defaultVersion: '1.0',
  },
  {
    type: 'privacy_policy',
    title: 'Política de Privacidade',
    description: 'Como coletamos, usamos e protegemos os dados pessoais dos usuários.',
    publicPath: '/politica-de-privacidade',
    icon: <ShieldCheck className="h-5 w-5" />,
    accentClass: 'text-emerald-600',
    iconBgClass: 'bg-emerald-50 dark:bg-emerald-950/40',
    defaultVersion: '1.0',
  },
  {
    type: 'cookies_policy',
    title: 'Politica de Cookies',
    description: 'Quais cookies sao utilizados e como o usuario pode gerencia-los.',
    publicPath: '/politica-de-cookies',
    icon: <Cookie className="h-5 w-5" />,
    accentClass: 'text-amber-600',
    iconBgClass: 'bg-amber-50 dark:bg-amber-950/40',
    defaultVersion: '1.0',
  },
  {
    type: 'referral_terms',
    title: 'Termos do Programa de Indicacoes',
    description: 'Regras, elegibilidade, comissoes e condicoes do programa Indique e Ganhe.',
    publicPath: '/termos-indicacoes',
    icon: <Gift className="h-5 w-5" />,
    accentClass: 'text-teal-600',
    iconBgClass: 'bg-teal-50 dark:bg-teal-950/40',
    defaultVersion: '1.0',
  },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// ── Sub-components ────────────────────────────────────────────────────────────

interface DocumentCardProps {
  def: DocDef;
  doc: LegalDocument | null;
  onCopy: (type: string, content: string) => void;
  copiedType: string | null;
  onEdit: (type: string) => void;
}

function DocumentCard({ def, doc, onCopy, copiedType, onEdit }: DocumentCardProps) {
  const version = doc?.version ?? def.defaultVersion;
  const updatedAt = doc?.updated_at ?? null;
  const isActive = doc?.is_active ?? false;
  const hasContent = !!(doc?.content);
  const isCopied = copiedType === def.type;

  return (
    <Card className="flex flex-col h-full">
      <CardHeader className="pb-4">
        <div className="flex items-start gap-3">
          <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${def.iconBgClass}`}>
            <span className={def.accentClass}>{def.icon}</span>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <CardTitle className="text-base leading-snug">{def.title}</CardTitle>
              {doc ? (
                <Badge
                  variant={isActive ? 'default' : 'secondary'}
                  className="text-[10px] px-1.5 py-0"
                >
                  {isActive ? 'Ativa' : 'Rascunho'}
                </Badge>
              ) : (
                <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-muted-foreground">
                  Sem registro
                </Badge>
              )}
            </div>
            <CardDescription className="mt-1 text-sm leading-relaxed">
              {def.description}
            </CardDescription>
          </div>
        </div>
      </CardHeader>

      <CardContent className="flex flex-col gap-4 flex-1">
        {/* Meta */}
        <div className="rounded-lg border border-border bg-muted/30 divide-y divide-border">
          <div className="flex items-center gap-2 px-3 py-2.5">
            <Tag className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <span className="text-xs text-muted-foreground">Versão</span>
            <span className="ml-auto text-xs font-mono font-medium text-foreground">{version}</span>
          </div>
          <div className="flex items-center gap-2 px-3 py-2.5">
            <Clock className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <span className="text-xs text-muted-foreground">Atualizado em</span>
            <span className="ml-auto text-xs font-medium text-foreground">
              {updatedAt ? formatDate(updatedAt) : '—'}
            </span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-2 mt-auto">
          <Button
            size="sm"
            className="w-full justify-start gap-2"
            onClick={() => onEdit(def.type)}
          >
            <Pencil className="h-4 w-4" />
            Editar conteúdo
          </Button>

          <Button variant="outline" size="sm" className="w-full justify-start gap-2" asChild>
            <Link to={def.publicPath} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="h-4 w-4" />
              Ver página pública
            </Link>
          </Button>

          <Button
            variant="outline"
            size="sm"
            className="w-full justify-start gap-2"
            disabled={!hasContent}
            onClick={() => doc?.content && onCopy(def.type, doc.content)}
            title={hasContent ? 'Copiar conteúdo do documento' : 'Nenhum conteúdo salvo ainda'}
          >
            {isCopied ? (
              <>
                <Check className="h-4 w-4 text-emerald-600" />
                <span className="text-emerald-600">Copiado!</span>
              </>
            ) : (
              <>
                <Copy className="h-4 w-4" />
                Copiar conteúdo
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function LegalCenterPage() {
  const [documents, setDocuments] = useState<LegalDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [copiedType, setCopiedType] = useState<string | null>(null);
  const [editingType, setEditingType] = useState<string | null>(null);

  async function loadDocuments() {
    setLoading(true);
    const { data } = await supabase
      .from('legal_documents')
      .select('*')
      .order('updated_at', { ascending: false });
    setDocuments(data ?? []);
    setLoading(false);
  }

  useEffect(() => { loadDocuments(); }, []);

  function getActiveDoc(type: string): LegalDocument | null {
    const active = documents.find((d) => d.document_type === type && d.is_active);
    if (active) return active;
    const latest = documents.filter((d) => d.document_type === type).at(0);
    return latest ?? null;
  }

  async function handleCopy(type: string, content: string) {
    try {
      await navigator.clipboard.writeText(content);
      setCopiedType(type);
      setTimeout(() => setCopiedType(null), 2000);
    } catch {
      // clipboard not available — no-op
    }
  }

  const editingDef = editingType ? DOC_DEFINITIONS.find((d) => d.type === editingType) ?? null : null;
  const editingDoc = editingType ? getActiveDoc(editingType) : null;

  const totalActive = documents.filter((d) => d.is_active).length;
  const totalVersions = documents.length;

  return (
    <div className="container mx-auto p-6 max-w-5xl space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl md:text-3xl page-title">Central Legal</h1>
          <p className="text-muted-foreground mt-1">
            Gerencie as versões dos documentos legais da plataforma
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={loadDocuments}
          disabled={loading}
          className="gap-2 shrink-0"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Atualizar
        </Button>
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {[
          { label: 'Tipos de documento', value: DOC_DEFINITIONS.length },
          { label: 'Documentos ativos', value: loading ? '—' : totalActive },
          { label: 'Total de versões', value: loading ? '—' : totalVersions },
        ].map((stat) => (
          <div
            key={stat.label}
            className="rounded-xl border border-border bg-muted/30 px-4 py-3"
          >
            <p className="text-2xl font-bold tracking-tight text-foreground">{stat.value}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Document cards */}
      {loading ? (
        <div className="flex items-center gap-2 py-12 justify-center text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span className="text-sm">Carregando documentos...</span>
        </div>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {DOC_DEFINITIONS.map((def) => (
            <DocumentCard
              key={def.type}
              def={def}
              doc={getActiveDoc(def.type)}
              onCopy={handleCopy}
              copiedType={copiedType}
              onEdit={setEditingType}
            />
          ))}
        </div>
      )}

      {/* Version history */}
      {!loading && totalVersions > 0 && (
        <div>
          <h2 className="text-base font-semibold text-foreground mb-3">Histórico de versões</h2>
          <div className="rounded-xl border border-border overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40">
                  <th className="text-left px-4 py-2.5 font-medium text-muted-foreground text-xs uppercase tracking-wide">Documento</th>
                  <th className="text-left px-4 py-2.5 font-medium text-muted-foreground text-xs uppercase tracking-wide">Versão</th>
                  <th className="text-left px-4 py-2.5 font-medium text-muted-foreground text-xs uppercase tracking-wide hidden sm:table-cell">Atualizado</th>
                  <th className="text-left px-4 py-2.5 font-medium text-muted-foreground text-xs uppercase tracking-wide">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {documents.map((doc) => {
                  const def = DOC_DEFINITIONS.find((d) => d.type === doc.document_type);
                  return (
                    <tr key={doc.id} className="hover:bg-muted/20 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          {def && (
                            <span className={`${def.accentClass} opacity-70`}>{def.icon}</span>
                          )}
                          <span className="font-medium text-foreground">
                            {doc.title || def?.title || doc.document_type}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded">
                          v{doc.version}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground hidden sm:table-cell">
                        {formatDate(doc.updated_at)}
                      </td>
                      <td className="px-4 py-3">
                        <Badge
                          variant={doc.is_active ? 'default' : 'secondary'}
                          className="text-[10px]"
                        >
                          {doc.is_active ? 'Ativa' : 'Rascunho'}
                        </Badge>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Empty DB state */}
      {!loading && totalVersions === 0 && (
        <div className="rounded-xl border border-dashed border-border px-6 py-10 text-center">
          <FileText className="h-8 w-8 mx-auto text-muted-foreground/50 mb-3" />
          <p className="text-sm font-medium text-foreground">Nenhum documento cadastrado</p>
          <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
            Clique em "Editar conteúdo" em qualquer documento para criar o primeiro registro.
          </p>
        </div>
      )}

      {/* Editor dialog */}
      {editingDef && (
        <LegalDocumentEditorDialog
          open={!!editingType}
          documentType={editingDef.type}
          documentTitle={editingDef.title}
          currentDoc={editingDoc}
          onClose={() => setEditingType(null)}
          onSaved={loadDocuments}
        />
      )}
    </div>
  );
}
