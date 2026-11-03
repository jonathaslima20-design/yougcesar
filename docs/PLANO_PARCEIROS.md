# Plano de Reestruturação — VitrineTurbo Partners

Elaborado em 03/11/2026. Ponto de partida: o programa atual (`/partners`), mapeado no código e nas migrações.

> **Objetivo:** transformar o Partners no principal canal de aquisição do VitrineTurbo. A meta é atrair **muitos parceiros qualificados**, ou seja, profissionais de marketing, agências e consultores de e-commerce. Esses parceiros trazem **muitos lojistas pagantes** e ganham **comissão recorrente**.

---

## 1. Resumo executivo

O programa atual funciona como motor de comissão: tem trigger, tiers, saque via PIX e criação de usuários. Ainda **não funciona como programa de parceiros**. Faltam quatro coisas:

1. **Uma porta de entrada.** Não existe página pública nem inscrição. Parceiros só entram se o admin criar a conta.
2. **Ferramentas para vender.** Há um único link, sem campanhas, materiais, proposta comercial ou funil.
3. **Motivos para ficar.** Não existem níveis com benefícios reais, metas, academia, comunidade nem reconhecimento.
4. **Proteção financeira e jurídica.** A comissão fica disponível para saque na hora, não há estorno automático e não há termos do programa.

A reestruturação se apoia em **4 pilares**:

| Pilar | O que entrega |
|---|---|
| **Atrair** | Página `/parceiros` com calculadora de ganhos, inscrição com aprovação, campanha de lançamento "Parceiros Fundadores" e presença onde agências estão. |
| **Equipar** | Painel novo: carteira de clientes, links e campanhas, funil, materiais, propostas, criação de lojas prontas e equipe da agência. |
| **Engajar** | Níveis (Parceiro → Prata → Ouro → Diamante), academia com certificação, metas, ranking, comunidade e suporte prioritário. |
| **Proteger** | Carência da comissão, estorno automático em reembolso/chargeback, antifraude, termos, LGPD e fluxo fiscal de pagamento. |

---

## 2. Diagnóstico do programa atual

### 2.1 O que existe hoje

| Área | Implementação | Arquivos |
|---|---|---|
| Papel `partner` | `users.role = 'partner'`, `is_partner()`, RLS de leitura e edição sobre `managed_by_partner_id` | `supabase/migrations/20260723010000_create_partners_role.sql` |
| Comissão | Trigger em `subscriptions` gera `partner_commissions` (nova/renovação) com idempotência por ciclo | `supabase/migrations/20260725000500_…`, `20260726000300_…` |
| Tiers | 0 ativos = 30%; 20+ ativos = 50% (editável pelo admin) | `20260725000000_create_partner_commission_tiers.sql` |
| Configurações | Interruptor geral, saque mínimo de R$ 50, carência de 7 dias para contar cliente ativo, prazo de 6h para pagamento de plano atribuído | `20260725000100_…`, `20260726000000_…` |
| Criar usuário | Parceiro cria conta de lojista com plano pago e acesso imediato; bloqueio automático se não pagar no prazo | `supabase/functions/create-user/index.ts`, `check-partner-pending-payments` |
| Painel | Dashboard, Usuários, Cadastrar Usuário, Meu Link, Comissões, Ajuda | `src/pages/partners/*` |
| Admin | Configurações, Tiers, Comissões e Saques | `src/pages/admin/PartnerManagementPage.tsx` |

### 2.2 Problemas encontrados

#### 🔴 Críticos (risco financeiro ou de segurança)

1. **Possível escalada de privilégio via RLS.** A policy `Partners can update managed users` libera UPDATE em **todas as colunas** do usuário gerenciado. A própria migração admite que não há restrição por coluna. Nas migrações não encontrei trigger nem GRANT por coluna que proteja `role`, `plan_status`, `managed_by_partner_id` ou `trial_ends_at`. Com isso, um parceiro pode, pela API, marcar um cliente como `plan_status = 'active'` sem pagamento ou alterar o `role` dele. **Isso precisa ser confirmado no banco de produção e corrigido antes de qualquer divulgação.** A correção é uma RPC com campos permitidos, ou um trigger `BEFORE UPDATE` que bloqueie colunas sensíveis quando quem edita é parceiro.
2. **A comissão fica disponível para saque no mesmo instante.** O status `pending` já entra no saldo "Disponível para saque". Se houver reembolso (fluxo lançado em 14/09) ou chargeback, o dinheiro já pode ter saído.
3. **Não existe estorno automático da comissão.** O status `reversed` existe, mas nenhum código do Partners o aplica. O programa de afiliados de loja já faz isso; o Partners, não.
4. **O plano anual paga 30–50% do valor anual inteiro de uma vez.** Um cancelamento com reembolso gera prejuízo direto.

