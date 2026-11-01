import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { RealtimeClient, type RealtimeChannel } from '@supabase/supabase-js';
import { Link } from 'react-router-dom';
import {
  fetchConversationMessages,
  forgetConversation,
  getRealtimeEndpoint,
  getStoredConversation,
  openConversation,
  sendVisitorMessage,
  setChatDismissed,
  storeConversation,
  submitWhatsapp,
} from '@/lib/liveChat/visitorApi';
import { buildGreeting, formatClock, formatPhoneBR } from '@/lib/liveChat/format';
import type { ChatMessage, LiveChatPublicConfig, StoredConversation, VisitorSession } from '@/lib/liveChat/types';

interface Props {
  config: LiveChatPublicConfig;
  session: VisitorSession;
}

type View = 'teaser' | 'open' | 'closed';

const TYPING_SHOW_MS = 4000;
const TYPING_THROTTLE_MS = 2000;

function mergeMessages(current: ChatMessage[], incoming: ChatMessage[]): ChatMessage[] {
  const byId = new Map<number, ChatMessage>();
  for (const m of current) if (!m.pending) byId.set(m.id, m);
  for (const m of incoming) byId.set(m.id, m);
  const confirmed = [...byId.values()].sort((a, b) => a.id - b.id);
  // mensagens otimistas que ainda não voltaram do servidor
  const pending = current.filter((m) => m.pending && !incoming.some((i) => i.body === m.body && i.sender === m.sender));
  return [...confirmed, ...pending];
}

