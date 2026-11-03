import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Store } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';

interface ReturnInfo {
  email: string;
  store: string;
  at: number;
}

function readReturnInfo(): ReturnInfo | null {
  try {
    const raw = localStorage.getItem('vt_partner_return');
    if (!raw) return null;
    const info = JSON.parse(raw) as ReturnInfo;
    // A manager session opened more than 12h ago is stale.
    if (Date.now() - info.at > 12 * 3600 * 1000) {
      localStorage.removeItem('vt_partner_return');
      return null;
    }
    return info;
  } catch {
    return null;
  }
}

/** Shown in the merchant dashboard while a partner is managing the store through "Gerenciar loja". */
export default function PartnerManagingBanner() {
  const { signOut } = useAuth();
  const navigate = useNavigate();
  const [info, setInfo] = useState<ReturnInfo | null>(() => readReturnInfo());

  if (!info) return null;

  const backToPanel = async () => {
    try {
      localStorage.removeItem('vt_partner_return');
    } catch {
      /* ignore */
    }
    setInfo(null);
    await signOut();
    navigate('/partners/login', { replace: true, state: { email: info.email } });
  };

  return (
    <div className="bg-sky-600 text-white px-4 py-2 text-sm flex flex-col sm:flex-row sm:items-center justify-between gap-2">
      <span className="flex items-center gap-2">
        <Store className="h-4 w-4 shrink-0" />
        Você está gerenciando a loja <strong>{info.store}</strong> como parceiro.
      </span>
      <Button size="sm" variant="secondary" className="h-7" onClick={backToPanel}>
        Voltar ao painel Partners
      </Button>
    </div>
  );
}
