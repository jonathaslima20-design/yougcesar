import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Loader2, Plus, Pencil, Trash2, Upload } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { deleteOperator, fetchOperators, saveOperator, uploadOperatorAvatar } from '@/lib/liveChat/adminService';
import { buildGreeting } from '@/lib/liveChat/format';
import type { LiveChatOperatorRow } from '@/lib/liveChat/types';

type Draft = Partial<LiveChatOperatorRow> & { display_name: string; role_title: string };

const EMPTY: Draft = { display_name: '', role_title: 'Consultora comercial', avatar_url: null, is_active: true, weight: 1 };
const MAX_AVATAR_BYTES = 200 * 1024;

export default function LiveChatOperatorsPage() {
  const [operators, setOperators] = useState<LiveChatOperatorRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = () =>
    fetchOperators()
      .then(setOperators)
      .catch((err) => {
        toast.error('Erro ao carregar operadores');
        console.error(err);
      })
      .finally(() => setLoading(false));

  useEffect(() => {
    load();
  }, []);

  const onFile = async (file: File | undefined) => {
    if (!file || !draft) return;
    if (!['image/webp', 'image/png', 'image/jpeg'].includes(file.type)) {
      toast.error('Use uma imagem WEBP, PNG ou JPG.');
      return;
    }
    if (file.size > MAX_AVATAR_BYTES) {
      toast.error('Imagem muito grande: máximo 200 KB (recomendado: 128×128 px em WEBP).');
      return;
    }
    setUploading(true);
    try {
      const url = await uploadOperatorAvatar(file);
      setDraft({ ...draft, avatar_url: url });
    } catch (err) {
      toast.error('Erro ao enviar a foto');
      console.error(err);
    } finally {
      setUploading(false);
    }
  };

  const save = async () => {
    if (!draft) return;
    if (!draft.display_name.trim()) {
      toast.error('Informe o nome do operador.');
      return;
    }
    setSaving(true);
    try {
      await saveOperator({ ...draft, display_name: draft.display_name.trim(), role_title: draft.role_title.trim() });
      toast.success('Operador salvo');
      setDraft(null);
      load();
    } catch (err) {
      toast.error('Erro ao salvar operador');
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const remove = async (op: LiveChatOperatorRow) => {
    if (!window.confirm(`Excluir ${op.display_name}? Conversas antigas continuam no histórico, sem a persona.`)) return;
    try {
      await deleteOperator(op.id);
      load();
    } catch {
      toast.error('Erro ao excluir operador');
    }
  };

  const toggleActive = async (op: LiveChatOperatorRow) => {
    try {
      await saveOperator({ ...op, is_active: !op.is_active });
      load();
    } catch {
      toast.error('Erro ao atualizar operador');
    }
  };

  const activeCount = operators.filter((o) => o.is_active).length;

  return (
    <div className="container mx-auto p-6 space-y-6 max-w-4xl">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">Operadores do Chat</h1>
          <p className="text-sm text-muted-foreground">
            Personas exibidas no chat da landing. Cada visitante recebe uma persona sorteada (pelo peso) e passa a ver
            sempre a mesma nas próximas visitas.
          </p>
        </div>
        <Button onClick={() => setDraft({ ...EMPTY })}>
          <Plus className="h-4 w-4 mr-2" /> Novo operador
        </Button>
      </div>

      <p className="text-xs text-muted-foreground rounded-md border bg-muted/40 p-3">
        Use ilustrações, avatares gerados ou fotos com autorização de uso. Nunca use foto de uma pessoa real sem
        consentimento.
      </p>

      {loading ? (
        <div className="h-40 flex items-center justify-center text-muted-foreground">Carregando…</div>
      ) : operators.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            Nenhum operador cadastrado. Sem operador, o chat aparece com a marca “VitrineTurbo”.
          </CardContent>
        </Card>
      ) : (
        <div className="grid sm:grid-cols-2 gap-4">
          {operators.map((op) => (
            <Card key={op.id} className={op.is_active ? '' : 'opacity-60'}>
              <CardContent className="p-4 flex gap-3 items-start">
                <Avatar className="h-12 w-12">
                  {op.avatar_url && <AvatarImage src={op.avatar_url} alt={op.display_name} />}
                  <AvatarFallback>{op.display_name.charAt(0)}</AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-medium truncate">{op.display_name}</p>
                    {!op.is_active && <Badge variant="secondary">inativo</Badge>}
                  </div>
                  <p className="text-xs text-muted-foreground">{op.role_title}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Peso {op.weight}
                    {op.is_active && activeCount > 0 && (
                      <> · ~{Math.round((op.weight / operators.filter((o) => o.is_active).reduce((s, o) => s + o.weight, 0)) * 100)}% das novas visitas</>
                    )}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <Switch checked={op.is_active} onCheckedChange={() => toggleActive(op)} />
                  <div className="flex gap-1">
                    <Button size="icon" variant="ghost" onClick={() => setDraft({ ...op })} aria-label="Editar">
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button size="icon" variant="ghost" onClick={() => remove(op)} aria-label="Excluir">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={!!draft} onOpenChange={(open) => !open && setDraft(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{draft?.id ? 'Editar operador' : 'Novo operador'}</DialogTitle>
          </DialogHeader>
          {draft && (
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <Avatar className="h-16 w-16">
                  {draft.avatar_url && <AvatarImage src={draft.avatar_url} alt="" />}
                  <AvatarFallback>{draft.display_name.charAt(0) || '?'}</AvatarFallback>
                </Avatar>
                <div className="space-y-1">
                  <Button type="button" variant="outline" size="sm" disabled={uploading} onClick={() => fileRef.current?.click()}>
                    {uploading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Upload className="h-4 w-4 mr-2" />}
                    Enviar foto
                  </Button>
                  <p className="text-xs text-muted-foreground">WEBP/PNG/JPG, até 200 KB, quadrada.</p>
                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/webp,image/png,image/jpeg"
                    className="hidden"
                    onChange={(e) => {
                      onFile(e.target.files?.[0]);
                      e.target.value = '';
                    }}
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="op-name">Nome</Label>
                <Input
                  id="op-name"
                  maxLength={60}
                  value={draft.display_name}
                  onChange={(e) => setDraft({ ...draft, display_name: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="op-role">Cargo</Label>
                <Input
                  id="op-role"
                  maxLength={60}
                  value={draft.role_title}
                  onChange={(e) => setDraft({ ...draft, role_title: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="op-weight">Peso no sorteio</Label>
                  <Input
                    id="op-weight"
                    type="number"
                    min={1}
                    max={100}
                    value={draft.weight ?? 1}
                    onChange={(e) => setDraft({ ...draft, weight: Math.min(100, Math.max(1, Number(e.target.value) || 1)) })}
                  />
                </div>
                <div className="flex items-center justify-between rounded-md border px-3">
                  <Label htmlFor="op-active">Ativo</Label>
                  <Switch
                    id="op-active"
                    checked={draft.is_active ?? true}
                    onCheckedChange={(v) => setDraft({ ...draft, is_active: v })}
                  />
                </div>
              </div>
              <div className="rounded-lg bg-muted/50 p-3 text-sm">
                <p className="text-xs text-muted-foreground mb-1">Prévia da saudação</p>
                {buildGreeting(draft.display_name || 'Nome', draft.role_title, 'Posso te ajudar a montar sua loja online?')}
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDraft(null)}>Cancelar</Button>
            <Button onClick={save} disabled={saving || uploading}>
              {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