#### 🟠 Estruturais

5. **A atribuição do link é frágil.**
   - O `?ref=` só é capturado na home (`src/pages/LandingPage.tsx:126`). Um link para `/catalogo-para-whatsapp?ref=X` perde a indicação.
   - O código fica só em `localStorage`, sem validade e preso ao dispositivo. Se o lead clica no celular e assina no computador, a indicação se perde.
   - Qualquer novo `?ref` sobrescreve o anterior, sem regra de prioridade.
6. **Partners e "indique e ganhe" do lojista estão misturados.** Os dois usam `referral_code`, `referral_clicks` e `referred_by`. Isso confunde relatórios e regras.
7. **Não há entrada pública.** O parceiro só existe se o admin criar a conta, então não escala.
8. **O parceiro define a senha do cliente na criação.** Isso é ruim para segurança, LGPD e confiança. O certo é convidar o cliente para assumir a conta.
9. **Os tiers contam usuários, não receita.** Um parceiro com 20 clientes no plano mais barato recebe o mesmo percentual de quem tem 20 clientes no plano mais caro. Também não há rebaixamento formal nem benefícios além do percentual.
10. **Tudo é fixo em BRL.** O texto da notificação e os valores do painel usam R$, o que conflita com a expansão i18n/Stripe.

#### 🟡 Experiência

11. O painel é um relatório, não uma ferramenta de trabalho. Faltam materiais, campanhas, funil, CRM, metas, academia e saúde da carteira.
12. Não existe comunicação com o parceiro: nada de e-mail de boas-vindas, trilha de ativação, newsletter ou comunidade.
13. O Partners não aparece no site: nem no rodapé, nem na landing, nem no blog.

> ⚠️ Não consegui consultar o banco de produção nesta análise, porque o conector do Supabase só tem acesso a outro projeto. Antes de definir metas, vale levantar: nº de parceiros, clientes por parceiro, MRR vindo de parceiros, comissões geradas/pagas e churn dos clientes de parceiros. As consultas estão no **Anexo A**.

---

## 3. Posicionamento e proposta de valor

**Nome:** VitrineTurbo Partners. Mantém a marca atual.

**Promessa:** *"Monte lojas online para seus clientes em minutos e ganhe comissão recorrente todo mês, enquanto eles venderem."*

### Para quem

| Perfil | Como atua | O que mais valoriza |
|---|---|---|
| **Freelancer / social media** | Indica para a própria carteira, monta lojas simples | Renda recorrente, facilidade, materiais prontos |
| **Agência de marketing** | Monta e opera lojas dos clientes, vende como serviço | Gestão de várias lojas, equipe, marca própria, margem |
| **Consultor de e-commerce / gestor de tráfego** | Recomenda a plataforma no projeto | Ferramenta confiável, comissão, autoridade (certificação) |
| **Criador de conteúdo / educador** | Indica para a audiência | Link rastreável, cupom, bônus por volume |

### Por que o parceiro escolheria o VitrineTurbo

- **Comissão recorrente e vitalícia** enquanto o cliente estiver ativo.
- **Loja pronta em minutos**, com importação em massa de produtos, temas e domínio próprio. A agência entrega rápido e cobra pelo serviço.
- **Pix, cartão e WhatsApp**, que é o que o pequeno lojista brasileiro pede.
- **Painel de gestão de carteira**, para a agência operar todos os clientes de um lugar.
- **Teste e desconto para o cliente do parceiro**, o que facilita fechar a venda.

---

## 4. Modelos de parceria

São três modos, que o parceiro pode combinar:

### 4.1 Indicação (link)

O cliente se cadastra pelo link ou cupom do parceiro e paga direto ao VitrineTurbo. O parceiro recebe comissão recorrente. **Já existe; precisa de atribuição robusta.**

### 4.2 Gestão (o parceiro monta a loja)

O parceiro cria a loja pelo painel: tema, produtos (importação em massa), domínio e pagamentos. Depois **convida o cliente** para assumir a conta, definir a própria senha e pagar.

- Enquanto o cliente não aceita, a loja fica em "rascunho do parceiro", sem cobrança. Isso substitui o fluxo atual de "acesso imediato + 6h para pagar".
- Com o consentimento do cliente, o parceiro mantém **acesso de gestor** à loja. O cliente pode revogar esse acesso a qualquer momento.
- O parceiro recebe a mesma comissão recorrente do modelo de indicação.

