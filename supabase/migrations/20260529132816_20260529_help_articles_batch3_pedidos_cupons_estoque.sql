/*
  # Help Articles - Batch 3: Pedidos & Vendas, Cupons & Promoções, Controle de Estoque

  Category IDs:
  - Pedidos & Vendas:     1d0700ba-e8af-4a49-99e3-b9ab0e779cc3
  - Cupons & Promoções:   916914a9-b7df-4665-aba4-7c1d1e6c02bb
  - Controle de Estoque:  27fecf3d-82fe-4542-a383-ffa3444a34bc
*/

INSERT INTO help_articles (title, slug, excerpt, content, category_id, tags, is_published, is_featured, published_at) VALUES

-- PEDIDOS & VENDAS
('Como os pedidos chegam até você', 'como-pedidos-chegam', 'Entenda o fluxo completo de um pedido no VitrineTurbo, desde o cliente selecionar o produto até a mensagem chegar no seu WhatsApp.',
$$# Como os pedidos chegam até você

O VitrineTurbo usa o WhatsApp como canal principal de comunicação entre você e o cliente. Entender esse fluxo é essencial para atender bem.

## O fluxo completo de um pedido

```
Cliente visita a vitrine
        ↓
Escolhe o produto e as variações
        ↓
Clica em "Comprar" ou "Adicionar ao carrinho"
        ↓
Revisa o pedido (itens, quantidades, total)
        ↓
Clica em "Finalizar pedido"
        ↓
É redirecionado para o WhatsApp com a mensagem pronta
        ↓
Você recebe a mensagem e confirma o pedido
```

## A mensagem automática do WhatsApp

Quando o cliente clica em finalizar, o VitrineTurbo gera automaticamente uma mensagem formatada como esta:

```
Olá! Gostaria de fazer o seguinte pedido:

🛍️ *PEDIDO*
• Camiseta Oversize Preta (Tam. M) — 2x R$ 59,90 = R$ 119,80
• Boné Trucker Branco — 1x R$ 45,00 = R$ 45,00

💰 *Total: R$ 164,80*

📦 Dados de entrega:
Nome: João Silva
CEP: 01310-100
```

> **Nota:** O formato exato da mensagem pode variar conforme as configurações do checkout da sua loja.

## Configurando as informações de checkout

Você pode personalizar o que o cliente preenche antes de finalizar o pedido. Acesse **Configurações > Checkout** para definir:
- Campos obrigatórios (nome, telefone, CEP, endereço)
- Mensagem de boas-vindas do checkout
- Número de WhatsApp que recebe os pedidos

## Notificações de novos pedidos

O VitrineTurbo envia notificações dentro do painel quando novos pedidos são registrados. Acesse o sino de notificações no topo do painel para ver os alertas.

> **Dica de atendimento:** Responda os pedidos o mais rápido possível. Clientes que ficam sem resposta por mais de 30 minutos tendem a desistir da compra.$$,
'1d0700ba-e8af-4a49-99e3-b9ab0e779cc3', ARRAY['pedido', 'whatsapp', 'fluxo', 'checkout', 'atendimento'], true, true, now()),

