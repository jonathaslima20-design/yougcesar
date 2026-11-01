# Plano — Chat com Operador Comercial + Monitoramento de Visitantes

> Status: **rascunho para validação** (2026-10-31). Nada implementado.
> Escopo: landing page (`/`, `LandingPage.tsx`) + novo módulo no admin (`/admin/*`).

---

## 0. Resumo executivo

- **Visitante não abre WebSocket até precisar.** Presença é feita por *heartbeat HTTP* (RPC a cada 30 s, só com aba visível). A conexão Realtime só é aberta quando o chat é exibido. Isso corta o maior custo (conexões simultâneas) em ~80–95%, porque a maioria dos visitantes nunca interage com o chat.
- **Visitante anônimo nunca lê tabelas diretamente.** Toda escrita/leitura do visitante passa por RPCs `SECURITY DEFINER` que validam um `session_token` secreto. Tabelas novas têm RLS ligado, **sem nenhuma policy para `anon`**, e leitura total só para `is_admin()`.
- **Mensagens em tempo real via Realtime Broadcast** (não `postgres_changes`), disparado pelo banco (`realtime.send` em trigger). Admin escuta um canal **privado** (autorizado por RLS em `realtime.messages`); o visitante escuta um canal cujo nome é derivado de um token impossível de adivinhar.
- **Widget 100% fora do caminho crítico:** chunk separado, importado só depois de `load` + `requestIdleCallback` + delay configurado. Impacto em LCP ≈ zero.
- **3 toggles independentes** em `site_settings`: `visitor_tracking_enabled`, `chat_widget_enabled`, `chat_typing_indicator_enabled`. Lidos por 1 RPC pública cacheável.
- **Retenção:** `pg_cron` diário apaga sessões sem chat após 7 dias e conversas após 90 dias (configurável); WhatsApp coletado expira junto com a conversa.

---

## 1. Arquitetura proposta

