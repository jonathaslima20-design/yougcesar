import { useEffect, useState } from 'react';
import { Palette, Loader, TriangleAlert as AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { fetchEletronicosThemeEnabled, saveEletronicosThemeEnabled } from '@/lib/platformThemeSettings';

export default function StorefrontThemesPage() {
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchEletronicosThemeEnabled().then((value) => {
      setEnabled(value);
      setLoading(false);
    });
  }, []);

  const handleToggle = async (checked: boolean) => {
    setSaving(true);
    try {
      await saveEletronicosThemeEnabled(checked);
      setEnabled(checked);
      toast.success(checked ? 'Tema Eletrônicos liberado para os lojistas' : 'Tema Eletrônicos ocultado dos lojistas');
    } catch (err: any) {
      console.error(err);
      toast.error('Erro ao salvar: ' + (err?.message || 'tente novamente'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="container mx-auto p-4 md:p-6 space-y-6 max-w-3xl">
      <div className="flex items-center gap-3">
        <Palette className="h-6 w-6" />
        <div>
          <h1 className="text-2xl font-bold">Temas da Vitrine</h1>
          <p className="text-sm text-muted-foreground">Controle quais temas de vitrine estão disponíveis para os lojistas.</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Tema Eletrônicos</CardTitle>
          <CardDescription>Interruptor geral, para todas as lojas.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {loading ? (
            <div className="flex items-center gap-2 py-2 text-muted-foreground">
              <Loader className="h-4 w-4 animate-spin" />
              <span className="text-sm">Carregando...</span>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between rounded-lg border p-3">
                <div className="space-y-0.5 pr-4">
                  <Label className="text-sm font-medium">Exibir o tema Eletrônicos para os lojistas</Label>
                  <p className="text-xs text-muted-foreground">
                    Quando desligado, o tema some da escolha de tema em Configurações e qualquer loja que já o tenha
                    selecionado passa a mostrar o tema Padrão. Nada é apagado: a escolha e a personalização do
                    lojista continuam salvas e voltam ao ligar de novo.
                  </p>
                </div>
                <Switch checked={enabled} onCheckedChange={handleToggle} disabled={saving} />
              </div>
              {!enabled && (
                <div className="flex items-start gap-2 rounded-md bg-amber-500/10 border border-amber-500/20 px-3 py-2.5 text-sm text-amber-700">
                  <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                  <span>Desligado agora. Administradores ainda veem o tema no painel para poder configurá-lo, mas as vitrines públicas mostram o Padrão.</span>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
