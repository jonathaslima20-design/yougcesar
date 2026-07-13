import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
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
import { format, addMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { CircleCheck as CheckCircle, Circle as XCircle, CreditCard as Edit, Plus, Calendar, DollarSign } from 'lucide-react';
import type { Subscription, SubscriptionStatus, PaymentStatus, BillingCycle } from '@/types';

interface SubscriptionManagementProps {
  subscription: Subscription | null;
  userId?: string;
  userName: string;
  currency?: string;
  onSubscriptionUpdate: () => void;
}

const getPriceLabel = (cycle: string) => {
  switch (cycle) {
    case 'monthly': return 'Valor Mensal';
    case 'quarterly': return 'Valor Trimestral';
    case 'semiannually': return 'Valor Semestral';
    case 'annually': return 'Valor Anual';
    default: return 'Valor do Plano';
  }
};

const getBillingCycleLabel = (cycle: string) => {
  switch (cycle) {
    case 'monthly': return 'Mensal';
    case 'quarterly': return 'Trimestral';
    case 'semiannually': return 'Semestral';
    case 'annually': return 'Anual';
    default: return cycle;
  }
};

const calculateNextPaymentDate = (startDate: string, cycle: BillingCycle): string => {
  const date = new Date(startDate);
  switch (cycle) {
    case 'monthly': return format(addMonths(date, 1), 'yyyy-MM-dd');
    case 'quarterly': return format(addMonths(date, 3), 'yyyy-MM-dd');
    case 'semiannually': return format(addMonths(date, 6), 'yyyy-MM-dd');
    case 'annually': return format(addMonths(date, 12), 'yyyy-MM-dd');
    default: return format(addMonths(date, 1), 'yyyy-MM-dd');
  }
};

const getStatusColor = (status: string) => {
  switch (status) {
    case 'active': return 'bg-green-500';
    case 'pending': return 'bg-yellow-500';
    case 'cancelled': return 'bg-red-500';
    case 'suspended': return 'bg-orange-500';
    default: return 'bg-gray-500';
  }
};

const getStatusLabel = (status: string) => {
  switch (status) {
    case 'active': return 'Ativo';
    case 'pending': return 'Pendente';
    case 'cancelled': return 'Cancelado';
    case 'suspended': return 'Suspenso';
    default: return status;
  }
};

const getPaymentStatusLabel = (status: string) => {
  switch (status) {
    case 'paid': return 'Pago';
    case 'pending': return 'Pendente';
    case 'overdue': return 'Vencido';
    default: return status;
  }
};

export default function SubscriptionManagement({
  subscription,
  userId,
  userName,
  currency = 'BRL',
  onSubscriptionUpdate,
}: SubscriptionManagementProps) {
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);

  const [editForm, setEditForm] = useState({
    plan_name: subscription?.plan_name || '',
    plan_price: subscription?.plan_price || 0,
    billing_cycle: (subscription?.billing_cycle as BillingCycle) || 'monthly',
    status: subscription?.status || 'pending',
    payment_status: subscription?.payment_status || 'pending',
    next_payment_date: subscription?.next_payment_date || '',
  });

  const [createForm, setCreateForm] = useState({
    plan_name: 'Plano Basico',
    plan_price: 29.90,
    billing_cycle: 'monthly' as BillingCycle,
    status: 'active' as SubscriptionStatus,
    payment_status: 'paid' as PaymentStatus,
    start_date: format(new Date(), 'yyyy-MM-dd'),
    next_payment_date: format(addMonths(new Date(), 1), 'yyyy-MM-dd'),
  });

  const [paymentForm, setPaymentForm] = useState({
    amount: subscription?.plan_price || 0,
    billing_cycle: (subscription?.billing_cycle as BillingCycle) || 'monthly',
    payment_method: 'pix' as string,
    payment_date: format(new Date(), 'yyyy-MM-dd'),
    notes: '',
  });

  const [planPrices, setPlanPrices] = useState<Record<string, number>>({});

  useEffect(() => {
    const fetchPlanPrices = async () => {
      const { data } = await supabase
        .from('subscription_plans')
        .select('duration, price')
        .eq('is_active', true);

      if (data) {
        const durationToCycle: Record<string, string> = {
          'Mensal': 'monthly',
          'Trimestral': 'quarterly',
          'Semestral': 'semiannually',
          'Anual': 'annually',
        };
        const prices: Record<string, number> = {};
        data.forEach((plan) => {
          const cycle = durationToCycle[plan.duration];
          if (cycle) prices[cycle] = plan.price;
        });
        setPlanPrices(prices);
      }
    };
    fetchPlanPrices();
  }, []);

  useEffect(() => {
    if (subscription) {
      setEditForm({
        plan_name: subscription.plan_name || '',
        plan_price: subscription.plan_price || 0,
        billing_cycle: (subscription.billing_cycle as BillingCycle) || 'monthly',
        status: subscription.status || 'pending',
        payment_status: subscription.payment_status || 'pending',
        next_payment_date: subscription.next_payment_date || '',
      });
      setPaymentForm(prev => ({
        ...prev,
        amount: subscription.plan_price || 0,
        billing_cycle: (subscription.billing_cycle as BillingCycle) || 'monthly',
      }));
    }
  }, [subscription]);

  const calculateEndDate = (billingCycle: string): string => {
    const now = new Date();
    switch (billingCycle) {
      case 'monthly': return format(addMonths(now, 1), 'yyyy-MM-dd');
      case 'quarterly': return format(addMonths(now, 3), 'yyyy-MM-dd');
      case 'semiannually': return format(addMonths(now, 6), 'yyyy-MM-dd');
      case 'annually': return format(addMonths(now, 12), 'yyyy-MM-dd');
      default: return format(addMonths(now, 1), 'yyyy-MM-dd');
    }
  };

  const handleToggleStatus = async () => {
    if (!subscription) return;

    const newStatus: SubscriptionStatus = subscription.status === 'active' ? 'suspended' : 'active';

    setIsUpdating(true);
    try {
      const newEndDate = newStatus === 'active'
        ? calculateEndDate(subscription.billing_cycle)
        : undefined;

      const subscriptionUpdate: Record<string, unknown> = {
        status: newStatus,
        payment_status: newStatus === 'active' ? 'paid' : subscription.payment_status,
      };
      if (newEndDate) {
        subscriptionUpdate.next_payment_date = newEndDate;
      }

      const { error } = await supabase
        .from('subscriptions')
        .update(subscriptionUpdate)
        .eq('id', subscription.id);

      if (error) throw error;

      const userUpdate: Record<string, unknown> = {
        plan_status: newStatus === 'active' ? 'active' : 'suspended',
        billing_cycle: subscription.billing_cycle,
      };
      if (newEndDate) {
        userUpdate.next_payment_date = newEndDate;
        userUpdate.subscription_end_date = newEndDate;
      }

      await supabase
        .from('users')
        .update(userUpdate)
        .eq('id', userId);

      toast.success(
        newStatus === 'active'
          ? 'Plano ativado com sucesso'
          : 'Plano suspenso com sucesso'
      );

      onSubscriptionUpdate();
    } catch (error) {
      console.error('Error toggling subscription status:', error);
      toast.error('Erro ao atualizar status do plano');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleTogglePaymentStatus = async () => {
    if (!subscription) return;

    const newPaymentStatus: PaymentStatus = subscription.payment_status === 'paid' ? 'pending' : 'paid';

    setIsUpdating(true);
    try {
      const { error } = await supabase
        .from('subscriptions')
        .update({ payment_status: newPaymentStatus })
        .eq('id', subscription.id);

      if (error) throw error;

      toast.success('Status de pagamento atualizado com sucesso');
      onSubscriptionUpdate();
    } catch (error) {
      console.error('Error toggling payment status:', error);
      toast.error('Erro ao atualizar status de pagamento');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleUpdateSubscription = async () => {
    if (!subscription || !userId) return;

    setIsUpdating(true);
    try {
      const { error } = await supabase
        .from('subscriptions')
        .update({
          plan_name: editForm.plan_name,
          plan_price: editForm.plan_price,
          billing_cycle: editForm.billing_cycle as BillingCycle,
          status: editForm.status,
          payment_status: editForm.payment_status,
          next_payment_date: editForm.next_payment_date,
        })
        .eq('id', subscription.id);

      if (error) throw error;

      await updateUserPlanStatus(userId, editForm.status as SubscriptionStatus);

      await supabase
        .from('users')
        .update({ billing_cycle: editForm.billing_cycle })
        .eq('id', userId);

      toast.success('Assinatura atualizada com sucesso');
      setIsEditDialogOpen(false);
      onSubscriptionUpdate();
    } catch (error) {
      console.error('Error updating subscription:', error);
      toast.error('Erro ao atualizar assinatura');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleCreateSubscription = async () => {
    if (!userId) {
      toast.error('ID do usuario nao encontrado');
      return;
    }

    setIsUpdating(true);
    try {
      const { error } = await supabase
        .from('subscriptions')
        .insert({
          user_id: userId,
          plan_name: createForm.plan_name,
          plan_price: createForm.plan_price,
          billing_cycle: createForm.billing_cycle as BillingCycle,
          status: createForm.status,
          payment_status: createForm.payment_status,
          start_date: createForm.start_date,
          next_payment_date: createForm.next_payment_date,
        });

      if (error) throw error;

      await updateUserPlanStatus(userId, createForm.status);

      await supabase
        .from('users')
        .update({ billing_cycle: createForm.billing_cycle })
        .eq('id', userId);

      toast.success('Assinatura criada com sucesso');
      setIsCreateDialogOpen(false);
      onSubscriptionUpdate();
    } catch (error) {
      console.error('Error creating subscription:', error);
      toast.error('Erro ao criar assinatura');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleRegisterPayment = async () => {
    if (!subscription || !userId) return;

    if (paymentForm.amount <= 0) {
      toast.error('Valor deve ser maior que 0');
      return;
    }

    setIsUpdating(true);
    try {
      const { error: paymentError } = await supabase
        .from('payments')
        .insert({
          subscription_id: subscription.id,
          amount: paymentForm.amount,
          payment_method: paymentForm.payment_method,
          payment_date: paymentForm.payment_date,
          status: 'completed',
          notes: paymentForm.notes || null,
        });

      if (paymentError) throw paymentError;

      const selectedCycle = paymentForm.billing_cycle;
      const newNextPaymentDate = calculateNextPaymentDate(
        paymentForm.payment_date,
        selectedCycle
      );

      const planNameMap: Record<string, string> = {
        monthly: 'Plano Mensal',
        quarterly: 'Plano Trimestral',
        semiannually: 'Plano Semestral',
        annually: 'Plano Anual',
      };

      const { error: subError } = await supabase
        .from('subscriptions')
        .update({
          payment_status: 'paid',
          status: 'active',
          next_payment_date: newNextPaymentDate,
          billing_cycle: selectedCycle,
          plan_price: paymentForm.amount,
          plan_name: planNameMap[selectedCycle] || subscription.plan_name,
        })
        .eq('id', subscription.id);

      if (subError) throw subError;

      await supabase
        .from('users')
        .update({
          plan_status: 'active',
          billing_cycle: selectedCycle,
          next_payment_date: newNextPaymentDate,
          subscription_end_date: newNextPaymentDate,
        })
        .eq('id', userId);

      toast.success('Pagamento registrado com sucesso');
      setIsPaymentDialogOpen(false);
      setPaymentForm({
        amount: paymentForm.amount,
        billing_cycle: selectedCycle,
        payment_method: 'pix',
        payment_date: format(new Date(), 'yyyy-MM-dd'),
        notes: '',
      });
      onSubscriptionUpdate();
    } catch (error) {
      console.error('Error registering payment:', error);
      toast.error('Erro ao registrar pagamento');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleCancelSubscription = async () => {
    if (!subscription) return;

    setIsUpdating(true);
    try {
      const { error } = await supabase
        .from('subscriptions')
        .update({ status: 'cancelled' })
        .eq('id', subscription.id);

      if (error) throw error;

      await updateUserPlanStatus(userId, 'cancelled');

      toast.success('Assinatura cancelada com sucesso');
      onSubscriptionUpdate();
    } catch (error) {
      console.error('Error canceling subscription:', error);
      toast.error('Erro ao cancelar assinatura');
    } finally {
      setIsUpdating(false);
    }
  };

  const updateUserPlanStatus = async (userId: string | undefined, subscriptionStatus: SubscriptionStatus) => {
    if (!userId) return;

    let planStatus: 'active' | 'free' | 'expired' | 'suspended' = 'free';

    if (subscriptionStatus === 'active') {
      planStatus = 'active';
    } else if (subscriptionStatus === 'suspended') {
      planStatus = 'suspended';
    } else if (subscriptionStatus === 'cancelled') {
      planStatus = 'expired';
    }

    const { error } = await supabase
      .from('users')
      .update({ plan_status: planStatus })
      .eq('id', userId);

    if (error) {
      console.error('Error updating user plan_status:', error);
    }
  };

  if (!subscription) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Assinatura</CardTitle>
          <CardDescription>
            Este usuario nao possui assinatura ativa
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Criar Assinatura
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Criar Assinatura</DialogTitle>
                <DialogDescription>
                  Crie uma nova assinatura para {userName}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="create-billing-cycle">Periodicidade do Plano</Label>
                  <Select
                    value={createForm.billing_cycle}
                    onValueChange={(value) => {
                      const newCycle = value as BillingCycle;
                      setCreateForm({
                        ...createForm,
                        billing_cycle: newCycle,
                        next_payment_date: calculateNextPaymentDate(createForm.start_date, newCycle)
                      });
                    }}
                  >
                    <SelectTrigger id="create-billing-cycle">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="monthly">Mensal</SelectItem>
                      <SelectItem value="quarterly">Trimestral (3 meses)</SelectItem>
                      <SelectItem value="semiannually">Semestral (6 meses)</SelectItem>
                      <SelectItem value="annually">Anual (12 meses)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="create-plan-price">{getPriceLabel(createForm.billing_cycle)}</Label>
                  <Input
                    id="create-plan-price"
                    type="number"
                    step="0.01"
                    value={createForm.plan_price}
                    onChange={(e) => setCreateForm({ ...createForm, plan_price: parseFloat(e.target.value) || 0 })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="create-status">Status</Label>
                  <Select
                    value={createForm.status}
                    onValueChange={(value) => setCreateForm({ ...createForm, status: value as SubscriptionStatus })}
                  >
                    <SelectTrigger id="create-status">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Ativo</SelectItem>
                      <SelectItem value="pending">Pendente</SelectItem>
                      <SelectItem value="suspended">Suspenso</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="create-payment-status">Status de Pagamento</Label>
                  <Select
                    value={createForm.payment_status}
                    onValueChange={(value) => setCreateForm({ ...createForm, payment_status: value as PaymentStatus })}
                  >
                    <SelectTrigger id="create-payment-status">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="paid">Pago</SelectItem>
                      <SelectItem value="pending">Pendente</SelectItem>
                      <SelectItem value="overdue">Vencido</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="create-next-payment">Proximo Pagamento</Label>
                  <Input
                    id="create-next-payment"
                    type="date"
                    value={createForm.next_payment_date}
                    onChange={(e) => setCreateForm({ ...createForm, next_payment_date: e.target.value })}
                  />
                </div>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button onClick={handleCreateSubscription} disabled={isUpdating}>
                  {isUpdating ? 'Criando...' : 'Criar Assinatura'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Gerenciar Assinatura</CardTitle>
            <CardDescription>
              Controle a assinatura do usuario
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <Dialog open={isPaymentDialogOpen} onOpenChange={setIsPaymentDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm">
                  <DollarSign className="h-4 w-4 mr-2" />
                  Registrar Pagamento
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>Registrar Pagamento</DialogTitle>
                  <DialogDescription>
                    Registre um pagamento manual para {userName}. A data do proximo pagamento sera recalculada automaticamente.
                  </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="payment-billing-cycle">Plano (Periodicidade)</Label>
                    <Select
                      value={paymentForm.billing_cycle}
                      onValueChange={(value) => {
                        const newCycle = value as BillingCycle;
                        const newAmount = planPrices[newCycle] ?? paymentForm.amount;
                        setPaymentForm({ ...paymentForm, billing_cycle: newCycle, amount: newAmount });
                      }}
                    >
                      <SelectTrigger id="payment-billing-cycle">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="monthly">Mensal</SelectItem>
                        <SelectItem value="quarterly">Trimestral (3 meses)</SelectItem>
                        <SelectItem value="semiannually">Semestral (6 meses)</SelectItem>
                        <SelectItem value="annually">Anual (12 meses)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="payment-amount">{getPriceLabel(paymentForm.billing_cycle)}</Label>
                    <Input
                      id="payment-amount"
                      type="number"
                      step="0.01"
                      min="0.01"
                      value={paymentForm.amount}
                      onChange={(e) => setPaymentForm({ ...paymentForm, amount: parseFloat(e.target.value) || 0 })}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="payment-method">Metodo de Pagamento</Label>
                    <Select
                      value={paymentForm.payment_method}
                      onValueChange={(value) => setPaymentForm({ ...paymentForm, payment_method: value })}
                    >
                      <SelectTrigger id="payment-method">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pix">PIX</SelectItem>
                        <SelectItem value="credit_card">Cartao de Credito</SelectItem>
                        <SelectItem value="debit_card">Cartao de Debito</SelectItem>
                        <SelectItem value="transfer">Transferencia</SelectItem>
                        <SelectItem value="cash">Dinheiro</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="payment-date">Data do Pagamento</Label>
                    <Input
                      id="payment-date"
                      type="date"
                      value={paymentForm.payment_date}
                      onChange={(e) => setPaymentForm({ ...paymentForm, payment_date: e.target.value })}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="payment-notes">Observacoes (opcional)</Label>
                    <Textarea
                      id="payment-notes"
                      value={paymentForm.notes}
                      onChange={(e) => setPaymentForm({ ...paymentForm, notes: e.target.value })}
                      placeholder="Ex: Pagamento via transferencia bancaria"
                      rows={2}
                    />
                  </div>

                  <div className="rounded-lg bg-muted/50 p-3 text-sm">
                    <p className="text-muted-foreground">
                      Proximo pagamento sera calculado como: <strong>{format(new Date(paymentForm.payment_date || new Date()), 'dd/MM/yyyy', { locale: ptBR })}</strong> + {getBillingCycleLabel(paymentForm.billing_cycle).toLowerCase()} = <strong>{format(new Date(calculateNextPaymentDate(paymentForm.payment_date || format(new Date(), 'yyyy-MM-dd'), paymentForm.billing_cycle)), 'dd/MM/yyyy', { locale: ptBR })}</strong>
                    </p>
                  </div>
                </div>

                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsPaymentDialogOpen(false)}>
                    Cancelar
                  </Button>
                  <Button onClick={handleRegisterPayment} disabled={isUpdating}>
                    {isUpdating ? 'Registrando...' : 'Registrar Pagamento'}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm">
                  <Edit className="h-4 w-4 mr-2" />
                  Editar
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>Editar Assinatura</DialogTitle>
                  <DialogDescription>
                    Atualize as informacoes da assinatura de {userName}
                  </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="edit-billing-cycle">Periodicidade do Plano</Label>
                    <Select
                      value={editForm.billing_cycle}
                      onValueChange={(value) => {
                        const planNameMap: Record<string, string> = {
                          monthly: 'Plano Mensal',
                          quarterly: 'Plano Trimestral',
                          semiannually: 'Plano Semestral',
                          annually: 'Plano Anual',
                        };
                        setEditForm({
                          ...editForm,
                          billing_cycle: value,
                          plan_name: planNameMap[value] || editForm.plan_name,
                        });
                      }}
                    >
                      <SelectTrigger id="edit-billing-cycle">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="monthly">Mensal</SelectItem>
                        <SelectItem value="quarterly">Trimestral (3 meses)</SelectItem>
                        <SelectItem value="semiannually">Semestral (6 meses)</SelectItem>
                        <SelectItem value="annually">Anual (12 meses)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="edit-plan-price">{getPriceLabel(editForm.billing_cycle)}</Label>
                    <Input
                      id="edit-plan-price"
                      type="number"
                      step="0.01"
                      value={editForm.plan_price}
                      onChange={(e) => setEditForm({ ...editForm, plan_price: parseFloat(e.target.value) || 0 })}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="edit-status">Status</Label>
                    <Select
                      value={editForm.status}
                      onValueChange={(value) => setEditForm({ ...editForm, status: value })}
                    >
                      <SelectTrigger id="edit-status">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="active">Ativo</SelectItem>
                        <SelectItem value="pending">Pendente</SelectItem>
                        <SelectItem value="suspended">Suspenso</SelectItem>
                        <SelectItem value="cancelled">Cancelado</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="edit-payment-status">Status de Pagamento</Label>
                    <Select
                      value={editForm.payment_status}
                      onValueChange={(value) => setEditForm({ ...editForm, payment_status: value })}
                    >
                      <SelectTrigger id="edit-payment-status">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="paid">Pago</SelectItem>
                        <SelectItem value="pending">Pendente</SelectItem>
                        <SelectItem value="overdue">Vencido</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="edit-next-payment">Proximo Pagamento</Label>
                    <Input
                      id="edit-next-payment"
                      type="date"
                      value={editForm.next_payment_date}
                      onChange={(e) => setEditForm({ ...editForm, next_payment_date: e.target.value })}
                    />
                  </div>
                </div>

                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
                    Cancelar
                  </Button>
                  <Button onClick={handleUpdateSubscription} disabled={isUpdating}>
                    {isUpdating ? 'Salvando...' : 'Salvar Alteracoes'}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="text-sm text-muted-foreground mb-1">Periodicidade</div>
              <Badge variant="outline">
                {getBillingCycleLabel(subscription.billing_cycle)}
              </Badge>
            </div>
            <div>
              <div className="text-sm text-muted-foreground mb-1">{getPriceLabel(subscription.billing_cycle)}</div>
              <div className="font-semibold">
                {new Intl.NumberFormat('pt-BR', {
                  style: 'currency',
                  currency: currency,
                }).format(subscription.plan_price)}
              </div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground mb-1">Status</div>
              <Badge className={getStatusColor(subscription.status)}>
                {getStatusLabel(subscription.status)}
              </Badge>
            </div>
            <div>
              <div className="text-sm text-muted-foreground mb-1">Status Pagamento</div>
              <Badge
                variant={
                  subscription.payment_status === 'paid' ? 'default' :
                  subscription.payment_status === 'overdue' ? 'destructive' :
                  'secondary'
                }
              >
                {getPaymentStatusLabel(subscription.payment_status)}
              </Badge>
            </div>
            <div>
              <div className="text-sm text-muted-foreground mb-1">Proximo Pagamento</div>
              <div className="font-semibold flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                {format(new Date(subscription.next_payment_date), 'dd/MM/yyyy', { locale: ptBR })}
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <div className="flex gap-2">
            <Button
              variant={subscription.status === 'active' ? 'destructive' : 'default'}
              onClick={handleToggleStatus}
              disabled={isUpdating}
              className="flex-1"
            >
              {subscription.status === 'active' ? (
                <>
                  <XCircle className="h-4 w-4 mr-2" />
                  Suspender Plano
                </>
              ) : (
                <>
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Ativar Plano
                </>
              )}
            </Button>

            <Button
              variant={subscription.payment_status === 'paid' ? 'outline' : 'default'}
              onClick={handleTogglePaymentStatus}
              disabled={isUpdating}
              className="flex-1"
            >
              {subscription.payment_status === 'paid' ? 'Marcar como Pendente' : 'Marcar como Pago'}
            </Button>
          </div>

          {subscription.status !== 'cancelled' && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" className="w-full">
                  Cancelar Assinatura
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Cancelar assinatura</AlertDialogTitle>
                  <AlertDialogDescription>
                    Tem certeza que deseja cancelar a assinatura de "{userName}"?
                    Esta acao nao pode ser desfeita.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Voltar</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleCancelSubscription}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    Sim, cancelar
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
