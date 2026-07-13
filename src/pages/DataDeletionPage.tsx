import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, ShieldCheck, Clock, FileText, TriangleAlert as AlertTriangle, CircleCheck as CheckCircle2, Loader as Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/lib/supabase';

const REQUEST_TYPES = [
  { value: 'delete_account', label: 'Excluir minha conta e dados' },
  { value: 'correct_data', label: 'Corrigir meus dados' },
  { value: 'data_copy', label: 'Solicitar cópia dos meus dados' },
  { value: 'revoke_consent', label: 'Revogar consentimento' },
  { value: 'other', label: 'Outro' },
];

const INFO_CARDS = [
  {
    icon: <ShieldCheck className="h-5 w-5" />,
    title: 'Seus direitos pela LGPD',
    body: 'A Lei Geral de Proteção de Dados (Lei nº 13.709/2018) garante a você o direito de acessar, corrigir, excluir e portar seus dados pessoais, bem como revogar o consentimento dado anteriormente.',
    accent: 'text-emerald-600',
    bg: 'bg-emerald-50 dark:bg-emerald-950/40',
  },
  {
    icon: <Clock className="h-5 w-5" />,
    title: 'Prazo de resposta',
    body: 'Após o recebimento da solicitação, nossa equipe entrará em contato em até 15 dias úteis para confirmar o andamento ou solicitar informações adicionais.',
    accent: 'text-blue-600',
    bg: 'bg-blue-50 dark:bg-blue-950/40',
  },
  {
    icon: <FileText className="h-5 w-5" />,
    title: 'Retenção legal obrigatória',
    body: 'Alguns dados podem ser mantidos mesmo após a solicitação de exclusão, quando houver obrigação legal, fiscal ou regulatória, prevenção à fraude, defesa de direitos em processo judicial ou administrativo.',
    accent: 'text-amber-600',
    bg: 'bg-amber-50 dark:bg-amber-950/40',
  },
  {
    icon: <AlertTriangle className="h-5 w-5" />,
    title: 'Pedidos e registros financeiros',
    body: 'Registros de pedidos, pagamentos e transações financeiras podem ter retenção obrigatória por prazo determinado em lei, independentemente da solicitação de exclusão de conta.',
    accent: 'text-rose-600',
    bg: 'bg-rose-50 dark:bg-rose-950/40',
  },
];

interface FormState {
  name: string;
  email: string;
  request_type: string;
  message: string;
}

type SubmitStatus = 'idle' | 'submitting' | 'success' | 'error';

