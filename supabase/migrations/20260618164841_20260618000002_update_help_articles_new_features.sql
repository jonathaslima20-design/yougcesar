/*
  # Help Articles — Update articles with new features

  Updates 6 articles to document features added since original content was written:
  1. configurando-variacoes-produtos — add weight variants, custom flavors, custom sizes, custom colors
  2. definindo-precos-descontos — add pricing_mode (exact vs progressive/tiered)
  3. personalizando-visual-vitrine — add gradients, footer logo mode/format, category display settings
  4. conectando-meta-pixel — add Meta CAPI server-side tracking, domain verification
  5. configurando-checkout — add online payment via PIX/card
  6. como-funciona-indique-ganhe — add discount for referred user, custom share messages
*/

UPDATE help_articles SET
  excerpt = 'Configure variações de produtos como cores, tamanhos, sabores, pesos e crie opções personalizadas para cada tipo de produto.',
  content = $$# Configurando variações de produtos — cores, tamanhos e mais

As variações permitem que um produto tenha múltiplas opções para o cliente escolher no momento da compra. O VitrineTurbo suporta vários tipos de variação.

## Tipos de variação disponíveis

### Cores
Adicione opções de cor ao produto. Para cada cor você pode definir:
- Nome da cor (ex: "Preto", "Azul Navy")
- Código hexadecimal para exibição visual
- Imagem específica para essa cor (opcional)

### Tamanhos
Adicione opções de tamanho padrão (PP, P, M, G, GG, XGG) ou tamanhos personalizados criados por você.

### Sabores
Ideal para produtos alimentícios. Adicione opções de sabor (ex: "Chocolate", "Baunilha", "Morango") que o cliente escolherá ao comprar.

### Pesos / Gramagens
Para produtos vendidos por peso ou em embalagens de diferentes tamanhos. Adicione variações de peso (ex: "250g", "500g", "1kg") com preços individuais para cada opção.

## Como adicionar variações

1. Acesse **Produtos** e abra o produto desejado (ou crie um novo)
2. Role até a seção **"Variações"**
3. Escolha o tipo de variação que deseja adicionar
4. Clique em **"Adicionar variação"** e preencha os dados
5. Repita para cada opção disponível
6. Salve o produto

## Criando opções personalizadas

Além das opções padrão, você pode criar listas de variações personalizadas que ficam disponíveis para uso em todos os seus produtos.

### Tamanhos personalizados
Acesse **Configurações → Tamanhos** para criar seus próprios tamanhos (ex: "Único", "Infantil P", "Plus Size").

### Cores personalizadas
Acesse **Configurações → Cores** para criar um catálogo de cores exclusivo da sua loja.

### Sabores personalizados
Acesse **Configurações → Sabores** para criar sabores que refletem o cardápio ou linha de produtos da sua loja.

## Preços por variação

Cada variação pode ter um **preço próprio**, diferente do preço base do produto. Isso é útil para produtos de peso diferente (pacote 250g é mais barato que 1kg) ou versões premium de um mesmo produto.

## Estoque por variação

Quando o controle de estoque está ativo, você pode controlar o estoque **separadamente para cada variação**. Assim você sabe exatamente quantas unidades da cor Preta tamanho M você tem disponível.

> **Dica:** Produtos com variações bem configuradas reduzem as dúvidas dos clientes pelo WhatsApp e aumentam as conversões.$$,
  updated_at = now()
WHERE slug = 'configurando-variacoes-produtos';

UPDATE help_articles SET
  excerpt = 'Aprenda a definir preços, adicionar preço promocional, configurar preço de atacado e entender os modos de precificação por quantidade.',
  content = $$# Definindo preços, descontos e preço de atacado

O VitrineTurbo oferece um sistema de precificação flexível que permite desde um simples preço único até tabelas de preço progressivo por quantidade.

## Preço base

O preço base é o valor principal do produto, exibido na vitrine. Para defini-lo:

1. Abra o produto no painel
2. Localize o campo **"Preço"**
3. Digite o valor (use ponto ou vírgula como separador decimal)
4. Salve o produto

## Preço promocional

Para mostrar um desconto, preencha também o campo **"Preço original"** (ou "De:"). O VitrineTurbo exibirá automaticamente o preço original riscado ao lado do preço promocional, destacando o desconto para o cliente.

## Modo de precificação por quantidade

