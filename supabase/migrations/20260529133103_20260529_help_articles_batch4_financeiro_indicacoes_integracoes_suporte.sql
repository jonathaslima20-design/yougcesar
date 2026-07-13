/*
  # Help Articles - Batch 4: Financeiro & Planos, Indicações, Integrações & API, Solução de Problemas

  Category IDs:
  - Financeiro & Planos:       3be2ac36-0a17-4394-81ab-5ae43a98c3f3
  - Programa de Indicações:    90067506-a15d-4b87-baa9-0f1985173fed
  - Integrações & API:         7d9fd809-f26e-4b14-a514-1748e2669c3d
  - Solução de Problemas:      05028d32-2d30-4d48-a539-208cbcd3678e
*/

INSERT INTO help_articles (title, slug, excerpt, content, category_id, tags, is_published, is_featured, published_at) VALUES

-- FINANCEIRO & PLANOS
('Planos do VitrineTurbo — o que cada um oferece', 'planos-vitrineturbo', 'Conheça os planos disponíveis no VitrineTurbo, os recursos de cada um e como fazer o upgrade.',
$$# Planos do VitrineTurbo — o que cada um oferece

O VitrineTurbo oferece diferentes planos para atender desde quem está começando até lojistas com alto volume de vendas.

## Como ver os planos disponíveis

Acesse o painel e clique em **"Plano"** ou **"Assinatura"** no menu lateral, ou acesse **Configurações > Meu plano**.

## Recursos que variam por plano

Os principais recursos que diferem entre os planos são:

| Recurso | Grátis | Básico | Pro | Avançado |
|---------|--------|--------|-----|---------|
| Produtos na vitrine | Limitado | Limitado | Alto | Ilimitado |
| Imagens por produto | Limitado | Até 5 | Até 10 | Ilimitado |
| Controle de estoque | ❌ | ✅ | ✅ | ✅ |
| Cupons de desconto | ❌ | ✅ | ✅ | ✅ |
| Analytics avançado | ❌ | ❌ | ✅ | ✅ |
| Domínio personalizado | ❌ | ❌ | ✅ | ✅ |
| Integração MercadoPago | ❌ | ✅ | ✅ | ✅ |
| Suporte prioritário | ❌ | ❌ | ✅ | ✅ |

> **Nota:** Os planos e recursos exatos podem variar. Consulte a página de preços no painel para informações atualizadas.

## Fazendo upgrade de plano

1. Acesse **Configurações > Meu plano**
2. Clique em **"Fazer upgrade"** ou **"Ver planos"**
3. Escolha o plano desejado
4. Confirme o pagamento via MercadoPago

A mudança de plano é imediata — assim que o pagamento é confirmado, os recursos do novo plano ficam disponíveis.

## Fazendo downgrade de plano

Para fazer downgrade, entre em contato com o suporte. Ao fazer downgrade:
- Produtos que excedem o limite do novo plano são ocultados (não excluídos)
- Recursos exclusivos são desabilitados mas os dados são mantidos

## Período de teste

Novos usuários podem testar o VitrineTurbo gratuitamente. Durante o período de teste, você tem acesso a todos os recursos para avaliar a plataforma.

## Cancelamento

Para cancelar a assinatura, acesse **Configurações > Meu plano > Cancelar assinatura**. Ao cancelar:
- Sua vitrine continua ativa até o fim do período pago
- Após o vencimento, a vitrine é pausada mas os dados são mantidos

> **Dica:** Se estiver em dúvida entre planos, comece pelo básico e faça upgrade quando precisar de mais recursos. É sempre possível escalar.$$,
'3be2ac36-0a17-4394-81ab-5ae43a98c3f3', ARRAY['plano', 'assinatura', 'upgrade', 'preço', 'recursos'], true, true, now()),