export default function DataDeletionPage() {
  const [form, setForm] = useState<FormState>({
    name: '',
    email: '',
    request_type: '',
    message: '',
  });
  const [status, setStatus] = useState<SubmitStatus>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  function setField(field: keyof FormState, value: string) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  const isValid =
    form.name.trim().length > 0 &&
    form.email.trim().length > 0 &&
    form.request_type.length > 0;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isValid) return;
    setStatus('submitting');
    setErrorMsg('');

    const { error } = await supabase.from('privacy_requests').insert({
      name: form.name.trim(),
      email: form.email.trim().toLowerCase(),
      request_type: form.request_type,
      message: form.message.trim() || null,
    });

    if (error) {
      setErrorMsg('Não foi possível enviar a solicitação. Tente novamente em instantes.');
      setStatus('error');
    } else {
      setStatus('success');
    }
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="max-w-3xl mx-auto px-4 py-12 lg:py-16">

        {/* Back */}
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-10 group"
        >
          <ArrowLeft className="h-4 w-4 group-hover:-translate-x-0.5 transition-transform" />
          Voltar ao início
        </Link>

        {/* Header */}
        <div className="mb-10">
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            Solicitação de dados pessoais
          </h1>
          <p className="mt-3 text-muted-foreground leading-relaxed max-w-xl">
            Em cumprimento à Lei Geral de Proteção de Dados (LGPD), você pode solicitar a exclusão,
            correção, cópia ou portabilidade dos seus dados, bem como revogar consentimentos
            anteriormente concedidos.
          </p>
        </div>

        {/* Info cards */}
        <div className="grid sm:grid-cols-2 gap-4 mb-10">
          {INFO_CARDS.map((card) => (
            <div
              key={card.title}
              className="rounded-xl border border-border bg-card p-4 flex gap-3"
            >
              <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${card.bg}`}>
                <span className={card.accent}>{card.icon}</span>
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground leading-snug">{card.title}</p>
                <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{card.body}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Form / Success */}
        <div className="rounded-2xl border border-border bg-card p-6 sm:p-8">
          {status === 'success' ? (
            <div className="flex flex-col items-center text-center py-8 gap-4">
              <div className="w-14 h-14 rounded-full bg-emerald-50 dark:bg-emerald-950/40 flex items-center justify-center">
                <CheckCircle2 className="h-7 w-7 text-emerald-600" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-foreground">Solicitação recebida</h2>
                <p className="text-sm text-muted-foreground mt-2 max-w-sm">
                  Registramos sua solicitação com sucesso. Nossa equipe entrará em contato em até
                  15 dias úteis no e-mail informado.
                </p>
              </div>
              <Button variant="outline" asChild className="mt-2">
                <Link to="/">Voltar ao início</Link>
              </Button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5" noValidate>
              <div>
                <h2 className="text-base font-semibold text-foreground">Preencha o formulário</h2>
                <p className="text-sm text-muted-foreground mt-0.5">
                  Todos os campos marcados com <span className="text-rose-500">*</span> são obrigatórios.
                </p>
              </div>

              {/* Name */}
              <div className="space-y-1.5">
                <Label htmlFor="name">
                  Nome <span className="text-rose-500">*</span>
                </Label>
                <Input
                  id="name"
                  placeholder="Seu nome"
                  value={form.name}
                  onChange={(e) => setField('name', e.target.value)}
                  disabled={status === 'submitting'}
                  autoComplete="name"
                />
              </div>

              {/* Email */}
              <div className="space-y-1.5">
                <Label htmlFor="email">
                  E-mail da conta <span className="text-rose-500">*</span>
                </Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="email@exemplo.com"
                  value={form.email}
                  onChange={(e) => setField('email', e.target.value)}
                  disabled={status === 'submitting'}
                  autoComplete="email"
                />
                <p className="text-xs text-muted-foreground">
                  Informe o e-mail cadastrado na plataforma VitrineTurbo.
                </p>
              </div>

              {/* Request type */}
              <div className="space-y-1.5">
                <Label htmlFor="request_type">
                  Tipo de solicitação <span className="text-rose-500">*</span>
                </Label>
                <Select
                  value={form.request_type}
                  onValueChange={(v) => setField('request_type', v)}
                  disabled={status === 'submitting'}
                >
                  <SelectTrigger id="request_type">
                    <SelectValue placeholder="Selecione o tipo" />
                  </SelectTrigger>
                  <SelectContent>
                    {REQUEST_TYPES.map((rt) => (
                      <SelectItem key={rt.value} value={rt.value}>
                        {rt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Message */}
              <div className="space-y-1.5">
                <Label htmlFor="message">Mensagem adicional (opcional)</Label>
                <Textarea
                  id="message"
                  placeholder="Descreva detalhes adicionais sobre sua solicitação, se necessário..."
                  rows={4}
                  value={form.message}
                  onChange={(e) => setField('message', e.target.value)}
                  disabled={status === 'submitting'}
                  className="resize-none"
                />
              </div>

              {/* Error */}
              {status === 'error' && (
                <div className="flex items-start gap-2 rounded-lg bg-destructive/10 border border-destructive/20 px-3 py-2.5 text-sm text-destructive">
                  <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}

              {/* Submit */}
              <Button
                type="submit"
                disabled={!isValid || status === 'submitting'}
                className="w-full sm:w-auto"
              >
                {status === 'submitting' && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {status === 'submitting' ? 'Enviando...' : 'Enviar solicitação'}
              </Button>

              <p className="text-xs text-muted-foreground leading-relaxed">
                Ao enviar, você confirma que é o titular dos dados informados. Consulte nossa{' '}
                <Link to="/politica-de-privacidade" className="underline underline-offset-2 hover:text-foreground transition-colors">
                  Política de Privacidade
                </Link>{' '}
                para saber como tratamos suas informações.
              </p>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
