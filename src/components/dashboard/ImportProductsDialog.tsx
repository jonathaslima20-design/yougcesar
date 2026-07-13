import { useState, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Upload, FileText, TriangleAlert as AlertTriangle, CircleCheck as CheckCircle, Loader, Download } from 'lucide-react';
import { parseCSV, downloadCSV, exportProductsToCSV, type ParsedProduct, type ImportResult } from '@/lib/csvUtils';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';

interface ImportProductsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  onComplete: () => void;
}

export function ImportProductsDialog({
  open,
  onOpenChange,
  userId,
  onComplete,
}: ImportProductsDialogProps) {
  const [result, setResult] = useState<ImportResult | null>(null);
  const [importing, setImporting] = useState(false);
  const [imported, setImported] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      const content = ev.target?.result as string;
      const parsed = parseCSV(content);
      setResult(parsed);
      setImported(false);
    };
    reader.readAsText(file);
  };

  const handleImport = async () => {
    if (!result || result.products.length === 0) return;

    try {
      setImporting(true);
      let successCount = 0;

      for (const product of result.products) {
        const { error } = await supabase.from('products').insert({
          user_id: userId,
          title: product.title,
          description: '',
          price: product.price || 0,
          discounted_price: product.discounted_price,
          short_description: product.short_description,
          category: product.category,
          brand: product.brand || null,
          model: product.model || null,
          condition: product.condition || 'novo',
          gender: product.gender || null,
          status: product.status || 'disponivel',
          is_visible_on_storefront: product.is_visible_on_storefront,
          colors: product.colors,
          sizes: product.sizes,
          flavors: product.flavors,
          track_inventory: product.track_inventory,
          stock_quantity: product.stock_quantity,
        });

        if (!error) successCount++;
      }

      toast.success(`${successCount} produtos importados com sucesso`);
      setImported(true);
      onComplete();
    } catch (err) {
      toast.error('Erro ao importar produtos');
    } finally {
      setImporting(false);
    }
  };

  const handleDownloadTemplate = () => {
    const template = 'titulo,preco,preco_promocional,descricao_curta,categorias,marca,modelo,condicao,genero,status,visivel_na_vitrine,cores,tamanhos,sabores,controla_estoque,quantidade_estoque,url_imagem_destaque\nExemplo Produto,99.90,79.90,Descricao aqui,Categoria1; Categoria2,Marca,Modelo,novo,unissex,disponivel,sim,Vermelho; Azul,P; M; G,,nao,,';
    downloadCSV(template, 'template_produtos.csv');
  };

  const handleClose = (open: boolean) => {
    if (!open) {
      setResult(null);
      setImported(false);
      if (fileRef.current) fileRef.current.value = '';
    }
    onOpenChange(open);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Importar Produtos</DialogTitle>
          <DialogDescription>
            Importe produtos de um arquivo CSV
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {!result ? (
            <>
              {/* Upload area */}
              <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-border/60 rounded-xl cursor-pointer hover:border-primary/50 hover:bg-muted/30 transition-all">
                <Upload className="h-8 w-8 text-muted-foreground mb-2" />
                <span className="text-sm text-muted-foreground">Clique para selecionar o arquivo CSV</span>
                <input
                  ref={fileRef}
                  type="file"
                  accept=".csv"
                  className="hidden"
                  onChange={handleFileChange}
                />
              </label>

              {/* Template download */}
              <Button variant="outline" size="sm" className="w-full text-xs" onClick={handleDownloadTemplate}>
                <Download className="h-3.5 w-3.5 mr-1.5" />
                Baixar Template CSV
              </Button>
            </>
          ) : (
            <>
              {/* Results */}
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">Resultado da analise</span>
                </div>

                <div className="flex gap-2">
                  <Badge variant="default" className="bg-emerald-500/10 text-emerald-700 border-0">
                    <CheckCircle className="h-3 w-3 mr-1" />
                    {result.products.length} validos
                  </Badge>
                  {result.errors.length > 0 && (
                    <Badge variant="destructive" className="bg-red-500/10 text-red-700 border-0">
                      <AlertTriangle className="h-3 w-3 mr-1" />
                      {result.errors.length} erros
                    </Badge>
                  )}
                </div>

                {/* Preview */}
                {result.products.length > 0 && (
                  <div className="bg-muted/30 rounded-lg p-2 space-y-1 max-h-[150px] overflow-y-auto">
                    {result.products.slice(0, 5).map((p, i) => (
                      <div key={i} className="flex items-center justify-between text-xs">
                        <span className="truncate max-w-[200px]">{p.title}</span>
                        <span className="text-muted-foreground">
                          {p.price ? `R$ ${p.price.toFixed(2)}` : '-'}
                        </span>
                      </div>
                    ))}
                    {result.products.length > 5 && (
                      <p className="text-[10px] text-muted-foreground text-center">
                        +{result.products.length - 5} produtos
                      </p>
                    )}
                  </div>
                )}

                {/* Errors */}
                {result.errors.length > 0 && (
                  <div className="bg-destructive/5 rounded-lg p-2 space-y-0.5 max-h-[100px] overflow-y-auto">
                    {result.errors.slice(0, 5).map((err, i) => (
                      <p key={i} className="text-[10px] text-destructive">
                        Linha {err.row}: {err.message}
                      </p>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" size="sm" onClick={() => handleClose(false)}>
            {imported ? 'Fechar' : 'Cancelar'}
          </Button>
          {result && !imported && result.products.length > 0 && (
            <Button size="sm" onClick={handleImport} disabled={importing}>
              {importing && <Loader className="h-3.5 w-3.5 animate-spin mr-1.5" />}
              Importar {result.products.length} produtos
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