('Integrando o MercadoPago ao VitrineTurbo', 'integrando-mercadopago', 'Passo a passo para conectar sua conta do MercadoPago ao VitrineTurbo e começar a receber pagamentos online.',
$$# Integrando o MercadoPago ao VitrineTurbo

A integração com o MercadoPago permite que seus clientes paguem diretamente na vitrine, sem precisar combinar pagamento via WhatsApp.

## Pré-requisitos

- Conta ativa no MercadoPago (mercadopago.com.br)
- Plano do VitrineTurbo que inclui integração de pagamentos

## Passo 1: Acessar as configurações de pagamento

No painel do VitrineTurbo, acesse **Configurações > Pagamentos** ou **Integrações > MercadoPago**.

## Passo 2: Conectar a conta do MercadoPago

1. Clique em **"Conectar MercadoPago"**
2. Você será redirecionado para o site do MercadoPago
3. Faça login na sua conta do MercadoPago (ou crie uma se não tiver)
4. Autorize o VitrineTurbo a acessar sua conta
5. Você será redirecionado de volta ao painel do VitrineTurbo

## Passo 3: Configurar as opções de pagamento

Após conectar, configure:
- **Parcelamento**: quantas parcelas aceitar e a partir de qual valor
- **Meios aceitos**: cartão de crédito, débito, PIX, boleto
- **Notificações**: para quais eventos receber alertas (pagamento aprovado, recusado, estornado)

## Como funciona para o cliente?

Com a integração ativa, o fluxo do cliente muda:
1. Seleciona os produtos e vai ao checkout
2. Preenche os dados de entrega
3. Escolhe a forma de pagamento
4. Paga diretamente na vitrine (sem ir ao WhatsApp para o pagamento)
5. Você recebe a notificação de pagamento aprovado

## Recebendo os pagamentos

Os valores pagos ficam disponíveis na sua conta do MercadoPago conforme as políticas de liberação do MercadoPago (geralmente 14 dias para cartão, imediato para PIX).

## Testando a integração

Antes de divulgar para os clientes, teste com um pedido de baixo valor para garantir que está funcionando corretamente.

## Desconectando o MercadoPago

Para desconectar, acesse **Configurações > Pagamentos** e clique em **"Desconectar"**. Os pedidos pagos anteriormente não são afetados.

> **Dica:** Configure uma conta separada do MercadoPago exclusiva para a loja, diferente da sua conta pessoal. Isso facilita a conciliação financeira.$$,
'3be2ac36-0a17-4394-81ab-5ae43a98c3f3', ARRAY['mercadopago', 'pagamento', 'integração', 'pix', 'cartão'], true, false, now()),

('Gerenciando sua assinatura e cobranças', 'gerenciando-assinatura', 'Entenda como funciona a cobrança do VitrineTurbo, como atualizar o método de pagamento e o que acontece em caso de inadimplência.',
$$# Gerenciando sua assinatura e cobranças

Entender como funciona a cobrança do VitrineTurbo ajuda a evitar interrupções no serviço.

## Como funciona a cobrança

A assinatura do VitrineTurbo é cobrada de forma recorrente (mensal, trimestral ou anual, conforme o plano escolhido) via MercadoPago.

## Consultando o histórico de pagamentos

Acesse **Configurações > Meu plano > Histórico de cobranças** para ver todas as cobranças realizadas, com data, valor e status (pago, pendente, falhou).

## Datas importantes

- **Data de vencimento**: exibida no painel em **Meu plano**
- **Renovação automática**: a cobrança é feita automaticamente na data de vencimento
- **Prazo de tolerância**: se a cobrança falhar, você tem alguns dias antes do serviço ser pausado

## O que acontece se a cobrança falhar?

Se o pagamento não for processado:
1. Você recebe uma notificação no painel e por e-mail
2. O VitrineTurbo tenta cobrar novamente em alguns dias
3. Se a falha persistir, a vitrine é **pausada** (invisível para clientes)
4. Seus dados são mantidos por um período de segurança

Para reativar, regularize o pagamento em **Configurações > Meu plano**.

## Atualizando o método de pagamento

1. Acesse **Configurações > Meu plano > Método de pagamento**
2. Clique em **"Atualizar cartão"**
3. Você será redirecionado ao MercadoPago para inserir o novo método
4. Confirme

## Plano anual — desconto e funcionamento

Os planos anuais oferecem desconto significativo em relação ao mensal. Ao escolher o plano anual:
- Uma cobrança única do valor anual é feita
- A vitrine fica ativa por 12 meses
- Após 12 meses, renova automaticamente

## Solicitar reembolso

Para solicitar reembolso dentro do prazo de garantia, entre em contato com o suporte do VitrineTurbo informando o motivo. Veja [Como entrar em contato com o suporte](/help/category/solucao-problemas/contato-suporte).$$,
'3be2ac36-0a17-4394-81ab-5ae43a98c3f3', ARRAY['assinatura', 'cobrança', 'pagamento', 'plano', 'renovação'], true, false, now()),