### 4.3 Revenda / faturamento centralizado (Fase 3, para agências maiores)

- A agência paga o VitrineTurbo com **desconto de atacado** (ex.: 30–40% sobre a tabela), em uma fatura única para todas as lojas.
- Ela cobra o cliente final pelo preço que quiser, junto com o serviço dela.
- O VitrineTurbo fica em segundo plano: o cliente usa domínio próprio e a agência é quem dá o suporte de primeiro nível.
- **Só entra depois que o programa principal estiver maduro.** Exige faturamento consolidado e regras de inadimplência por agência.

---

## 5. Remuneração

### 5.1 Princípios

1. **É recorrente e vitalícia** enquanto o cliente pagar e o parceiro estiver ativo (pelo menos 1 cliente novo a cada 12 meses; sem isso, a taxa cai para o nível base).
2. **Os níveis se baseiam em receita da carteira (MRR), não em contagem de usuários.**
3. **Existe carência antes do saque.** A comissão nasce "em carência" e é liberada após **30 dias**, prazo que cobre arrependimento de 7 dias e a maior parte dos reembolsos.
4. **Há estorno automático** em reembolso, cancelamento com devolução ou chargeback. O valor estornado é abatido do saldo futuro (clawback).
5. **O parceiro fundador tem taxa protegida.** Quem já é parceiro hoje nunca recebe menos que os 30% atuais.

### 5.2 Níveis propostos

Os percentuais e faixas abaixo são uma **proposta para validar** com a margem real (ver 5.4).

| Nível | Critério (MRR ativo da carteira) | Comissão recorrente | Benefícios |
|---|---|---|---|
| **Parceiro** | Aprovado no programa | 25% | Painel, links, materiais, academia, conta demo |
| **Prata** | ≥ R$ 500/mês **ou** 5 clientes ativos | 30% | + Selo, listagem no diretório, suporte prioritário por e-mail |
| **Ouro** | ≥ R$ 2.000/mês **ou** 15 clientes | 35% | + Gerente de conta, leads indicados pelo VitrineTurbo, acesso antecipado a recursos |
| **Diamante** | ≥ R$ 6.000/mês **ou** 40 clientes | 40% | + Co-marketing, case publicado, condições de revenda (4.3), canal direto com o time de produto |

**Regras dos níveis**
- A subida é imediata, ao atingir o critério.
- A descida só acontece após **2 meses seguidos** abaixo do critério, para evitar oscilação.
- A taxa vale para **toda a carteira**, não só para os novos clientes. É mais simples de explicar e é um motivador forte.
- O admin pode definir uma **taxa individual (override)** para parceiros estratégicos.

### 5.3 Bônus (aceleradores)

| Bônus | Regra | Por quê |
|---|---|---|
| **Primeira venda** | R$ X fixo quando o 1º cliente pagar, nos primeiros 30 dias do parceiro | Ativação é o maior gargalo de qualquer programa |
| **Meta trimestral** | Bônus por N clientes novos no trimestre | Mantém o ritmo |
| **Plano anual** | Comissão sobre o anual paga em **12 parcelas mensais**, ou à vista após 60 dias de carência | Elimina o risco do item 2.2-4 |
| **Indique um parceiro** | 5% da comissão do parceiro indicado por 12 meses, **apenas 1 nível** | Crescimento viral sem cara de pirâmide |
| **Campanhas sazonais** | Ex.: Black Friday, comissão em dobro no 1º mês | Picos de aquisição |

### 5.4 Conta de viabilidade

A comissão é o **CAC do canal**. Ela precisa caber na margem:

```
Margem por cliente/mês = preço do plano − taxas de pagamento − custo de infra por loja − suporte
Comissão máxima saudável ≈ 40–50% da margem por cliente
Payback = (bônus fixos) ÷ (margem − comissão)  → alvo < 3 meses
```

É preciso preencher com os preços reais de `subscription_plans` e o custo de infra por loja. O incidente de custo de imagens no Supabase mostra que o custo por loja não é desprezível. Se 40% não couber, o Diamante fica em 35% e o diferencial passa a ser benefícios não financeiros.

### 5.5 Benefício para o cliente do parceiro

O cliente também precisa de um motivo para usar o link:
- **15 dias de teste.** O link de teste já existe (`generateTrialReferralLink`).
- **Desconto na 1ª mensalidade**, reaproveitando o "Desconto de Boas-vindas" (`signupDiscountService`).
- **Cupom do parceiro** (ex.: `AGENCIAX10`), para quem prefere digitar em vez de clicar. O cupom também atribui a indicação.

