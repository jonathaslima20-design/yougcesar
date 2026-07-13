import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { CreditCard as Edit, Trash2, Plus, Check } from 'lucide-react';
import type { SubscriptionPlan } from '@/types';
import { formatCurrencyI18n } from '@/lib/i18n';

export default function SubscriptionPlansManager() {
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<SubscriptionPlan | null>(null);

  const [editForm, setEditForm] = useState({
    name: '',
    duration: 'Mensal' as 'Mensal' | 'Trimestral' | 'Semestral' | 'Anual',
    price: 0,
    is_active: true,
    display_order: 0,
  });

  const [createForm, setCreateForm] = useState({
    name: '',
    duration: 'Mensal' as 'Mensal' | 'Trimestral' | 'Semestral' | 'Anual',
    price: 0,
    is_active: true,
    display_order: 0,
  });

  useEffect(() => {
    fetchPlans();
  }, []);

  const fetchPlans = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('subscription_plans')
        .select('*')
        .order('display_order', { ascending: true });

      if (error) throw error;
      setPlans(data || []);
    } catch (error) {
      console.error('Error fetching plans:', error);
      toast.error('Erro ao carregar planos');
    } finally {
      setLoading(false);
    }
  };

  const handleEditClick = (plan: SubscriptionPlan) => {
    setSelectedPlan(plan);
    setEditForm({
      name: plan.name,
      duration: plan.duration,
      price: plan.price,
      is_active: plan.is_active,
      display_order: plan.display_order,
    });
    setIsEditDialogOpen(true);
  };

  const handleUpdatePlan = async () => {
    if (!selectedPlan) return;

    if (!editForm.name.trim()) {
      toast.error('Nome do plano é obrigatório');
      return;
    }

    if (editForm.price <= 0) {
      toast.error('Preço deve ser maior que 0');
      return;
    }

    setIsUpdating(true);
    try {
      const { error } = await supabase
        .from('subscription_plans')
        .update({
          name: editForm.name,
          duration: editForm.duration,
          price: editForm.price,
          is_active: editForm.is_active,
          display_order: editForm.display_order,
          updated_at: new Date().toISOString(),
        })
        .eq('id', selectedPlan.id);

      if (error) throw error;

      toast.success('Plano atualizado com sucesso');
      setIsEditDialogOpen(false);
      setSelectedPlan(null);
      fetchPlans();
    } catch (error) {
      console.error('Error updating plan:', error);
      toast.error('Erro ao atualizar plano');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleDeletePlan = async (planId: string) => {
    setIsUpdating(true);
    try {
      const { error } = await supabase
        .from('subscription_plans')
        .delete()
        .eq('id', planId);

      if (error) throw error;

      toast.success('Plano deletado com sucesso');
      fetchPlans();
    } catch (error) {
      console.error('Error deleting plan:', error);
      toast.error('Erro ao deletar plano');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleToggleActive = async (plan: SubscriptionPlan) => {
    setIsUpdating(true);
    try {
      const { error } = await supabase
        .from('subscription_plans')
        .update({
          is_active: !plan.is_active,
          updated_at: new Date().toISOString(),
        })
        .eq('id', plan.id);

      if (error) throw error;

      toast.success(
        !plan.is_active
          ? 'Plano ativado com sucesso'
          : 'Plano desativado com sucesso'
      );
      fetchPlans();
    } catch (error) {
      console.error('Error toggling plan status:', error);
      toast.error('Erro ao atualizar status do plano');
    } finally {
      setIsUpdating(false);
    }
  };



  const handleCreatePlan = async () => {
    if (!createForm.name.trim()) {
      toast.error('Nome do plano é obrigatório');
      return;
    }

    if (createForm.price <= 0) {
      toast.error('Preço deve ser maior que 0');
      return;
    }

    setIsUpdating(true);
    try {
      const { error } = await supabase
        .from('subscription_plans')
        .insert({
          name: createForm.name,
          duration: createForm.duration,
          price: createForm.price,
          is_active: createForm.is_active,
          display_order: createForm.display_order,
        });

      if (error) throw error;

      toast.success('Plano criado com sucesso');
      setIsCreateDialogOpen(false);
      setCreateForm({
        name: '',
        duration: 'Mensal',
        price: 0,
        is_active: true,
        display_order: 0,
      });
      fetchPlans();
    } catch (error) {
      console.error('Error creating plan:', error);
      toast.error('Erro ao criar plano');
    } finally {
      setIsUpdating(false);
    }
  };

  const getDurationLabel = (duration: string) => {
    switch (duration) {
      case 'Mensal':
        return 'Mensal (1 mês)';
      case 'Trimestral':
        return 'Trimestral (3 meses)';
      case 'Semestral':
        return 'Semestral (6 meses)';
      case 'Anual':
        return 'Anual (12 meses)';
      default:
        return duration;
    }
  };

  const getDurationColor = (duration: string) => {
    switch (duration) {
      case 'Mensal':
        return 'bg-blue-100 text-blue-800';
      case 'Trimestral':
        return 'bg-green-100 text-green-800';
      case 'Semestral':
        return 'bg-purple-100 text-purple-800';
      case 'Anual':
        return 'bg-yellow-100 text-yellow-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Planos de Assinatura</CardTitle>
              <CardDescription>
                Gerencie os planos disponíveis e configure os links de pagamento
              </CardDescription>
            </div>
            <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Criar Novo Plano
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>Criar Novo Plano</DialogTitle>
                  <DialogDescription>
                    Adicione um novo plano de assinatura ao sistema
                  </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="create-plan-name">Nome do Plano</Label>
                    <Input
                      id="create-plan-name"
                      value={createForm.name}
                      onChange={(e) =>
                        setCreateForm({ ...createForm, name: e.target.value })
                      }
                      placeholder="Ex: Plano Trimestral"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="create-plan-duration">Duração</Label>
                    <Select
                      value={createForm.duration}
                      onValueChange={(value) =>
                        setCreateForm({
                          ...createForm,
                          duration: value as 'Mensal' | 'Trimestral' | 'Semestral' | 'Anual',
                        })
                      }
                    >
                      <SelectTrigger id="create-plan-duration">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Mensal">
                          Mensal (1 mês)
                        </SelectItem>
                        <SelectItem value="Trimestral">
                          Trimestral (3 meses)
                        </SelectItem>
                        <SelectItem value="Semestral">
                          Semestral (6 meses)
                        </SelectItem>
                        <SelectItem value="Anual">
                          Anual (12 meses)
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="create-plan-price">Preço (R$)</Label>
                    <Input
                      id="create-plan-price"
                      type="number"
                      step="0.01"
                      min="0"
                      value={createForm.price}
                      onChange={(e) =>
                        setCreateForm({
                          ...createForm,
                          price: parseFloat(e.target.value) || 0,
                        })
                      }
                      placeholder="0.00"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="create-plan-order">Ordem de Exibição</Label>
                    <Input
                      id="create-plan-order"
                      type="number"
                      min="0"
                      value={createForm.display_order}
                      onChange={(e) =>
                        setCreateForm({
                          ...createForm,
                          display_order: parseInt(e.target.value) || 0,
                        })
                      }
                    />
                  </div>

                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="create-plan-active"
                      checked={createForm.is_active}
                      onChange={(e) =>
                        setCreateForm({
                          ...createForm,
                          is_active: e.target.checked,
                        })
                      }
                      className="h-4 w-4"
                    />
                    <Label htmlFor="create-plan-active" className="mb-0">
                      Plano ativo
                    </Label>
                  </div>
                </div>

                <DialogFooter>
                  <Button
                    variant="outline"
                    onClick={() => setIsCreateDialogOpen(false)}
                  >
                    Cancelar
                  </Button>
                  <Button
                    onClick={handleCreatePlan}
                    disabled={isUpdating}
                  >
                    {isUpdating ? 'Criando...' : 'Criar Plano'}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          {plans.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground mb-4">Nenhum plano cadastrado</p>
            </div>
          ) : (
            <div className="space-y-4">
              {plans.map((plan) => (
                <div
                  key={plan.id}
                  className="border rounded-lg p-4 hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 space-y-3">
                      <div className="flex items-center gap-3">
                        <h3 className="text-lg font-semibold">{plan.name}</h3>
                        <Badge
                          className={getDurationColor(plan.duration)}
                          variant="outline"
                        >
                          {getDurationLabel(plan.duration)}
                        </Badge>
                        <Badge
                          variant={plan.is_active ? 'default' : 'secondary'}
                        >
                          {plan.is_active ? 'Ativo' : 'Inativo'}
                        </Badge>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                        <div>
                          <span className="text-muted-foreground">Preço: </span>
                          <span className="font-semibold">
                            R$ {plan.price.toLocaleString('pt-BR', {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}
                          </span>
                        </div>

                        <div>
                          <span className="text-muted-foreground">Ordem: </span>
                          <span className="font-semibold">{plan.display_order}</span>
                        </div>

                        <div>
                          <span className="text-muted-foreground">Última atualização: </span>
                          <span className="font-semibold">
                            {new Date(plan.updated_at).toLocaleDateString('pt-BR')}
                          </span>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <div className="text-sm">
                          <span className="text-muted-foreground">Checkout: </span>
                          <span className="text-xs text-green-600 font-medium">Mercado Pago</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <Dialog open={isEditDialogOpen && selectedPlan?.id === plan.id} onOpenChange={setIsEditDialogOpen}>
                        <DialogTrigger asChild>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleEditClick(plan)}
                          >
                            <Edit className="h-4 w-4 mr-2" />
                            Editar
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-md">
                          <DialogHeader>
                            <DialogTitle>Editar Plano</DialogTitle>
                            <DialogDescription>
                              Modifique as informações do plano "{plan.name}"
                            </DialogDescription>
                          </DialogHeader>

                          <div className="space-y-4 py-4">
                            <div className="space-y-2">
                              <Label htmlFor="plan-name">Nome do Plano</Label>
                              <Input
                                id="plan-name"
                                value={editForm.name}
                                onChange={(e) =>
                                  setEditForm({ ...editForm, name: e.target.value })
                                }
                                placeholder="Ex: Plano Mensal"
                              />
                            </div>

                            <div className="space-y-2">
                              <Label htmlFor="plan-duration">Duração</Label>
                              <Select
                                value={editForm.duration}
                                onValueChange={(value) =>
                                  setEditForm({
                                    ...editForm,
                                    duration: value as 'Mensal' | 'Trimestral' | 'Semestral' | 'Anual',
                                  })
                                }
                              >
                                <SelectTrigger id="plan-duration">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="Mensal">
                                    Mensal (1 mês)
                                  </SelectItem>
                                  <SelectItem value="Trimestral">
                                    Trimestral (3 meses)
                                  </SelectItem>
                                  <SelectItem value="Semestral">
                                    Semestral (6 meses)
                                  </SelectItem>
                                  <SelectItem value="Anual">
                                    Anual (12 meses)
                                  </SelectItem>
                                </SelectContent>
                              </Select>
                            </div>

                            <div className="space-y-2">
                              <Label htmlFor="plan-price">Preço (R$)</Label>
                              <Input
                                id="plan-price"
                                type="number"
                                step="0.01"
                                min="0"
                                value={editForm.price}
                                onChange={(e) =>
                                  setEditForm({
                                    ...editForm,
                                    price: parseFloat(e.target.value),
                                  })
                                }
                                placeholder="0.00"
                              />
                            </div>

                            <div className="space-y-2">
                              <Label htmlFor="plan-order">Ordem de Exibição</Label>
                              <Input
                                id="plan-order"
                                type="number"
                                min="0"
                                value={editForm.display_order}
                                onChange={(e) =>
                                  setEditForm({
                                    ...editForm,
                                    display_order: parseInt(e.target.value),
                                  })
                                }
                              />
                            </div>

                            <div className="flex items-center gap-2">
                              <input
                                type="checkbox"
                                id="plan-active"
                                checked={editForm.is_active}
                                onChange={(e) =>
                                  setEditForm({
                                    ...editForm,
                                    is_active: e.target.checked,
                                  })
                                }
                                className="h-4 w-4"
                              />
                              <Label htmlFor="plan-active" className="mb-0">
                                Plano ativo
                              </Label>
                            </div>
                          </div>

                          <DialogFooter>
                            <Button
                              variant="outline"
                              onClick={() => setIsEditDialogOpen(false)}
                            >
                              Cancelar
                            </Button>
                            <Button
                              onClick={handleUpdatePlan}
                              disabled={isUpdating}
                            >
                              {isUpdating ? 'Salvando...' : 'Salvar Alterações'}
                            </Button>
                          </DialogFooter>
                        </DialogContent>
                      </Dialog>

                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            size="sm"
                            variant="destructive"
                            disabled={isUpdating}
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Deletar
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Deletar Plano</AlertDialogTitle>
                            <AlertDialogDescription>
                              Tem certeza que deseja deletar o plano "{plan.name}"?
                              Esta ação não pode ser desfeita.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => handleDeletePlan(plan.id)}
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            >
                              Deletar
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