-- PROGRAMA DE INDICAÇÕES
('Como funciona o Indique e Ganhe — guia completo', 'como-funciona-indique-ganhe', 'Entenda todas as regras do programa de indicações do VitrineTurbo: como ganhar comissões, acompanhar os indicados e sacar os ganhos.',
$$# Como funciona o Indique e Ganhe — guia completo

O programa Indique e Ganhe do VitrineTurbo permite que você ganhe comissões recorrentes indicando novos lojistas para a plataforma.

## Como funciona

1. Você gera um **link de indicação exclusivo** no painel
2. Compartilha esse link com amigos, conhecidos ou seguidores
3. A pessoa clica no link, se cadastra no VitrineTurbo e assina um plano
4. Você recebe uma **comissão** sobre o pagamento do plano dessa pessoa

## Acessando o programa

No painel, clique em **"Indicações"** ou **"Indique e Ganhe"** no menu lateral.

## Seu link de indicação

Na página do programa, você encontra seu link exclusivo. Exemplo:
```
https://vitrineturbo.com.br/register?ref=SEU_CODIGO
```

Copie e compartilhe este link. Qualquer pessoa que se cadastrar por ele fica vinculada à sua conta.

## Comissões

- As comissões são calculadas sobre os pagamentos mensais dos seus indicados
- Enquanto seu indicado mantiver a assinatura ativa, você continua recebendo
- A porcentagem de comissão é exibida na página do programa

## Acompanhando os indicados

Na tela do programa, você vê:
- **Total de indicados**: quantas pessoas se cadastraram pelo seu link
- **Indicados ativos**: quantos têm assinatura ativa atualmente
- **Comissões acumuladas**: valor disponível para saque
- **Histórico**: registro de cada comissão recebida

## Regras importantes

- O cadastro do indicado deve ser feito pelo seu link exclusivo
- O indicado deve assinar um plano pago (não conta para plano gratuito)
- Contas vinculadas ao mesmo CPF, e-mail ou IP podem não ser contabilizadas
- Tentativas de fraude resultam em cancelamento do programa

> **Dica:** Compartilhe seu link em grupos de WhatsApp de empreendedores, posts no Instagram com dicas sobre vendas online ou em vídeos no TikTok mostrando sua vitrine.$$,
'90067506-a15d-4b87-baa9-0f1985173fed', ARRAY['indicação', 'comissão', 'indique e ganhe', 'referral'], true, true, now()),