---

## 6. Jornada do parceiro

```
Descobre → Se inscreve → É aprovado → Onboarding → 1ª venda → Cresce → Vira referência
```

| Etapa | O que acontece | Meta |
|---|---|---|
| **Descoberta** | Página `/parceiros`, blog, anúncios, indicação de outro parceiro, eventos | — |
| **Inscrição** | Formulário: tipo (freelancer/agência), CPF/CNPJ, site/Instagram, carteira atual, nicho, como pretende vender | Formulário com conclusão > 60% |
| **Aprovação** | Automática para perfis que cumprem os critérios; manual para os demais. Resposta em até 48h | — |
| **Onboarding** | E-mail de boas-vindas, trilha "Primeiros passos" no painel (5 tarefas), conta demo, convite para a comunidade | 70% concluem em 7 dias |
| **Ativação** | 1ª venda. Bônus de primeira venda e acompanhamento por um "Partner Success" nos primeiros 30 dias | 40% ativados em 30 dias |
| **Crescimento** | Metas, níveis, academia, campanhas, leads | — |
| **Referência** | Diamante: case publicado, co-marketing, palestra em webinar | — |

**Trilha "Primeiros passos" (checklist no painel)**
1. Completar perfil e dados de pagamento.
2. Assistir à aula "Como vender o VitrineTurbo" (10 min).
3. Montar uma loja demo.
4. Criar o primeiro link de campanha.
5. Enviar a primeira proposta ou fazer o primeiro convite.

---

## 7. Novo painel do parceiro

### 7.1 Navegação proposta

```
Início
Clientes            (carteira + saúde)
  └ Nova loja       (modelo Gestão)
Oportunidades       (CRM leve de leads)
Links & Campanhas
Desempenho          (funil e relatórios)
Financeiro          (extrato, previsão, saques, notas)
Materiais           (kit de marketing + gerador de proposta)
Academia
Equipe              (agências)
Meu Perfil público
Ajuda & Suporte
```

### 7.2 Módulos

**Início**
- MRR da carteira, comissão do mês (prevista e confirmada), clientes ativos e saldo em carência e disponível.
- Nível atual com barra de progresso para o próximo nível em R$ de MRR, e não só em contagem.
- A trilha de onboarding, enquanto não estiver concluída.
- **Alertas acionáveis:** "3 clientes com pagamento vencendo esta semana", "2 lojas sem produtos há 10 dias", "convite pendente há 5 dias".
- Campanha ativa do mês e próximo webinar.

**Clientes (carteira)**
- Lista com plano, status da assinatura, próxima cobrança, comissão gerada e **saúde da loja**: produtos cadastrados, último acesso, pedidos em 30 dias e domínio configurado.
- **Risco de churn:** a loja fica marcada quando há inatividade, falha de pagamento ou plano vencendo.
- Ações: entrar na loja como gestor (com consentimento), reenviar convite, ver histórico de comissões do cliente e exportar CSV.
- Filtros por status, plano, origem (link/gestão/cupom) e saúde.

**Nova loja (modelo Gestão)**
- Assistente: dados do cliente → tema/nicho → **importação de produtos** (reaproveita o bulk import em andamento neste branch) → domínio → convite.
- **Modelos de loja por nicho** (moda, eletrônicos, alimentação…) para o parceiro entregar em minutos.
- O cliente recebe e-mail e WhatsApp para aceitar, definir a senha e escolher o plano. O parceiro nunca define a senha do cliente.

**Oportunidades (CRM leve)**
- Registro de leads com nome, contato, nicho, valor estimado e etapa (contato → proposta → teste → fechado/perdido).
- Um lead convertido vira cliente automaticamente.
- **Proteção de lead:** o parceiro registra o lead e ganha 60 dias de exclusividade na atribuição. Isso evita conflito entre parceiros.

**Links & Campanhas**
- Vários links por parceiro, cada um com nome, destino (home, página pilar, planos, cadastro direto), oferta (teste/desconto) e UTMs.
- Link curto com slug: `vitrineturbo.com/p/agencia-x` ou `vitrineturbo.com/p/agencia-x/blackfriday`.
- QR Code para baixar, cupom do parceiro e mensagens prontas para WhatsApp, Instagram e e-mail.

**Desempenho**
- Funil por campanha: cliques → cadastros → testes → pagantes → retidos após 3 meses.
- Gráficos de comissão (12 meses), MRR da carteira e churn.
- Comparativo com a média dos parceiros do mesmo nível, de forma anônima.