Para produtos vendidos em quantidade (como atacado), você pode configurar um **modo de precificação** que define como o preço varia conforme a quantidade comprada.

### Modo Exato
Cada faixa de quantidade tem um **preço unitário fixo**. O cliente paga exatamente o preço da faixa correspondente à quantidade escolhida.

Exemplo:
| Quantidade | Preço unitário |
|-----------|---------------|
| 1–5 un. | R$ 20,00 |
| 6–11 un. | R$ 17,00 |
| 12+ un. | R$ 14,00 |

Se o cliente comprar 6 unidades, paga R$ 17,00 cada (total: R$ 102,00).

### Modo Progressivo
O cliente paga preços diferentes para cada faixa que percorre. As unidades de cada faixa custam o valor daquela faixa.

Exemplo: comprando 7 unidades no modo progressivo, as primeiras 5 custam R$ 20,00 e as 2 seguintes custam R$ 17,00.

> Use o **Modo Exato** para tabelas de atacado tradicionais onde o preço vira "tudo ou nada" por faixa. Use o **Modo Progressivo** para descontos graduais que se acumulam.

## Como configurar a tabela de preços

1. Abra o produto
2. Role até a seção **"Preço de atacado"** ou **"Tabela de preços"**
3. Escolha o modo: **Exato** ou **Progressivo**
4. Clique em **"Adicionar faixa"** e defina a quantidade mínima e o preço unitário
5. Adicione quantas faixas quiser
6. Salve o produto

## Preços por variação

Cada variação do produto (tamanho, peso, etc.) pode ter um preço próprio que substitui o preço base para aquela opção específica. Veja mais em [Configurando variações](/help/category/vitrine-produtos/configurando-variacoes-produtos).

## Cupons de desconto

Além dos preços por produto, você pode criar cupons de desconto globais ou por produto. Veja o artigo [Criando cupons de desconto](/help/category/cupons-promocoes/criando-cupons-desconto).$$,
  updated_at = now()
WHERE slug = 'definindo-precos-descontos';

UPDATE help_articles SET
  excerpt = 'Personalize cores, fontes, gradientes, logo, capa, banner e o layout das categorias da sua vitrine para criar uma identidade visual única.',
  content = $$# Personalizando o visual da sua vitrine

A aparência da vitrine é o cartão de visitas do seu negócio. O VitrineTurbo oferece um editor visual completo para você criar uma identidade profissional sem precisar de conhecimento técnico.

## Acessando o editor visual

No painel, acesse **Configurações → Aparência** (ou "Visual da Vitrine").

## Cores

### Cor principal
A cor principal é usada em botões, destaques e elementos interativos. Escolha uma cor que represente a identidade da sua marca.

### Gradiente
Além de cores sólidas, você pode usar um **gradiente** como cor de fundo de elementos. Configure a cor inicial, a cor final e a direção do gradiente para criar um visual moderno.

## Tipografia

Escolha a fonte usada na vitrine. O VitrineTurbo oferece diversas opções do Google Fonts. Mantenha a legibilidade — fontes simples e limpas geralmente funcionam melhor.

## Imagens da loja

### Logo
A logo aparece no cabeçalho da vitrine. Você pode controlar:
- **Modo da logo no rodapé**: escolha se o rodapé exibe a logo colorida original, uma versão em branco/monocromática, ou nenhuma logo.
- **Formato da logo no rodapé**: ajuste o formato de exibição (quadrado, retangular, etc.) para que a logo fique proporcional no rodapé.

### Foto de capa
Imagem panorâmica no topo da vitrine. Recomendamos 1280×720px ou maior.

### Banner promocional
Banner opcional exibido logo abaixo do cabeçalho — ideal para promoções sazonais ou destaque de novidades.

## Layout de categorias

### Modo de exibição das categorias
Configure como as categorias aparecem na sua vitrine:
- **Carrossel horizontal** — categorias rolam lateralmente
- **Grade** — categorias exibidas em grid
- **Lista** — exibição em lista vertical

### Configurações de exibição
Para cada categoria você pode definir configurações individuais de exibição (visível ou oculta, ordem, etc.) acessando **Produtos → Categorias → Configurações de exibição**.

## Cores personalizadas da seção de categorias

Cada categoria pode ter sua própria cor de destaque, permitindo criar uma vitrine visualmente rica e organizada.

