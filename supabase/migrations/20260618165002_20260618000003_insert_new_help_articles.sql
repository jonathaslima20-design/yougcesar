/*
  # Help Articles — Insert new articles for undocumented features

  Adds 4 new articles:
  1. Domínio personalizado com Netlify (Integrações & API)
  2. Google Tag Manager (Integrações & API)
  3. Ofertas promocionais e banners (Vitrine & Produtos)
  4. Recebendo pagamentos online com PIX e cartão (Pedidos & Vendas)
*/

INSERT INTO help_articles (title, slug, excerpt, content, category_id, tags, is_published, is_featured, published_at)
VALUES

('Conectando um domínio personalizado à sua vitrine', 'conectando-dominio-personalizado',
'Aprenda a conectar um domínio próprio (ex: www.minhaloja.com.br) à sua vitrine no VitrineTurbo usando a integração com Netlify.',
$$# Conectando um domínio personalizado à sua vitrine

Por padrão, sua vitrine está disponível em um endereço do VitrineTurbo. Com o **domínio personalizado**, você pode usar um endereço próprio como `www.minhaloja.com.br` ou `loja.minhaempresa.com`.

## Por que usar um domínio personalizado?

- **Profissionalismo**: Um domínio próprio transmite muito mais credibilidade
- **Branding**: Reforça a identidade da sua marca
- **SEO**: Domínios próprios tendem a ter melhor posicionamento nos mecanismos de busca

## Pré-requisitos

Antes de conectar o domínio, você precisa:

1. **Ter um domínio registrado** — compre em registradores como Registro.br, GoDaddy, Namecheap, etc.
2. **Ter acesso ao painel DNS do domínio** — geralmente disponível no site onde você registrou o domínio

## Como conectar o domínio

### Passo 1: Adicionar o domínio no painel

1. Acesse **Configurações → Domínio Personalizado**
2. Digite o domínio desejado (ex: `www.minhaloja.com.br`)
3. Clique em **"Adicionar domínio"**

O sistema mostrará as **configurações DNS** que você precisa aplicar no seu registrador de domínio.

### Passo 2: Configurar o DNS

No painel do seu registrador de domínio, adicione os registros DNS conforme indicado no painel do VitrineTurbo. Geralmente são registros do tipo **CNAME** apontando para o endereço Netlify da sua vitrine.

### Passo 3: Aguardar a propagação

Após configurar o DNS, a propagação pode levar de **alguns minutos até 48 horas** dependendo do registrador. O painel do VitrineTurbo mostrará o status da verificação.

Quando o domínio estiver verificado e ativo, o status mudará para **"Ativo"** e um certificado SSL será emitido automaticamente.

## SSL (HTTPS) automático

O VitrineTurbo configura automaticamente um certificado SSL gratuito para o seu domínio. Sua vitrine estará acessível com HTTPS, garantindo segurança para os clientes.

## Domínio sem "www"

Se quiser usar o domínio sem o prefixo `www` (ex: `minhaloja.com.br`), adicione o domínio sem www no painel e configure o registro DNS correspondente (geralmente um registro `A` ou `ALIAS`).

## Problemas comuns

**Domínio não verificado após 48h**: Verifique se os registros DNS foram salvos corretamente no painel do registrador. O nome do registro e o valor devem ser idênticos ao exibido no VitrineTurbo.

**Certificado SSL pendente**: Aguarde até que o DNS propague completamente. O SSL é emitido automaticamente após a verificação do domínio.

> **Dica:** Use a ferramenta [dnschecker.org](https://dnschecker.org) para acompanhar a propagação do seu DNS em tempo real.$$,
'7d9fd809-f26e-4b14-a514-1748e2669c3d',
ARRAY['domínio', 'domínio personalizado', 'DNS', 'CNAME', 'SSL', 'Netlify'],
true, false, now()),

('Configurando o Google Tag Manager na sua vitrine', 'configurando-google-tag-manager',
'Saiba como instalar o Google Tag Manager (GTM) na sua vitrine para gerenciar pixels, scripts de rastreamento e eventos sem precisar de código.',
$$# Configurando o Google Tag Manager na sua vitrine

O **Google Tag Manager (GTM)** é uma ferramenta gratuita do Google que permite gerenciar pixels, scripts de rastreamento e eventos em um único lugar — sem precisar mexer no código da vitrine toda vez que quiser adicionar ou modificar uma integração.

## O que você pode fazer com o GTM

- Gerenciar o Google Analytics, Meta Pixel e outras integrações em um único painel
- Disparar eventos customizados baseados em ações dos usuários
- Testar alterações antes de publicar
- Adicionar scripts de terceiros (chat, suporte, análise de calor, etc.)

## Criando uma conta no GTM

Se ainda não tem uma conta:

1. Acesse [tagmanager.google.com](https://tagmanager.google.com)
2. Clique em **"Criar conta"**
3. Preencha o nome da conta e o nome do contêiner
4. Em **"Onde usar o contêiner"**, selecione **"Web"**
5. Clique em **"Criar"** e aceite os termos

Você receberá o **ID do contêiner** no formato `GTM-XXXXXXX`.

## Instalando o GTM na vitrine

1. Acesse **Configurações → Integrações** no painel do VitrineTurbo
2. Localize a seção **Google Tag Manager**
3. Cole o seu **ID do contêiner GTM** (formato: `GTM-XXXXXXX`)
4. Salve as configurações

O código do GTM será inserido automaticamente em todas as páginas da sua vitrine.

## Verificando a instalação

Use a extensão **Tag Assistant** do Google (Chrome) para confirmar que o GTM está carregando corretamente nas páginas da vitrine.

Você também pode ativar o **modo de prévia** dentro do GTM para testar suas tags antes de publicar.

## Boas práticas

- Se você já configurou o Google Analytics e o Meta Pixel diretamente no VitrineTurbo, **não os adicione novamente pelo GTM** — isso causará duplicação de eventos.
- Use o GTM para integrações que o VitrineTurbo não suporta nativamente (scripts de chat, ferramentas de análise de comportamento, etc.)
- Sempre publique uma versão nova no GTM após fazer alterações para que entrem em vigor.

> **Dica:** O GTM é especialmente útil para equipes de marketing que precisam adicionar ou modificar integrações com frequência, sem depender de um desenvolvedor.$$,
'7d9fd809-f26e-4b14-a514-1748e2669c3d',
ARRAY['GTM', 'Google Tag Manager', 'rastreamento', 'integração', 'analytics'],
true, false, now()),

('Criando ofertas promocionais e banners de destaque', 'criando-ofertas-promocionais',
'Aprenda a criar ofertas com desconto e banners promocionais que aparecem automaticamente na sua vitrine para aumentar as conversões.',
$$# Criando ofertas promocionais e banners de destaque

As **ofertas promocionais** permitem criar campanhas com desconto e banners visuais que aparecem automaticamente para os visitantes da sua vitrine, incentivando a compra imediata.

## O que são ofertas promocionais

Uma oferta promocional combina:
- Um **banner visual** exibido na vitrine (imagem ou cores com texto)
- Um **desconto automático** aplicado quando o cliente aceita a oferta
- Um **período de validade** (a oferta expira automaticamente)
- Opcionalmente, um **contador regressivo** para criar urgência

## Criando uma oferta

1. Acesse **Marketing → Ofertas Promocionais** no painel
2. Clique em **"Nova oferta"**
3. Preencha as informações:

### Informações básicas
- **Nome da oferta** — nome interno para sua referência
- **Título do banner** — texto principal exibido para o cliente
- **Descrição** — texto de apoio com mais detalhes da oferta

### Desconto
- **Tipo de desconto**: percentual ou valor fixo
- **Valor do desconto**: quanto de desconto será aplicado
- Os descontos de ofertas são aplicados automaticamente no checkout quando o cliente aceita a oferta

### Validade
- **Data de início** e **data de término**
- A oferta expira automaticamente na data/hora configurada

### Contador regressivo
- Habilite o **mostrar contador** para exibir uma contagem regressiva até o fim da oferta
- Isso cria senso de urgência e aumenta as conversões

## Atribuindo a oferta a clientes

Após criar a oferta, você pode atribuí-la manualmente a clientes específicos ou configurar para que apareça automaticamente para visitantes. Acesse as configurações da oferta para gerenciar as atribuições.

## Monitorando as conversões

Na lista de ofertas, você pode ver:
- Quantas vezes a oferta foi visualizada
- Quantas conversões (clientes que aceitaram)
- Taxa de conversão da oferta

## Boas práticas

- Crie ofertas com prazo curto (24–72h) para maximizar a urgência
- Use o contador regressivo em promoções relâmpago
- Combine ofertas com o [Programa de Indicações](/help/category/indicacoes/como-funciona-indique-ganhe) para atrair novos clientes
- Teste diferentes valores de desconto para encontrar o ponto ideal entre margem e conversão

> **Dica:** Ofertas com contador regressivo visível convertem em média 2–3x mais do que ofertas sem urgência explícita.$$,
'54b5bb6f-f733-409b-81bb-eea690a217d4',
ARRAY['oferta', 'promoção', 'banner', 'desconto', 'contador', 'marketing'],
true, false, now()),

('Recebendo pagamentos online com PIX e cartão', 'recebendo-pagamentos-online',
'Entenda como seus clientes podem pagar diretamente na vitrine usando PIX ou cartão de crédito e como acompanhar esses pedidos no painel.',
$$# Recebendo pagamentos online com PIX e cartão

Com o pagamento online habilitado, seus clientes podem pagar diretamente na vitrine — sem precisar combinar pelo WhatsApp. Veja como funciona do ponto de vista do cliente e como você acompanha os pedidos.

## Como o cliente paga

### Pagamento com PIX

1. O cliente finaliza o carrinho e escolhe **"Pagar com PIX"**
2. A vitrine exibe um **QR code** e uma **chave copia-e-cola**
3. O cliente abre o app do banco e realiza o pagamento
4. A confirmação é instantânea — o pedido aparece como **pago** no painel em segundos

### Pagamento com cartão de crédito

1. O cliente finaliza o carrinho e escolhe **"Pagar com cartão"**
2. O cliente preenche os dados do cartão (nome, número, validade, CVV)
3. O pagamento é processado em tempo real
4. Aprovado, o pedido aparece como **pago** no painel imediatamente

## Como os pedidos aparecem no painel

Pedidos com pagamento online chegam ao painel em **Pedidos** com:

- Status de pagamento: **Pago** (confirmado) ou **Pendente** (aguardando confirmação)
- Método de pagamento: PIX ou Cartão
- Valor total cobrado

Você não precisa confirmar o pagamento manualmente — o sistema faz isso automaticamente quando o MercadoPago confirma.

## Habilitando o pagamento online

Para ativar o pagamento online na sua vitrine:

1. Acesse **Configurações → Checkout**
2. Localize a seção **Pagamento Online**
3. Habilite a opção e salve

> Se a opção não estiver disponível no seu painel, entre em contato com o suporte para verificar a disponibilidade no seu plano.

## Segurança dos pagamentos

Todos os pagamentos são processados com segurança pelo **MercadoPago**, que é certificado PCI-DSS. Os dados do cartão do cliente nunca passam pelos servidores do VitrineTurbo.

## Reembolsos e cancelamentos

Caso precise cancelar um pedido pago online e realizar reembolso, entre em contato com o suporte. O reembolso é processado pelo MercadoPago diretamente para o cliente.

## Perguntas frequentes

**O PIX cai na minha conta diretamente?**
O modelo de recebimento é definido pela plataforma. Entre em contato com o suporte para entender como os repasses funcionam.

**O cliente pode parcelar no cartão?**
As opções de parcelamento disponíveis são configuradas pela plataforma. Verifique na sua página de checkout quais opções aparecem para o cliente.

**O que acontece se o pagamento for recusado?**
O cliente recebe uma mensagem de recusa e pode tentar novamente com outro cartão ou optar pelo PIX. O pedido não é criado em caso de pagamento recusado.

> **Dica:** Oferecer PIX e cartão como opções de pagamento remove uma das principais barreiras de compra e aumenta significativamente as conversões da sua vitrine.$$,
'1d0700ba-e8af-4a49-99e3-b9ab0e779cc3',
ARRAY['pagamento online', 'PIX', 'cartão', 'MercadoPago', 'checkout', 'pagamento'],
true, false, now());
