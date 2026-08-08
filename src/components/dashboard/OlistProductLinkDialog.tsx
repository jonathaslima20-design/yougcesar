import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Loader as Loader2, Search, Download, Link2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import {
  listErpProducts,
  linkErpProduct,
  pullErpProduct,
  bulkImportErpProducts,
  type ErpProduct,
} from '@/lib/merchantErp';

interface UnlinkedProduct {
  id: string;
  title: string;
}

interface OlistProductLinkDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function OlistProductLinkDialog({ open, onOpenChange }: OlistProductLinkDialogProps) {
  const { user } = useAuth();
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [erpProducts, setErpProducts] = useState<ErpProduct[]>([]);
  const [unlinkedProducts, setUnlinkedProducts] = useState<UnlinkedProduct[]>([]);
  const [selectedTarget, setSelectedTarget] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkImporting, setBulkImporting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setSearch('');
    setErpProducts([]);
    setSelectedIds(new Set());
    runSearch('');
    loadUnlinkedProducts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function toggleSelected(olistProductId: string, checked: boolean) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(olistProductId);
      else next.delete(olistProductId);
      return next;
    });
  }

  function toggleSelectAll(checked: boolean) {
    setSelectedIds(checked ? new Set(erpProducts.map((p) => p.olist_product_id)) : new Set());
  }

  async function handleBulkImport() {
    if (selectedIds.size === 0) return;
    setBulkImporting(true);
    try {
      const result = await bulkImportErpProducts({ olist_product_ids: Array.from(selectedIds) });
      if (result.imported > 0) {
        toast.success(
          `${result.imported} produto(s) importado(s). Revise e publique em Produtos.${
            result.failed > 0 ? ` ${result.failed} falharam.` : ''
          }`
        );
      } else {
        toast.error(`Falha ao importar ${result.failed} produto(s).`);
      }
      setSelectedIds(new Set());
      loadUnlinkedProducts();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao importar produtos selecionados');
    } finally {
      setBulkImporting(false);
    }
  }

  async function loadUnlinkedProducts() {
    if (!user?.id) return;
    const { data } = await supabase
      .from('products')
      .select('id, title')
      .eq('user_id', user.id)
      .is('olist_product_id', null)
      .order('title');
    setUnlinkedProducts(data || []);
  }

  async function runSearch(term: string) {
    setLoading(true);
    try {
      const { products } = await listErpProducts({ search: term, limit: 25 });
      setErpProducts(products);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao buscar produtos na Olist');
    } finally {
      setLoading(false);
    }
  }

  async function handleImport(product: ErpProduct) {
    setBusyId(product.olist_product_id);
    try {
      await pullErpProduct({ olist_product_id: product.olist_product_id });
      toast.success(`"${product.name}" importado. Revise e publique em Produtos.`);
      loadUnlinkedProducts();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao importar produto');
    } finally {
      setBusyId(null);
    }
  }

  async function handleLink(product: ErpProduct) {
    const targetProductId = selectedTarget[product.olist_product_id];
    if (!targetProductId) {
      toast.error('Selecione um produto da sua loja para vincular.');
      return;
    }
    setBusyId(product.olist_product_id);
    try {
      await linkErpProduct({ product_id: targetProductId, olist_product_id: product.olist_product_id });
      toast.success(`"${product.name}" vinculado com sucesso.`);
      setUnlinkedProducts((prev) => prev.filter((p) => p.id !== targetProductId));
      setSelectedTarget((prev) => {
        const next = { ...prev };
        delete next[product.olist_product_id];
        return next;
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao vincular produto');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Vincular Produtos com a Olist</DialogTitle>
          <DialogDescription>
            Busque produtos do seu Olist ERP e importe vários de uma vez (com fotos) como novos produtos na
            Vitrine, ou vincule um deles a um produto que você já cadastrou.
          </DialogDescription>
        </DialogHeader>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            runSearch(search);
          }}
          className="flex gap-2"
        >
          <Input
            placeholder="Buscar por nome do produto na Olist..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <Button type="submit" variant="outline" size="icon" disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
          </Button>
        </form>

        {erpProducts.length > 0 && (
          <div className="flex items-center justify-between rounded-lg border bg-muted/20 px-3 py-2">
            <label className="flex items-center gap-2 text-xs cursor-pointer">
              <Checkbox
                checked={selectedIds.size > 0 && selectedIds.size === erpProducts.length}
                onCheckedChange={(checked) => toggleSelectAll(checked === true)}
              />
              Selecionar todos ({erpProducts.length})
            </label>
            <Button
              size="sm"
              onClick={handleBulkImport}
              disabled={selectedIds.size === 0 || bulkImporting}
            >
              {bulkImporting ? (
                <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
              ) : (
                <Download className="h-3.5 w-3.5 mr-1.5" />
              )}
              Importar selecionados ({selectedIds.size})
            </Button>
          </div>
        )}

        <div className="space-y-3">
          {!loading && erpProducts.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-8">
              Nenhum produto encontrado na Olist.
            </p>
          )}

          {erpProducts.map((product) => (
            <div key={product.olist_product_id} className="border rounded-lg p-3 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-start gap-2 min-w-0">
                  <Checkbox
                    className="mt-1"
                    checked={selectedIds.has(product.olist_product_id)}
                    onCheckedChange={(checked) => toggleSelected(product.olist_product_id, checked === true)}
                  />
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{product.name}</p>
                    <p className="text-xs text-muted-foreground">
                      SKU: {product.sku || '—'}
                      {product.price != null && ` · R$ ${product.price.toFixed(2)}`}
                    </p>
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleImport(product)}
                  disabled={busyId === product.olist_product_id}
                  className="shrink-0"
                >
                  <Download className="h-3.5 w-3.5 mr-1.5" />
                  Importar como novo
                </Button>
              </div>

              <div className="flex items-center gap-2">
                <Select
                  value={selectedTarget[product.olist_product_id] || ''}
                  onValueChange={(value) =>
                    setSelectedTarget((prev) => ({ ...prev, [product.olist_product_id]: value }))
                  }
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="Ou vincule a um produto existente..." />
                  </SelectTrigger>
                  <SelectContent>
                    {unlinkedProducts.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => handleLink(product)}
                  disabled={busyId === product.olist_product_id || !selectedTarget[product.olist_product_id]}
                  className="shrink-0"
                >
                  <Link2 className="h-3.5 w-3.5 mr-1.5" />
                  Vincular
                </Button>
              </div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