**Financeiro**
- **Extrato** linha a linha: cliente, plano, valor, %, status (em carência → disponível → pago / estornado) e data de liberação.
- **Previsão** da comissão dos próximos 3 meses com base nas renovações agendadas.
- **Saques** via PIX, com dados do recebedor, comprovante e histórico.
- **Fiscal:**
  - Parceiro PJ: envia a nota fiscal no saque.
  - Parceiro PF: recibo (RPA), com a retenção definida pela contabilidade.

**Materiais**
- Biblioteca de criativos (posts, stories, banners, vídeos curtos), copies, apresentação comercial, tabela de preços e FAQ de objeções.
- **Gerador de proposta em PDF** com logo e dados do parceiro, plano sugerido, valor da implantação (cobrada pelo parceiro) e link de cadastro já rastreado.
- **Loja demo** compartilhável para mostrar ao cliente.

**Academia**
- Trilhas: "Produto VitrineTurbo", "Como vender para pequenos lojistas", "Implantação em 1 hora", "Tráfego para lojas".
- **Certificação VitrineTurbo Partner** com prova. O certificado é pré-requisito para o nível Ouro e libera o selo no perfil público.

**Equipe (agências)**
- Convite de membros com papéis: Dono (tudo, inclusive financeiro), Gestor (clientes, lojas, links) e Operador (só lojas atribuídas).
- Log de atividades por membro.

**Perfil público e diretório**
- Página do parceiro com nome, logo, cidade, nichos, serviços, selo e lojas de portfólio (com consentimento).
- Lista em `vitrineturbo.com/especialistas`, para o lojista que quer contratar alguém para montar a loja. Os leads vão para parceiros Prata ou superior, por região e nicho.
- *Isso não fere a regra de não expor outras lojas para o comprador. O diretório é de prestadores de serviço, voltado ao lojista.*

**Ajuda & Suporte**
- Central de ajuda específica do programa, termos e políticas.
- Suporte prioritário por nível.
- Link para a comunidade.

---

## 8. Painel do administrador

Hoje são 4 abas. A proposta é ter um centro de gestão do programa:

| Área | Funções |
|---|---|
| **Visão geral** | Parceiros (inscritos/aprovados/ativos), MRR de parceiros e % do MRR total, novos clientes por parceiro, comissão do mês, churn dos clientes de parceiros vs. orgânicos, funil de ativação |
| **Inscrições** | Fila de aprovação com dados e sinais de risco; aprovar, recusar ou pedir informações |
| **Parceiros** | Lista com nível, MRR, clientes, última venda e status; ficha com histórico, override de taxa, suspensão, notas internas e transferência de carteira |
| **Atribuições** | Ver e corrigir quem trouxe cada cliente, com motivo e trilha de auditoria; resolver disputas |
| **Financeiro** | Comissões por status; **lote de pagamento** (selecionar disponíveis → gerar lote → anexar comprovantes); estornos manuais; notas fiscais recebidas |
| **Níveis & regras** | Níveis, percentuais, critérios, carência, saque mínimo, bônus e campanhas com data de início e fim |
| **Materiais & Academia** | CMS simples de materiais, aulas e prova de certificação |
| **Comunicação** | Avisos no painel, e-mails segmentados por nível e ranking mensal |
| **Antifraude** | Alertas: autoindicação, muitos cadastros do mesmo IP/dispositivo, cartões repetidos, cancelamentos em massa |

---

## 9. Atribuição e rastreamento

### 9.1 Regras

| Regra | Definição |
|---|---|
| **Janela** | 90 dias a partir do clique |
| **Modelo** | Último clique de parceiro dentro da janela. Lead registrado no CRM tem prioridade por 60 dias |
| **Prioridade** | Loja criada pelo parceiro > lead protegido > cupom > link |
| **Trava** | A atribuição é gravada no cadastro e não muda mais, exceto por decisão do admin com registro no log |
| **Separação** | Parceiro ≠ "indique e ganhe" do lojista. Códigos e tabelas próprios. Se as duas indicações existirem, prevalece a do parceiro e o lojista indicador recebe o benefício dele normalmente, sem dupla comissão sobre a mesma assinatura |

### 9.2 Implementação

- **Captura em qualquer rota.** Um hook global no `App.tsx` (ou na edge function do Netlify) lê `?ref=`, `/p/:slug` e UTMs em todas as páginas, não só na home.
- **Cookie first-party** `vt_partner` (90 dias), com `localStorage` como reserva e `visitor_id` anônimo.
- **Clique registrado no servidor** (`partner_clicks`), com link, campanha, página de entrada, IP em hash e user-agent.
- **No cadastro**, lê o cookie e grava a `partner_attributions` (um registro por lojista). O cadastro com Google também é coberto: hoje o `completeGoogleProfile` lê o `localStorage`.
- **Corrigir a corrida do `?code=` do OAuth.** Novas rotas `/p/:slug` não podem interferir no `?code=` (ver o histórico da corrida entre os dois clientes Supabase).