## Salvando e visualizando

Após cada alteração, clique em **"Salvar"**. Use o botão **"Ver vitrine"** para conferir o resultado em tempo real no celular ou computador.

> **Dica:** Teste o visual no celular antes de divulgar — a maioria dos clientes acessa pelo smartphone.$$,
  updated_at = now()
WHERE slug = 'personalizando-visual-vitrine';

UPDATE help_articles SET
  excerpt = 'Configure o Meta Pixel e o Meta CAPI (Conversions API) para rastrear eventos da vitrine no gerenciador de anúncios com máxima precisão.',
  content = $$# Conectando o Meta Pixel ao VitrineTurbo

O Meta Pixel (antigo Facebook Pixel) é uma ferramenta de rastreamento que registra as ações dos visitantes na sua vitrine e envia esses dados para o Meta (Facebook/Instagram), permitindo otimizar campanhas de anúncios.

## O que é rastreado

Com o Meta Pixel configurado, o VitrineTurbo envia automaticamente:

- **PageView** — quando alguém visita qualquer página da vitrine
- **ViewContent** — quando alguém visualiza um produto específico
- **AddToCart** — quando um produto é adicionado ao carrinho
- **InitiateCheckout** — quando o cliente inicia o checkout
- **Purchase** — quando um pedido é finalizado

## Configurando o Meta Pixel

1. Acesse **Configurações → Integrações** no painel
2. Localize a seção **Meta Pixel**
3. Cole o seu **ID do Pixel** (formato: sequência de 15–16 dígitos)
4. Salve as configurações

O pixel começará a rastrear eventos imediatamente após salvar.

## Meta Conversions API (CAPI) — rastreamento server-side

O Meta CAPI é uma camada adicional de rastreamento que funciona no **servidor**, complementando o pixel do navegador. Ele garante que eventos sejam capturados mesmo quando o pixel é bloqueado por extensões de privacidade ou iOS.

### Como configurar o CAPI

1. Na mesma tela de configuração do Pixel, localize a seção **Conversions API**
2. Cole o **Token de Acesso do CAPI** (gerado no Gerenciador de Eventos do Meta)
3. Salve as configurações

Com o CAPI ativo, os eventos são enviados em duplicata (navegador + servidor) com **deduplicação automática** pelo Meta, garantindo máxima cobertura sem contagem dupla.

## Verificação de domínio do Meta

Para usar o CAPI e certas funcionalidades avançadas do Meta, pode ser necessário verificar a propriedade do seu domínio no Meta Business Manager.

1. Acesse o Meta Business Manager → **Configurações de Segurança da Marca → Domínios**
2. Adicione o domínio da sua vitrine
3. Copie o **código de verificação** fornecido pelo Meta
4. Cole esse código em **Configurações → Integrações → Verificação de Domínio Meta**
5. Clique em **Verificar** no Meta Business Manager

## Testando o pixel

Use a extensão **Meta Pixel Helper** (Chrome) para confirmar que os eventos estão sendo disparados corretamente ao navegar na sua vitrine.

> **Recomendação:** Use Pixel + CAPI juntos para obter o máximo de dados para otimização de campanhas. Especialmente importante após as mudanças de privacidade do iOS.$$,
  updated_at = now()
WHERE slug = 'conectando-meta-pixel';

UPDATE help_articles SET
  excerpt = 'Configure o checkout da sua vitrine: endereço de entrega, WhatsApp, pagamento online com PIX e cartão de crédito via MercadoPago.',
  content = $$# Configurando o checkout e link de pagamento

O checkout é a etapa final da jornada do cliente na sua vitrine. Configure corretamente para maximizar conversões e facilitar o processo de compra.

## Acessando as configurações de checkout

Acesse **Configurações → Checkout** no painel da vitrine.

## Opções de finalização de pedido

### Via WhatsApp (padrão)
O cliente finaliza o pedido e é redirecionado para o WhatsApp da sua loja com uma mensagem automática já preenchida contendo os produtos, quantidades e valor total.

Configure o **número de WhatsApp** que receberá os pedidos. Use o formato internacional: `5511999999999` (55 = Brasil, 11 = DDD, seguido do número).

### Pagamento online com PIX e Cartão
Você pode habilitar o **pagamento online** para que os clientes paguem diretamente na vitrine, sem precisar combinar pelo WhatsApp.

