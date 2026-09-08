import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { CategorySelector } from '@/components/ui/category-selector';
import { Loader as Loader2, Copy, Info, Search } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { copyProductsBetweenUsers } from '@/lib/adminApi';
import { toast } from 'sonner';
import { syncUserCategoriesWithStorefrontSettings } from '@/lib/utils';

const copyFormSchema = z.object({
  sourceUserId: z.string().min(1, 'Selecione o usuário de origem'),
  targetUserId: z.string().min(1, 'Selecione o usuário de destino'),
  copyMode: z.enum(['all', 'category', 'specific']).default('all'),
  selectedCategories: z.array(z.string()).default([]),
  selectedProductIds: z.array(z.string()).default([]),
}).refine(
  (values) => values.copyMode !== 'category' || values.selectedCategories.length > 0,
  { message: 'Selecione ao menos uma categoria', path: ['selectedCategories'] }
).refine(
  (values) => values.copyMode !== 'specific' || values.selectedProductIds.length > 0,
  { message: 'Selecione ao menos um produto', path: ['selectedProductIds'] }
);

interface SourceProduct {
  id: string;
  title: string;
  featured_image_url: string | null;
  price: number;
}

interface User {
  id: string;
  name: string;
  email: string;
  listing_limit: number;
}

interface SimpleCopyProductsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultSourceUserId?: string;
  defaultTargetUserId?: string;
}