('Gerenciando e atualizando status de pedidos', 'gerenciando-status-pedidos', 'Saiba como registrar pedidos no painel, atualizar o status de cada etapa e manter um histórico organizado das suas vendas.',
$$# Gerenciando e atualizando status de pedidos

O módulo de pedidos do VitrineTurbo permite registrar e acompanhar todas as vendas em um só lugar.

## Acessando os pedidos

No menu lateral do painel, clique em **"Pedidos"**.

## Status disponíveis

Cada pedido passa por diferentes etapas. Os status disponíveis são:

| Status | Descrição |
|--------|-----------|
| **Novo** | Pedido recebido, ainda não confirmado |
| **Confirmado** | Pedido confirmado com o cliente |
| **Em preparo** | Produto sendo separado ou produzido |
| **Enviado** | Produto postado ou saiu para entrega |
| **Entregue** | Cliente recebeu o produto |
| **Cancelado** | Pedido cancelado por qualquer motivo |

## Atualizando o status

1. Na lista de pedidos, clique no pedido desejado
2. No painel de detalhes, localize o campo **"Status"**
3. Selecione o novo status no menu dropdown
4. Clique em **"Salvar"** ou **"Atualizar"**

## Registrando um pedido manualmente

Para pedidos recebidos por outros canais (direct do Instagram, por exemplo):

1. Clique em **"Novo pedido"**
2. Preencha os dados do cliente: nome, telefone
3. Adicione os produtos e quantidades
4. Selecione o status inicial
5. Adicione observações se necessário
6. Clique em **"Salvar pedido"**

## Filtrando e buscando pedidos

Use os filtros no topo da lista para encontrar pedidos por:
- **Status**: ver apenas pedidos "Em preparo", por exemplo
- **Data**: pedidos de hoje, essa semana, esse mês
- **Cliente**: busca pelo nome do cliente

## Exportando pedidos

Para exportar os pedidos para análise externa, use a opção **"Exportar"** (disponível em planos superiores). Os dados são exportados em formato CSV, compatível com Excel e Google Sheets.

> **Dica de organização:** Atualize o status dos pedidos assim que cada etapa for concluída. Isso facilita saber exatamente o que precisa de atenção ao olhar para a lista.$$,
'1d0700ba-e8af-4a49-99e3-b9ab0e779cc3', ARRAY['pedido', 'status', 'gerenciar', 'histórico', 'organização'], true, false, now()),

('Entendendo o funil de vendas e métricas', 'funil-vendas-metricas', 'Aprenda a interpretar as métricas do dashboard: visualizações, cliques, pedidos e taxa de conversão da sua vitrine.',
$$# Entendendo o funil de vendas e métricas

O VitrineTurbo coleta dados de comportamento dos visitantes da sua vitrine para te ajudar a entender o que está funcionando e o que pode melhorar.

## Onde ver as métricas?

Acesse o **Dashboard** no menu lateral do painel. Na seção de análises, você encontra o funil de vendas e os principais indicadores.

## O funil de vendas

O funil mostra quantas pessoas passaram por cada etapa:

```
👁️ Visualizações da vitrine
        ↓
🖱️ Cliques em produtos
        ↓
🛒 Adições ao carrinho
        ↓
📩 Pedidos enviados (WhatsApp)
```

### O que cada etapa significa?

- **Visualizações**: quantas pessoas abriram sua vitrine
- **Cliques em produtos**: quantas pessoas clicaram em algum produto para ver detalhes
- **Adições ao carrinho**: quantas vezes produtos foram adicionados ao carrinho
- **Pedidos enviados**: quantas conversas de pedido foram iniciadas no WhatsApp

## Taxa de conversão

A taxa de conversão mostra a porcentagem de visitantes que chegam até a etapa de pedido. Ela é calculada assim:

```
Taxa = (Pedidos enviados / Visualizações) × 100
```

Uma taxa saudável para vitrines digitais está entre **2% e 10%**. Se a sua estiver abaixo de 2%, pode indicar:
- Preços acima do mercado
- Imagens de baixa qualidade
- Falta de variedade de produtos
- Dificuldade de navegação

## Produtos mais vistos e mais vendidos

O dashboard mostra um ranking dos produtos com mais visualizações e mais pedidos. Use esses dados para:
- Dar destaque aos produtos mais populares
- Identificar quais produtos precisam de melhoria
- Planejar reposição de estoque

## Período de análise

Use o filtro de período (hoje, 7 dias, 30 dias, 3 meses) para comparar desempenho ao longo do tempo.

> **Dica:** Compare a taxa de conversão entre semanas. Se ela cair após uma mudança (novo preço, novas fotos), isso é um sinal importante.$$,
'1d0700ba-e8af-4a49-99e3-b9ab0e779cc3', ARRAY['funil', 'métricas', 'conversão', 'dashboard', 'analytics'], true, false, now()),

