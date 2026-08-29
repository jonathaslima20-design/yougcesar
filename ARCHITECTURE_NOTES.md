# ARCHITECTURE_NOTES — Estado atual (pré-internacionalização)

> Levantamento feito antes de qualquer mudança para a Fase 1 do plano de internacionalização.
> Objetivo: entender o fluxo de assinatura Mercado Pago (BR) hoje, o schema envolvido, a landing e o `netlify.toml`, para que a integração Stripe seja 100% aditiva.

## 1. Schema de assinatura SaaS (o lojista paga o VitrineTurbo)

Não confundir com `merchant_payment_credentials` / `merchant-payments` / `merchant-payment-webhook`, que são o **lojista recebendo** de clientes dele via Mercado Pago (marketplace). Aqui é o **VitrineTurbo cobrando o lojista** pela assinatura do SaaS.

Tabelas envolvidas: `users`, `subscription_plans`, `subscriptions`, `mp_payments`, `mercadopago_config`, `payment_webhook_events`.

⚠️ `subscription_plans` e `subscriptions` **não têm migration de criação** no diretório `supabase/migrations/` — foram criadas fora do controle de migrations (dashboard/SQL editor). O schema exato só pode ser confirmado consultando o banco diretamente antes de escrever a migração aditiva da Fase 1.

### `users` (colunas de assinatura)
- `plan_status`: `'active' | 'expired' | 'suspended' | 'free'`
- `plan_status_changed_at`
- `billing_cycle`: `'monthly' | 'quarterly' | 'semiannually' | 'annually'`
- `subscription_end_date`, `next_payment_date` (sincronizados por trigger a partir de `subscriptions`)
- `subscription_plan_name`
- `payments_test_override` (bool)

### `subscription_plans` (inferida por uso)
`id, name, duration ('Mensal'|'Trimestral'|'Semestral'|'Anual'|'Free'), price, checkout_url, is_active, display_order, product_limit, category_limit, created_at, updated_at`. **Sem coluna `currency`** — BRL implícito em todo o código. `Trimestral` está descontinuado.

### `subscriptions` (ciclo atual, separado de `mp_payments`)
`user_id, plan_name, plan_price, billing_cycle, status, payment_status, start_date, next_payment_date`. `plan_price` = valor total do ciclo (não mensal).

### `mp_payments`
`id, user_id, plan_id, billing_cycle, amount_cents, currency (default 'BRL'), payment_method ('pix'|'credit_card'), mp_payment_id (unique), status, status_detail, payer_email, payer_doc, pix_qr_code(_base64), pix_ticket_url, pix_expires_at, installments, card_last4, card_brand, environment, raw_response (jsonb), early_renewal`.

### `mercadopago_config`
Linha única, apenas via `service_role`: `environment, public_key_test/prod, access_token_test/prod, webhook_secret, notification_url, is_active`.

### Preços atuais (BRL, hardcoded)
Fonte: `src/lib/pricingPlans.ts:33-61` (landing/pricing) — **não** vem de `subscription_plans` nessa tela; o checkout usa `useSubscriptionPlans.ts` para ler do banco. Duas fontes de preço BR coexistem hoje.
- Mensal: R$57/mês
- Semestral: R$229/6 meses (~R$38,17/mês) — "Economize 33%"
- Anual: R$336/ano (~R$28/mês) — "Economize 51%", inclui API REST e remoção de logomarca
- Free: 20 produtos, 5 categorias

## 2. Fluxo de criação/confirmação da assinatura MP

**Frontend**: `src/pages/dashboard/CheckoutPage.tsx` (abas Pix/Cartão, `@mercadopago/sdk-react`) → `src/lib/mpPayments.ts` → edge function **`mercadopago`** (`supabase/functions/mercadopago/index.ts`), ações `createPixPayment` / `createCardPayment` / `getPaymentStatus` / `getPublicKey`.

Dentro de `mercadopago/index.ts`: resolve desconto (`resolveOfferDiscount`), cria registro `mp_payments` (`pending`), chama API MP (`external_reference` = id da linha), retorna QR Pix ou processa cartão. **Cartão aprovado síncrono → chama `activatePlan()` ali mesmo** (linhas ~254-354, ~692).

**Confirmação assíncrona**: `mp-webhook/index.ts` — valida HMAC (`x-signature`/`x-request-id`), grava em `payment_webhook_events` (idempotência por `mp_event_id`), busca o pagamento real na API MP, localiza `mp_payments`, atualiza status, e se `approved` e ainda não estava, chama `activatePlan()` (lógica **duplicada** em relação a `mercadopago/index.ts`).

`activatePlan()` (duplicada nos dois arquivos): calcula meses pelo `billing_cycle`, calcula `expiresAt` (considera `early_renewal`), upsert em `subscriptions` (`status='active', payment_status='paid'`) + `users.plan_status='active'` + `users.billing_cycle`.