```
┌──────────────────────── LANDING (vitrineturbo.com) ─────────────────────────┐
│ LandingPage.tsx                                                             │
│   └─ <LiveChatLoader/>  (≈1 KB, no bundle principal)                        │
│        1. espera window 'load' + requestIdleCallback                        │
│        2. GET rpc get_live_chat_public_config()  → toggles + delay          │
│        3. se tracking ON → visitorHeartbeat (fetch keepalive, 30 s)         │
│        4. após X s → import('./LiveChatWidget')  (chunk separado)           │
│             └─ abre canal Realtime  chat:<channel_key>  (só aqui!)          │
└──────────────┬───────────────────────────────────────────┬──────────────────┘
               │ RPCs (PostgREST, anon)                    │ WebSocket (Broadcast)
               ▼                                           ▼
┌──────────────────────────────── SUPABASE ───────────────────────────────────┐
│ Tabelas (RLS ON, zero policy anon):                                         │
│   live_chat_operators · visitor_sessions · chat_conversations ·             │
│   chat_messages                                                             │
│ RPCs anon (SECURITY DEFINER, validam session_token):                        │
│   visitor_session_start · visitor_heartbeat · chat_open_conversation ·      │
│   chat_send_visitor_message · chat_submit_whatsapp · chat_fetch_messages ·  │
│   visitor_forget_me                                                         │
│ RPCs admin (checam is_admin(), REVOKE anon):                                │
│   admin_list_active_visitors · admin_send_operator_message · ...            │
│ Triggers → realtime.send():                                                 │
│   nova msg  → 'chat:<channel_key>' (visitante)  + 'admin:live-chat' (priv.) │
│   heartbeat → 'admin:visitors' (priv., throttled)                           │
│ pg_cron: expirar sessões inativas, limpar dados antigos                     │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │ WebSocket privado (JWT admin)
                                       ▼
┌────────────────────────────── ADMIN (/admin) ───────────────────────────────┐
│ /admin/live-chat            Inbox: fila + conversa + painel do lead         │
│ /admin/live-visitors        Visitantes ativos agora                         │
│ /admin/live-chat/operators  CRUD de operadores fictícios                    │
│ /admin/live-chat/settings   Toggles, delay, respostas rápidas, retenção     │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Por que não usar Presence para os visitantes?
O Presence do Supabase exige que **cada visitante mantenha um WebSocket aberto** durante a visita inteira. Cada aba conta como uma conexão simultânea (é o que se paga no Realtime). Com heartbeat HTTP:
- custo vira uma escrita leve no banco a cada 30 s por aba visível (UPSERT de 1 linha);
- o admin recebe o "agora" por Broadcast disparado pelo banco, ou por *polling* de 10 s como fallback;
- Presence fica reservado ao **digitando…** dentro de uma conversa já aberta, onde o socket já existe.

### Por que Broadcast e não `postgres_changes`?
- `postgres_changes` faz o Realtime avaliar RLS **por linha e por assinante**, o que escala mal, e exigiria dar SELECT para `anon` nas tabelas. Isso contraria a lição do incidente de RLS de 2026-08-09.
- Broadcast disparado por trigger (`realtime.send`) entrega só o payload mínimo, e o canal admin é privado (RLS em `realtime.messages` com `is_admin()`).

---

## 2. Identificação de sessão anônima

| Item | Onde | Conteúdo | Vida útil |
|---|---|---|---|
| `vt_vid` | `localStorage` | `visitor_id` (UUID v4) → identifica **o navegador** entre visitas (ex.: "3ª visita") | 180 dias |
| `vt_sess` | `sessionStorage` | `{ session_id, session_token }` → uma **aba/visita** | até fechar a aba |
| `vt_chat` | `localStorage` | `{ conversation_id, channel_key, token }` → reabre a conversa se o visitante voltar em até 24 h | 24 h |

- `session_token` = 32 bytes aleatórios gerados **no servidor** (`gen_random_bytes`); o banco guarda só o **hash** (`sha256`). Toda RPC do visitante recebe `(session_id, token)` e confere o hash, então ninguém consegue ler ou escrever na conversa de outro visitante só sabendo o UUID.
- `channel_key` = outro valor aleatório, usado como nome do canal Broadcast do visitante (`chat:<channel_key>`). Canal público, mas não enumerável.
- Sem cookies HTTP: nada vai para o servidor automaticamente.
- **Não usar `supabase.auth.signInAnonymously()`**. Ele criaria uma linha em `auth.users` por visitante e conflitaria com os dois clientes Supabase (merchant/buyer) que já disputam a sessão (ver incidente da corrida de OAuth). O widget usa um **cliente Supabase dedicado e sem auth** (`persistSession: false`, `autoRefreshToken: false`, `detectSessionInUrl: false`), carregado só no chunk do widget.

---

## 3. Modelagem de dados

### 3.1 `live_chat_operators` — perfis fictícios
| campo | tipo | nota |
|---|---|---|
| id | uuid PK | |
| display_name | text | "Camila" |
| role_title | text | "Consultora comercial" |
| avatar_url | text | Storage bucket público `live-chat-avatars` (imagem pequena, webp ≤ 20 KB, **sem transformação** — ver incidente de custo de imagens) |
| greeting_override | text null | saudação própria opcional |
| is_active | bool default true | |
| weight | int default 1 | peso no sorteio |
| created_at / updated_at | timestamptz | |

### 3.2 `visitor_sessions` — uma por aba/visita
| campo | tipo | nota |
|---|---|---|
| id | uuid PK | `session_id` |
| visitor_id | uuid | do `localStorage`; não é FK |
| token_hash | bytea | sha256 do token |
| operator_id | uuid FK → operators null | sorteado na criação; fixo na sessão |
| started_at | timestamptz | |
| last_seen_at | timestamptz | atualizado pelo heartbeat |
| last_interaction_at | timestamptz | último scroll/click/tecla (enviado no heartbeat) |
| current_path | text | `/`, `/blog/...` |
| current_section | text null | `hero`, `pricing`, `faq`… via IntersectionObserver |
| sections_seen | text[] | sem duplicatas, máx. ~15 |
| referrer_host | text null | só o host, não a URL completa |
| utm_source / utm_medium / utm_campaign | text null | |
| device | text | `mobile`/`desktop` (derivado do viewport, sem fingerprint) |
| country | text null | se já detectado por `useDetectedCountry` |
| visit_number | int | contador por `visitor_id` |
| consent_analytics | bool | snapshot do consentimento no início |
| ended_at | timestamptz null | `pagehide` via `sendBeacon` ou cron por timeout |

Índices: `(last_seen_at DESC) WHERE ended_at IS NULL`, `(visitor_id)`.

**Status derivado (não armazenado):** `ativo` = `now() - last_interaction_at < 60 s`; `inativo` = heartbeat vivo mas sem interação; `saiu` = `last_seen_at` > 90 s ou `ended_at` preenchido.

### 3.3 `chat_conversations`
| campo | tipo | nota |
|---|---|---|
| id | uuid PK | |
| session_id | uuid FK → visitor_sessions ON DELETE SET NULL | |
| visitor_id | uuid | para juntar visitas futuras |
| operator_id | uuid FK → operators | persona exibida |
| channel_key | text unique | nome do canal do visitante |
| token_hash | bytea | pode reaproveitar o da sessão; separado permite retomar em outra aba |
| status | text check (`bot_only`, `open`, `pending`, `closed`) | `bot_only` = só a saudação automática, visitante não respondeu |
| assigned_admin_id | uuid FK → auth.users null | qual pessoa da equipe assumiu |
| whatsapp_e164 | text null | normalizado `+55…` |
| whatsapp_submitted_at | timestamptz null | |
| visitor_name | text null | opcional, se pedirmos |
| unread_for_admin | int default 0 | |
| last_message_at | timestamptz | ordenação da fila |
| last_message_preview | text | 120 chars |
| visitor_typing_at / admin_typing_at | — | **não persistir** — vai por Presence/Broadcast |
| created_at / closed_at | timestamptz | |
| expires_at | timestamptz | `created_at + retenção` |

### 3.4 `chat_messages`
| campo | tipo | nota |
|---|---|---|
| id | bigint identity PK | ordem estável |
| conversation_id | uuid FK ON DELETE CASCADE | |
| sender | text check (`visitor`, `operator`, `system`) | `system` = saudação automática e avisos |
| admin_user_id | uuid null | quem da equipe enviou (auditoria interna) |
| body | text check (length ≤ 2000) | |
| kind | text check (`text`, `quick_reply`, `whatsapp_card`) | |
| created_at | timestamptz | |
| read_at | timestamptz null | ✓✓ opcional |

Índice: `(conversation_id, id)`.

### 3.5 `site_settings` (já existe) — novas chaves
| setting_name | default | |
|---|---|---|
| `visitor_tracking_enabled` | `false` | liga o heartbeat |
| `chat_widget_enabled` | `false` | mostra o pop-up |
| `chat_typing_indicator_enabled` | `true` | Presence de "digitando" |
| `chat_open_delay_seconds` | `25` | |
| `chat_open_on_mobile` | `true` | |
| `chat_quick_replies` | JSON `["Quanto custa?","Funciona pro meu segmento?","Quero falar no WhatsApp"]` | |
| `chat_offline_behavior` | `ask_whatsapp` | ver decisão D3 |
| `chat_business_hours` | JSON | ver decisão D3 |
| `live_data_retention_days` | `{ sessions: 7, conversations: 90 }` | |

Leitura pública só por `get_live_chat_public_config()`, que devolve **apenas** essas chaves. Não abrir `site_settings` inteira para anon além do que já está aberto hoje (verificar policy atual antes).

### 3.6 Diagrama de relações
```
live_chat_operators 1 ── * visitor_sessions 1 ── 0..1 chat_conversations 1 ── * chat_messages
                    1 ─────────────────────────── * chat_conversations