function Avatar({ url, name, size = 40 }: { url?: string | null; name?: string; size?: number }) {
  if (url) {
    return (
      <img
        src={url}
        alt={name ?? ''}
        width={size}
        height={size}
        loading="lazy"
        className="rounded-full object-cover bg-ink-100 shrink-0"
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <div
      className="rounded-full bg-ink-900 text-white flex items-center justify-center font-display font-medium shrink-0"
      style={{ width: size, height: size, fontSize: size * 0.4 }}
    >
      {(name ?? 'V').charAt(0).toUpperCase()}
    </div>
  );
}

function TypingDots() {
  return (
    <span className="inline-flex items-center gap-1 py-1" aria-label="digitando">
      {[0, 150, 300].map((d) => (
        <span
          key={d}
          className="w-1.5 h-1.5 rounded-full bg-ink-400 animate-bounce"
          style={{ animationDelay: `${d}ms`, animationDuration: '1s' }}
        />
      ))}
    </span>
  );
}

export default function LiveChatWidget({ config, session }: Props) {
  const operator = session.operator;
  const greeting = useMemo(
    () => buildGreeting(operator?.name, operator?.role, config.greeting_cta ?? '', config.timezone),
    [operator?.name, operator?.role, config.greeting_cta, config.timezone],
  );
  const greetingAt = useRef(new Date().toISOString());

  const [conv, setConv] = useState<StoredConversation | null>(() => getStoredConversation());
  const [view, setView] = useState<View>(() => (getStoredConversation() ? 'closed' : 'teaser'));
  const [greetingReady, setGreetingReady] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [operatorTyping, setOperatorTyping] = useState(false);
  const [unread, setUnread] = useState(0);
  const [showWhatsapp, setShowWhatsapp] = useState(false);
  const [phone, setPhone] = useState('');
  const [phoneConsent, setPhoneConsent] = useState(false);

  const channelRef = useRef<RealtimeChannel | null>(null);
  const clientRef = useRef<RealtimeClient | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const typingTimer = useRef<ReturnType<typeof setTimeout>>();
  const lastTypingSent = useRef(0);
  const viewRef = useRef(view);
  viewRef.current = view;

  const displayOperator = conv?.operator ?? operator;
  const typingEnabled = config.typing_indicator_enabled !== false;
  const hasVisitorMessage = messages.some((m) => m.sender === 'visitor');
  const whatsappSent = messages.some((m) => m.kind === 'whatsapp');

  // "digitando…" curto antes da saudação aparecer
  useEffect(() => {
    if (conv) {
      setGreetingReady(true);
      return;
    }
    const t = setTimeout(() => setGreetingReady(true), 1500);
    return () => clearTimeout(t);
  }, [conv]);

  const receive = useCallback((incoming: ChatMessage[]) => {
    if (!incoming.length) return;
    setMessages((cur) => mergeMessages(cur, incoming));
    if (incoming.some((m) => m.sender === 'operator')) {
      setOperatorTyping(false);
      if (viewRef.current !== 'open') setUnread((n) => n + incoming.filter((m) => m.sender === 'operator').length);
    }
  }, []);

  const lastIdRef = useRef(0);
  useEffect(() => {
    lastIdRef.current = messages.reduce((max, m) => (!m.pending && m.id > max ? m.id : max), 0);
  }, [messages]);

  const catchUp = useCallback(async (c: StoredConversation) => {
    try {
      receive(await fetchConversationMessages(c, lastIdRef.current));
    } catch (err) {
      if (err instanceof Error && err.message.includes('invalid_conversation')) {
        storeConversation(null);
        setConv(null);
        setMessages([]);
      }
    }
  }, [receive]);

  // socket só existe depois que há conversa
  useEffect(() => {
    if (!conv) return;
    const { url, apiKey } = getRealtimeEndpoint();
    const client = new RealtimeClient(url, { params: { apikey: apiKey } });
    clientRef.current = client;
    const channel = client.channel(`chat:${conv.channel_key}`, { config: { broadcast: { self: false } } });
    channel
      .on('broadcast', { event: 'message' }, ({ payload }) => receive([payload as ChatMessage]))
      .on('broadcast', { event: 'typing' }, ({ payload }) => {
        if (payload?.from !== 'operator') return;
        setOperatorTyping(true);
        clearTimeout(typingTimer.current);
        typingTimer.current = setTimeout(() => setOperatorTyping(false), TYPING_SHOW_MS);
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') catchUp(conv);
      });
    channelRef.current = channel;

    const onVisible = () => {
      if (document.visibilityState === 'visible') catchUp(conv);
    };
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      clearTimeout(typingTimer.current);
      channel.unsubscribe();
      client.disconnect();
      channelRef.current = null;
      clientRef.current = null;
    };
  }, [conv, receive, catchUp]);

  useEffect(() => {
    if (view === 'open') {
      setUnread(0);
      requestAnimationFrame(() => listRef.current?.scrollTo({ top: listRef.current.scrollHeight }));
    }
  }, [view, messages.length, operatorTyping, showWhatsapp]);

  const ensureConversation = async (): Promise<StoredConversation> => {
    if (conv) return conv;
    const opened = await openConversation(session);
    const stored: StoredConversation = { ...opened, operator: operator ?? null, saved_at: Date.now() };
    storeConversation(stored);
    setConv(stored);
    return stored;
  };

  const send = async (body: string, kind: 'text' | 'quick_reply') => {
    const text = body.trim();
    if (!text || sending) return;
    setSending(true);
    setError(null);
    const tempId = -Date.now();
    setMessages((cur) => [
      ...cur,
      { id: tempId, sender: 'visitor', body: text, kind, created_at: new Date().toISOString(), pending: true },
    ]);
    setDraft('');
    try {
      const c = await ensureConversation();
      await sendVisitorMessage(c, text, kind, !hasVisitorMessage ? greeting : undefined);
      storeConversation({ ...c, saved_at: Date.now() });
      await catchUp(c);
    } catch {
      setMessages((cur) => cur.filter((m) => m.id !== tempId));
      setDraft(text);
      setError('Não conseguimos enviar agora. Tente novamente.');
    } finally {
      setSending(false);
    }
  };

  const sendTyping = () => {
    if (!typingEnabled || !channelRef.current) return;
    const now = Date.now();
    if (now - lastTypingSent.current < TYPING_THROTTLE_MS) return;
    lastTypingSent.current = now;
    channelRef.current.send({ type: 'broadcast', event: 'typing', payload: { from: 'visitor' } });
  };

  const sendWhatsapp = async () => {
    const digits = phone.replace(/\D/g, '');
    if (digits.length < 10 || digits.length > 11) {
      setError('Informe DDD + número (ex.: 11 91234-5678).');
      return;
    }
    if (!phoneConsent) {
      setError('Marque a autorização para contato por WhatsApp.');
      return;
    }
    setSending(true);
    setError(null);
    try {
      const c = await ensureConversation();
      if (!hasVisitorMessage) {
        await sendVisitorMessage(c, 'Prefiro falar pelo WhatsApp', 'quick_reply', greeting);
      }
      await submitWhatsapp(c, digits);
      setShowWhatsapp(false);
      setPhone('');
      await catchUp(c);
    } catch {
      setError('Não conseguimos salvar o número. Confira e tente novamente.');
    } finally {
      setSending(false);
    }
  };

  const forget = async () => {
    if (!conv) return;
    if (!window.confirm('Apagar esta conversa e o número informado? Essa ação não pode ser desfeita.')) return;
    try {
      await forgetConversation(conv);
    } finally {
      storeConversation(null);
      setConv(null);
      setMessages([]);
      setView('closed');
    }
  };

  const minimize = () => {
    setView('closed');
    if (!conv) setChatDismissed();
  };

  const greetingMessage: ChatMessage = {
    id: 0,
    sender: 'system',
    body: greeting,
    kind: 'text',
    created_at: greetingAt.current,
  };
  // quando já existe histórico, a saudação vem do servidor
  const shown = messages.some((m) => m.sender === 'system') ? messages : [greetingMessage, ...messages];

  const launcherBadge = view !== 'open' && (unread > 0 || (view === 'teaser' && greetingReady)) ? unread || 1 : 0;

  return (
    <div className="vt-live-chat fixed z-[60] right-4 bottom-24 md:bottom-6 md:right-6 flex flex-col items-end gap-3 font-sans">
      {view === 'open' && (
        <div
          role="dialog"
          aria-label={`Conversa com ${displayOperator?.name ?? 'VitrineTurbo'}`}
          className="w-[calc(100vw-2rem)] max-w-[370px] h-[min(560px,calc(100vh-9rem))] bg-white rounded-2xl shadow-2xl border border-ink-100 flex flex-col overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-200"
        >
          {/* header */}
          <div className="flex items-center gap-3 px-4 py-3 bg-ink-900 text-white">
            <div className="relative">
              <Avatar url={displayOperator?.avatar_url} name={displayOperator?.name} size={40} />
              <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-400 border-2 border-ink-900" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-display font-medium text-[15px] leading-tight truncate">{displayOperator?.name ?? 'VitrineTurbo'}</p>
              <p className="text-[12px] text-white/70 truncate">
                {operatorTyping ? 'digitando…' : displayOperator?.role ?? 'Atendimento'} · online
              </p>
            </div>
            <button
              type="button"
              onClick={minimize}
              className="w-8 h-8 rounded-full hover:bg-white/10 flex items-center justify-center"
              aria-label="Minimizar conversa"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 9l6 6 6-6" /></svg>
            </button>
          </div>

          {/* mensagens */}
          <div ref={listRef} className="flex-1 overflow-y-auto px-3 py-4 space-y-2 bg-[#f6f6f4]">
            {shown.map((m) => {
              const mine = m.sender === 'visitor';
              return (
                <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'} gap-2`}>
                  {!mine && <Avatar url={displayOperator?.avatar_url} name={displayOperator?.name} size={26} />}
                  <div
                    className={`max-w-[78%] rounded-2xl px-3 py-2 text-[14px] leading-snug whitespace-pre-wrap break-words ${
                      mine ? 'bg-ink-900 text-white rounded-br-md' : 'bg-white text-ink-900 rounded-bl-md shadow-sm'
                    } ${m.pending ? 'opacity-60' : ''}`}
                  >
                    {m.kind === 'whatsapp' ? `📱 Meu WhatsApp: ${formatPhoneBR(m.body)}` : m.body}
                    <span className={`block text-[10px] mt-1 text-right ${mine ? 'text-white/60' : 'text-ink-400'}`}>
                      {formatClock(m.created_at)}
                    </span>
                  </div>
                </div>
              );
            })}

            {whatsappSent && (
              <p className="text-center text-[12px] text-ink-500 px-4 py-1">
                Recebemos seu número! Vamos te chamar no WhatsApp em breve.
              </p>
            )}

            {operatorTyping && typingEnabled && (
              <div className="flex gap-2">
                <Avatar url={displayOperator?.avatar_url} name={displayOperator?.name} size={26} />
                <div className="bg-white rounded-2xl rounded-bl-md px-3 py-1.5 shadow-sm"><TypingDots /></div>
              </div>
            )}

            {!hasVisitorMessage && !showWhatsapp && (
              <div className="flex flex-wrap gap-2 pt-2 justify-end">
                {(config.quick_replies ?? []).map((q) => (
                  <button
                    key={q}
                    type="button"
                    disabled={sending}
                    onClick={() => send(q, 'quick_reply')}
                    className="text-[13px] px-3 py-1.5 rounded-full border border-ink-900 text-ink-900 bg-white hover:bg-ink-900 hover:text-white transition-colors"
                  >
                    {q}
                  </button>
                ))}
              </div>
            )}

            {showWhatsapp && (
              <div className="bg-white rounded-xl p-3 shadow-sm space-y-2">
                <label className="block text-[13px] font-medium text-ink-900" htmlFor="vt-chat-phone">
                  Seu WhatsApp (com DDD)
                </label>
                <input
                  id="vt-chat-phone"
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel-national"
                  placeholder="(11) 91234-5678"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full rounded-lg border border-ink-300 px-3 py-2 text-[14px] focus:outline-none focus:border-ink-900"
                />
                <label className="flex items-start gap-2 text-[12px] text-ink-500">
                  <input
                    type="checkbox"
                    checked={phoneConsent}
                    onChange={(e) => setPhoneConsent(e.target.checked)}
                    className="mt-0.5"
                  />
                  Autorizo a VitrineTurbo a me contatar por WhatsApp sobre este atendimento.
                </label>
                <div className="flex gap-2 justify-end">
                  <button type="button" onClick={() => setShowWhatsapp(false)} className="text-[13px] px-3 py-1.5 text-ink-500">
                    Cancelar
                  </button>
                  <button
                    type="button"
                    disabled={sending}
                    onClick={sendWhatsapp}
                    className="text-[13px] px-3 py-1.5 rounded-full bg-[#25D366] text-white font-medium disabled:opacity-60"
                  >
                    Enviar número
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* composer */}
          <div className="border-t border-ink-100 bg-white">
            {error && <p className="px-3 pt-2 text-[12px] text-red-600">{error}</p>}
            {!whatsappSent && !showWhatsapp && (
              <button
                type="button"
                onClick={() => {
                  setShowWhatsapp(true);
                  setError(null);
                }}
                className="mx-3 mt-2 text-[12px] text-[#128C7E] font-medium hover:underline"
              >
                Prefiro falar pelo WhatsApp
              </button>
            )}
            <form
              className="flex items-end gap-2 p-3"
              onSubmit={(e) => {
                e.preventDefault();
                send(draft, 'text');
              }}
            >
              <textarea
                value={draft}
                rows={1}
                maxLength={2000}
                placeholder="Escreva sua mensagem…"
                onChange={(e) => {
                  setDraft(e.target.value);
                  sendTyping();
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    send(draft, 'text');
                  }
                }}
                className="flex-1 resize-none max-h-28 rounded-xl border border-ink-300 px-3 py-2 text-[14px] focus:outline-none focus:border-ink-900"
              />
              <button
                type="submit"
                disabled={sending || !draft.trim()}
                className="w-10 h-10 rounded-full bg-ink-900 text-white flex items-center justify-center disabled:opacity-40 shrink-0"
                aria-label="Enviar mensagem"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" /></svg>
              </button>
            </form>
            <p className="px-3 pb-2 text-[10px] text-ink-400 flex justify-between gap-2">
              <span>
                Ao conversar, você concorda com nossa{' '}
                <Link to="/politica-de-privacidade" className="underline">Política de Privacidade</Link>.
              </span>
              {conv && (
                <button type="button" onClick={forget} className="underline shrink-0">Apagar conversa</button>
              )}
            </p>
          </div>
        </div>
      )}

      {view === 'teaser' && (
        <div className="relative max-w-[290px] bg-white rounded-2xl rounded-br-md shadow-xl border border-ink-100 p-3 pr-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
          <button
            type="button"
            onClick={minimize}
            className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full text-ink-400 hover:bg-ink-100 flex items-center justify-center"
            aria-label="Fechar"
          >
            ×
          </button>
          <button type="button" onClick={() => setView('open')} className="flex gap-2.5 text-left">
            <Avatar url={displayOperator?.avatar_url} name={displayOperator?.name} size={34} />
            <div className="min-w-0">
              <p className="text-[12px] font-medium text-ink-900">{displayOperator?.name ?? 'VitrineTurbo'}</p>
              {greetingReady ? (
                <p className="text-[13px] text-ink-700 leading-snug line-clamp-3">{greeting}</p>
              ) : (
                <TypingDots />
              )}
            </div>
          </button>
        </div>
      )}

      <button
        type="button"
        onClick={() => setView(view === 'open' ? 'closed' : 'open')}
        className="relative w-14 h-14 rounded-full shadow-xl bg-ink-900 text-white flex items-center justify-center hover:scale-105 transition-transform"
        aria-label={view === 'open' ? 'Fechar chat' : 'Abrir chat com atendimento'}
      >
        {view === 'open' ? (
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12" /></svg>
        ) : displayOperator?.avatar_url ? (
          <img src={displayOperator.avatar_url} alt="" width={56} height={56} className="w-14 h-14 rounded-full object-cover" />
        ) : (
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" /></svg>
        )}
        {launcherBadge > 0 && (
          <span className="absolute -top-1 -right-1 min-w-5 h-5 px-1 rounded-full bg-red-500 text-white text-[11px] font-semibold flex items-center justify-center">
            {launcherBadge}
          </span>
        )}
      </button>
    </div>
  );
}