export function SimpleCopyProductsDialog({
  open,
  onOpenChange,
  defaultSourceUserId,
  defaultTargetUserId,
}: SimpleCopyProductsDialogProps) {
  const [users, setUsers] = useState<User[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [copying, setCopying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressMessage, setProgressMessage] = useState('');
  const [sourceProductCount, setSourceProductCount] = useState<number | null>(null);
  const [sourceProductCountLoading, setSourceProductCountLoading] = useState(false);
  const [sourceProducts, setSourceProducts] = useState<SourceProduct[]>([]);
  const [sourceProductsLoading, setSourceProductsLoading] = useState(false);
  const [productSearch, setProductSearch] = useState('');

  const form = useForm<z.infer<typeof copyFormSchema>>({
    resolver: zodResolver(copyFormSchema),
    defaultValues: {
      sourceUserId: defaultSourceUserId || '',
      targetUserId: defaultTargetUserId || '',
      copyMode: 'all',
      selectedCategories: [],
      selectedProductIds: [],
    },
  });

  const sourceUserId = form.watch('sourceUserId');
  const targetUserId = form.watch('targetUserId');
  const copyMode = form.watch('copyMode');
  const selectedCategories = form.watch('selectedCategories');
  const selectedProductIds = form.watch('selectedProductIds');

  useEffect(() => {
    if (open) {
      fetchUsers();
      if (defaultSourceUserId) {
        form.setValue('sourceUserId', defaultSourceUserId);
        fetchSourceProductCount(defaultSourceUserId);
      }
      if (defaultTargetUserId) {
        form.setValue('targetUserId', defaultTargetUserId);
      }
    }
  }, [open, defaultSourceUserId, defaultTargetUserId]);

  useEffect(() => {
    if (sourceUserId) {
      fetchSourceProductCount(sourceUserId);
    } else {
      setSourceProductCount(null);
    }
    // Selections made for a different source user no longer make sense.
    form.setValue('selectedCategories', []);
    form.setValue('selectedProductIds', []);
    setSourceProducts([]);
  }, [sourceUserId]);

  useEffect(() => {
    if (copyMode === 'specific' && sourceUserId) {
      fetchSourceProducts(sourceUserId);
    }
  }, [copyMode, sourceUserId]);

  const fetchSourceProducts = async (userId: string) => {
    try {
      setSourceProductsLoading(true);
      const { data, error } = await supabase
        .from('products')
        .select('id, title, featured_image_url, price')
        .eq('user_id', userId)
        .order('title', { ascending: true });

      if (error) throw error;
      setSourceProducts(data || []);
    } catch (error) {
      console.error('Error fetching source products:', error);
      toast.error('Erro ao carregar produtos do usuário de origem');
    } finally {
      setSourceProductsLoading(false);
    }
  };

  const fetchUsers = async () => {
    try {
      setLoadingUsers(true);
      const { data, error } = await supabase
        .from('users')
        .select('id, name, email, listing_limit')
        .order('name', { ascending: true });

      if (error) throw error;
      setUsers(data || []);
    } catch (error) {
      console.error('Error fetching users:', error);
      toast.error('Erro ao carregar usuários');
    } finally {
      setLoadingUsers(false);
    }
  };

  const fetchSourceProductCount = async (userId: string) => {
    try {
      setSourceProductCountLoading(true);
      const { count, error } = await supabase
        .from('products')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId);

      if (error) throw error;
      setSourceProductCount(count || 0);
    } catch (error) {
      console.error('Error fetching product count:', error);
      setSourceProductCount(null);
    } finally {
      setSourceProductCountLoading(false);
    }
  };

  const copyProductsAndCategories = async (sourceId: string, targetId: string, productIds?: string[]) => {
    try {
      setProgress(10);
      setProgressMessage('Iniciando cópia de produtos...');

      const result = await copyProductsBetweenUsers(sourceId, targetId, productIds);

      setProgress(80);
      setProgressMessage('Sincronizando configurações...');

      try {
        await syncUserCategoriesWithStorefrontSettings(targetId);
      } catch (syncError) {
        console.warn('Category sync warning (non-critical):', syncError);
      }

      setProgress(100);
      setProgressMessage('Cópia concluída!');

      return result;
    } catch (error) {
      console.error('Error copying products:', error);
      throw error;
    }
  };

  const handleSubmit = async (values: z.infer<typeof copyFormSchema>) => {
    try {
      setCopying(true);
      setProgress(10);
      setProgressMessage('Iniciando cópia...');

      const sourceUser = users.find(u => u.id === values.sourceUserId);
      const targetUser = users.find(u => u.id === values.targetUserId);

      if (!sourceUser || !targetUser) {
        throw new Error('Usuário de origem não encontrado');
      }

      if (values.sourceUserId === values.targetUserId) {
        throw new Error('Usuário de origem e destino não podem ser o mesmo');
      }

      let productIds: string[] | undefined;
      if (values.copyMode === 'category') {
        setProgressMessage('Selecionando produtos das categorias escolhidas...');
        const { data, error } = await supabase
          .from('products')
          .select('id')
          .eq('user_id', values.sourceUserId)
          .overlaps('category', values.selectedCategories);

        if (error) throw new Error(`Erro ao filtrar produtos por categoria: ${error.message}`);

        productIds = (data || []).map((p) => p.id);
        if (productIds.length === 0) {
          throw new Error('Nenhum produto encontrado para as categorias selecionadas.');
        }
      } else if (values.copyMode === 'specific') {
        productIds = values.selectedProductIds;
      }

      const result = await copyProductsAndCategories(values.sourceUserId, values.targetUserId, productIds);

      const stats = result.stats || {};
      toast.success(
        `Cópia concluída: ${stats.copiedCategories || 0} categorias, ${stats.copiedProducts || 0} produtos, ${stats.copiedImages || 0} imagens, ${stats.copiedPriceTiers || 0} faixas de preço, ${stats.copiedWeightVariants || 0} variantes de peso`
      );

      onOpenChange(false);
      form.reset();
      setSourceProducts([]);
      setProductSearch('');

      setTimeout(() => {
        setProgress(0);
        setProgressMessage('');
      }, 1000);

    } catch (error: any) {
      console.error('Copy operation failed:', error);

      let errorMessage = 'Erro ao copiar produtos';

      if (error.message) {
        errorMessage = error.message;
      }

      // User-friendly error messages
      if (errorMessage.includes('Nenhum produto encontrado')) {
        errorMessage = 'O usuário de origem não possui produtos para copiar.';
      } else if (errorMessage.includes('não encontrado')) {
        errorMessage = 'Um dos usuários selecionados não foi encontrado. Tente recarregar a página.';
      } else if (errorMessage.includes('conflitos')) {
        errorMessage = 'Não foi possível copiar alguns produtos devido a conflitos de nomes. Os nomes foram ajustados automaticamente.';
      }

      toast.error(errorMessage);
    } finally {
      setCopying(false);
    }
  };

  const sourceUser = users.find(u => u.id === sourceUserId);
  const targetUser = users.find(u => u.id === targetUserId);

  const canSubmit =
    !!sourceUserId &&
    !!targetUserId &&
    !copying &&
    !sourceProductCountLoading &&
    (copyMode === 'all'
      ? sourceProductCount !== 0
      : copyMode === 'category'
        ? selectedCategories.length > 0
        : selectedProductIds.length > 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Copy className="h-5 w-5 text-primary" />
            Copiar Produtos e Categorias
          </DialogTitle>
          <DialogDescription>
            Copia produtos (incluindo imagens e categorias) de um usuário para outro —
            todos, por categoria, ou produtos específicos. O usuário de destino deve
            já existir na plataforma.
          </DialogDescription>
        </DialogHeader>

        {/* Progress Bar */}
        {copying && (
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>{progressMessage}</span>
              <span>{progress}%</span>
            </div>
            <Progress value={progress} className="w-full" />
          </div>
        )}

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="flex flex-col flex-1 min-h-0">
          <div className="space-y-6 overflow-y-auto flex-1 pr-1 -mr-1">
            {/* Source and Target User Selection */}
            <FormField
              control={form.control}
              name="sourceUserId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Usuário de Origem (copiar DE)</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    value={field.value}
                    disabled={loadingUsers || copying}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione o usuário de origem" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {users.map((user) => (
                        <SelectItem key={user.id} value={user.id}>
                          {user.name} ({user.email})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormDescription>
                    Produtos e categorias deste usuário serão copiados
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="targetUserId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Usuário de Destino (copiar PARA)</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    value={field.value}
                    disabled={loadingUsers || copying}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione o usuário de destino" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {users
                        .filter(user => user.id !== sourceUserId) // Não mostrar o mesmo usuário
                        .map((user) => (
                          <SelectItem key={user.id} value={user.id}>
                            {user.name} ({user.email})
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                  <FormDescription>
                    Os produtos serão adicionados a este usuário
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Copy Mode Selection */}
            {sourceUserId && (
              <FormField
                control={form.control}
                name="copyMode"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>O que copiar</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      value={field.value}
                      disabled={copying}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="all">Todos os produtos</SelectItem>
                        <SelectItem value="category">Por categoria</SelectItem>
                        <SelectItem value="specific">Produtos específicos</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {/* Category picker */}
            {sourceUserId && copyMode === 'category' && (
              <FormField
                control={form.control}
                name="selectedCategories"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Categorias</FormLabel>
                    <CategorySelector
                      value={field.value}
                      onChange={field.onChange}
                      userId={sourceUserId}
                    />
                    <FormDescription>
                      Todos os produtos do usuário de origem que tiverem qualquer uma
                      destas categorias serão copiados.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {/* Specific product picker */}
            {sourceUserId && copyMode === 'specific' && (
              <FormField
                control={form.control}
                name="selectedProductIds"
                render={({ field }) => {
                  const filteredProducts = sourceProducts.filter((p) =>
                    p.title.toLowerCase().includes(productSearch.toLowerCase())
                  );
                  const allFilteredSelected =
                    filteredProducts.length > 0 &&
                    filteredProducts.every((p) => field.value.includes(p.id));

                  const toggleProduct = (productId: string, checked: boolean) => {
                    field.onChange(
                      checked
                        ? [...field.value, productId]
                        : field.value.filter((id: string) => id !== productId)
                    );
                  };

                  const toggleAllFiltered = (checked: boolean) => {
                    const filteredIds = filteredProducts.map((p) => p.id);
                    field.onChange(
                      checked
                        ? Array.from(new Set([...field.value, ...filteredIds]))
                        : field.value.filter((id: string) => !filteredIds.includes(id))
                    );
                  };

                  return (
                    <FormItem>
                      <FormLabel>Produtos ({field.value.length} selecionado{field.value.length !== 1 ? 's' : ''})</FormLabel>
                      <div className="relative">
                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                          placeholder="Buscar produto por nome..."
                          value={productSearch}
                          onChange={(e) => setProductSearch(e.target.value)}
                          className="pl-8"
                        />
                      </div>
                      {sourceProductsLoading ? (
                        <p className="text-sm text-muted-foreground">Carregando produtos...</p>
                      ) : (
                        <>
                          <div className="flex items-center gap-2 pb-1">
                            <Checkbox
                              id="select-all-products"
                              checked={allFilteredSelected}
                              onCheckedChange={(checked) => toggleAllFiltered(!!checked)}
                              disabled={filteredProducts.length === 0}
                            />
                            <label htmlFor="select-all-products" className="text-sm text-muted-foreground cursor-pointer">
                              Selecionar todos {productSearch ? 'os filtrados' : ''} ({filteredProducts.length})
                            </label>
                          </div>
                          <div className="max-h-64 overflow-y-auto border rounded-md divide-y">
                            {filteredProducts.length === 0 ? (
                              <p className="text-sm text-muted-foreground p-3">
                                Nenhum produto encontrado.
                              </p>
                            ) : (
                              filteredProducts.map((product) => (
                                <label
                                  key={product.id}
                                  htmlFor={`product-${product.id}`}
                                  className="flex items-center gap-3 p-2 hover:bg-muted/50 cursor-pointer"
                                >
                                  <Checkbox
                                    id={`product-${product.id}`}
                                    checked={field.value.includes(product.id)}
                                    onCheckedChange={(checked) => toggleProduct(product.id, !!checked)}
                                  />
                                  {product.featured_image_url ? (
                                    <img
                                      src={product.featured_image_url}
                                      alt={product.title}
                                      className="h-8 w-8 rounded object-cover flex-shrink-0"
                                    />
                                  ) : (
                                    <div className="h-8 w-8 rounded bg-muted flex-shrink-0" />
                                  )}
                                  <span className="text-sm flex-1 truncate">{product.title}</span>
                                  <span className="text-sm text-muted-foreground flex-shrink-0">
                                    {product.price?.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                  </span>
                                </label>
                              ))
                            )}
                          </div>
                        </>
                      )}
                      <FormMessage />
                    </FormItem>
                  );
                }}
              />
            )}

            {/* Summary */}
            {sourceUser && targetUser && (
              <div className="p-4 bg-muted/50 rounded-lg">
                <div className="space-y-3">
                  <h4 className="font-medium mb-2">Resumo da Operação:</h4>
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-blue-500"></span>
                    <span className="text-sm">DE: {sourceUser.name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-green-500"></span>
                    <span className="text-sm">PARA: {targetUser.name}</span>
                  </div>
                  {copyMode === 'all' ? (
                    sourceProductCountLoading ? (
                      <p className="text-sm text-muted-foreground">Carregando contagem de produtos...</p>
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        {sourceProductCount === null
                          ? 'Não foi possível contar produtos'
                          : sourceProductCount === 0
                            ? 'Nenhum produto para copiar'
                            : `${sourceProductCount} produto${sourceProductCount !== 1 ? 's' : ''} serão copiados`
                        }
                      </p>
                    )
                  ) : copyMode === 'category' ? (
                    <p className="text-sm text-muted-foreground">
                      {selectedCategories.length === 0
                        ? 'Nenhuma categoria selecionada'
                        : `${selectedCategories.length} categoria${selectedCategories.length !== 1 ? 's' : ''} selecionada${selectedCategories.length !== 1 ? 's' : ''}`}
                    </p>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      {selectedProductIds.length === 0
                        ? 'Nenhum produto selecionado'
                        : `${selectedProductIds.length} produto${selectedProductIds.length !== 1 ? 's' : ''} selecionado${selectedProductIds.length !== 1 ? 's' : ''}`}
                    </p>
                  )}
                  <p className="text-sm text-muted-foreground mt-2">
                    Será copiado: categorias, produtos, imagens, faixas de preço e variantes de peso.
                  </p>
                </div>
              </div>
            )}

            {/* Info Alert */}
            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription>
                <strong>Cópia de Produtos:</strong> Esta operação copia os produtos selecionados
                (e suas categorias) do usuário de origem para o usuário de destino. As imagens são
                duplicadas fisicamente para evitar conflitos. Produtos duplicados não serão criados.
              </AlertDescription>
            </Alert>
          </div>

            <div className="flex justify-end gap-2 pt-4 flex-shrink-0 border-t mt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  onOpenChange(false);
                  form.reset();
                  setSourceProducts([]);
                  setProductSearch('');
                }}
                disabled={copying}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={!canSubmit}
                title={sourceProductCount === 0 ? 'O usuário de origem não possui produtos' : ''}
              >
                {copying ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Copiando...
                  </>
                ) : (
                  <>
                    <Copy className="mr-2 h-4 w-4" />
                    Copiar Produtos
                  </>
                )}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}