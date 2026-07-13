import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { Loader as Loader2, Package } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

interface InventoryState {
  enableInventory: boolean;
  showStockOnStorefront: boolean;
  autoDeductStock: boolean;
  blockZeroStock: boolean;
  reservationMinutes: number;
}

export default function InventorySettingsContent() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [state, setState] = useState<InventoryState>({
    enableInventory: true,
    showStockOnStorefront: true,
    autoDeductStock: true,
    blockZeroStock: false,
    reservationMinutes: 15,
  });
  const [showDisableDialog, setShowDisableDialog] = useState(false);
  const [settingsId, setSettingsId] = useState<string | null>(null);

  useEffect(() => {
    if (!user?.id) return;

    const fetchSettings = async () => {
      const { data, error } = await supabase
        .from('user_storefront_settings')
        .select('id, settings')
        .eq('user_id', user.id)
        .maybeSingle();

      if (!error && data) {
        setSettingsId(data.id);
        setState({
          enableInventory: data.settings?.enableInventory ?? false,
          showStockOnStorefront: data.settings?.showStockOnStorefront ?? false,
          autoDeductStock: data.settings?.autoDeductStock ?? true,
          blockZeroStock: data.settings?.blockZeroStock ?? false,
          reservationMinutes: data.settings?.reservationMinutes ?? 15,
        });
      }
      setLoading(false);
    };

    fetchSettings();
  }, [user?.id]);

  const handleSave = async (newState: InventoryState) => {
    if (!user?.id) return;
    setSaving(true);

    try {
      if (settingsId) {
        const { data: current } = await supabase
          .from('user_storefront_settings')
          .select('settings')
          .eq('id', settingsId)
          .maybeSingle();

        const updatedSettings = {
          ...(current?.settings || {}),
          enableInventory: newState.enableInventory,
          showStockOnStorefront: newState.showStockOnStorefront,
          autoDeductStock: newState.autoDeductStock,
          blockZeroStock: newState.blockZeroStock,
          reservationMinutes: newState.reservationMinutes,
        };

        const { error } = await supabase
          .from('user_storefront_settings')
          .update({ settings: updatedSettings })
          .eq('id', settingsId);

        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from('user_storefront_settings')
          .insert({
            user_id: user.id,
            settings: {
              enableInventory: newState.enableInventory,
              showStockOnStorefront: newState.showStockOnStorefront,
              autoDeductStock: newState.autoDeductStock,
              blockZeroStock: newState.blockZeroStock,
              reservationMinutes: newState.reservationMinutes,
            },
          })
          .select('id')
          .maybeSingle();

        if (error) throw error;
        if (data) setSettingsId(data.id);
      }

      setState(newState);
      toast.success('Configuracoes de estoque salvas');
    } catch (error) {
      console.error('Error saving inventory settings:', error);
      toast.error('Erro ao salvar configuracoes');
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = (key: keyof InventoryState, checked: boolean) => {
    if (key === 'enableInventory' && !checked && state.enableInventory) {
      setShowDisableDialog(true);
      return;
    }

    const newState = { ...state, [key]: checked };
    if (key === 'enableInventory' && !checked) {
      newState.showStockOnStorefront = false;
    }
    handleSave(newState);
  };

  const handleConfirmDisable = async () => {
    setShowDisableDialog(false);
    await handleSave({
      ...state,
      enableInventory: false,
      showStockOnStorefront: false,
    });

    if (user?.id) {
      await supabase
        .from('products')
        .update({ track_inventory: false, stock_quantity: null })
        .eq('user_id', user.id)
        .eq('track_inventory', true);
    }
  };

  const handleReservationChange = (value: string) => {
    const minutes = parseInt(value);
    handleSave({ ...state, reservationMinutes: minutes });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Package className="h-5 w-5 text-muted-foreground" />
            <CardTitle>Controle de Estoque</CardTitle>
          </div>
          <CardDescription>
            Gerencie a quantidade de produtos disponíveis na sua loja. Esta funcionalidade é opcional e pode ser desativada a qualquer momento sem perder dados.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-row items-center justify-between rounded-lg border p-4">
            <div className="space-y-0.5">
              <p className="text-sm font-medium">Gerenciar estoque dos produtos</p>
              <p className="text-xs text-muted-foreground">
                Ativa a opção de controlar quantidade em cada produto individualmente
              </p>
            </div>
            <Switch
              checked={state.enableInventory}
              onCheckedChange={(checked) => handleToggle('enableInventory', checked)}
              disabled={saving}
            />
          </div>

          {state.enableInventory && (
            <>
              <div className="flex flex-row items-center justify-between rounded-lg border p-4">
                <div className="space-y-0.5">
                  <p className="text-sm font-medium">Mostrar estoque na vitrine</p>
                  <p className="text-xs text-muted-foreground">
                    Exibe a quantidade disponível para o cliente na página do produto. Produtos com estoque baixo sempre mostram "Últimas unidades" independente desta configuração.
                  </p>
                </div>
                <Switch
                  checked={state.showStockOnStorefront}
                  onCheckedChange={(checked) => handleToggle('showStockOnStorefront', checked)}
                  disabled={saving}
                />
              </div>

              <div className="flex flex-row items-center justify-between rounded-lg border p-4">
                <div className="space-y-0.5">
                  <p className="text-sm font-medium">Dedução automática de estoque</p>
                  <p className="text-xs text-muted-foreground">
                    Reduz o estoque automaticamente quando um pedido é criado. Se desativado, você decide manualmente quando reduzir.
                  </p>
                </div>
                <Switch
                  checked={state.autoDeductStock}
                  onCheckedChange={(checked) => handleToggle('autoDeductStock', checked)}
                  disabled={saving}
                />
              </div>

              <div className="flex flex-row items-center justify-between rounded-lg border p-4">
                <div className="space-y-0.5">
                  <p className="text-sm font-medium">Bloquear venda com estoque zerado</p>
                  <p className="text-xs text-muted-foreground">
                    Impede que clientes adicionem ao carrinho produtos sem estoque disponível. Se desativado, clientes podem contatar via WhatsApp para consultar.
                  </p>
                </div>
                <Switch
                  checked={state.blockZeroStock}
                  onCheckedChange={(checked) => handleToggle('blockZeroStock', checked)}
                  disabled={saving}
                />
              </div>

              <div className="flex flex-row items-center justify-between rounded-lg border p-4">
                <div className="space-y-0.5">
                  <p className="text-sm font-medium">Tempo de reserva do carrinho</p>
                  <p className="text-xs text-muted-foreground">
                    Quanto tempo um item fica reservado no carrinho antes de ser liberado para outros clientes.
                  </p>
                </div>
                <Select
                  value={String(state.reservationMinutes)}
                  onValueChange={handleReservationChange}
                  disabled={saving}
                >
                  <SelectTrigger className="w-[120px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="5">5 min</SelectItem>
                    <SelectItem value="10">10 min</SelectItem>
                    <SelectItem value="15">15 min</SelectItem>
                    <SelectItem value="30">30 min</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={showDisableDialog} onOpenChange={setShowDisableDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Desativar controle de estoque?</AlertDialogTitle>
            <AlertDialogDescription>
              Os dados de estoque dos seus produtos serão preservados, mas o controle automático será pausado. Badges de estoque não aparecerão mais na vitrine. Produtos que estejam com estoque zerado continuarão com o status atual.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmDisable}>
              Desativar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