---

## 10. Antifraude, jurídico e fiscal

**Antifraude**
- Bloqueio de autoindicação por CPF/CNPJ, e-mail, telefone, cartão e dispositivo iguais aos do parceiro.
- Carência de 30 dias antes do saque, mais clawback.
- Alertas de padrões: cadastros em lote, contas sem atividade que pagam só o 1º mês, chargebacks.
- Um volume alto de estornos leva à suspensão automática do saque para revisão.

**Práticas proibidas (nos Termos)**
- Comprar anúncios com a marca "VitrineTurbo" (brand bidding).
- Spam ou listas compradas.
- Prometer recursos inexistentes.
- Usar a marca como se fosse o VitrineTurbo.
- Cupons em sites de cupom sem autorização.

**Documentos**
- **Termos do Programa de Parceiros**, com versão e aceite registrado.
- **Política de Comissões**: carência, estorno, níveis, inatividade e encerramento.
- **Adendo de Proteção de Dados (LGPD)**: o parceiro acessa dados de clientes e dos compradores das lojas. O acesso de gestor exige consentimento do lojista.
- **Manual de marca** para parceiros.

**Fiscal e pagamento**
- Decidir se o programa aceita PF ou só PJ (MEI resolve a maior parte). Recomendação: aceitar PF até um teto mensal e exigir CNPJ acima dele. **Validar com a contabilidade.**
- Pagamento mensal em data fixa (ex.: dia 10), em lote via PIX.
- Automação do pagamento via API de transferências como evolução. O primeiro passo é manual, com comprovante anexado.

---

## 11. Divulgação: como trazer muitos parceiros

### 11.1 Fundação (sem custo de mídia)

1. **Página `/parceiros`** otimizada para SEO, em linha com o `docs/PLANO_SEO.md`:
   - Hero com a promessa.
   - **Calculadora de ganhos:** "com X clientes no plano Y você ganha R$ Z/mês, todo mês".
   - Comparativo de níveis, depoimentos, FAQ e botão "Quero ser parceiro".
2. **Links no site:** "Seja parceiro" no rodapé e no menu da landing, no blog e no painel do lojista ("Você é agência? Ganhe indicando").
3. **Conteúdo de blog voltado a agências:** "Como vender lojas virtuais para clientes", "Quanto cobrar para montar uma loja", "Renda recorrente para social media".
4. **Diretório `/especialistas`** (item 7.2). Ele atrai parceiros, porque é uma fonte de leads, e ajuda lojistas.

### 11.2 Lançamento: "Parceiros Fundadores" (primeiros 60–90 dias)

- **Vagas limitadas** (ex.: 100) com benefícios vitalícios: +5 p.p. sobre o nível, selo "Fundador" e acesso direto ao time.
- **Webinar de lançamento** ao vivo: "Como ganhar renda recorrente montando lojas para seus clientes".
- Convite direto aos parceiros atuais e aos lojistas mais engajados, que muitas vezes também prestam serviço a outros.

### 11.3 Canais ativos

| Canal | Ação |
|---|---|
| **Prospecção de agências** | Lista de agências e social medias por região (Instagram, Google Maps, LinkedIn); abordagem com proposta e conta demo |
| **Escolas e cursos de marketing** | Parceria para incluir o VitrineTurbo como ferramenta recomendada; aula convidada |
| **Comunidades** | Grupos de social media, gestores de tráfego e freelancers; conteúdo útil, não spam |
| **Eventos** | Encontros regionais de marketing digital e e-commerce; workshop "Monte uma loja em 30 min" |
| **Mídia paga** | Instagram/Meta e LinkedIn para o público "social media / agência", com a calculadora como chamada; começar com orçamento pequeno e medir o custo por parceiro ativado (não por inscrito) |
| **Indique um parceiro** | Bônus de 1 nível (item 5.3) |
| **Prova social** | Cases mensais de parceiros, ranking público (com permissão) e selo no Instagram dos parceiros |

### 11.4 Ritmo de engajamento

- **Semanal:** dica de venda no painel e na comunidade.
- **Mensal:** webinar (novidades + case), newsletter com campanha do mês e ranking.
- **Trimestral:** meta com bônus e premiação dos 3 primeiros (viagem, equipamento ou upgrade de nível).
- **Comunidade:** grupo oficial no WhatsApp com avisos e dúvidas, moderado.