```

---

## 4. Segurança / RLS

1. `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` nas 4 tabelas **e conferir `relrowsecurity`** depois de aplicar (lição de 2026-08-09).
2. Policies: `SELECT/INSERT/UPDATE/DELETE` só `USING (public.is_admin())`. **Nenhuma policy para `anon`/`authenticated` comum.**
3. RPCs do visitante: `SECURITY DEFINER`, `SET search_path = public`, `GRANT EXECUTE TO anon`. Todas validam o token e aplicam rate limit (ex.: máx. 20 mensagens/min por sessão e 3 conversas/h por `visitor_id`).
4. RPCs admin: `REVOKE ALL FROM anon, public` + checagem `is_admin()` no corpo (padrão já usado em Vendas Online).
5. Realtime Authorization: policy em `realtime.messages` permitindo `SELECT` em tópicos `admin:%` só se `is_admin()`. Canal `chat:<channel_key>`: o visitante só **escuta**, porque mensagens entram via RPC e saem via trigger. Isso impede que alguém injete mensagens falsas direto no canal.
6. Sanitização: renderizar `body` como texto puro (sem HTML/markdown) nos dois lados.
7. Anti-spam do campo WhatsApp: validar no servidor com regex BR (`^\+55\d{10,11}$`) e opcionalmente exigir 1 mensagem prévia.

---

## 5. Fluxos principais

### 5.1 Visitante chega
1. `LiveChatLoader` monta após `load` + idle. Chama `get_live_chat_public_config()` (resposta pequena; pode ir com `Cache-Control` curto via edge function se quiser poupar banco).
2. Se `visitor_tracking_enabled` **e** consentimento compatível (ver §7) → `visitor_session_start()` → recebe `session_id`, `token`, `operator` sorteado.
3. Heartbeat a cada 30 s **só com `document.visibilityState === 'visible'`**: envia `current_section`, `last_interaction_at`. `pagehide` → `navigator.sendBeacon` para encerrar.

### 5.2 Chat abre
1. Após `chat_open_delay_seconds` (contando só tempo com aba visível), se `chat_widget_enabled` e o visitante não fechou o chat nesta visita → `import('LiveChatWidget')`.
2. Primeiro aparece só um **balão-teaser** com avatar + "digitando…" por 1,5 s e depois a saudação. Ainda **sem** WebSocket e sem criar conversa (saudação gerada no cliente).
3. A conversa só é criada (`chat_open_conversation`) quando o visitante **responde** (texto ou resposta rápida). Assim, 0 linhas em `chat_conversations` para quem ignora o pop-up, e o socket só abre nesse momento.
4. Saudação: `Bom dia` 05–11h59, `Boa tarde` 12–17h59, `Boa noite` 18–04h59, no fuso **America/Sao_Paulo** (decisão D7), mais o nome do operador e a CTA.

### 5.3 Troca de mensagens
- Visitante → `chat_send_visitor_message` → insert → trigger → `realtime.send` em `admin:live-chat` (+ eco em `chat:<key>` para multi-aba).
- Admin → `admin_send_operator_message` → insert → trigger → `chat:<key>`.
- Reconexão: ao reabrir o socket, o widget chama `chat_fetch_messages(after_id)` para cobrir o que perdeu (Broadcast não guarda histórico).

### 5.4 WhatsApp
- Botão "Prefiro falar pelo WhatsApp" abre um mini-form inline (DDD + número, máscara BR) **com texto de consentimento** (§7).
- `chat_submit_whatsapp` → salva `whatsapp_e164`, insere mensagem `whatsapp_card`, status `pending`, notifica admin.
- No admin: card destacado com botão **Abrir no WhatsApp** → `https://wa.me/55XXXXXXXXXXX?text=<mensagem pré-preenchida com nome do operador e contexto>`. Nenhuma API, nenhum envio automático.
- Opcional: botão "Copiar número" e marcar "contatado no WhatsApp" (status `closed` + motivo).

