import { useState } from 'react';
import { Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useAuth } from '@/contexts/AuthContext';
import { useStorefrontAppearance } from '@/hooks/useStorefrontAppearance';

export function StorefrontTopBarManager() {
  const { user } = useAuth();
  const { appearance, loading, save } = useStorefrontAppearance(user?.id, 'eletronicos');
  const [busy, setBusy] = useState(false);

  if (loading) return null;

  const phrases = appearance.top_bar_phrases;

  const updatePhrase = (index: number, value: string) => {
    const next = [...phrases];
    next[index] = value;
    save({ top_bar_phrases: next });
  };

  const removePhrase = (index: number) => {
    save({ top_bar_phrases: phrases.filter((_, i) => i !== index) });
  };

  const addPhrase = () => {
    save({ top_bar_phrases: [...phrases, ''] });
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
        <div className="space-y-2">
          {phrases.length === 0 && (
            <p className="text-xs text-muted-foreground">
              Sem frases cadastradas — mostra "Fale com a gente pelo WhatsApp" por padrão.
            </p>
          )}
          {phrases.map((phrase, index) => (
            <div key={index} className="flex items-center gap-2">
              <Input
                defaultValue={phrase}
                onBlur={(e) => updatePhrase(index, e.target.value)}
                placeholder="Ex: Frete grátis acima de R$ 200"
                maxLength={120}
              />
              <Button type="button" variant="ghost" size="icon" onClick={() => removePhrase(index)}>
                <X className="h-4 w-4" />
              </Button>
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