---

## 12. Indicadores de sucesso

| Indicador | Definição | Referência inicial (hipótese, ajustar com dados) |
|---|---|---|
| Inscritos/mês | Inscrições recebidas | — |
| Taxa de aprovação | Aprovados ÷ inscritos | 60–80% |
| **Taxa de ativação** | Parceiros com 1ª venda em 30 dias ÷ aprovados | **≥ 40%** (indicador nº 1) |
| Parceiros ativos | Pelo menos 1 venda nos últimos 90 dias | — |
| Clientes novos via parceiros | Por mês | — |
| **% do MRR vindo de parceiros** | MRR parceiro ÷ MRR total | Meta em 12 meses: **25–40%** |
| Churn dos clientes de parceiros | vs. orgânicos | Deve ser **menor** que o orgânico |
| CAC do canal | (Comissões + bônus + custo do programa) ÷ clientes novos | Payback < 3 meses |
| Pagamentos em dia | Lotes pagos na data | 100% |

---

## 13. Modelo de dados proposto

Evolução das tabelas atuais. Tudo com RLS ativa, `relrowsecurity` conferido e `anon` revogado nas RPCs de admin.

| Tabela | Propósito |
|---|---|
| `partner_profiles` | 1:1 com `users`: tipo (freelancer/agência), razão social, CPF/CNPJ, status (`applied`, `approved`, `suspended`, `terminated`), nível, `is_founder`, override de taxa, versão dos termos aceita, dados do perfil público |
| `partner_applications` | Inscrições com respostas do formulário e decisão |
| `partner_levels` | Substitui `partner_commission_tiers`: critério de MRR, critério de clientes, %, benefícios (json) |
| `partner_links` | Links e campanhas: slug, destino, oferta (teste/desconto), UTMs, cupom |
| `partner_clicks` | Cliques separados do `referral_clicks` |
| `partner_attributions` | Quem trouxe cada lojista: origem (link/cupom/lead/gestão), link, data, travado, log de alterações |
| `partner_leads` | CRM leve com etapa e proteção de 60 dias |
| `partner_commissions` | Atual, mais: `available_at`, `status` (`holding`, `available`, `paid`, `reversed`), `reversal_reason`, `payout_id`, `currency`, parcela (para anual) |
| `partner_payouts` / `partner_payout_items` | Lotes de pagamento, comprovantes, nota fiscal |
| `partner_bonuses` | Bônus de 1ª venda, meta, campanha, indicação de parceiro |
| `partner_team_members` | Membros da agência e papéis |
| `partner_store_access` | Acesso de gestor por loja, com consentimento e revogação |
| `partner_assets`, `partner_courses`, `partner_course_progress`, `partner_certifications` | Materiais e academia |
| `partner_audit_log` | Toda alteração sensível (atribuição, taxa, estorno, acesso de gestor) |

**Jobs e edge functions**
- `partner-apply`: inscrição, com aprovação automática quando os critérios são cumpridos.
- `partner-invite-client`: convite para o cliente assumir a loja.
- Cron diário: libera comissões (`holding` → `available`), recalcula níveis e gera alertas da carteira.
- Hook no `mp-webhook` e no fluxo de reembolso: estorna a comissão (`reversed`) e aplica clawback.
- `partner-payout-run`: gera o lote mensal.

---

## 14. Roadmap

### Fase 0 — Fundações e correções (1–2 semanas) · *antes de divulgar*
- [ ] **Corrigir a RLS de UPDATE do parceiro** (item 2.2-1) e auditar as outras policies do Partners.
- [ ] Carência de 30 dias e status `holding`/`available`.
- [ ] Estorno automático em reembolso e chargeback.
- [ ] Plano anual com comissão parcelada ou com carência estendida.
- [ ] Captura do `?ref` em qualquer rota, com cookie de 90 dias e regra de prioridade.
- [ ] Separar atribuição de parceiro do "indique e ganhe" (`partner_attributions`, `partner_clicks`).
- [ ] Termos do programa e política de comissões (versão 1).

### Fase 1 — Relançamento (3–5 semanas)
- [ ] Página `/parceiros` com calculadora e inscrição.
- [ ] Fila de aprovação no admin.
- [ ] Novos níveis por MRR, com taxa protegida para os fundadores.
- [ ] Painel novo: Início, Clientes (com saúde), Links & Campanhas, Financeiro (extrato, previsão, lote de pagamento).
- [ ] Modelo Gestão com convite ao cliente (substitui a senha definida pelo parceiro).
- [ ] Trilha de onboarding e e-mails de boas-vindas e ativação.
- [ ] Materiais iniciais: apresentação, 20 criativos, copies, FAQ.
- [ ] Campanha "Parceiros Fundadores" e webinar de lançamento.