('Configurando o checkout e link de pagamento', 'configurando-checkout', 'Saiba como personalizar o formulário de checkout, definir os campos obrigatórios e configurar o link direto para o WhatsApp.',
$$# Configurando o checkout e link de pagamento

O checkout é a etapa final que o cliente percorre antes de enviar o pedido. Personalizá-lo melhora a experiência e aumenta as conversões.

## Acessando as configurações de checkout

No painel, acesse **Configurações > Checkout**.

## Número de WhatsApp

Configure o número de WhatsApp que receberá os pedidos. Informe com DDD e sem espaços ou traços:
- ✅ Correto: 11987654321
- ❌ Errado: (11) 98765-4321

> **Importante:** Sempre teste o checkout após salvar para garantir que as mensagens estão chegando no número correto.

## Campos do formulário

Defina quais informações o cliente deve preencher antes de finalizar:

| Campo | Obrigatório? | Quando usar |
|-------|-------------|-------------|
| Nome | Recomendado | Sempre |
| Telefone | Opcional | Se quiser contato além do WhatsApp |
| CEP | Recomendado | Se trabalhar com entrega |
| Endereço completo | Opcional | Se precisar do endereço exato |
| Observações | Opcional | Para clientes adicionarem instruções especiais |

## Mensagem de abertura

Configure uma mensagem personalizada que aparece para o cliente antes do formulário:

```
Exemplo:
"Olá! Para finalizar seu pedido, preencha os dados abaixo.
Entraremos em contato em até 2 horas úteis para confirmar."
```

## Configurando formas de pagamento

Adicione as formas de pagamento aceitas para exibir no checkout:
- PIX
- Cartão de crédito/débito
- Dinheiro na entrega
- Transferência bancária

Essas informações são apenas informativas para o cliente — o pagamento em si é combinado via WhatsApp.

## Integrando o MercadoPago (opcional)

Para lojas que desejam receber pagamentos online diretamente pelo VitrineTurbo, é possível integrar o MercadoPago. Veja o artigo [Integrando o MercadoPago](/help/category/financeiro-planos/integrando-mercadopago).

> **Dica:** Mantenha o formulário de checkout simples. Cada campo extra é uma oportunidade do cliente desistir. Peça apenas o que for realmente necessário.$$,
'1d0700ba-e8af-4a49-99e3-b9ab0e779cc3', ARRAY['checkout', 'whatsapp', 'pagamento', 'formulário', 'pedido'], true, false, now()),

-- CUPONS & PROMOÇÕES
('Criando cupons de desconto do zero', 'criando-cupons-desconto', 'Aprenda a criar cupons de desconto no VitrineTurbo, definir regras de uso e compartilhar com seus clientes.',
$$# Criando cupons de desconto do zero

Os cupons de desconto são uma poderosa ferramenta para atrair novos clientes e fidelizar os existentes.

## Acessando os cupons

No menu lateral do painel, clique em **"Cupons"** ou **"Promoções"**.

## Criando um novo cupom

Clique em **"Novo cupom"** e preencha as informações:

### Código do cupom
O código que o cliente digitará no checkout. Use algo fácil de lembrar e comunicar:
- ✅ BEMVINDO10, NATAL20, FRETEGRATIS
- ❌ XPTO123ABCD (difícil de lembrar)

O código não é sensível a maiúsculas/minúsculas — BEMVINDO10 e bemvindo10 funcionam igual.

### Tipo de desconto

**Porcentagem (%):**
Desconta um percentual sobre o valor total do pedido.
- Exemplo: 10% de desconto em um pedido de R$ 200,00 = R$ 20,00 de desconto

**Valor fixo (R$):**
Desconta um valor fixo independente do total.
- Exemplo: R$ 30,00 de desconto em qualquer pedido

### Valor do desconto
Informe o valor ou percentual do desconto.

### Valor mínimo do pedido (opcional)
Define um valor mínimo para o cupom ser aplicado.
- Exemplo: "Válido para pedidos acima de R$ 100,00"

### Limite de usos (opcional)
Quantidade máxima de vezes que o cupom pode ser usado. Deixe vazio para uso ilimitado.

### Validade (opcional)
Data até quando o cupom pode ser usado. Após essa data, o cupom é desativado automaticamente.

## Ativando e desativando cupons

Na lista de cupons, use o botão de toggle ao lado de cada cupom para ativar ou desativar. Cupons desativados não funcionam no checkout mesmo que o código seja inserido.

## Compartilhando o cupom

Após criar, compartilhe o código com seus clientes via:
- Stories e posts no Instagram
- Mensagem direta no WhatsApp
- E-mail marketing
- Banner na vitrine

> **Dica:** Cupons com prazo de validade curto (48–72 horas) criam senso de urgência e aumentam as conversões.$$,
'916914a9-b7df-4665-aba4-7c1d1e6c02bb', ARRAY['cupom', 'desconto', 'promoção', 'código'], true, true, now()),

