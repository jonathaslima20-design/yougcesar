import LandingTestimonialsManager from '@/components/admin/LandingTestimonialsManager';

export default function LandingTestimonialsPage() {
  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl page-title">Depoimentos da Landing</h1>
        <p className="text-muted-foreground">
          Gerencie os depoimentos de clientes exibidos na landing page pública. A seção só aparece quando houver ao menos um depoimento ativo.
        </p>
      </div>
      <LandingTestimonialsManager />
    </div>
  );
}