('Configurando sua chave PIX e solicitando saques', 'configurando-pix-saques', 'Veja como cadastrar sua chave PIX e solicitar o saque das comissões acumuladas pelo programa de indicações.',
$$# Configurando sua chave PIX e solicitando saques

Para receber as comissões do programa Indique e Ganhe, você precisa cadastrar uma chave PIX e solicitar o saque.

## Cadastrando sua chave PIX

1. Acesse **Indicações > Minha conta PIX** (ou **Indicações > Sacar**)
2. Clique em **"Adicionar chave PIX"**
3. Selecione o tipo de chave:
   - CPF
   - CNPJ
   - E-mail
   - Telefone
   - Chave aleatória (EVP)
4. Informe a chave
5. Confirme

> **Importante:** A chave PIX deve estar em seu nome (CPF/CNPJ) para evitar problemas na transferência.

## Valor mínimo para saque

Existe um valor mínimo para solicitar o saque. Esse valor é exibido na página de saques do painel. Não é possível sacar valores abaixo do mínimo.

## Solicitando um saque

1. Acesse **Indicações > Sacar**
2. Verifique o saldo disponível
3. Informe o valor que deseja sacar (mínimo exigido)
4. Confirme sua chave PIX
5. Clique em **"Solicitar saque"**

## Prazo de processamento

Os saques são processados pela equipe do VitrineTurbo em até **3 dias úteis**. Após a aprovação, o valor é transferido via PIX para a chave cadastrada.

## Acompanhando o status do saque

Na seção de saques, você vê o histórico com os status:
- **Pendente**: aguardando análise
- **Aprovado**: aprovado, aguardando transferência
- **Pago**: transferência realizada

## Perguntas frequentes sobre saques

**Posso ter mais de uma chave PIX?**
Sim, mas apenas uma chave pode ser a principal para receber saques.

**O que acontece se a transferência falhar?**
O valor volta para o saldo de comissões e você é notificado para verificar a chave PIX.

**Preciso emitir nota fiscal?**
Consulte seu contador sobre obrigações fiscais referentes a comissões recebidas.$$,
'90067506-a15d-4b87-baa9-0f1985173fed', ARRAY['pix', 'saque', 'comissão', 'indicação', 'pagamento'], true, false, now()),