### 5.5 Digitando…
- Admin → visitante: Broadcast efêmero no `chat:<key>` (`event: typing`) enviado pelo admin autenticado. Exige policy de INSERT em `realtime.messages` para admins nesse padrão de tópico.
- Visitante → admin: o visitante **não pode** publicar no canal admin. Opção: Broadcast no próprio `chat:<key>`, que o admin também escuta enquanto a conversa está aberta na tela. Throttle de 1 evento a cada 2 s.
- Desligável por `chat_typing_indicator_enabled`.

---

## 6. Performance da landing (Core Web Vitals)

| Medida | Efeito |
|---|---|
| `LiveChatLoader` minúsculo, no bundle da landing; widget em `lazy(() => import(...))` com chunk próprio | 0 KB do widget no carregamento inicial |
| Carregar só após `load` + `requestIdleCallback` (fallback `setTimeout 3s`) | não compete com LCP/hero |
| `@supabase/realtime-js` só entra no chunk do widget, e o socket só abre na 1ª resposta | sem WS em ~90% das visitas |
| Botão flutuante com tamanho fixo (`position: fixed`, dimensões reservadas) | CLS = 0 |
| Animações só com `transform/opacity`; **sem framer-motion no widget** (é pesado; CSS transitions bastam) | chunk < ~25 KB gz alvo |
| Avatares webp pequenos com `width/height`, `loading="lazy"`, sem image transform do Supabase | sem custo de transformação |
| Handlers de interação (`scroll`, `pointerdown`, `keydown`) `passive` e com throttle; só gravam timestamp em memória | INP intacto |
| Heartbeat com `fetch(..., { keepalive: true })`, sem bloquear o main thread | — |
| **Não exibir em rotas de loja (`/:slug`)**, só na landing institucional e, se desejado, blog/ajuda | não afeta lojistas |
| Coordenar com o `CookieConsentBanner`: o chat nunca abre enquanto o banner estiver visível (os dois disputam o canto inferior) | evita sobreposição e duplo pop-up |

