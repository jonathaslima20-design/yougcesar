/*
  # Help Articles — Fix factually incorrect content

  Updates 3 articles with incorrect information:
  1. planos-vitrineturbo — remove static plan table, fix cancellation/grace period, fix upgrade flow
  2. gerenciando-assinatura — remove false auto-recurrence / retry claims, fix payment method update flow
  3. integrando-mercadopago — rewrite to describe admin-centralized token, not per-user OAuth
*/

UPDATE help_articles SET
  excerpt = 'Conheça os planos disponíveis no VitrineTurbo, como funciona o período de teste gratuito, renovações, cancelamento e o período de carência.',
  content = $$# Planos do VitrineTurbo — o que cada um oferece

O VitrineTurbo oferece um **plano pago** com diferentes ciclos de cobrança, além de um **plano gratuito** com recursos limitados para você conhecer a plataforma.

## Plano Gratuito

O plano gratuito está disponível para todos os usuários logo após o cadastro. Com ele você pode:

- Cadastrar produtos e configurar sua vitrine
- Testar as funcionalidades básicas da plataforma
- Acessar o painel e explorar os recursos

O plano gratuito tem **limites de recursos** (número de produtos, funcionalidades de marketing, etc.). Ao fazer upgrade para o plano pago, todos os limites são removidos.

## Plano Pago — Ciclos Disponíveis

O plano pago é único, mas você pode escolher o **ciclo de cobrança** que melhor se encaixa no seu bolso:

| Ciclo | Periodicidade |
|-------|--------------|
| Mensal | Cobrança a cada 30 dias |
| Trimestral | Cobrança a cada 3 meses |
| Semestral | Cobrança a cada 6 meses |
| Anual | Cobrança a cada 12 meses |

> Os valores de cada ciclo são exibidos na página de planos dentro do seu painel.

## Como funciona a renovação

O VitrineTurbo **não faz cobrança automática**. Quando a sua assinatura estiver próxima do vencimento, você receberá uma notificação para renovar manualmente.

Para renovar, acesse **Financeiro → Minha Assinatura** e realize um novo pagamento pelo ciclo desejado.

## Período de carência

Após o vencimento da assinatura, você tem **2 dias de carência** antes de a vitrine ser suspensa. Durante esse período você pode renovar normalmente sem perder nenhuma configuração.

## Cancelamento

Não existe um botão de "cancelar assinatura" porque as cobranças não são automáticas. Se você não renovar após o vencimento + período de carência, sua vitrine será suspensa automaticamente. Seus dados ficam preservados por um período, podendo ser reativados com uma nova assinatura.

## Upgrade de plano

Para fazer upgrade (por exemplo, de Mensal para Anual), acesse **Financeiro → Minha Assinatura** e escolha o novo ciclo. Se você ainda tem dias restantes na assinatura atual, o sistema considera isso como uma **renovação antecipada** e a nova data de vencimento é calculada a partir do final do período atual.

## Recursos exclusivos do plano pago

- Produtos ilimitados
- Cupons de desconto
- Controle de estoque
- Integrações (Meta Pixel, Google Analytics, Google Tag Manager)
- Domínio personalizado
- Programa de Indicações
- Pagamento online via PIX e cartão
- Acesso à API pública

> **Dica:** Quanto maior o ciclo escolhido, maior o desconto por mês. O plano anual é a opção mais econômica.$$,
  updated_at = now()
WHERE slug = 'planos-vitrineturbo';

UPDATE help_articles SET
  excerpt = 'Saiba como acompanhar sua assinatura, ver a data de vencimento, renovar o plano e o que acontece após o vencimento.',
  content = $$# Gerenciando sua assinatura e cobranças

Neste artigo você aprende a acompanhar o status da sua assinatura, renovar o plano e entender o que acontece caso ela vença.

## Acessando o painel de assinatura

No painel, acesse **Financeiro → Minha Assinatura**. Aqui você encontra:

- Plano atual e ciclo de cobrança
- Data de vencimento da assinatura
- Status da assinatura (Ativo, Vencendo, Suspenso)
- Histórico de pagamentos realizados

## Não existe cobrança automática

O VitrineTurbo **não realiza cobranças automáticas**. Sua assinatura não é renovada automaticamente como acontece em serviços de streaming. Quando o prazo vencer, você simplesmente receberá uma notificação e deverá realizar um novo pagamento manualmente.

