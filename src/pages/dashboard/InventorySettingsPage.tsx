import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import InventorySettingsContent from '@/components/dashboard/InventorySettingsContent';

export default function InventorySettingsPage() {
  const navigate = useNavigate();

  return (
    <div className="w-full px-4 sm:px-6 lg:px-8 xl:px-12 2xl:px-16 py-6 space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate('/dashboard/inventory')}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl md:text-3xl page-title">Configurações de Estoque</h1>
          <p className="text-sm text-muted-foreground">Gerencie como o controle de estoque funciona na sua loja</p>
        </div>
      </div>

      <div className="max-w-2xl">
        <InventorySettingsContent />
      </div>
    </div>
  );
}
