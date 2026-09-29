import { useEffect, useState } from 'react';
import { Palette, Loader, TriangleAlert as AlertTriangle, X } from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { supabase } from '@/lib/supabase';
import {
  fetchPlatformThemeSettings,
  savePlatformThemeSettings,
  type PlatformThemeSettings,
} from '@/lib/platformThemeSettings';

interface AllowedUser {
  id: string;
  name: string | null;
  email: string | null;
}

export default function StorefrontThemesPage() {
  const [settings, setSettings] = useState<PlatformThemeSettings | null>(null);
  const [allowedUsers, setAllowedUsers] = useState<AllowedUser[]>([]);
  const [emailInput, setEmailInput] = useState('');
  const [saving, setSaving] = useState(false);

  const loadAllowedUsers = async (ids: string[]) => {
    if (ids.length === 0) {
      setAllowedUsers([]);
      return;
    }
    const { data } = await supabase.from('users').select('id, name, email').in('id', ids);
    setAllowedUsers((data || []) as AllowedUser[]);
  };

  useEffect(() => {
    fetchPlatformThemeSettings().then((value) => {
      setSettings(value);
      loadAllowedUsers(value.eletronicosAllowedUserIds);
    });
  }, []);

  const persist = async (next: PlatformThemeSettings, successMessage: string) => {
    setSaving(true);
    try {
      await savePlatformThemeSettings(next);
      setSettings(next);
      toast.success(successMessage);
      return true;
    } catch (err: any) {
      console.error(err);
      toast.error('Erro ao salvar: ' + (err?.message || 'tente novamente'));
      return false;
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = (checked: boolean) => {
    if (!settings) return;
    persist(
      { ...settings, eletronicosEnabled: checked },
      checked ? 'Tema Eletrônicos liberado para todos os lojistas' : 'Tema Eletrônicos ocultado dos lojistas'
    );
  };

  const handleAdd = async () => {
    if (!settings) return;
    const email = emailInput.trim().toLowerCase();
    if (!email) return;
    const { data, error } = await supabase.from('users').select('id, name, email').ilike('email', email).maybeSingle();
    if (error || !data) {
      toast.error('Nenhum usuário encontrado com esse e-mail');
      return;
    }
    if (settings.eletronicosAllowedUserIds.includes(data.id)) {
      toast.info('Esse usuário já tem acesso');
      return;
    }
    const ok = await persist(
      { ...settings, eletronicosAllowedUserIds: [...settings.eletronicosAllowedUserIds, data.id] },
      'Acesso liberado'
    );
    if (ok) {
      setAllowedUsers((prev) => [...prev, data as AllowedUser]);
      setEmailInput('');
    }
  };

  const handleRemove = async (user: AllowedUser) => {
    if (!settings) return;
    const ok = await persist(
      { ...settings, eletronicosAllowedUserIds: settings.eletronicosAllowedUserIds.filter((id) => id !== user.id) },
      'Acesso removido'
    );
    if (ok) setAllowedUsers((prev) => prev.filter((u) => u.id !== user.id));
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
          {!settings ? (
            <div className="flex items-center gap-2 py-2 text-muted-foreground">
              <Loader className="h-4 w-4 animate-spin" />
              <span className="text-sm">Carregando...</span>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between rounded-lg border p-3">
                <div className="space-y-0.5 pr-4">
                  <Label className="text-sm font-medium">Exibir o tema Eletrônicos para todos os lojistas</Label>
                  <p className="text-xs text-muted-foreground">
                    Quando desligado, o tema some da escolha de tema em Configurações e qualquer loja que já o tenha
                    selecionado passa a mostrar o tema Padrão, exceto as lojas liberadas abaixo. Nada é apagado: a
                    escolha e a personalização do lojista continuam salvas e voltam ao ligar de novo.
                  </p>
                </div>
                <Switch checked={settings.eletronicosEnabled} onCheckedChange={handleToggle} disabled={saving} />
              </div>
              {!settings.eletronicosEnabled && (
                <div className="flex items-start gap-2 rounded-md bg-amber-500/10 border border-amber-500/20 px-3 py-2.5 text-sm text-amber-700">
                  <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                  <span>Desligado para todos. Só as lojas liberadas abaixo veem e usam o tema. Administradores também o veem no painel, mas a vitrine pública deles mostra o Padrão.</span>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Lojas com acesso antecipado</CardTitle>
          <CardDescription>
            Estas lojas usam o tema Eletrônicos mesmo com o interruptor geral desligado.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {allowedUsers.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma loja liberada.</p>
          ) : (
            <div className="space-y-2">
              {allowedUsers.map((user) => (
                <div key={user.id} className="flex items-center justify-between rounded-lg border p-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{user.name || 'Sem nome'}</p>
                    <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => handleRemove(user)} disabled={saving}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}

          <div className="flex gap-2 pt-1">
            <Input
              type="email"
              placeholder="E-mail do lojista"
              value={emailInput}
              onChange={(e) => setEmailInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleAdd();
              }}
            />
            <Button onClick={handleAdd} disabled={saving || !emailInput.trim() || !settings}>
              Liberar
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