-- INTEGRAÇÕES & API
('Conectando o Meta Pixel ao VitrineTurbo', 'conectando-meta-pixel', 'Aprenda a instalar e configurar o Meta Pixel (Facebook Pixel) na sua vitrine para rastrear visitas, eventos e criar públicos para anúncios.',
$$# Conectando o Meta Pixel ao VitrineTurbo

O Meta Pixel (anteriormente Facebook Pixel) é um código que permite rastrear o comportamento dos visitantes da sua vitrine para otimizar anúncios no Facebook e Instagram.

## Para que serve o Meta Pixel?

- Rastrear quem visitou sua vitrine e quais produtos visualizou
- Criar públicos personalizados para remarketing (anunciar para quem já visitou)
- Otimizar campanhas de anúncios com base em conversões reais
- Criar públicos semelhantes (lookalike) para alcançar novas pessoas

## Passo 1: Criar o Meta Pixel

1. Acesse o [Gerenciador de Eventos do Meta](https://business.facebook.com/events_manager)
2. Clique em **"Conectar fontes de dados"**
3. Selecione **"Web"**
4. Escolha **"Pixel do Meta"**
5. Dê um nome ao pixel (ex: "VitrineTurbo — Nome da Loja")
6. Copie o **ID do Pixel** (um número de 15 dígitos)

## Passo 2: Inserir o ID no VitrineTurbo

1. No painel do VitrineTurbo, acesse **Configurações > Integrações** ou **Configurações > Rastreamento**
2. Cole o ID do Pixel no campo **"Meta Pixel ID"**
3. Clique em **"Salvar"**

## Passo 3: Verificar a instalação

1. Instale a extensão **Meta Pixel Helper** no Chrome
2. Visite sua vitrine pública
3. A extensão mostrará se o Pixel está disparando corretamente

## Eventos rastreados automaticamente

O VitrineTurbo envia automaticamente os seguintes eventos para o Meta Pixel:
- **PageView**: toda vez que alguém abre a vitrine
- **ViewContent**: quando alguém visualiza a página de um produto
- **AddToCart**: quando alguém adiciona um produto ao carrinho
- **InitiateCheckout**: quando alguém inicia o processo de checkout

## Usando os dados para anúncios

Com o pixel instalado e funcionando por pelo menos 7 dias, você pode:
1. No Gerenciador de Anúncios, criar um público personalizado de "Visitantes do site dos últimos 30 dias"
2. Criar uma campanha de remarketing para esse público
3. Isso aumenta muito a chance de conversão pois você anuncia para quem já conhece sua loja

> **Dica:** Deixe o pixel acumular pelo menos 50–100 eventos antes de criar campanhas com otimização de conversão. Com poucos dados, o algoritmo não consegue otimizar bem.$$,
'7d9fd809-f26e-4b14-a514-1748e2669c3d', ARRAY['meta pixel', 'facebook pixel', 'rastreamento', 'anúncios', 'remarketing'], true, true, now()),

('Configurando o Google Analytics na sua vitrine', 'configurando-google-analytics', 'Como conectar o Google Analytics 4 ao VitrineTurbo para acompanhar tráfego, comportamento dos visitantes e conversões.',
$$# Configurando o Google Analytics na sua vitrine

O Google Analytics 4 (GA4) oferece dados detalhados sobre o tráfego da sua vitrine: de onde vêm os visitantes, quanto tempo ficam, quais páginas visitam e muito mais.

## Pré-requisitos

- Conta Google (Gmail)
- Acesso ao Google Analytics (analytics.google.com)

## Passo 1: Criar uma propriedade no GA4

1. Acesse [analytics.google.com](https://analytics.google.com)
2. Clique em **"Administrador"** (ícone de engrenagem)
3. Clique em **"Criar propriedade"**
4. Informe o nome (ex: "VitrineTurbo — Nome da Loja")
5. Selecione o fuso horário (Brasil/São Paulo) e moeda (BRL)
6. Clique em **"Avançar"** e preencha as informações do negócio
7. Crie um **Fluxo de dados Web** com a URL da sua vitrine
8. Copie o **ID de medição** (formato: G-XXXXXXXXXX)

## Passo 2: Inserir o ID no VitrineTurbo

1. No painel, acesse **Configurações > Integrações** ou **Configurações > Rastreamento**
2. Cole o ID de medição no campo **"Google Analytics ID"**
3. Salve as configurações

## Passo 3: Verificar o funcionamento

1. Acesse sua vitrine pública em uma aba
2. No Google Analytics, vá em **Relatórios > Tempo real**
3. Você deve ver "1 usuário ativo" nos próximos 30 segundos

## O que você vai conseguir monitorar

### Aquisição (de onde vêm os visitantes)
- Orgânico (Google, pesquisa)
- Social (Instagram, WhatsApp, TikTok)
- Direto (digitaram o link)
- Pago (anúncios)

### Comportamento
- Páginas mais visitadas
- Tempo médio na página de cada produto
- Taxa de rejeição (quem saiu sem clicar em nada)

### Conversões
Configure eventos de conversão para rastrear quando alguém:
- Visita a página de checkout
- Envia o pedido pelo WhatsApp

## Relatórios mais úteis para lojistas

1. **Aquisição > Visão geral**: veja de onde vêm mais visitantes
2. **Engajamento > Páginas e telas**: veja quais produtos são mais visitados
3. **Tempo real**: monitore visitantes ao vivo durante promoções ou lives

> **Dica:** Conecte o GA4 com o Google Search Console para ver exatamente quais palavras-chave trazem visitantes orgânicos para sua vitrine.$$,
'7d9fd809-f26e-4b14-a514-1748e2669c3d', ARRAY['google analytics', 'ga4', 'rastreamento', 'métricas', 'tráfego'], true, false, now()),

('Usando a API pública do VitrineTurbo', 'usando-api-publica', 'Documentação básica sobre a API pública do VitrineTurbo para desenvolvedores que precisam integrar sistemas externos.',
$$# Usando a API pública do VitrineTurbo

A API pública do VitrineTurbo permite acessar dados da sua loja de forma programática para integrações com sistemas externos.

## Para quem é esta documentação?

Este artigo é voltado para desenvolvedores ou usuários com conhecimento técnico que precisam:
- Integrar o catálogo de produtos com outros sistemas
- Automatizar importação/exportação de dados
- Criar aplicativos personalizados que consomem dados da vitrine

## Autenticação

A API usa autenticação via **API Key**. Para gerar uma chave:

1. Acesse **Configurações > API** no painel do VitrineTurbo
2. Clique em **"Gerar nova chave de API"**
3. Copie a chave gerada (ela não será exibida novamente)

Inclua a chave em todas as requisições no header:
```
Authorization: Bearer SUA_API_KEY
```

## Endpoints disponíveis

### Produtos
```
GET /api/v1/products
```
Retorna todos os produtos visíveis da loja.

Parâmetros opcionais:
- `category` — filtrar por categoria (slug)
- `page` — página (padrão: 1)
- `limit` — itens por página (padrão: 20, máximo: 100)

Exemplo de resposta:
```json
{
  "data": [
    {
      "id": "uuid",
      "name": "Camiseta Oversize Preta",
      "price": 59.90,
      "original_price": 89.90,
      "images": ["https://..."],
      "category": "camisetas"
    }
  ],
  "total": 45,
  "page": 1,
  "pages": 3
}
```

### Categorias
```
GET /api/v1/categories
```
Retorna todas as categorias ativas da loja.

### Pedidos (apenas leitura)
```
GET /api/v1/orders
```
Retorna o histórico de pedidos. Requer autenticação.

## Limites de requisição

A API tem um limite de **100 requisições por minuto** por chave de API. Exceder esse limite resulta em erro 429 (Too Many Requests).

## Suporte para desenvolvedores

Para dúvidas técnicas sobre a API, entre em contato com o suporte do VitrineTurbo informando que é uma questão de desenvolvimento/integração. Veja [Como entrar em contato com o suporte](/help/category/solucao-problemas/contato-suporte).$$,
'7d9fd809-f26e-4b14-a514-1748e2669c3d', ARRAY['api', 'integração', 'desenvolvedor', 'webhook', 'programação'], true, false, now()),

-- SOLUÇÃO DE PROBLEMAS
('Não consigo fazer login — o que fazer', 'nao-consigo-fazer-login', 'Soluções para os problemas mais comuns de login no VitrineTurbo: senha esquecida, e-mail não encontrado e conta bloqueada.',
$$# Não consigo fazer login — o que fazer

Se você está com dificuldade para entrar na sua conta do VitrineTurbo, este guia vai te ajudar a resolver.

## Problema 1: Esqueci minha senha

1. Na tela de login, clique em **"Esqueci minha senha"**
2. Informe o e-mail cadastrado
3. Você receberá um e-mail com o link de redefinição
4. Clique no link e crie uma nova senha
5. Tente fazer login novamente

> **Não recebeu o e-mail?** Verifique a pasta de spam/lixo eletrônico. O e-mail pode demorar até 5 minutos. Se ainda não chegou, tente reenviar clicando em "Reenviar e-mail de recuperação".

## Problema 2: E-mail ou senha incorretos

Verifique:
- Se você não tem contas em dois e-mails diferentes (use o e-mail exato do cadastro)
- Se o Caps Lock não está ativado
- Se não tem espaços extras antes ou depois do e-mail/senha

## Problema 3: Conta bloqueada temporariamente

Após várias tentativas com senha incorreta, o sistema bloqueia temporariamente o acesso. Aguarde 15 minutos e tente novamente, ou use a opção "Esqueci minha senha" para criar uma nova senha.

## Problema 4: Sessão expirada

Se você ficou sem acessar o painel por muito tempo, sua sessão expira automaticamente por segurança. Basta fazer login novamente.

## Problema 5: Página de login com erro

Se a página de login não carrega ou exibe um erro:
1. Limpe o cache do navegador (Ctrl+Shift+Del no Chrome)
2. Tente abrir em uma aba anônima
3. Tente em outro navegador (Chrome, Firefox, Edge)
4. Verifique se sua conexão com a internet está funcionando

## Problema 6: Conta desativada

Se sua conta foi desativada por inadimplência, regularize o pagamento em **Configurações > Meu plano**. Se for por outro motivo, entre em contato com o suporte.

## Ainda não conseguiu entrar?

Se nenhuma das soluções acima funcionou, entre em contato com o suporte do VitrineTurbo. Veja [Como entrar em contato com o suporte](/help/category/solucao-problemas/contato-suporte).$$,
'05028d32-2d30-4d48-a539-208cbcd3678e', ARRAY['login', 'senha', 'acesso', 'conta', 'bloqueado'], true, false, now()),

('Meu produto não aparece na vitrine', 'produto-nao-aparece-vitrine', 'Descubra as causas mais comuns de um produto não aparecer na vitrine e como resolver cada uma delas.',
$$# Meu produto não aparece na vitrine

Se você cadastrou um produto mas ele não está aparecendo na vitrine pública, verifique as causas mais comuns abaixo.

## Causa 1: Produto marcado como "Oculto"

Esta é a causa mais comum. Verifique:

1. Abra o produto no painel
2. Procure o campo **"Visibilidade"** ou **"Status"**
3. Certifique-se de que está como **"Visível"** (ativo)
4. Salve se fizer alguma alteração

## Causa 2: Limite de produtos do plano atingido

Cada plano do VitrineTurbo tem um limite de produtos visíveis. Se você atingiu o limite:
- Produtos adicionados além do limite ficam ocultos automaticamente
- Verifique em **Configurações > Meu plano** qual é o limite do seu plano
- Considere fazer upgrade ou ocultar produtos menos importantes

## Causa 3: Produto sem imagem

Alguns planos e configurações exigem que o produto tenha pelo menos uma imagem para aparecer na vitrine. Adicione uma imagem ao produto e tente novamente.

## Causa 4: Cache do navegador

Às vezes o produto já está visível mas o cache do navegador mostra a versão antiga:
1. Pressione **Ctrl+Shift+R** (ou Cmd+Shift+R no Mac) para recarregar sem cache
2. Ou abra a vitrine em uma aba anônima

## Causa 5: Categoria oculta

Se o produto está em uma categoria que está oculta, ele pode não aparecer corretamente:
1. Acesse **Produtos > Categorias**
2. Verifique se a categoria do produto está ativa/visível

## Causa 6: Estoque zerado

Se o controle de estoque estiver ativo e o produto tiver estoque zero, ele pode aparecer como "Esgotado" em vez de não aparecer. Para testar, adicione 1 unidade ao estoque e verifique.

## Ainda não aparece?

Se após verificar todos os pontos acima o produto ainda não aparece, entre em contato com o suporte informando:
- Nome exato do produto
- ID do produto (visível na URL quando você edita o produto)
- Captura de tela do problema$$,
'05028d32-2d30-4d48-a539-208cbcd3678e', ARRAY['produto', 'visibilidade', 'vitrine', 'oculto', 'problema'], true, false, now()),

('Pedido não foi registrado no painel', 'pedido-nao-registrado', 'O que fazer quando um cliente afirma que fez um pedido mas ele não aparece no painel do VitrineTurbo.',
$$# Pedido não foi registrado no painel

O VitrineTurbo funciona principalmente com pedidos via WhatsApp. Entenda quando e por que um pedido pode não aparecer no painel.

## Como os pedidos são registrados?

Existem duas formas de um pedido entrar no painel:

1. **Automaticamente**: quando o VitrineTurbo está configurado com integração de pagamento (MercadoPago) e o cliente finaliza o pagamento online
2. **Manualmente**: você registra o pedido recebido pelo WhatsApp diretamente no painel

## O pedido chegou no WhatsApp mas não está no painel

Isso é normal! O pedido via WhatsApp **não é registrado automaticamente** no painel — você precisa cadastrá-lo manualmente:

1. No painel, clique em **Pedidos > Novo pedido**
2. Informe os dados do cliente e os produtos
3. Salve o pedido

Se preferir, use a integração com MercadoPago para que o fluxo de pagamento online registre os pedidos automaticamente.

## O cliente pagou online mas o pedido não aparece

Se você usa a integração com MercadoPago e um pagamento foi feito mas não aparece:

1. Verifique no painel do MercadoPago se o pagamento foi aprovado
2. Se foi aprovado no MercadoPago mas não aparece no VitrineTurbo, pode ser uma falha de sincronização
3. Acesse **Configurações > Integrações > MercadoPago** e clique em **"Sincronizar"** se disponível
4. Se o problema persistir, entre em contato com o suporte

## O link de checkout não está funcionando

Se os clientes estão relatando que não conseguem finalizar o pedido:

1. Teste você mesmo o checkout da sua vitrine
2. Verifique se o número de WhatsApp está correto nas configurações
3. Verifique se o link do WhatsApp abre corretamente no celular

> **Dica:** Teste seu checkout periodicamente (uma vez por semana) para garantir que tudo está funcionando. Às vezes problemas ficam dias sem ser detectados.$$,
'05028d32-2d30-4d48-a539-208cbcd3678e', ARRAY['pedido', 'registro', 'whatsapp', 'checkout', 'problema'], true, false, now()),

('Como entrar em contato com o suporte', 'contato-suporte', 'Saiba quais canais de suporte estão disponíveis no VitrineTurbo, o que informar ao contatar e os prazos de resposta.',
$$# Como entrar em contato com o suporte

O suporte do VitrineTurbo está disponível para ajudar com qualquer dúvida ou problema que não foi resolvido pelos artigos da Central de Ajuda.

## Canal principal de suporte

O VitrineTurbo oferece suporte via **WhatsApp**. Para entrar em contato:

1. Acesse o painel do VitrineTurbo
2. Clique no botão **"Suporte"** ou **"Ajuda"** (geralmente no canto inferior ou no menu)
3. Você será direcionado para o WhatsApp do suporte

## O que informar ao contatar o suporte

Para agilizar o atendimento, tenha em mãos:

- **E-mail da sua conta** no VitrineTurbo
- **Descrição clara do problema**: o que aconteceu, quando começou, o que você já tentou
- **Capturas de tela** do problema (se possível)
- **Passos para reproduzir**: como o suporte pode reproduzir o problema na conta de vocês

Exemplo de uma mensagem de suporte eficiente:
```
Olá! Meu e-mail é joao@email.com.
Problema: Um produto que está marcado como visível 
não aparece na minha vitrine.
Produto: "Camiseta Oversize Preta" (ID: 12345)
Já tentei: verificar a visibilidade, limpar o cache.
Capturas de tela em anexo.
```

## Horário de atendimento

O suporte do VitrineTurbo atende de **segunda a sexta, das 9h às 18h** (horário de Brasília).

Mensagens fora do horário são respondidas no próximo dia útil.

## Prazo de resposta

- Questões simples: até 4 horas úteis
- Problemas técnicos: até 24 horas úteis
- Problemas críticos (loja fora do ar, pagamentos): prioritário

## Antes de contatar o suporte

Verifique se a sua dúvida já está respondida nos artigos da Central de Ajuda. Use a busca no topo desta página para encontrar respostas rápidas.

> **Dica:** Descreva o problema com o máximo de detalhes possível na primeira mensagem. Isso evita idas e vindas e acelera muito a resolução.$$,
'05028d32-2d30-4d48-a539-208cbcd3678e', ARRAY['suporte', 'contato', 'ajuda', 'atendimento', 'whatsapp'], true, false, now());
