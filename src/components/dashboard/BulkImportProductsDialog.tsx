import { useRef, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Progress } from '@/components/ui/progress';
import {
  Upload, FileText, TriangleAlert as AlertTriangle, CircleCheck as CheckCircle,
  Loader, Download, RefreshCw, ImageIcon, Layers,
} from 'lucide-react';
import {
  parseBulkImportCsv, chunkGroups,
  type BulkImportGroup, type BulkImportRowError,
} from '@/lib/bulkImportUtils';
import { generateBulkImportXlsxTemplate, parseBulkImportXlsxFile } from '@/lib/bulkImportXlsx';
import { importBulkProductBatch, type BulkImportGroupResult } from '@/lib/bulkImport';
import { downloadCSV, downloadBlob } from '@/lib/csvUtils';
import { toast } from 'sonner';

interface BulkImportProductsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onComplete: () => void;
}

type Step = 'upload' | 'preview' | 'importing' | 'done';

export function BulkImportProductsDialog({
  open,
  onOpenChange,
  onComplete,
}: BulkImportProductsDialogProps) {
  const [step, setStep] = useState<Step>('upload');
  const [groups, setGroups] = useState<BulkImportGroup[]>([]);
  const [parseErrors, setParseErrors] = useState<BulkImportRowError[]>([]);
  const [updateImages, setUpdateImages] = useState(false);
  const [progress, setProgress] = useState({ processed: 0, total: 0 });
  const [results, setResults] = useState<BulkImportGroupResult[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  const reset = () => {
    setStep('upload');
    setGroups([]);
    setParseErrors([]);
    setResults([]);
    setProgress({ processed: 0, total: 0 });
    if (fileRef.current) fileRef.current.value = '';
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const isXlsx = /\.xlsx$/i.test(file.name);

    if (isXlsx) {
      try {
        const parsed = await parseBulkImportXlsxFile(file);
        setGroups(parsed.groups);
        setParseErrors(parsed.errors);
        setStep('preview');
      } catch {
        toast.error('Não foi possível ler o arquivo .xlsx');
      }
      return;
    }

    const reader = new FileReader();
    reader.onload = (ev) => {
      const content = ev.target?.result as string;
      const parsed = parseBulkImportCsv(content);
      setGroups(parsed.groups);
      setParseErrors(parsed.errors);
      setStep('preview');
    };
    reader.readAsText(file);
  };

  const runImport = async (groupsToImport: BulkImportGroup[]) => {
    setStep('importing');
    const batches = chunkGroups(groupsToImport);
    setProgress({ processed: 0, total: groupsToImport.length });

    const newResults: BulkImportGroupResult[] = [];
    for (const batch of batches) {
      try {
        const response = await importBulkProductBatch(batch, { update_images_on_existing: updateImages });
        newResults.push(...response.results);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Erro desconhecido';
        for (const g of batch) {
          newResults.push({ grupo_id: g.grupo_id, status: 'failed', error: message });
        }
      }
      setProgress((p) => ({ ...p, processed: p.processed + batch.length }));
    }

    setResults((prev) => {
      const byGrupoId = new Map(prev.map((r) => [r.grupo_id, r]));
      for (const r of newResults) byGrupoId.set(r.grupo_id, r);
      return Array.from(byGrupoId.values());
    });
    setStep('done');
    onComplete();
  };

  const handleImport = () => runImport(groups);

  const handleRetryFailed = () => {
    const failedIds = new Set(results.filter((r) => r.status === 'failed').map((r) => r.grupo_id));
    const retryGroups = groups.filter((g) => failedIds.has(g.grupo_id));
    if (retryGroups.length === 0) return;
    runImport(retryGroups);
  };

  const handleDownloadTemplate = async () => {
    const blob = await generateBulkImportXlsxTemplate();
    downloadBlob(blob, 'template_importacao_avancada.xlsx');
  };

  const handleDownloadErrorReport = () => {
    const failed = results.filter((r) => r.status === 'failed');
    const lines = ['grupo_id,erro', ...failed.map((r) => `${r.grupo_id},"${(r.error || '').replace(/"/g, '""')}"`)];
    downloadCSV(lines.join('\n'), 'erros_importacao.csv');
  };

  const handleClose = (nextOpen: boolean) => {
    if (!nextOpen) {
      reset();
      toast.success('Importação concluída');
    }
    onOpenChange(nextOpen);
  };

  const summary = {
    created: results.filter((r) => r.status === 'created').length,
    updated: results.filter((r) => r.status === 'updated').length,
    failed: results.filter((r) => r.status === 'failed').length,
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Importação avançada de produtos</DialogTitle>
          <DialogDescription>
            Planilha (.xlsx ou .csv) com variações (cor/tamanho/sabor), imagens por URL e atualização de produtos existentes por SKU
          </DialogDescription>
        </DialogHeader>

        {step === 'upload' && (
          <div className="space-y-4 py-2">
            <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-border/60 rounded-xl cursor-pointer hover:border-primary/50 hover:bg-muted/30 transition-all">
              <Upload className="h-8 w-8 text-muted-foreground mb-2" />
              <span className="text-sm text-muted-foreground">Clique para selecionar o arquivo .xlsx ou .csv</span>
              <input ref={fileRef} type="file" accept=".csv,.xlsx" className="hidden" onChange={handleFileChange} />
            </label>
            <Button variant="outline" size="sm" className="w-full text-xs" onClick={handleDownloadTemplate}>
              <Download className="h-3.5 w-3.5 mr-1.5" />
              Baixar planilha modelo (.xlsx)
            </Button>
          </div>
        )}

        {step === 'preview' && (
          <div className="space-y-3 py-2">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Resultado da análise</span>
            </div>

            <div className="flex gap-2 flex-wrap">
              <Badge variant="default" className="bg-emerald-500/10 text-emerald-700 border-0">
                <CheckCircle className="h-3 w-3 mr-1" />
                {groups.length} produtos válidos
              </Badge>
              <Badge variant="secondary" className="border-0">
                <Layers className="h-3 w-3 mr-1" />
                {groups.reduce((sum, g) => sum + g.variants.length, 0)} variações
              </Badge>
              <Badge variant="secondary" className="border-0">
                <ImageIcon className="h-3 w-3 mr-1" />
                {groups.reduce((sum, g) => sum + g.images.length, 0)} imagens
              </Badge>
              {parseErrors.length > 0 && (
                <Badge variant="destructive" className="bg-red-500/10 text-red-700 border-0">
                  <AlertTriangle className="h-3 w-3 mr-1" />
                  {parseErrors.length} avisos/erros
                </Badge>
              )}
            </div>

            {groups.length > 0 && (
              <div className="bg-muted/30 rounded-lg p-2 space-y-1 max-h-[150px] overflow-y-auto">
                {groups.slice(0, 8).map((g) => (
                  <div key={g.grupo_id} className="flex items-center justify-between text-xs">
                    <span className="truncate max-w-[200px]">
                      {g.title} {g.sku && <span className="text-muted-foreground">({g.sku})</span>}
                    </span>
                    <span className="text-muted-foreground">
                      R$ {g.price.toFixed(2)}{g.variants.length > 0 ? ` · ${g.variants.length} var.` : ''}
                    </span>
                  </div>
                ))}
                {groups.length > 8 && (
                  <p className="text-[10px] text-muted-foreground text-center">+{groups.length - 8} produtos</p>
                )}
              </div>
            )}

            {parseErrors.length > 0 && (
              <div className="bg-destructive/5 rounded-lg p-2 space-y-0.5 max-h-[100px] overflow-y-auto">
                {parseErrors.slice(0, 8).map((err, i) => (
                  <p key={i} className="text-[10px] text-destructive">
                    Linha {err.row}: {err.message}
                  </p>
                ))}
                {parseErrors.length > 8 && (
                  <p className="text-[10px] text-muted-foreground text-center">+{parseErrors.length - 8} outros</p>
                )}
              </div>
            )}

            <div className="flex items-center justify-between gap-2 pt-1 px-1">
              <div className="space-y-0.5">
                <p className="text-xs font-medium">Atualizar imagens de produtos já existentes</p>
                <p className="text-[10px] text-muted-foreground">Por padrão, reimportar não mexe nas fotos já salvas</p>
              </div>
              <Switch checked={updateImages} onCheckedChange={setUpdateImages} />
            </div>
          </div>
        )}

        {step === 'importing' && (
          <div className="space-y-3 py-6">
            <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
              <Loader className="h-4 w-4 animate-spin" />
              Importando {progress.processed}/{progress.total} produtos...
            </div>
            <Progress value={progress.total ? (progress.processed / progress.total) * 100 : 0} />
          </div>
        )}

        {step === 'done' && (
          <div className="space-y-3 py-2">
            <div className="flex gap-2 flex-wrap">
              <Badge variant="default" className="bg-emerald-500/10 text-emerald-700 border-0">
                <CheckCircle className="h-3 w-3 mr-1" />
                {summary.created} criados
              </Badge>
              <Badge variant="default" className="bg-blue-500/10 text-blue-700 border-0">
                {summary.updated} atualizados
              </Badge>
              {summary.failed > 0 && (
                <Badge variant="destructive" className="bg-red-500/10 text-red-700 border-0">
                  <AlertTriangle className="h-3 w-3 mr-1" />
                  {summary.failed} falharam
                </Badge>
              )}
            </div>

            {summary.failed > 0 && (
              <div className="bg-destructive/5 rounded-lg p-2 space-y-0.5 max-h-[120px] overflow-y-auto">
                {results.filter((r) => r.status === 'failed').slice(0, 8).map((r, i) => (
                  <p key={i} className="text-[10px] text-destructive">
                    {r.grupo_id}: {r.error}
                  </p>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="flex justify-end gap-2 pt-2">
          {step === 'upload' && (
            <Button variant="outline" size="sm" onClick={() => handleClose(false)}>Cancelar</Button>
          )}

          {step === 'preview' && (
            <>
              <Button variant="outline" size="sm" onClick={reset}>Voltar</Button>
              <Button size="sm" onClick={handleImport} disabled={groups.length === 0}>
                Importar {groups.length} produtos
              </Button>
            </>
          )}

          {step === 'importing' && (
            <Button variant="outline" size="sm" disabled>Importando...</Button>
          )}

          {step === 'done' && (
            <>
              {summary.failed > 0 && (
                <>
                  <Button variant="outline" size="sm" onClick={handleDownloadErrorReport}>
                    <Download className="h-3.5 w-3.5 mr-1.5" />
                    Erros
                  </Button>
                  <Button variant="outline" size="sm" onClick={handleRetryFailed}>
                    <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
                    Tentar novamente
                  </Button>
                </>
              )}
              <Button size="sm" onClick={() => handleClose(false)}>Fechar</Button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
