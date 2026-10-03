import { useEffect, useState } from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/contexts/AuthContext';
import { useStorefrontAppearance } from '@/hooks/useStorefrontAppearance';
import type { StorefrontAppearance } from '@/lib/appearanceDefaults';

type SectionTitleKey = 'offers_title' | 'new_arrivals_title' | 'highlights_title';

// Long titles break the single-line carousel heading on phones.
const TITLE_MAX_LENGTH = 40;

/**
 * Title shown above a product carousel in the E-commerce theme. Saves on blur; an empty
 * value goes back to the default name (e.g. "Ofertas") on the storefront.
 */
export function SectionTitleField({ field, placeholder }: { field: SectionTitleKey; placeholder: string }) {
  const { user } = useAuth();
  const { appearance, loading, save } = useStorefrontAppearance(user?.id, 'eletronicos');
  const [title, setTitle] = useState('');

  useEffect(() => {
    if (!loading) setTitle(appearance[field] || '');
  }, [loading, appearance, field]);

  const handleBlur = async () => {
    const normalized = title.trim() || null;
    if (normalized === appearance[field]) return;
    const ok = await save({ [field]: normalized } as Partial<StorefrontAppearance>);
    if (!ok) setTitle(appearance[field] || '');
  };

  return (
    <div className="space-y-1.5 mb-4">
      <Label htmlFor={`title-${field}`} className="text-sm">Título da sessão</Label>
      <Input
        id={`title-${field}`}
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onBlur={handleBlur}
        placeholder={placeholder}
        maxLength={TITLE_MAX_LENGTH}
        disabled={loading}
      />
      <p className="text-xs text-muted-foreground">Deixe em branco para usar o nome padrão.</p>
    </div>
  );
}