Meta de verificação: Lighthouse/PSI antes e depois em mobile; LCP e TBT sem regressão > 50 ms.

---

## 7. LGPD — onde precisa de aviso/consentimento

> Não é parecer jurídico; é o mapeamento técnico para validar com quem cuida do jurídico.

| Dado | Base legal sugerida | Implementação |
|---|---|---|
| Monitoramento de navegação (seção, tempo, UTM, referrer) | **Consentimento**: categoria *Analytics* do banner já existente | Heartbeat só roda se `hasCookieConsent('analytics')`. Sem consentimento: chat pode funcionar, mas **sem** entrar na lista de "visitantes ao vivo" (ou entra como sessão mínima sem seções/UTM; decisão D5) |
| `localStorage` (`vt_vid`, `vt_sess`, `vt_chat`) | `vt_sess`/`vt_chat` = necessário para o chat funcionar quando o usuário o usa; `vt_vid` (reconhecer visitas) = analytics | Documentar na Política de Cookies (`CookiesPolicyPage.tsx`) |
| Conteúdo do chat | Execução de procedimentos preliminares a contrato / legítimo interesse, iniciados pelo titular | Aviso curto no rodapé do widget: "Ao conversar, você concorda com nossa Política de Privacidade" (link) |
| Número de WhatsApp | **Consentimento explícito e específico** | Texto junto ao campo: "Autorizo a VitrineTurbo a me contatar por WhatsApp sobre este atendimento." Salvar `whatsapp_consent_at` + versão do texto |
| Persona fictícia | Transparência / CDC | ver Risco R1 |

**Retenção e exclusão**
- `pg_cron` diário: sessões sem conversa apagadas após **7 dias**; conversas (incluindo WhatsApp) após **90 dias** sem atividade (ou ao converter em cliente → decisão D8).
- Botão "Apagar esta conversa" no widget → `visitor_forget_me(token)` apaga sessão, conversa e mensagens.
- Integração com o fluxo existente de **Solicitações de Privacidade** (`/admin/privacy-requests`, `DataDeletionPage.tsx`): buscar por número de WhatsApp e apagar conversas.
- Atualizar `PrivacyPolicyPage` / Central Jurídica (`/admin/legal`) com: finalidade, retenção, operadores (Supabase como suboperador), direito de exclusão.
- IP: **não armazenar**. País vem do detector já existente.

---

## 8. Custo de Supabase Realtime

> ⚠️ Os números abaixo são de memória e **precisam ser conferidos** na página de preços atual da Supabase antes de decidir. O projeto está no plano **Pro** (inferido pela fatura de 2026-10).

Referência (Pro, aproximado): ~**500 conexões Realtime simultâneas** e ~**5 milhões de mensagens/mês** incluídas; acima disso cobrança por pico de conexões (blocos de 1.000) e por milhão de mensagens. Limite de mensagens/segundo por projeto também existe.

