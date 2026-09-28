import { CreditCard, Truck, MessageCircle, ShieldCheck, Sparkles } from 'lucide-react';

const BENEFITS = [
  { icon: CreditCard, title: 'Parcelamento', subtitle: 'No cartão de crédito' },
  { icon: Truck, title: 'Envios', subtitle: 'Para todo o Brasil' },
  { icon: MessageCircle, title: 'Atendimento', subtitle: 'Direto pelo WhatsApp' },
  { icon: ShieldCheck, title: 'Compra segura', subtitle: 'Seus dados protegidos' },
  { icon: Sparkles, title: 'Novidades', subtitle: 'Toda semana' },
];

export default function BenefitsBar() {
  return (
    <div className="border-b bg-background">
      <div className="container mx-auto px-4 py-6">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-6">
          {BENEFITS.map(({ icon: Icon, title, subtitle }) => (
            <div key={title} className="flex flex-col items-center text-center gap-2">
              <Icon className="h-6 w-6 text-foreground" strokeWidth={1.5} />
              <div>
                <p className="text-sm font-semibold">{title}</p>
                <p className="text-xs text-muted-foreground">{subtitle}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
