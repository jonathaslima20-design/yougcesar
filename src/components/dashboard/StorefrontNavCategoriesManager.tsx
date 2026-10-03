import { useState } from 'react';
import { toast } from 'sonner';
import { ArrowDown, ArrowUp, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { useAuth } from '@/contexts/AuthContext';
import { useStorefrontAppearance } from '@/hooks/useStorefrontAppearance';
import { useProductFilterMetadata } from '@/hooks/useProductFilterMetadata';

type NavRow = { category: string; order: number; enabled: boolean };

/**
 * Merges the saved menu list with the store's current categories: saved ones keep their
 * order, categories created since then are appended enabled. With nothing saved yet,
 * every category shows, alphabetically — the same starting point as the Vitrine.
 */
function buildRows(categories: string[], saved: NavRow[] | null): NavRow[] {
  const rows: NavRow[] = [];
  if (saved) {
    [...saved].sort((a, b) => a.order - b.order).forEach((s) => {
      if (categories.includes(s.category)) rows.push({ category: s.category, order: 0, enabled: s.enabled });
    });
  }
  categories.forEach((category) => {
    if (!rows.some((r) => r.category === category)) rows.push({ category, order: 0, enabled: true });
  });
  if (!saved) rows.sort((a, b) => a.category.localeCompare(b.category));
  return rows.map((r, order) => ({ ...r, order }));
}

/**
 * Dedicated control for the Eletrônicos menu bar ("Todas Categorias") and its drawer.
 * It doesn't touch the Vitrine's "Organização por Categorias": a store can show a
 * different list in the menu than in the home sections.
 */
export function StorefrontNavCategoriesManager() {
  const { user } = useAuth();
  const { appearance, loading: appearanceLoading, save } = useStorefrontAppearance(user?.id, 'eletronicos');
  const { metadata, loading: categoriesLoading } = useProductFilterMetadata({ userId: user?.id || '', enabled: !!user?.id });

  // Unsaved edits. null = show what's saved (or the default list when nothing is saved).
  const [draft, setDraft] = useState<NavRow[] | null>(null);
  const [saving, setSaving] = useState(false);

  const saved = appearance.nav_category_settings;
  const rows = draft ?? buildRows(metadata.categories || [], saved);
  const loading = appearanceLoading || categoriesLoading;

  const update = (next: NavRow[]) => setDraft(next.map((r, order) => ({ ...r, order })));

  const toggle = (index: number, enabled: boolean) => {
    update(rows.map((r, i) => (i === index ? { ...r, enabled } : r)));
  };

  const move = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= rows.length) return;
    const next = [...rows];
    [next[index], next[target]] = [next[target], next[index]];
    update(next);
  };

  const handleSave = async () => {
    setSaving(true);
    const ok = await save({ nav_category_settings: rows });
    setSaving(false);
    if (ok) {
      setDraft(null);
      toast.success('Menu de categorias atualizado');
    } else {
      toast.error('Erro ao salvar o menu de categorias');
    }
  };

  const handleUseVitrine = async () => {
    setSaving(true);
    const ok = await save({ nav_category_settings: null });
    setSaving(false);
    if (ok) {
      setDraft(null);
      toast.success('O menu voltou a seguir a Vitrine');
    } else {
      toast.error('Erro ao restaurar o menu');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
        <Loader2 className="h-4 w-4 animate-spin" /> Carregando categorias...
      </div>
    );
  }

  if (rows.length === 0) {
    return <p className="text-sm text-muted-foreground">Cadastre produtos com categorias para escolher o que aparece no menu.</p>;
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        {saved
          ? 'O menu usa esta lista própria. Alterações na Vitrine não mudam o menu.'
          : 'O menu segue a organização da Vitrine. Salve uma lista para escolher o menu separadamente.'}
      </p>

      <ul className="divide-y rounded-md border bg-background">
        {rows.map((row, index) => (
          <li key={row.category} className="flex items-center gap-3 px-3 py-2">
            <div className="flex flex-col">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={() => move(index, -1)}
                disabled={index === 0 || saving}
                aria-label={`Subir ${row.category}`}
              >
                <ArrowUp className="h-3.5 w-3.5" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={() => move(index, 1)}
                disabled={index === rows.length - 1 || saving}
                aria-label={`Descer ${row.category}`}
              >
                <ArrowDown className="h-3.5 w-3.5" />
              </Button>
            </div>
            <span className={`flex-1 text-sm ${row.enabled ? '' : 'text-muted-foreground line-through'}`}>{row.category}</span>
            <Switch
              checked={row.enabled}
              onCheckedChange={(v) => toggle(index, v)}
              disabled={saving}
              aria-label={`Mostrar ${row.category} no menu`}
            />
          </li>
        ))}
      </ul>

      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" size="sm" onClick={handleSave} disabled={draft === null || saving}>
          {saving && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
          Salvar menu
        </Button>
        {saved && (
          <Button type="button" size="sm" variant="outline" onClick={handleUseVitrine} disabled={saving}>
            Seguir a Vitrine
          </Button>
        )}
        {draft && (
          <Button type="button" size="sm" variant="ghost" onClick={() => setDraft(null)} disabled={saving}>
            Descartar alterações
          </Button>
        )}
      </div>
    </div>
  );
}
