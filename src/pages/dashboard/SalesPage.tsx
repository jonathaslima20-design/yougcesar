import { CreditCard, ShoppingBag } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';

export default function SalesPage() {
  const navigate = useNavigate();

  return (
    <div className="container mx-auto p-4 md:p-6 max-w-4xl">
      <div className="flex items-center gap-2 mb-6">
        <h1 className="text-2xl md:text-3xl page-title">Vendas Online</h1>
        <Badge variant="outline" className="text-xs">Em breve</Badge>
      </div>

      <Card>
        <CardContent className="flex flex-col items-center justify-center py-20 text-center">
          <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mb-6">
            <CreditCard className="h-8 w-8 text-muted-foreground" />
          </div>
          <h2 className="text-lg font-semibold mb-2">Vendas com pagamento integrado</h2>
          <p className="text-sm text-muted-foreground max-w-md mb-6">
            Em breve você poderá aceitar pagamentos automáticos diretamente na sua vitrine,
            com integração de meios de pagamento como Mercado Pago. Seus clientes poderão
            comprar sem precisar sair da sua loja.
          </p>
          <p className="text-sm text-muted-foreground max-w-md mb-8">
            Enquanto isso, utilize a seção de <strong>Pedidos</strong> para gerenciar
            as vendas recebidas via WhatsApp.
          </p>
          <Button variant="outline" onClick={() => navigate('/dashboard/orders')}>
            <ShoppingBag className="h-4 w-4 mr-2" />
            Ir para Pedidos
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