('Tipos de desconto — percentual, valor fixo e frete grátis', 'tipos-desconto-cupons', 'Entenda as diferenças entre os tipos de desconto disponíveis no VitrineTurbo e quando usar cada um.',
$$# Tipos de desconto — percentual, valor fixo e frete grátis

O VitrineTurbo oferece diferentes tipos de desconto para atender diversas estratégias promocionais.

## Desconto percentual

Remove uma porcentagem do valor total do pedido.

**Quando usar:**
- Promoções gerais de temporada (10% OFF em tudo)
- Descontos para primeira compra (15% de boas-vindas)
- Campanhas sazonais (Black Friday, Natal)

**Exemplo:**
- Pedido: R$ 250,00
- Cupom: 20% de desconto
- Valor descontado: R$ 50,00
- **Total: R$ 200,00**

## Desconto de valor fixo

Remove um valor em reais do pedido, independente do total.

**Quando usar:**
- Recuperar carrinhos abandonados ("Aqui está R$ 25,00 para finalizar seu pedido")
- Promoções específicas (ganhe R$ 50,00 na próxima compra)
- Vouchers de compensação (cliente teve problema, você oferece crédito)

**Exemplo:**
- Pedido: R$ 180,00
- Cupom: R$ 30,00 de desconto
- **Total: R$ 150,00**

> **Atenção:** Configure um valor mínimo de pedido para cupons de valor fixo. Sem esse limite, o cliente pode comprar R$ 10,00 e usar um cupom de R$ 30,00, gerando pedido negativo.

## Estratégias de uso

### Para novos clientes
Crie um cupom de boas-vindas com desconto atrativo (10–20%) e divulgue nos seus canais de aquisição.

### Para clientes recorrentes
Envie um cupom exclusivo via WhatsApp para clientes que compraram nos últimos 30 dias: "Olá, João! Como agradecimento pela sua compra, aqui está 15% OFF para seu próximo pedido: VOLTOU15"

### Para datas comemorativas
Crie cupons temáticos com validade de 48–72 horas:
- NATAL15 (válido de 20/12 a 25/12)
- MAEDAANA (especial Dia das Mães)
- ANIVERSARIO20 (mês de aniversário da loja)

### Para recuperar vendas perdidas
Quando um cliente demonstrou interesse mas não finalizou a compra, ofereça um desconto especial via WhatsApp.

> **Dica:** Não use cupons de desconto muito alto com frequência. Clientes que se acostumam a esperar por promoções pararam de comprar pelo preço cheio.$$,
'916914a9-b7df-4665-aba4-7c1d1e6c02bb', ARRAY['desconto', 'percentual', 'valor fixo', 'promoção', 'estratégia'], true, false, now()),

('Monitorando uso e desempenho dos cupons', 'monitorando-cupons', 'Veja como acompanhar quantas vezes cada cupom foi usado, o desconto total concedido e avaliar a efetividade das campanhas.',
$$# Monitorando uso e desempenho dos cupons

Acompanhar o desempenho dos cupons é fundamental para entender o retorno das campanhas promocionais.

## Acessando as métricas de cupons

Na listagem de cupons (**Painel > Cupons**), cada cupom exibe um resumo de uso ao lado do código.

## Informações disponíveis por cupom

| Métrica | O que significa |
|---------|----------------|
| **Usos** | Quantas vezes o cupom foi aplicado em pedidos |
| **Usos restantes** | Quantos usos ainda disponíveis (se houver limite) |
| **Total descontado** | Soma total dos descontos concedidos por este cupom |
| **Status** | Ativo / Inativo / Expirado |

## Avaliando a efetividade

Para avaliar se um cupom valeu a pena, compare:

1. **Custo do desconto** (total descontado) vs. **valor dos pedidos gerados**
2. Se a campanha trouxe **novos clientes** ou foi usada por clientes recorrentes
3. Se o ticket médio dos pedidos com cupom é maior ou menor que sem cupom

> **Insight:** Cupons que aumentam o ticket médio (cliente compra mais para atingir o valor mínimo) são geralmente mais rentáveis do que cupons que apenas reduzem a margem dos pedidos existentes.

## Boas práticas de gestão de cupons

- **Desative cupons expirados manualmente** se você não configurou data de validade
- **Crie um cupom por campanha** para saber exatamente de onde veio cada uso
- **Não reutilize códigos** — se você usou NATAL20 em 2024, crie NATAL25 em 2025
- **Revise mensalmente** os cupons ativos para garantir que nenhum esteja rodando sem querer

> **Dica:** Se um cupom está sendo muito usado, pode ser que o código vazou e está circulando em grupos de desconto. Nesse caso, desative o cupom e crie um novo com código diferente.$$,
'916914a9-b7df-4665-aba4-7c1d1e6c02bb', ARRAY['cupom', 'métricas', 'monitoramento', 'desempenho', 'análise'], true, false, now()),

