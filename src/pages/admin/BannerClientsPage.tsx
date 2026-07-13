import BannerClientsManager from '@/components/admin/BannerClientsManager';

export default function BannerClientsPage() {
  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl page-title">Banner de Clientes</h1>
        <p className="text-muted-foreground">
          Configure os clientes exibidos no banner de prova social da página de planos. Cole a URL da página do corretor e os dados serão buscados automaticamente.
        </p>
      </div>
      <BannerClientsManager />
    </div>
  );
}