### Fase 2 — Crescimento (6–10 semanas)
- [ ] Academia e certificação.
- [ ] CRM leve com proteção de lead.
- [ ] Gerador de proposta em PDF e loja demo.
- [ ] Modelos de loja por nicho.
- [ ] Bônus, metas trimestrais, ranking e campanhas sazonais.
- [ ] "Indique um parceiro".
- [ ] Antifraude com alertas.
- [ ] Diretório `/especialistas`.

### Fase 3 — Agências (após validar a Fase 2)
- [ ] Equipe e papéis.
- [ ] Acesso de gestor multi-loja com consentimento.
- [ ] Revenda com faturamento centralizado e desconto de atacado.
- [ ] Automação do pagamento via API PIX.

### Fase 4 — Internacional (junto com a expansão i18n/Stripe)
- [ ] Comissões multi-moeda (`currency`) e pagamento internacional.
- [ ] Páginas `/es/socios` e `/en/partners`.

---

## 15. Riscos e mitigação

| Risco | Mitigação |
|---|---|
| Comissão alta demais corrói a margem | Conta de viabilidade (5.4) antes de publicar; benefícios não financeiros nos níveis altos |
| Muitos inscritos, poucos ativos | Medir ativação, não inscrição; onboarding guiado; bônus de 1ª venda; Partner Success nos primeiros 30 dias |
| Fraude e autoindicação | Carência, clawback, verificação de documentos, alertas |
| Conflito entre parceiros pelo mesmo cliente | Regras claras de atribuição, proteção de lead, log e decisão do admin |
| Clientes de parceiros com churn maior | Saúde da carteira, alertas e comissão só enquanto o cliente paga, o que mantém o incentivo à retenção |
| Parceiros atuais insatisfeitos com a mudança | Taxa protegida (≥ 30%), status de Fundador e comunicação antecipada |
| Mudar as regras quebra a confiança | Termos versionados, aviso prévio de 30 dias para mudanças e direitos adquiridos preservados |

---

## 16. Decisões pendentes (dono do produto)

1. **Percentuais e critérios finais dos níveis**, após a conta de viabilidade com preços e custos reais.
2. **A comissão é vitalícia ou tem prazo** (ex.: 24 meses)? Recomendação: vitalícia, com a regra de parceiro ativo.
3. **Aceitar parceiro PF** ou exigir CNPJ/MEI? Validar com a contabilidade.
4. **Valor dos bônus** (1ª venda, metas) e orçamento de premiações.
5. **Quantidade de vagas e benefícios** dos Parceiros Fundadores.
6. **O modelo Revenda (4.3) entra no roadmap?** Se sim, a partir de qual nível.
7. **Orçamento de mídia paga** para a captação de parceiros.
8. **Quem cuida do programa** (Partner Success): uma pessoa dedicada, ainda que em meio período, faz grande diferença na taxa de ativação.

---

## Anexo A — Consultas para a linha de base (somente leitura)

```sql
-- Parceiros e carteira
SELECT
  (SELECT count(*) FROM users WHERE role = 'partner')                                         AS parceiros,
  (SELECT count(*) FROM users WHERE managed_by_partner_id IS NOT NULL)                        AS clientes_de_parceiros,
  (SELECT count(*) FROM users WHERE managed_by_partner_id IS NOT NULL AND plan_status = 'active') AS clientes_ativos,
  (SELECT count(*) FROM users WHERE managed_by_partner_id IS NOT NULL
                               AND referred_by = managed_by_partner_id)                       AS via_link,
  (SELECT coalesce(sum(amount), 0) FROM partner_commissions)                                  AS comissoes_total,
  (SELECT coalesce(sum(amount), 0) FROM partner_commissions WHERE status = 'paid')            AS comissoes_pagas;

-- Clientes por parceiro
SELECT p.name, count(u.id) AS clientes,
       count(u.id) FILTER (WHERE u.plan_status = 'active') AS ativos
FROM users p
LEFT JOIN users u ON u.managed_by_partner_id = p.id
WHERE p.role = 'partner'
GROUP BY p.name
ORDER BY ativos DESC;

-- Verificar se há proteção de colunas para UPDATE de parceiro (item 2.2-1)
SELECT tgname, pg_get_triggerdef(oid) FROM pg_trigger
WHERE tgrelid = 'public.users'::regclass AND NOT tgisinternal;
```
