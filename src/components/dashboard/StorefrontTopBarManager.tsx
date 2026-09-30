import { useEffect, useRef, useState } from 'react';
import { Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useAuth } from '@/contexts/AuthContext';
import { useStorefrontAppearance } from '@/hooks/useStorefrontAppearance';
import { normalizeTopBarPhrase, type TopBarPhrase } from '@/lib/appearanceDefaults';
import { BannerLinkField } from '@/components/dashboard/BannerLinkField';

export function StorefrontTopBarManager() {
  const { user } = useAuth();
  const { appearance, loading, save } = useStorefrontAppearance(user?.id, 'eletronicos');
  const [busy, setBusy] = useState(false);
  // Local, authoritative copy of the phrases — each row has two fields (text on
  // blur, link on change) that can fire two `save()` calls close together; since
  // `save()` is a network round trip, an earlier call's response can land after a
  // later one's and stomp it (`setAppearance(prev => ({ ...prev, ...data }))`
  // always wins on whichever response arrives last). Deriving `phrases` straight
  // from `appearance.top_bar_phrases` was losing edits to that race. Keeping our
  // own copy — updated synchronously and always sent whole on every save — means
  // the UI (and each new save's payload) never depends on that response timing.
  const [phrases, setPhrases] = useState<TopBarPhrase[]>([]);
  const initialized = useRef(false);

  useEffect(() => {
    if (loading || initialized.current) return;
    initialized.current = true;
    setPhrases(appearance.top_bar_phrases.map(normalizeTopBarPhrase));
  }, [loading, appearance.top_bar_phrases]);

  if (loading) return null;

  const persist = (next: TopBarPhrase[]) => {
    setPhrases(next);
    save({ top_bar_phrases: next });
  };

  const updatePhrase = (index: number, patch: Partial<TopBarPhrase>) => {
    persist(phrases.map((p, i) => (i === index ? { ...p, ...patch } : p)));
  };

  const removePhrase = (index: number) => {
    persist(phrases.filter((_, i) => i !== index));
  };

  const addPhrase = () => {
    persist([...phrases, { text: '', link_url: null }]);
  };

  const toggleEnabled = async () => {
    setBusy(true);
    await save({ top_bar_enabled: !appearance.top_bar_enabled });
    setBusy(false);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <Label className="text-xs text-muted-foreground">Exibir frases</Label>
        <div className="flex items-center gap-1.5">
          <Switch checked={appearance.top_bar_enabled} onCheckedChange={toggleEnabled} disabled={busy} />
          <span className="text-xs text-muted-foreground">
            {appearance.top_bar_enabled ? 'Visível' : 'Oculta'}
          </span>
        </div>
      </div>
      {appearance.top_bar_enabled && (
        <div className="space-y-3">
          {phrases.length === 0 && (
            <p className="text-xs text-muted-foreground">
              Sem frases cadastradas — mostra "Fale com a gente pelo WhatsApp" por padrão.
            </p>
          )}
          {phrases.map((phrase, index) => (
            <div key={index} className="space-y-2 rounded-lg border p-3">
              <div className="flex items-center gap-2">
                <Input
                  defaultValue={phrase.text}
                  onBlur={(e) => updatePhrase(index, { text: e.target.value })}
                  placeholder="Ex: Frete grátis acima de R$ 200"
                  maxLength={120}
                  className="flex-1"
                />
                <Button type="button" variant="ghost" size="icon" onClick={() => removePhrase(index)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <BannerLinkField
                value={phrase.link_url}
                onChange={(v) => updatePhrase(index, { link_url: v })}
                label="Ao clicar nesta frase"
              />
            </div>
          ))}
          <Button type="button" variant="outline" size="sm" onClick={addPhrase}>
            <Plus className="mr-1.5 h-3.5 w-3.5" /> Adicionar frase
          </Button>
          {phrases.length > 1 && (
            <p className="text-xs text-muted-foreground">
              Com mais de uma frase, elas alternam automaticamente no topo da loja.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