### Modelo de consumo com a arquitetura proposta
| Fonte | Conexões | Mensagens |
|---|---|---|
| Visitante só navegando | **0** (heartbeat HTTP) | 0 Realtime; ~2 req/min ao PostgREST |
| Visitante que respondeu o chat | 1 enquanto o chat está ativo | ~N mensagens × 2 (eco) + typing |
| Admin com painel aberto | 1 por pessoa da equipe | recebe tudo de `admin:*` |
| Heartbeat → `admin:visitors` | — | 1 por heartbeat **só se algum admin estiver no painel** (o trigger checa uma flag `admin_watching` com TTL); senão 0 |

**Cenário exemplo:** 5.000 visitas/dia, 3% respondem o chat (150 conversas), 15 mensagens cada → ~4,5k mensagens de chat/dia + typing ≈ **~250k mensagens/mês**; conexões simultâneas de pico raramente > 20. **Cabe com folga no Pro.**

**Quando passaria do limite:** com Presence para *todos* os visitantes, 500 conexões = ~500 pessoas simultâneas na landing (campanha de tráfego pago). Por isso a recomendação de heartbeat HTTP.

**Custo de banco (heartbeat):** 5.000 visitas × ~3 min médios × 2/min = ~30k UPSERTs/dia em uma tabela pequena. Irrelevante para CPU. Lembrete do diagnóstico de 2026-10-18: PostgREST usa pool próprio, então não abre conexões novas.

**Válvulas de custo:** os 3 toggles + `chat_open_delay_seconds` alto + fechamento automático do socket após 5 min sem mensagens (reabre sob demanda).

---

## 9. Telas e componentes novos

### Landing (`src/components/liveChat/`)
- `LiveChatLoader.tsx`: gate de idle, config, consentimento, heartbeat, timer
- `LiveChatWidget.tsx` (lazy): container, estado, canal
- `ChatLauncherButton.tsx`: bolinha flutuante com avatar + badge
- `ChatTeaserBubble.tsx`: balão de saudação antes de abrir
- `ChatWindow.tsx`, `ChatMessageList.tsx`, `ChatMessageBubble.tsx`, `TypingDots.tsx`
- `QuickReplies.tsx`, `ChatComposer.tsx`, `WhatsAppCaptureForm.tsx`
- `src/lib/liveChat/` → `visitorSession.ts`, `heartbeat.ts`, `chatClient.ts` (cliente Supabase sem auth), `greeting.ts`, `sectionObserver.ts`

