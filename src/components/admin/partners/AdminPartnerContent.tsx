import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Loader2, Pencil, Plus, Trash2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ToneBadge } from '@/components/partners/PartnerUi';

interface Asset {
  id?: string;
  title: string;
  description: string | null;
  category: 'copy' | 'faq' | 'image' | 'video' | 'presentation' | 'document';
  channel: string | null;
  body_text: string | null;
  file_url: string | null;
  thumbnail_url: string | null;
  sort_order: number;
  is_published: boolean;
}

interface Course { id: string; slug: string; title: string; description: string | null; sort_order: number; is_published: boolean }
interface Lesson { id?: string; course_id: string; slug: string; title: string; content_md: string; video_url: string | null; duration_minutes: number; sort_order: number; is_published: boolean }
interface Question { id?: string; question: string; options: string[]; correct_index: number; sort_order: number; is_active: boolean }

const CATEGORY_LABELS: Record<Asset['category'], string> = {
  copy: 'Texto', faq: 'Objeção', image: 'Imagem', video: 'Vídeo', presentation: 'Apresentação', document: 'Documento',
};

async function uploadAsset(file: File) {
  const ext = file.name.split('.').pop()?.toLowerCase() || 'bin';
  const path = `library/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const { error } = await supabase.storage.from('partner-assets').upload(path, file, { contentType: file.type });
  if (error) throw new Error(error.message);
  return supabase.storage.from('partner-assets').getPublicUrl(path).data.publicUrl;
}

const slugify = (v: string) => v.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);

export default function AdminPartnerContent() {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [asset, setAsset] = useState<Asset | null>(null);
  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [question, setQuestion] = useState<Question | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const [a, c, l, q] = await Promise.all([
      supabase.from('partner_assets').select('*').order('sort_order'),
      supabase.from('partner_courses').select('*').order('sort_order'),
      supabase.from('partner_lessons').select('*').order('sort_order'),
      supabase.from('partner_quiz_questions').select('*').order('sort_order'),
    ]);
    setAssets((a.data as Asset[]) ?? []);
    setCourses((c.data as Course[]) ?? []);
    setLessons((l.data as Lesson[]) ?? []);
    setQuestions((q.data as Question[]) ?? []);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const run = async (fn: () => Promise<{ error: { message: string } | null }>, done: () => void) => {
    setBusy(true);
    const { error } = await fn();
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    done();
    load();
  };

  const remove = (table: string, id: string | undefined, label: string) => {
    if (!id || !confirm(`Excluir "${label}"?`)) return;
    run(async () => supabase.from(table).delete().eq('id', id), () => toast.success('Excluído'));
  };

  return (
    <Tabs defaultValue="assets">
      <TabsList>
        <TabsTrigger value="assets">Materiais</TabsTrigger>
        <TabsTrigger value="lessons">Aulas</TabsTrigger>
        <TabsTrigger value="quiz">Prova</TabsTrigger>
      </TabsList>

      <TabsContent value="assets" className="mt-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Biblioteca de materiais</CardTitle>
            <Button size="sm" onClick={() => setAsset({ title: '', description: null, category: 'copy', channel: 'whatsapp', body_text: '', file_url: null, thumbnail_url: null, sort_order: assets.length + 1, is_published: true })}>
              <Plus className="h-4 w-4 mr-1.5" />Novo
            </Button>
          </CardHeader>
          <CardContent className="p-0">
            <ul className="divide-y">
              {assets.map((a) => (
                <li key={a.id} className="p-3 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{a.title}</p>
                    <p className="text-xs text-muted-foreground">{CATEGORY_LABELS[a.category]}{a.channel ? ` · ${a.channel}` : ''}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {!a.is_published && <ToneBadge tone="muted">Rascunho</ToneBadge>}
                    <Button size="sm" variant="ghost" onClick={() => setAsset(a)} aria-label="Editar"><Pencil className="h-4 w-4" /></Button>
                    <Button size="sm" variant="ghost" className="text-destructive" onClick={() => remove('partner_assets', a.id, a.title)} aria-label="Excluir"><Trash2 className="h-4 w-4" /></Button>
                  </div>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="lessons" className="mt-4 space-y-4">
        {courses.map((c) => (
          <Card key={c.id}>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">{c.title}</CardTitle>
              <Button size="sm" variant="outline" onClick={() => setLesson({ course_id: c.id, slug: '', title: '', content_md: '', video_url: null, duration_minutes: 5, sort_order: lessons.filter((l) => l.course_id === c.id).length + 1, is_published: true })}>
                <Plus className="h-4 w-4 mr-1.5" />Aula
              </Button>
            </CardHeader>
            <CardContent className="p-0">
              <ul className="divide-y">
                {lessons.filter((l) => l.course_id === c.id).map((l) => (
                  <li key={l.id} className="p-3 flex items-center justify-between gap-3">
                    <p className="text-sm">{l.sort_order}. {l.title}{l.video_url ? ' · vídeo' : ''}</p>
                    <div className="flex gap-1">
                      <Button size="sm" variant="ghost" onClick={() => setLesson(l)} aria-label="Editar"><Pencil className="h-4 w-4" /></Button>
                      <Button size="sm" variant="ghost" className="text-destructive" onClick={() => remove('partner_lessons', l.id, l.title)} aria-label="Excluir"><Trash2 className="h-4 w-4" /></Button>
                    </div>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        ))}
      </TabsContent>

      <TabsContent value="quiz" className="mt-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Perguntas da certificação (nota mínima 80%)</CardTitle>
            <Button size="sm" onClick={() => setQuestion({ question: '', options: ['', '', '', ''], correct_index: 0, sort_order: questions.length + 1, is_active: true })}><Plus className="h-4 w-4 mr-1.5" />Pergunta</Button>
          </CardHeader>
          <CardContent className="p-0">
            <ul className="divide-y">
              {questions.map((q) => (
                <li key={q.id} className="p-3 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm">{q.sort_order}. {q.question}</p>
                    <p className="text-xs text-emerald-600">Correta: {q.options[q.correct_index]}</p>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    {!q.is_active && <ToneBadge tone="muted">Inativa</ToneBadge>}
                    <Button size="sm" variant="ghost" onClick={() => setQuestion(q)} aria-label="Editar"><Pencil className="h-4 w-4" /></Button>
                    <Button size="sm" variant="ghost" className="text-destructive" onClick={() => remove('partner_quiz_questions', q.id, q.question)} aria-label="Excluir"><Trash2 className="h-4 w-4" /></Button>
                  </div>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </TabsContent>

      <Dialog open={!!asset} onOpenChange={(o) => !o && setAsset(null)}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{asset?.id ? 'Editar material' : 'Novo material'}</DialogTitle></DialogHeader>
          {asset && (
            <div className="space-y-3">
              <div className="space-y-1.5"><Label>Título</Label><Input value={asset.title} onChange={(e) => setAsset({ ...asset, title: e.target.value })} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Tipo</Label>
                  <Select value={asset.category} onValueChange={(v) => setAsset({ ...asset, category: v as Asset['category'] })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{Object.entries(CATEGORY_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Canal</Label>
                  <Select value={asset.channel ?? 'geral'} onValueChange={(v) => setAsset({ ...asset, channel: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {['whatsapp', 'instagram', 'email', 'linkedin', 'geral'].map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-1.5"><Label>Descrição</Label><Input value={asset.description ?? ''} onChange={(e) => setAsset({ ...asset, description: e.target.value })} /></div>
              <div className="space-y-1.5">
                <Label>Texto / legenda</Label>
                <Textarea rows={6} value={asset.body_text ?? ''} onChange={(e) => setAsset({ ...asset, body_text: e.target.value })} />
                <p className="text-xs text-muted-foreground">Use {'{link}'} para o link do parceiro e {'{seu nome}'} para o nome dele.</p>
              </div>
              <div className="space-y-1.5">
                <Label>Arquivo</Label>
                {asset.file_url && <a href={asset.file_url} target="_blank" rel="noopener noreferrer" className="text-xs underline block truncate">{asset.file_url}</a>}
                <Input
                  type="file"
                  onChange={async (e) => {
                    const f = e.target.files?.[0];
                    if (!f) return;
                    try {
                      setBusy(true);
                      const url = await uploadAsset(f);
                      setAsset((cur) => (cur ? { ...cur, file_url: url, thumbnail_url: f.type.startsWith('image/') ? url : cur.thumbnail_url } : cur));
                    } catch (err) {
                      toast.error((err as Error).message);
                    } finally {
                      setBusy(false);
                    }
                  }}
                />
              </div>
              <div className="grid grid-cols-2 gap-3 items-end">
                <div className="space-y-1.5"><Label>Ordem</Label><Input type="number" value={asset.sort_order} onChange={(e) => setAsset({ ...asset, sort_order: Number(e.target.value) })} /></div>
                <label className="flex items-center gap-2 text-sm pb-2"><Switch checked={asset.is_published} onCheckedChange={(v) => setAsset({ ...asset, is_published: v })} />Publicado</label>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setAsset(null)}>Cancelar</Button>
            <Button
              disabled={busy || !asset?.title || (!asset?.body_text && !asset?.file_url)}
              onClick={() => asset && run(async () => (asset.id ? supabase.from('partner_assets').update(asset).eq('id', asset.id) : supabase.from('partner_assets').insert(asset)), () => setAsset(null))}
            >
              {busy && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!lesson} onOpenChange={(o) => !o && setLesson(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{lesson?.id ? 'Editar aula' : 'Nova aula'}</DialogTitle></DialogHeader>
          {lesson && (
            <div className="space-y-3">
              <div className="space-y-1.5"><Label>Título</Label><Input value={lesson.title} onChange={(e) => setLesson({ ...lesson, title: e.target.value, slug: lesson.id ? lesson.slug : slugify(e.target.value) })} /></div>
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1.5"><Label>Duração (min)</Label><Input type="number" value={lesson.duration_minutes} onChange={(e) => setLesson({ ...lesson, duration_minutes: Number(e.target.value) })} /></div>
                <div className="space-y-1.5"><Label>Ordem</Label><Input type="number" value={lesson.sort_order} onChange={(e) => setLesson({ ...lesson, sort_order: Number(e.target.value) })} /></div>
                <label className="flex items-center gap-2 text-sm self-end pb-2"><Switch checked={lesson.is_published} onCheckedChange={(v) => setLesson({ ...lesson, is_published: v })} />Publicada</label>
              </div>
              <div className="space-y-1.5"><Label>Vídeo (YouTube ou Vimeo)</Label><Input value={lesson.video_url ?? ''} onChange={(e) => setLesson({ ...lesson, video_url: e.target.value || null })} /></div>
              <div className="space-y-1.5"><Label>Conteúdo (Markdown)</Label><Textarea rows={14} className="font-mono text-xs" value={lesson.content_md} onChange={(e) => setLesson({ ...lesson, content_md: e.target.value })} /></div>
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setLesson(null)}>Cancelar</Button>
            <Button
              disabled={busy || !lesson?.title || !lesson?.slug}
              onClick={() => lesson && run(async () => (lesson.id ? supabase.from('partner_lessons').update(lesson).eq('id', lesson.id) : supabase.from('partner_lessons').insert(lesson)), () => setLesson(null))}
            >
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!question} onOpenChange={(o) => !o && setQuestion(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{question?.id ? 'Editar pergunta' : 'Nova pergunta'}</DialogTitle></DialogHeader>
          {question && (
            <div className="space-y-3">
              <div className="space-y-1.5"><Label>Pergunta</Label><Textarea rows={2} value={question.question} onChange={(e) => setQuestion({ ...question, question: e.target.value })} /></div>
              {question.options.map((opt, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <input type="radio" name="correct" checked={question.correct_index === idx} onChange={() => setQuestion({ ...question, correct_index: idx })} aria-label={`Marcar opção ${idx + 1} como correta`} />
                  <Input value={opt} placeholder={`Opção ${idx + 1}`} onChange={(e) => setQuestion({ ...question, options: question.options.map((o, i) => (i === idx ? e.target.value : o)) })} />
                </div>
              ))}
              <p className="text-xs text-muted-foreground">Marque a opção correta. Opções vazias são ignoradas.</p>
              <label className="flex items-center gap-2 text-sm"><Switch checked={question.is_active} onCheckedChange={(v) => setQuestion({ ...question, is_active: v })} />Ativa</label>
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setQuestion(null)}>Cancelar</Button>
            <Button
              disabled={busy || !question?.question || !question?.options[question.correct_index]?.trim()}
              onClick={() => {
                if (!question) return;
                const filled = question.options.map((o, i) => ({ o: o.trim(), i })).filter((x) => x.o);
                const payload = {
                  question: question.question,
                  options: filled.map((x) => x.o),
                  correct_index: filled.findIndex((x) => x.i === question.correct_index),
                  sort_order: question.sort_order,
                  is_active: question.is_active,
                };
                run(async () => (question.id ? supabase.from('partner_quiz_questions').update(payload).eq('id', question.id) : supabase.from('partner_quiz_questions').insert(payload)), () => setQuestion(null));
              }}
            >
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Tabs>
  );
}
