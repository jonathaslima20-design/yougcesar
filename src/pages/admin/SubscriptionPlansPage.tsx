import SubscriptionPlansManager from '@/components/admin/SubscriptionPlansManager';

export default function SubscriptionPlansPage() {
  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl page-title">Planos de Assinatura</h1>
        <p className="text-muted-foreground">Gerencie os planos disponíveis, preços e links de pagamento</p>
      </div>
      <SubscriptionPlansManager />
    </div>
  );
}