### Admin
| Rota | Tela | Conteúdo |
|---|---|---|
| `/admin/live-chat` | **Inbox** | 3 colunas: fila (abas *Pendentes / Abertas / Encerradas*, badge de não lidas, som opcional) · conversa (histórico, composer, digitando…, respostas prontas do operador) · painel do lead (card WhatsApp com botão wa.me, seção atual, tempo na página, origem/UTM, nº da visita) |
| `/admin/live-visitors` | **Ao vivo** | Tabela: visitante (anônimo #curto), página/seção, tempo de sessão, ativo/inativo/saiu, origem, dispositivo, "tem chat?" + botão **Iniciar conversa** (operador puxa o visitante proativamente; decisão D6) |
| `/admin/live-chat/operators` | **Operadores** | CRUD: nome, cargo, foto (upload), peso, ativo, prévia do balão |
| `/admin/live-chat/settings` | **Configurações** | 3 toggles com explicação de custo, delay, mobile on/off, respostas rápidas, horário comercial/offline, retenção, botão "Limpar dados agora" |

- Entrada no `AdminSidebar.tsx`: grupo novo **"Atendimento"** com Inbox (badge de pendentes), Ao vivo, Operadores, Configurações. Segue a regra de telas dedicadas porque não existe fluxo de atendimento hoje.
- Hook global leve no layout admin (`useLiveChatUnreadBadge`) que escuta `admin:live-chat` só se `chat_widget_enabled`, para mostrar badge e notificação do navegador mesmo fora da Inbox.
- Páginas admin importadas com `lazy()`; hoje são estáticas no `App.tsx`, então não aumentar o bundle principal.

---

## 10. Integração com o que já existe (sem quebrar)

- **Rotas:** só rotas novas sob `/admin/`; nenhuma rota existente muda.
- **`LandingPage.tsx`:** 1 linha (`<LiveChatLoader/>`) + `data-section` nas seções existentes para o IntersectionObserver. Não mexer em layout.
- **`CookieConsentBanner`/`cookieConsent.ts`:** só leitura (`hasCookieConsent`) + escutar evento de mudança de consentimento (adicionar um `window.dispatchEvent` em `saveCookiePreferences` se ainda não houver).
- **Clientes Supabase existentes:** intocados. O widget usa um cliente próprio sem auth.
- **`site_settings`:** só INSERT de novas chaves (padrão da migration do footer).
- **Branches:** desenvolver em branch própria a partir de `main`. Migrations e edge functions exigem deploy manual (fluxo já conhecido). Push agrupado.
- **Testes:** só com RPCs de leitura para verificar migrations. Escrever mensagens de teste pelo próprio widget em dev, nunca chamando RPCs de escrita direto em produção.

---

## 11. Fases de implementação

| Fase | Entrega | Complexidade | Estimativa* |
|---|---|---|---|
| **0. Fundações** | Migrations (4 tabelas, RLS, chaves `site_settings`), RPCs públicas/admin, policy `realtime.messages`, cron de limpeza, cliente sem auth | Média | 1–1,5 dia |
| **1. MVP chat** | Widget (launcher, teaser, saudação por horário, **1 operador fixo**, texto livre + respostas rápidas), Inbox admin simples (fila + conversa + responder), toggle `chat_widget_enabled`, aviso LGPD no widget | Média-alta | 2–3 dias |
| **2. WhatsApp** | Form de captura com consentimento, card no admin com wa.me + mensagem pré-preenchida, status `pending`, notificação/badge | Baixa | 0,5–1 dia |
| **3. Operadores múltiplos** | CRUD + upload de avatar, sorteio ponderado na sessão, persona fixa por `visitor_id` em visitas futuras (opcional) | Baixa-média | 1 dia |
| **4. Monitoramento ao vivo** | Heartbeat com consentimento, IntersectionObserver de seções, tela Ao vivo, toggle `visitor_tracking_enabled`, broadcast condicionado a admin assistindo | Média | 1,5–2 dias |
| **5. Typing + polimento** | Digitando… bidirecional, ✓✓ lido, som/notificação do navegador, reconexão robusta, "iniciar conversa" proativo, horário comercial/offline | Média | 1,5 dia |
| **6. LGPD/retensão final** | Atualizar políticas, `visitor_forget_me`, integração com Solicitações de Privacidade, tela de config de retenção | Baixa-média | 1 dia |

\* Dias de trabalho focado, incluindo testes em dev. Total ≈ **9–11 dias**.

**Sugestão de ordem:** 0 → 1 → 2 já entrega valor (lead → WhatsApp). A 4 (monitoramento) pode até vir antes da 3 se você quiser ver o tráfego primeiro.

---

## 12. Riscos

| # | Risco | Mitigação |
|---|---|---|
| R1 | **Persona fictícia + mensagem automática que parece humana.** Se ninguém responde, o visitante se sente enganado. Há também risco de prática enganosa (CDC art. 37) e de dano à marca se for exposto | Persona = "nome de atendimento" usado por pessoas reais da equipe (prática comum). Saudação inicial não deve afirmar algo falso. Fora do horário/sem ninguém online, informar prazo de resposta e oferecer WhatsApp em vez de manter "digitando…" falso. Fotos: **ilustrações ou imagens geradas/licenciadas, nunca foto de pessoa real sem autorização** |
| R2 | Ninguém da equipe online → conversas morrem | Status "online" do admin (Presence no painel); se nenhum admin online, widget muda para modo `ask_whatsapp` |
| R3 | Spam/abuso via RPC anônima | Rate limit no banco, limite de tamanho, captcha **só** se houver abuso real |
| R4 | Regressão de CWV | Gate de idle + chunk separado + medir PSI antes/depois |
| R5 | Sobreposição com banner de cookies e botões flutuantes existentes da landing | Regra de exibição única + posição coordenada |
| R6 | Custos inesperados | Toggles default **OFF**, broadcast de visitantes só com admin assistindo, alerta manual no painel Supabase |
| R7 | Bloqueadores de anúncio/tracking cortam o heartbeat | Aceitável: só afeta o monitoramento, não o chat (mesmo domínio Supabase) |
| R8 | Realtime Authorization (canais privados) exige versão/config recente do projeto | Verificar na Fase 0; fallback = canal admin com nome secreto + polling |

---

## 13. Decisões em aberto (preciso da sua validação)

- **D1 — Heartbeat HTTP vs. Presence para visitantes.** Recomendo heartbeat (custo ~zero, latência de até 30 s na tela Ao vivo). Presence dá atualização instantânea, mas 1 conexão por visitante.
- **D2 — Quando criar a conversa no banco.** Recomendo só na 1ª resposta do visitante (saudação fica no cliente). Alternativa: registrar toda exibição do pop-up para medir taxa de abertura, o que gera mais linhas.
- **D3 — Comportamento sem operador online / fora do horário.** (a) pedir WhatsApp direto, (b) aceitar mensagem e avisar "respondemos em até X h", (c) esconder o chat.
- **D4 — Escopo de páginas.** Só `/` ou também blog, ajuda e planos? Nunca nas lojas dos lojistas (confirma?).
- **D5 — Visitante que recusou cookies de analytics.** (a) não monitorar e não mostrar chat, (b) mostrar chat mas sem monitoramento (recomendado), (c) monitorar minimamente.
- **D6 — Operador pode iniciar conversa proativamente** a partir da tela Ao vivo ("Vi que você está olhando os planos…")? Converte mais, mas é mais invasivo.
- **D7 — Fuso da saudação:** horário de Brasília fixo ou horário local do visitante? Relevante para a expansão MX/CL/ES/PT/US.
- **D8 — Retenção:** 7 dias (sessões) / 90 dias (conversas) está bom? Leads que viram clientes: manter conversa vinculada ao usuário?
- **D9 — Quem atende:** só você (super-admin) ou equipe? Se equipe, precisa de papel novo (ex.: `support`) sem acesso ao resto do admin. Isso muda `is_admin()` para algo como `can_handle_live_chat()`.
- **D10 — Idioma do widget:** só PT-BR no MVP ou já usar o i18n existente?
- **D11 — Persona fixa por visitante recorrente** (mesmo `visitor_id` volta e vê a mesma "Camila") ou sorteio a cada sessão como no pedido original? Recomendo fixa por visitante: é mais crível e evita "falei com a Camila ontem, hoje é o Rafael".

---

## 14. Decisões validadas (2026-10-31)

| # | Decisão |
|---|---|
| D1 | **Heartbeat HTTP a cada 30 s** (sem Presence para visitantes). |
| D3 | **Horário de funcionamento configurável** (dias da semana + início/fim, fuso America/Sao_Paulo) com toggle próprio. Fora do horário, **nada aparece para o visitante** (nem launcher, nem teaser). O horário é checado no servidor (`get_live_chat_public_config` devolve `chat_available`) e de novo antes de abrir. |
| D5 | **Funciona igual para quem recusou cookies de analytics.** ⚠️ Risco LGPD assumido pelo dono: a base legal passa a ser legítimo interesse (atendimento comercial), então a Política de Privacidade/Cookies precisa descrever o monitoramento e a retenção curta. IP não é armazenado e não há fingerprint. |
| D9 | **Só o administrador atende**, dentro do painel admin existente (`is_admin()`). Sem papel novo. |
| Demais | Adotadas as recomendações até nova decisão: D2 conversa criada na 1ª resposta; D4 só na landing `/`; D6 sem conversa proativa no MVP; D7 fuso de Brasília; D8 retenção 7 d / 90 d; D10 só PT-BR; D11 persona fixa por `visitor_id`. |

**Ajuste de modelagem:** as configurações ficaram em uma tabela própria de linha única, `live_chat_settings` (tipada, com JSON de horário), em vez de várias chaves em `site_settings`. A leitura pública acontece só via RPC.