-- CONTROLE DE ESTOQUE
('Ativando e configurando o controle de estoque', 'ativando-controle-estoque', 'Aprenda a ativar o controle de estoque no VitrineTurbo, definir quantidades iniciais e entender como o sistema funciona.',
$$# Ativando e configurando o controle de estoque

O controle de estoque do VitrineTurbo permite que você acompanhe a quantidade disponível de cada produto e evite vender itens que não têm mais em estoque.

## Por que usar o controle de estoque?

Sem controle de estoque, você pode receber pedidos de produtos que já estão esgotados, causando frustração para o cliente e retrabalho para você. Com ele ativo:

- Produtos esgotados aparecem como **"Sem estoque"** na vitrine
- Você recebe alertas quando o estoque está baixo
- Tem um histórico completo de entradas e saídas

## Ativando o controle de estoque

1. Acesse **Configurações > Estoque** no painel
2. Ative o toggle **"Controle de estoque"**
3. Confirme a ativação

> **Importante:** Ao ativar, todos os produtos começam com estoque **zero**. Você precisa registrar as quantidades iniciais manualmente.

## Configurando o estoque inicial dos produtos

Após ativar, você pode definir o estoque de cada produto de duas formas:

**Opção 1 — Produto a produto:**
1. Abra o produto no painel
2. Na aba de estoque, informe a quantidade disponível
3. Salve o produto

**Opção 2 — Entrada de estoque em massa:**
1. Acesse **Estoque > Nova entrada**
2. Adicione os produtos e quantidades de uma vez
3. Confirme a entrada

## Estoque por variação

Se o produto tem variações (tamanhos, cores), o estoque pode ser controlado individualmente por variação:
- Camiseta Preta Tam. P: 5 unidades
- Camiseta Preta Tam. M: 12 unidades
- Camiseta Preta Tam. G: 8 unidades

## O que acontece quando o estoque zera?

- O produto aparece como **"Esgotado"** na vitrine
- O botão de compra é desabilitado para o cliente
- Você recebe uma notificação no painel

Para reativar, basta registrar uma nova entrada de estoque para o produto.

## Desativando o controle de estoque

Se precisar desativar, volte em **Configurações > Estoque** e desative o toggle. Todos os produtos voltam a aparecer como disponíveis na vitrine.

> **Dica:** Se você vende produtos sob encomenda (sem estoque físico), deixe o controle de estoque desativado ou use quantidades altas (999) para produtos sem limite de venda.$$,
'27fecf3d-82fe-4542-a383-ffa3444a34bc', ARRAY['estoque', 'inventário', 'configuração', 'ativar'], true, true, now()),

