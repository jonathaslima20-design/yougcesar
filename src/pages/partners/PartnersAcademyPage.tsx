import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import { toast } from 'sonner';
import { ArrowLeft, ArrowRight, Award, BadgeCheck, CheckCircle2, Circle, Clock, GraduationCap, Loader2, PlayCircle } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { usePartner } from '@/contexts/PartnerContext';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { PageHeader, ToneBadge, formatDate } from '@/components/partners/PartnerUi';

interface Course {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  sort_order: number;
}

interface Lesson {
  id: string;
  course_id: string;
  slug: string;
  title: string;
  content_md: string;
  video_url: string | null;
  duration_minutes: number;
  sort_order: number;
}

function useAcademy() {
  const { user } = useAuth();
  const [courses, setCourses] = useState<Course[] | null>(null);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [done, setDone] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    if (!user?.id) return;
    const [c, l, p] = await Promise.all([
      supabase.from('partner_courses').select('*').eq('is_published', true).order('sort_order'),
      supabase.from('partner_lessons').select('*').eq('is_published', true).order('sort_order'),
      supabase.from('partner_lesson_progress').select('lesson_id').eq('user_id', user.id),
    ]);
    setCourses((c.data as Course[]) ?? []);
    setLessons((l.data as Lesson[]) ?? []);
    setDone(new Set((p.data ?? []).map((r) => r.lesson_id)));
  }, [user?.id]);

  useEffect(() => {
    load();
  }, [load]);

  const ordered = useMemo(() => {
    const courseOrder = new Map((courses ?? []).map((c) => [c.id, c.sort_order]));
    return [...lessons].sort((a, b) => (courseOrder.get(a.course_id) ?? 0) - (courseOrder.get(b.course_id) ?? 0) || a.sort_order - b.sort_order);
  }, [courses, lessons]);

  return { courses, lessons: ordered, done, reload: load, userId: user?.id };
}

/** Embeds YouTube/Vimeo links; anything else is shown as a plain link. */
function VideoEmbed({ url }: { url: string }) {
  const yt = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([\w-]{11})/);
  const vimeo = url.match(/vimeo\.com\/(\d+)/);
  const src = yt ? `https://www.youtube-nocookie.com/embed/${yt[1]}` : vimeo ? `https://player.vimeo.com/video/${vimeo[1]}` : null;
  if (!src) return <a href={url} target="_blank" rel="noopener noreferrer" className="underline">Assistir ao vídeo</a>;
  return (
    <div className="aspect-video rounded-xl overflow-hidden border bg-black">
      <iframe src={src} title="Vídeo da aula" className="h-full w-full" allow="encrypted-media; picture-in-picture" allowFullScreen />
    </div>
  );
}

