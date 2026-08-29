import { useState } from 'react';
import { toast } from 'sonner';
import { Loader as Loader2, CreditCard } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { supabase } from '@/lib/supabase';
import type { BillingCycle } from '@/lib/billing/stripePricing';

const STRIPE_CHECKOUT_ENDPOINT = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/stripe-checkout`;

function resolveCycle(rawCycle: string | null): BillingCycle {
  return rawCycle && /anual|annual/i.test(rawCycle) ? 'annual' : 'monthly';
}

interface StripeCheckoutRedirectProps {
  rawCycle: string | null;
}

/**
 * Tela mínima para assinantes fora do Brasil (Fase 1 — sem UI dedicada
 * ainda, isso vem na Fase 2 junto com a landing localizada). Cria a Stripe
 * Checkout Session e redireciona para o checkout hosted da Stripe.
 */
export default function StripeCheckoutRedirect({ rawCycle }: StripeCheckoutRedirectProps) {
  const [loading, setLoading] = useState(false);
  const cycle = resolveCycle(rawCycle);

  const handleContinue = async () => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const resp = await fetch(STRIPE_CHECKOUT_ENDPOINT, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session?.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ cycle }),
      });

      const data = await resp.json();
      if (!resp.ok || !data.url) {
        throw new Error(data.error || 'Falha ao iniciar pagamento');
      }

      window.location.href = data.url;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Falha ao iniciar pagamento');
      setLoading(false);
    }
  };

  return (
    <Card className="max-w-md mx-auto">
      <CardHeader>
        <CardTitle>Assinar plano {cycle === 'annual' ? 'anual' : 'mensal'}</CardTitle>
        <CardDescription>
          Você será redirecionado para o checkout seguro da Stripe.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Button className="w-full" onClick={handleContinue} disabled={loading}>
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <>
              <CreditCard className="h-4 w-4 mr-2" />
              Continuar para pagamento
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