('Registrando entradas e saídas de estoque', 'entradas-saidas-estoque', 'Como registrar manualmente entradas de mercadoria, saídas por venda ou perda, e manter o histórico de movimentações.',
$$# Registrando entradas e saídas de estoque

O VitrineTurbo registra automaticamente as saídas quando pedidos são confirmados, mas você também pode registrar movimentações manualmente.

## Acessando o módulo de estoque

No painel, clique em **"Estoque"** no menu lateral. Aqui você encontra:
- Visão geral do estoque atual
- Histórico de movimentações
- Produtos com estoque crítico

## Registrando uma entrada de mercadoria

Use quando receber novas mercadorias para repor o estoque:

1. Clique em **"Nova entrada"**
2. Selecione o produto (e a variação, se aplicável)
3. Informe a quantidade que chegou
4. Adicione uma observação (opcional): "Compra NF 1234", "Reposição fornecedor X"
5. Clique em **"Confirmar entrada"**

O estoque é atualizado imediatamente.

## Registrando uma saída manual

Use para corrigir o estoque em situações como:
- Produto com defeito descartado
- Produto usado como brinde
- Ajuste de inventário após contagem física

1. Clique em **"Nova saída"**
2. Selecione o produto
3. Informe a quantidade e o motivo
4. Confirme

## Histórico de movimentações

Cada entrada e saída fica registrada no histórico com:
- Data e hora
- Tipo (entrada, saída, ajuste)
- Quantidade
- Estoque resultante
- Observação (se informada)

Use o histórico para auditar inconsistências e entender o giro de cada produto.

## Realizando um inventário (contagem física)

Periodicamente, faça uma contagem física do estoque e compare com o sistema:

1. Acesse **Estoque > Inventário**
2. O sistema mostra a quantidade registrada para cada produto
3. Você informa a quantidade física real
4. O sistema aplica os ajustes automaticamente

> **Dica:** Faça inventários mensais para manter o estoque confiável. Diferenças grandes podem indicar extravios ou erros no registro de vendas.$$,
'27fecf3d-82fe-4542-a383-ffa3444a34bc', ARRAY['estoque', 'entrada', 'saída', 'movimentação', 'inventário'], true, false, now()),

('Alertas de estoque baixo e produtos críticos', 'alertas-estoque-baixo', 'Configure alertas para ser notificado quando produtos estão acabando e saiba como priorizar a reposição.',
$$# Alertas de estoque baixo e produtos críticos

Ficar sem estoque de um produto popular é um dos maiores problemas para lojas online. O VitrineTurbo tem um sistema de alertas para te avisar antes que isso aconteça.

## O que são produtos críticos?

Produtos críticos são aqueles cujo estoque está abaixo do **estoque mínimo** configurado. Por padrão, o VitrineTurbo considera crítico qualquer produto com 3 ou menos unidades.

## Configurando o estoque mínimo

Você pode definir o estoque mínimo globalmente ou por produto:

**Globalmente:**
1. Acesse **Configurações > Estoque**
2. Defina o valor em **"Estoque mínimo padrão"** (padrão: 3 unidades)

**Por produto:**
1. Abra o produto no painel
2. Na aba de estoque, defina um **"Estoque mínimo"** específico

Exemplo de estoque mínimo por tipo de produto:
- Produtos de alta rotatividade: 10–20 unidades
- Produtos de média rotatividade: 5–10 unidades
- Produtos de baixa rotatividade: 2–5 unidades

## Onde ver os alertas?

**No painel (Dashboard):**
Um widget de "Produtos críticos" mostra os produtos que precisam de reposição.

**Nas notificações:**
O sino de notificações no topo do painel exibe alertas de estoque baixo.

**Na listagem de estoque:**
Produtos críticos são destacados em vermelho ou laranja na lista de **Estoque > Visão geral**.

## Priorizando a reposição

Na seção de estoque crítico, os produtos são ordenados por:
1. Estoque mais baixo (próximo do zero primeiro)
2. Mais vendidos (produtos que têm mais saída)

Foque na reposição dos produtos que combinam **pouco estoque + alta venda** — esses são os mais urgentes.

## Produto esgotado vs. produto oculto

- **Esgotado**: aparece na vitrine com o rótulo "Sem estoque" e botão desabilitado
- **Oculto**: não aparece na vitrine de jeito nenhum

Mantenha os produtos esgotados visíveis (não ocultos) para que os clientes saibam que você trabalha com aquele item e possam te contatar para saber quando volta.

> **Dica:** Crie uma planilha de acompanhamento mensal com seus 10 produtos mais vendidos e mantenha estoque mínimo de 2 semanas de vendas para cada um.$$,
'27fecf3d-82fe-4542-a383-ffa3444a34bc', ARRAY['estoque', 'alerta', 'crítico', 'reposição', 'mínimo'], true, false, now());
