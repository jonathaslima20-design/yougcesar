import { useState, useEffect } from 'react';
import { Loader as Loader2, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { generateRandomCode, type CouponFormData } from '@/hooks/useCoupons';
import type { Coupon, CouponAppliesTo, CouponDiscountType } from '@/types';

interface CouponFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  coupon?: Coupon | null;
  couponProductIds?: string[];
  couponCategoryIds?: string[];
  onSave: (data: CouponFormData) => Promise<boolean | Coupon | null>;
}

export default function CouponFormDialog({
  open,
  onOpenChange,
  coupon,
  couponProductIds = [],
  couponCategoryIds = [],
  onSave,
}: CouponFormDialogProps) {
  const { user } = useAuth();
  const isEditing = !!coupon;

  const [saving, setSaving] = useState(false);
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [discountType, setDiscountType] = useState<CouponDiscountType>('percentage');
  const [discountValue, setDiscountValue] = useState('');
  const [minOrderValue, setMinOrderValue] = useState('');
  const [maxDiscountAmount, setMaxDiscountAmount] = useState('');
  const [maxUses, setMaxUses] = useState('');
  const [maxUsesPerCustomer, setMaxUsesPerCustomer] = useState('');
  const [validFrom, setValidFrom] = useState('');
  const [validUntil, setValidUntil] = useState('');
  const [hasExpiration, setHasExpiration] = useState(false);
  const [isActive, setIsActive] = useState(true);
  const [appliesTo, setAppliesTo] = useState<CouponAppliesTo>('all_products');
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([]);
  const [selectedCategoryNames, setSelectedCategoryNames] = useState<string[]>([]);

  const [products, setProducts] = useState<Array<{ id: string; title: string }>>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!open) return;

    if (coupon) {
      setCode(coupon.code);
      setName(coupon.name);
      setDiscountType(coupon.discount_type);
      setDiscountValue(String(coupon.discount_value));
      setMinOrderValue(coupon.min_order_value ? String(coupon.min_order_value) : '');
      setMaxDiscountAmount(coupon.max_discount_amount ? String(coupon.max_discount_amount) : '');
      setMaxUses(coupon.max_uses ? String(coupon.max_uses) : '');
      setMaxUsesPerCustomer(coupon.max_uses_per_customer ? String(coupon.max_uses_per_customer) : '');
      setValidFrom(coupon.valid_from ? coupon.valid_from.slice(0, 16) : '');
      setHasExpiration(!!coupon.valid_until);
      setValidUntil(coupon.valid_until ? coupon.valid_until.slice(0, 16) : '');
      setIsActive(coupon.is_active);
      setAppliesTo(coupon.applies_to);
      setSelectedProductIds(couponProductIds);
    } else {
      setCode('');
      setName('');
      setDiscountType('percentage');
      setDiscountValue('');
      setMinOrderValue('');
      setMaxDiscountAmount('');
      setMaxUses('');
      setMaxUsesPerCustomer('');
      setValidFrom(new Date().toISOString().slice(0, 16));
      setHasExpiration(false);
      setValidUntil('');
      setIsActive(true);
      setAppliesTo('all_products');
      setSelectedProductIds([]);
      setSelectedCategoryNames([]);
    }
    setErrors({});
  }, [open, coupon, couponProductIds]);

  useEffect(() => {
    if (!open || !user?.id) return;

    const loadData = async () => {
      if (appliesTo === 'specific_products') {
        const { data } = await supabase
          .from('products')
          .select('id, title')
          .eq('user_id', user.id)
          .eq('is_visible_on_storefront', true)
          .order('title');
        setProducts(data || []);
      }

      if (appliesTo === 'specific_categories') {
        const { data } = await supabase
          .from('products')
          .select('category')
          .eq('user_id', user.id);

        const allCats = new Set<string>();
        (data || []).forEach(p => {
          if (Array.isArray(p.category)) {
            p.category.forEach((c: string) => allCats.add(c));
          }
        });
        setCategories(Array.from(allCats).sort());
      }
    };

    loadData();
  }, [open, user?.id, appliesTo]);

  useEffect(() => {
    if (coupon && couponCategoryIds.length > 0 && categories.length === 0) {
      // Will be loaded when categories are fetched
    }
  }, [coupon, couponCategoryIds, categories]);

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    const codeClean = code.trim();
    if (!codeClean || codeClean.length < 3) {
      newErrors.code = 'Código deve ter pelo menos 3 caracteres';
    } else if (!/^[A-Z0-9\-]+$/.test(codeClean)) {
      newErrors.code = 'Apenas letras, números e hífen';
    }

    const val = parseFloat(discountValue);
    if (!discountValue || isNaN(val) || val <= 0) {
      newErrors.discountValue = 'Valor obrigatório e positivo';
    } else if (discountType === 'percentage' && val > 100) {
      newErrors.discountValue = 'Percentual máximo de 100%';
    }

    if (appliesTo === 'specific_products' && selectedProductIds.length === 0) {
      newErrors.products = 'Selecione pelo menos um produto';
    }

    if (appliesTo === 'specific_categories' && selectedCategoryNames.length === 0) {
      newErrors.categories = 'Selecione pelo menos uma categoria';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;
    setSaving(true);

    const formData: CouponFormData = {
      code: code.toUpperCase().trim(),
      name: name.trim(),
      discount_type: discountType,
      discount_value: parseFloat(discountValue),
      min_order_value: minOrderValue ? parseFloat(minOrderValue) : 0,
      max_discount_amount: discountType === 'percentage' && maxDiscountAmount ? parseFloat(maxDiscountAmount) : null,
      max_uses: maxUses ? parseInt(maxUses) : null,
      max_uses_per_customer: maxUsesPerCustomer ? parseInt(maxUsesPerCustomer) : null,
      valid_from: validFrom ? new Date(validFrom).toISOString() : new Date().toISOString(),
      valid_until: hasExpiration && validUntil ? new Date(validUntil).toISOString() : null,
      is_active: isActive,
      applies_to: appliesTo,
      product_ids: appliesTo === 'specific_products' ? selectedProductIds : [],
      category_ids: [],
    };

    const result = await onSave(formData);
    setSaving(false);
    if (result !== false && result !== null) {
      onOpenChange(false);
    }
  };

  const previewText = (() => {
    const val = parseFloat(discountValue);
    if (!discountValue || isNaN(val) || val <= 0) return '';

    let text = discountType === 'percentage'
      ? `${val}% de desconto`
      : `R$ ${val.toFixed(2)} de desconto`;

    const minVal = parseFloat(minOrderValue);
    if (minOrderValue && !isNaN(minVal) && minVal > 0) {
      text += ` em pedidos acima de R$ ${minVal.toFixed(2)}`;
    }

    const maxVal = parseFloat(maxDiscountAmount);
    if (discountType === 'percentage' && maxDiscountAmount && !isNaN(maxVal) && maxVal > 0) {
      text += `, limite de R$ ${maxVal.toFixed(2)}`;
    }

    return text;
  })();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Editar Cupom' : 'Criar Cupom'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-5">
          {/* Basic Info */}
          <div className="space-y-3">
            <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Informações básicas</h4>
            <div className="space-y-2">
              <Label>Código do cupom</Label>
              <div className="flex gap-2">
                <Input
                  placeholder="EX: PROMO10"
                  value={code}
                  onChange={(e) => {
                    setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9\-]/g, ''));
                    if (errors.code) setErrors(p => ({ ...p, code: '' }));
                  }}
                  className="flex-1 uppercase font-mono"
                />
                <Button
                  variant="outline"
                  size="icon"
                  type="button"
                  onClick={() => setCode(generateRandomCode())}
                  title="Gerar código aleatório"
                >
                  <RefreshCw className="h-4 w-4" />
                </Button>
              </div>
              {errors.code && <p className="text-xs text-destructive">{errors.code}</p>}
            </div>
            <div className="space-y-2">
              <Label>Nome interno (opcional)</Label>
              <Input
                placeholder="Ex: Promoção de lançamento"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
          </div>

          <Separator />

          {/* Discount */}
          <div className="space-y-3">
            <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Desconto</h4>
            <div className="space-y-2">
              <Label>Tipo de desconto</Label>
              <Select value={discountType} onValueChange={(v) => setDiscountType(v as CouponDiscountType)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="percentage">Percentual (%)</SelectItem>
                  <SelectItem value="fixed_amount">Valor fixo (R$)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Valor {discountType === 'percentage' ? '(%)' : '(R$)'}</Label>
                <Input
                  type="number"
                  min="0"
                  max={discountType === 'percentage' ? '100' : undefined}
                  step="0.01"
                  placeholder={discountType === 'percentage' ? '10' : '25.00'}
                  value={discountValue}
                  onChange={(e) => {
                    setDiscountValue(e.target.value);
                    if (errors.discountValue) setErrors(p => ({ ...p, discountValue: '' }));
                  }}
                />
                {errors.discountValue && <p className="text-xs text-destructive">{errors.discountValue}</p>}
              </div>
              {discountType === 'percentage' && (
                <div className="space-y-2">
                  <Label>Desconto máximo (R$)</Label>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="30.00"
                    value={maxDiscountAmount}
                    onChange={(e) => setMaxDiscountAmount(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">Teto do desconto</p>
                </div>
              )}
            </div>
          </div>

          <Separator />

          {/* Conditions */}
          <div className="space-y-3">
            <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Condições</h4>
            <div className="space-y-2">
              <Label>Valor mínimo do pedido (R$)</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                placeholder="0.00"
                value={minOrderValue}
                onChange={(e) => setMinOrderValue(e.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Máximo de usos total</Label>
                <Input
                  type="number"
                  min="1"
                  placeholder="Ilimitado"
                  value={maxUses}
                  onChange={(e) => setMaxUses(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Máximo por cliente</Label>
                <Input
                  type="number"
                  min="1"
                  placeholder="Ilimitado"
                  value={maxUsesPerCustomer}
                  onChange={(e) => setMaxUsesPerCustomer(e.target.value)}
                />
              </div>
            </div>
          </div>

          <Separator />

          {/* Validity */}
          <div className="space-y-3">
            <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Validade</h4>
            <div className="space-y-2">
              <Label>Início da validade</Label>
              <Input
                type="datetime-local"
                value={validFrom}
                onChange={(e) => setValidFrom(e.target.value)}
              />
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={hasExpiration} onCheckedChange={setHasExpiration} />
              <Label className="font-normal">Definir data de expiração</Label>
            </div>
            {hasExpiration && (
              <div className="space-y-2">
                <Label>Expiração</Label>
                <Input
                  type="datetime-local"
                  value={validUntil}
                  onChange={(e) => setValidUntil(e.target.value)}
                />
              </div>
            )}
          </div>

          <Separator />

          {/* Applicability */}
          <div className="space-y-3">
            <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Aplicavel a</h4>
            <Select value={appliesTo} onValueChange={(v) => setAppliesTo(v as CouponAppliesTo)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all_products">Todos os produtos</SelectItem>
                <SelectItem value="specific_products">Produtos específicos</SelectItem>
                <SelectItem value="specific_categories">Categorias específicas</SelectItem>
              </SelectContent>
            </Select>

            {appliesTo === 'specific_products' && (
              <div className="space-y-2">
                <div className="max-h-40 overflow-y-auto border rounded-md p-2 space-y-1">
                  {products.length === 0 ? (
                    <p className="text-xs text-muted-foreground py-2 text-center">Nenhum produto encontrado</p>
                  ) : (
                    products.map(p => (
                      <label key={p.id} className="flex items-center gap-2 py-1 px-1 hover:bg-muted/50 rounded cursor-pointer">
                        <Checkbox
                          checked={selectedProductIds.includes(p.id)}
                          onCheckedChange={(checked) => {
                            setSelectedProductIds(prev =>
                              checked ? [...prev, p.id] : prev.filter(id => id !== p.id)
                            );
                            if (errors.products) setErrors(prev => ({ ...prev, products: '' }));
                          }}
                        />
                        <span className="text-sm truncate">{p.title}</span>
                      </label>
                    ))
                  )}
                </div>
                {selectedProductIds.length > 0 && (
                  <p className="text-xs text-muted-foreground">{selectedProductIds.length} produto(s) selecionado(s)</p>
                )}
                {errors.products && <p className="text-xs text-destructive">{errors.products}</p>}
              </div>
            )}

            {appliesTo === 'specific_categories' && (
              <div className="space-y-2">
                <div className="max-h-40 overflow-y-auto border rounded-md p-2 space-y-1">
                  {categories.length === 0 ? (
                    <p className="text-xs text-muted-foreground py-2 text-center">Nenhuma categoria encontrada</p>
                  ) : (
                    categories.map(cat => (
                      <label key={cat} className="flex items-center gap-2 py-1 px-1 hover:bg-muted/50 rounded cursor-pointer">
                        <Checkbox
                          checked={selectedCategoryNames.includes(cat)}
                          onCheckedChange={(checked) => {
                            setSelectedCategoryNames(prev =>
                              checked ? [...prev, cat] : prev.filter(c => c !== cat)
                            );
                            if (errors.categories) setErrors(prev => ({ ...prev, categories: '' }));
                          }}
                        />
                        <span className="text-sm">{cat}</span>
                      </label>
                    ))
                  )}
                </div>
                {selectedCategoryNames.length > 0 && (
                  <p className="text-xs text-muted-foreground">{selectedCategoryNames.length} categoria(s) selecionada(s)</p>
                )}
                {errors.categories && <p className="text-xs text-destructive">{errors.categories}</p>}
              </div>
            )}
          </div>

          <Separator />

          {/* Status */}
          <div className="flex items-center justify-between">
            <div>
              <Label>Cupom ativo</Label>
              <p className="text-xs text-muted-foreground">O cupom pode ser usado imediatamente</p>
            </div>
            <Switch checked={isActive} onCheckedChange={setIsActive} />
          </div>

          {/* Preview */}
          {previewText && (
            <div className="bg-muted/50 rounded-lg p-3">
              <p className="text-xs font-medium text-muted-foreground mb-1">Preview</p>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="font-mono">{code || '???'}</Badge>
                <span className="text-sm">{previewText}</span>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2 pt-2">
            <Button variant="outline" className="flex-1" onClick={() => onOpenChange(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button className="flex-1" onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              {isEditing ? 'Salvar' : 'Criar Cupom'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