export default function PartnersAcademyPage() {
  const { overview } = usePartner();
  const { courses, lessons, done } = useAcademy();

  if (courses === null) return <div className="flex justify-center py-24"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;

  const total = lessons.length;
  const completed = lessons.filter((l) => done.has(l.id)).length;
  const nextLesson = lessons.find((l) => !done.has(l.id));

  return (
    <div className="container mx-auto p-4 sm:p-6 space-y-6 max-w-5xl">
      <PageHeader title="Academia" description="Aulas curtas sobre o programa, o produto, vendas e implantação." />

      <div className="grid md:grid-cols-3 gap-4">
        <Card className="md:col-span-2">
          <CardContent className="pt-6 space-y-3">
            <div className="flex items-center justify-between">
              <p className="font-medium">Seu progresso</p>
              <p className="text-sm text-muted-foreground tabular-nums">{completed}/{total} aulas</p>
            </div>
            <Progress value={total ? (completed / total) * 100 : 0} />
            {nextLesson ? (
              <Button asChild size="sm"><Link to={`/partners/academy/${nextLesson.id}`}><PlayCircle className="h-4 w-4 mr-2" />{completed ? 'Continuar' : 'Começar'}: {nextLesson.title}</Link></Button>
            ) : (
              <p className="text-sm text-emerald-600 dark:text-emerald-400">Você concluiu todas as aulas. 🎓</p>
            )}
          </CardContent>
        </Card>
        <Card className={overview?.certified_at ? 'border-emerald-500/40' : 'border-primary/40'}>
          <CardContent className="pt-6 space-y-3">
            <Award className="h-6 w-6 text-primary" />
            <p className="font-medium">Certificação VitrineTurbo Partner</p>
            {overview?.certified_at ? (
              <ToneBadge tone="green"><BadgeCheck className="h-3.5 w-3.5" />Certificado em {formatDate(overview.certified_at)}</ToneBadge>
            ) : (
              <>
                <p className="text-sm text-muted-foreground">10 perguntas, nota mínima 80%. Exigida para os níveis mais altos e libera o selo no seu perfil.</p>
                <Button asChild size="sm" variant="outline"><Link to="/partners/academy/certificacao">Fazer a prova</Link></Button>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {courses.map((course) => {
        const courseLessons = lessons.filter((l) => l.course_id === course.id);
        const courseDone = courseLessons.filter((l) => done.has(l.id)).length;
        return (
          <Card key={course.id}>
            <CardHeader>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <CardTitle className="text-base">{course.title}</CardTitle>
                  {course.description && <CardDescription>{course.description}</CardDescription>}
                </div>
                <span className="text-xs text-muted-foreground whitespace-nowrap">{courseDone}/{courseLessons.length}</span>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <ul className="divide-y">
                {courseLessons.map((l) => (
                  <li key={l.id}>
                    <Link to={`/partners/academy/${l.id}`} className="flex items-center gap-3 py-3 hover:bg-muted/30 -mx-2 px-2 rounded-md">
                      {done.has(l.id) ? <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" /> : <Circle className="h-4 w-4 text-muted-foreground shrink-0" />}
                      <span className="flex-1 text-sm">{l.title}</span>
                      <span className="text-xs text-muted-foreground flex items-center gap-1"><Clock className="h-3 w-3" />{l.duration_minutes} min</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

export function PartnersLessonPage() {
  const { lessonId } = useParams();
  const navigate = useNavigate();
  const { lessons, done, reload, userId } = useAcademy();
  const [saving, setSaving] = useState(false);

  const index = lessons.findIndex((l) => l.id === lessonId);
  const lesson = lessons[index];
  const next = index >= 0 ? lessons[index + 1] : undefined;

  if (!lessons.length) return <div className="flex justify-center py-24"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  if (!lesson) return <div className="container mx-auto p-6 text-center text-muted-foreground">Aula não encontrada.</div>;

  const complete = async () => {
    if (!userId) return;
    setSaving(true);
    const { error } = await supabase.from('partner_lesson_progress').upsert({ user_id: userId, lesson_id: lesson.id }, { onConflict: 'user_id,lesson_id' });
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    await reload();
    if (next) navigate(`/partners/academy/${next.id}`);
    else toast.success('Trilha concluída! Agora faça a prova de certificação.');
  };

  return (
    <div className="container mx-auto p-4 sm:p-6 max-w-3xl space-y-6">
      <Link to="/partners/academy" className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1"><ArrowLeft className="h-4 w-4" />Academia</Link>
      <div>
        <p className="text-xs text-muted-foreground flex items-center gap-1"><GraduationCap className="h-3.5 w-3.5" />Aula {index + 1} de {lessons.length} · {lesson.duration_minutes} min</p>
        <h1 className="text-2xl font-semibold mt-1">{lesson.title}</h1>
      </div>
      {lesson.video_url && <VideoEmbed url={lesson.video_url} />}
      <article className="space-y-4 text-[15px] leading-relaxed text-foreground/90">
        <ReactMarkdown
          components={{
            h2: ({ children }) => <h2 className="text-lg font-semibold text-foreground pt-2">{children}</h2>,
            h3: ({ children }) => <h3 className="font-semibold text-foreground">{children}</h3>,
            p: ({ children }) => <p>{children}</p>,
            ul: ({ children }) => <ul className="list-disc pl-5 space-y-1.5">{children}</ul>,
            ol: ({ children }) => <ol className="list-decimal pl-5 space-y-1.5">{children}</ol>,
            strong: ({ children }) => <strong className="font-semibold text-foreground">{children}</strong>,
            a: ({ href, children }) => <a href={href} target="_blank" rel="noopener noreferrer" className="underline">{children}</a>,
          }}
        >
          {lesson.content_md}
        </ReactMarkdown>
      </article>
      <div className="flex flex-col sm:flex-row gap-2 border-t pt-6">
        {done.has(lesson.id) ? (
          next ? (
            <Button asChild><Link to={`/partners/academy/${next.id}`}>Próxima aula<ArrowRight className="h-4 w-4 ml-2" /></Link></Button>
          ) : (
            <Button asChild><Link to="/partners/academy/certificacao">Fazer a certificação<ArrowRight className="h-4 w-4 ml-2" /></Link></Button>
          )
        ) : (
          <Button onClick={complete} disabled={saving}>{saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Concluir aula{next ? ' e continuar' : ''}</Button>
        )}
      </div>
    </div>
  );
}

interface QuizQuestion {
  id: string;
  question: string;
  options: string[];
}

export function PartnersCertificationPage() {
  const { overview, refresh } = usePartner();
  const [questions, setQuestions] = useState<QuizQuestion[] | null>(null);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ score: number; passed: boolean; correct: number; total: number } | null>(null);

  useEffect(() => {
    supabase.rpc('get_partner_quiz').then(({ data }) => setQuestions((data as QuizQuestion[]) ?? []));
  }, []);

  const submit = async () => {
    setSubmitting(true);
    const { data, error } = await supabase.rpc('submit_partner_certification', { p_answers: answers });
    setSubmitting(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setResult(data as typeof result);
    if ((data as { passed: boolean }).passed) await refresh();
  };

  if (questions === null) return <div className="flex justify-center py-24"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="container mx-auto p-4 sm:p-6 max-w-3xl space-y-6">
      <Link to="/partners/academy" className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1"><ArrowLeft className="h-4 w-4" />Academia</Link>
      <PageHeader title="Certificação VitrineTurbo Partner" description="Responda às 10 perguntas. A nota mínima é 80%." />

      {overview?.certified_at && !result && (
        <Card className="border-emerald-500/40"><CardContent className="pt-6 text-sm">Você já é certificado desde {formatDate(overview.certified_at)}. Pode refazer a prova para revisar o conteúdo.</CardContent></Card>
      )}

      {result ? (
        <Card className={result.passed ? 'border-emerald-500/40' : 'border-amber-500/40'}>
          <CardContent className="pt-6 space-y-3 text-center">
            {result.passed ? <BadgeCheck className="h-12 w-12 text-emerald-500 mx-auto" /> : <Award className="h-12 w-12 text-amber-500 mx-auto" />}
            <p className="text-xl font-semibold">{result.passed ? 'Parabéns, você está certificado!' : 'Quase lá'}</p>
            <p className="text-muted-foreground">Você acertou {result.correct} de {result.total} ({Number(result.score)}%).</p>
            {result.passed ? (
              <Button asChild><Link to="/partners">Voltar ao início</Link></Button>
            ) : (
              <div className="flex gap-2 justify-center">
                <Button variant="outline" asChild><Link to="/partners/academy">Revisar as aulas</Link></Button>
                <Button onClick={() => { setResult(null); setAnswers({}); }}>Tentar de novo</Button>
              </div>
            )}
          </CardContent>
        </Card>
      ) : (
        <>
          {questions.map((q, i) => (
            <Card key={q.id}>
              <CardContent className="pt-5 space-y-3">
                <p className="font-medium">{i + 1}. {q.question}</p>
                <div className="space-y-2" role="radiogroup" aria-label={q.question}>
                  {q.options.map((opt, idx) => (
                    <button
                      key={opt}
                      type="button"
                      role="radio"
                      aria-checked={answers[q.id] === idx}
                      onClick={() => setAnswers({ ...answers, [q.id]: idx })}
                      className={`w-full text-left rounded-lg border px-3 py-2.5 text-sm transition-colors ${answers[q.id] === idx ? 'border-primary bg-primary/5' : 'hover:bg-muted/40'}`}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
          <Button onClick={submit} disabled={submitting || Object.keys(answers).length < questions.length} className="w-full sm:w-auto">
            {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Enviar respostas ({Object.keys(answers).length}/{questions.length})
          </Button>
        </>
      )}
    </div>
  );
}