## Como renovar

1. Acesse **Financeiro → Minha Assinatura**
2. Clique em **"Renovar assinatura"** ou **"Fazer upgrade"**
3. Escolha o ciclo desejado (Mensal, Trimestral, Semestral ou Anual)
4. Realize o pagamento via **PIX** ou **cartão de crédito**
5. Após a confirmação do pagamento, sua assinatura é ativada imediatamente

## Renovação antecipada

Você pode renovar antes do vencimento atual. O sistema identifica que você ainda tem dias restantes e trata o pagamento como **renovação antecipada**: a nova data de vencimento é calculada a partir do final do período atual, sem perda de dias.

## Notificações de vencimento

O sistema envia notificações automáticas:

- **7 dias antes do vencimento** — aviso para você se programar
- **Dentro do período de carência** — lembrete urgente para renovar antes da suspensão

Fique de olho nas notificações no painel e no e-mail cadastrado.

## Período de carência

Após o vencimento, você tem **2 dias de carência**. Durante esse período:

- Sua vitrine continua ativa para os clientes
- Você pode renovar normalmente sem perder nenhum dado
- Pedidos ainda podem ser recebidos

Após o período de carência, a vitrine é **suspensa automaticamente** até você renovar.

## O que acontece com minha vitrine suspensa?

Quando suspensa, sua vitrine fica inacessível para os clientes, mas todos os seus dados (produtos, pedidos, configurações) são mantidos. Ao renovar, tudo é restaurado imediatamente.

## Trocar de ciclo de cobrança

Para mudar de ciclo (por exemplo, de Mensal para Anual), simplesmente escolha o novo ciclo na tela de renovação. Não é necessário cancelar nada — apenas realize o pagamento do novo ciclo desejado.$$,
  updated_at = now()
WHERE slug = 'gerenciando-assinatura';

UPDATE help_articles SET
  title = 'Pagamento online com MercadoPago — como funciona',
  excerpt = 'Entenda como o VitrineTurbo usa o MercadoPago para processar pagamentos online com PIX e cartão de crédito diretamente na sua vitrine.',
  content = $$# Pagamento online com MercadoPago — como funciona

O VitrineTurbo utiliza o **MercadoPago** como gateway de pagamento para que seus clientes possam pagar diretamente na vitrine, sem precisar combinar pelo WhatsApp.

## Como funciona na prática

Quando o pagamento online está habilitado na sua loja, o cliente pode finalizar o pedido pagando com:

- **PIX** — pagamento instantâneo com QR code ou chave copia-e-cola
- **Cartão de crédito** — pagamento com parcelamento (conforme configuração)

Após a confirmação do pagamento pelo MercadoPago, o pedido é **registrado automaticamente** no seu painel com o status de pagamento atualizado.

## Configuração é feita pelo administrador

A integração com o MercadoPago é configurada centralmente pelo time do VitrineTurbo. Você **não precisa criar uma conta no MercadoPago** nem configurar chaves de API.

O recebimento dos valores é feito conforme o modelo financeiro da plataforma. Para saber mais sobre como os repasses funcionam, entre em contato com o suporte.

## Habilitando o pagamento online na sua vitrine

Para ativar a opção de pagamento online:

1. Acesse **Configurações → Checkout** no painel
2. Habilite a opção **"Pagamento online"**
3. Salve as alterações

Após ativar, os botões de PIX e cartão aparecerão automaticamente na sua vitrine durante o checkout.

## Pedidos pagos online

Pedidos com pagamento online confirmado aparecem no painel com o status de pagamento **"Pago"**. Você ainda precisa processar o pedido (preparar e enviar), mas pode ter a certeza de que o pagamento já foi confirmado.

## Limitações

- O pagamento online requer plano ativo no VitrineTurbo
- O processamento de PIX é instantâneo; cartão pode levar alguns minutos para confirmação
- Em caso de dúvidas sobre repasses ou disputas de pagamento, entre em contato com o suporte

> **Dica:** Oferecer pagamento online aumenta significativamente as conversões, pois o cliente pode comprar a qualquer hora sem precisar aguardar confirmação manual.$$,
  updated_at = now()
WHERE slug = 'integrando-mercadopago';