Quando habilitado, o cliente escolhe entre:
- **PIX** — gera um QR code e chave copia-e-cola para pagamento instantâneo
- **Cartão de crédito** — pagamento com opção de parcelamento

Após a confirmação do pagamento, o pedido é registrado automaticamente no painel com o status de pagamento **"Pago"**.

> Para habilitar o pagamento online, entre em contato com o suporte ou acesse a opção em **Configurações → Checkout → Pagamento Online**.

## Campos do formulário de checkout

Configure quais informações solicitar ao cliente durante o checkout:

- **Nome completo** (recomendado: obrigatório)
- **Telefone / WhatsApp** (recomendado: obrigatório)
- **CEP e endereço** — habilite se faz entregas e precisa do endereço
- **CPF** — habilite se precisa para emissão de nota fiscal
- **Observações** — campo livre para o cliente informar detalhes do pedido

## Frete

Configure as opções de entrega disponíveis:
- **Retirada no local** — cliente busca pessoalmente
- **Entrega com frete a combinar** — valor combinado via WhatsApp após o pedido
- **Frete fixo** — valor fixo cobrado em todos os pedidos
- **Entrega grátis** — sem cobrança de frete (pode definir valor mínimo de pedido)

## Mensagem de confirmação

Configure a mensagem exibida ao cliente após finalizar o pedido. Use para informar o próximo passo (ex: "Entraremos em contato em breve pelo WhatsApp!").

> **Dica:** Simplifique ao máximo o checkout. Quanto menos campos obrigatórios, menor o abandono de carrinho.$$,
  updated_at = now()
WHERE slug = 'configurando-checkout';

UPDATE help_articles SET
  excerpt = 'Entenda como funciona o programa de indicações, como você ganha comissão, como os indicados ganham desconto e como personalizar sua mensagem de compartilhamento.',
  content = $$# Como funciona o Indique e Ganhe — guia completo

O programa de Indicações do VitrineTurbo permite que você **ganhe comissão** ao indicar novos lojistas para a plataforma e que seus indicados recebam um **desconto especial** na primeira assinatura.

## Como funciona

1. Você tem um **link de indicação exclusivo** (disponível em **Financeiro → Indicações**)
2. Você compartilha esse link com amigos, colegas ou na sua rede social
3. Quando alguém se cadastra pelo seu link e assina um plano, você ganha uma **comissão**
4. O indicado recebe um **desconto** no momento de assinar o plano

## Sua comissão como indicador

Ao indicar alguém que se torna assinante, você recebe uma comissão em créditos ou conforme o modelo definido pela plataforma. O valor da comissão é exibido na página de Indicações.

Você pode acompanhar:
- Total de indicações realizadas
- Quantas converteram em assinatura
- Comissão acumulada

## Desconto para o indicado

Quem se cadastrar usando o seu link recebe um **desconto exclusivo** na primeira assinatura. Esse desconto é aplicado automaticamente durante o processo de pagamento — o indicado não precisa fazer nada além de usar o seu link de cadastro.

## Como compartilhar o link

Acesse **Financeiro → Indicações** para ver seu link exclusivo. Você pode compartilhá-lo em:

- WhatsApp (pessoalmente ou em grupos)
- Instagram (bio, stories, posts)
- TikTok
- Qualquer outro canal que você usar

### Mensagem personalizada de compartilhamento

Na página de Indicações, você pode configurar uma **mensagem personalizada** que será usada ao compartilhar o link via WhatsApp. Edite o texto para que fique com a sua voz e destaque os benefícios para quem você está indicando.

## Sacando a comissão

As comissões acumuladas podem ser solicitadas para saque conforme as regras da plataforma. Acesse **Financeiro → Indicações → Solicitar saque** para iniciar o processo.

Configure sua **chave PIX** em **Financeiro → Dados bancários** para receber os valores.

## Dicas para indicar mais

- Compartilhe em grupos de WhatsApp de empreendedores
- Mostre sua própria vitrine como exemplo do que é possível fazer
- Mencione o desconto que o indicado vai receber — isso aumenta muito a conversão
- Use a mensagem personalizada para dar um toque mais pessoal ao compartilhamento

> **Atenção:** O desconto e a comissão são válidos apenas para novos cadastros que utilizem o seu link exclusivo.$$,
  updated_at = now()
WHERE slug = 'como-funciona-indique-ganhe';