**Checagem de acesso pago** — não existe função/view SQL (`is_subscriber`); é 100% no frontend:
- `src/hooks/useSubscriptionCheck.ts:19-46` → `hasAccess = plan_status === 'active' || plan_status === 'free'`
- `src/components/SubscriptionBlocker.tsx` → guard global, força modal quando `expired`/`suspended`
- Bloqueio pós-graça é feito pelo cron `check-expiring-subscriptions`, que só grava `plan_status` (sem RPC dedicada)

**Implicação para a Fase 1**: como não existe `is_subscriber()` único, o item 2.6 do plano (status unificado independente do provedor) precisa ser criado do zero — é o ponto certo para introduzir essa função sem tocar no fluxo MP existente.

## 3. Estrutura da landing e funil público

`src/pages/LandingPage.tsx` — **SPA client-side puro, sem SSR/prerender** (`index.html` só tem `<div id="root">`, Vite + `@vitejs/plugin-react`, nenhum plugin de SSR). Textos 100% hardcoded em PT-BR inline no JSX.

Já existe um `src/lib/i18n.ts`, mas é escopado só para a vitrine do lojista/comprador (formatação de moeda/data em `CorretorPage.tsx`, `ProductDetailsPage.tsx`), **não** cobre landing, registro, checkout ou dashboard — não serve como base para o i18n de produto/landing da Fase 2, que precisará de `react-i18next` como o plano define.

Páginas do funil público:
- `src/pages/LandingPage.tsx` — rota `/` (só quando não é domínio customizado)
- `src/pages/RegisterPage.tsx` — rota `/register`
- `src/pages/PlansSharePage.tsx` — rota `/planos`, reusa `PricingCard`/`PAID_PLANS`
- `src/pages/LoginPage.tsx`, `src/pages/CompleteProfilePage.tsx`
- Rotas centrais em `src/App.tsx:262-272`

## 4. `netlify.toml` (referência)

- `command = "npx vite build"`, `publish = "dist"`, `NODE_VERSION = 20`
- Edge functions: `/sitemap.xml` → `sitemap`; `/*` → `meta-handler`
- Redirect SPA: `/* → /index.html` (200)
- CSP atual libera: `*.supabase.co`, `auth.vitrineturbo.com`, `*.bolt.host`, Meta Pixel (`connect.facebook.net`, `www.facebook.com`), Google (`googletagmanager.com`, `googleadservices.com`, `google.com`, `google.com.br`, `pagead2.googlesyndication.com`, `googleads.g.doubleclick.net`), Mercado Pago (`sdk.mercadopago.com`, `*.mercadopago.com`, `api.mercadopago.com`, `events.mercadopago.com`, `http2.mlstatic.com`, `*.mlstatic.com`)
- **Nenhum domínio Stripe liberado ainda** — Fase 1 precisa adicionar `js.stripe.com`, `api.stripe.com`, `checkout.stripe.com`, `hooks.stripe.com` em `script-src`/`connect-src`/`frame-src` conforme o caso, **sem remover** nada existente (já houve incidente de CSP quebrando Ads/Pixel — ver memória do projeto).

## 5. Edge functions relevantes

- **`mp-admin`**: painel admin de credenciais MP (`getConfig`/`saveConfig`/`testCredentials`), valida prefixo `APP_USR-`/`TEST-`.
- **`check-expiring-subscriptions`**: cron (`CRON_SECRET`, pg_cron) — sincroniza `subscription_end_date`, notifica expiração em 7 dias, aplica período de graça (`GRACE_PERIOD_DAYS=2`) e bloqueia `plan_status`.

## 6. Pontos de atenção para a Fase 1

1. **Duas fontes de preço BR** (`pricingPlans.ts` hardcoded vs `subscription_plans` no banco) — o novo mapa de preços multi-moeda (2.3/3.4 do plano) deve ser uma terceira fonte só para os países Stripe, sem tentar unificar com as duas existentes (fora de escopo, risco de regressão no BR).
2. **`activatePlan()` duplicada** em `mercadopago/index.ts` e `mp-webhook/index.ts` — ao criar o equivalente Stripe, replicar o padrão (função própria no `stripe-webhook`), não tentar compartilhar código com o MP para não acoplar os dois provedores.
3. **Sem `is_subscriber()` única** — criar agora, mas fazendo `plan_status`/`subscriptions` continuarem sendo a fonte para BR (a função só lê e unifica, não migra dados).
4. **`subscription_plans`/`subscriptions` sem migration de criação** — antes de escrever a migração aditiva da 2.6, confirmar o schema real direto no banco (consulta read-only), não assumir pelas colunas inferidas acima.
