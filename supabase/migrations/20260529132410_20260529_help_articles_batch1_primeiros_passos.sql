/*
  # Help Articles - Batch 1: Primeiros Passos

  Inserts 4 detailed articles for the "Primeiros Passos" category.
  Category ID: 5fa6258d-352a-43f8-a1b2-bbafd733192c
*/

INSERT INTO help_articles (title, slug, excerpt, content, category_id, tags, is_published, is_featured, published_at) VALUES

('Criando sua conta no VitrineTurbo', 'criando-sua-conta', 'Aprenda a criar sua conta no VitrineTurbo, confirmar o e-mail e acessar o painel pela primeira vez.', 
$$# Criando sua conta no VitrineTurbo

Bem-vindo ao VitrineTurbo! Este guia vai te ajudar a criar sua conta e dar os primeiros passos na plataforma.

## Passo 1: Acessar a página de cadastro

Acesse o site do VitrineTurbo e clique no botão **"Criar conta"** ou **"Cadastrar-se"** no topo da página.

## Passo 2: Preencher seus dados

Na página de cadastro, preencha as informações obrigatórias:

- **Nome completo** — seu nome pessoal ou nome do negócio
- **E-mail** — use um e-mail que você acessa com frequência, pois ele será usado para recuperar sua senha
- **Senha** — crie uma senha com no mínimo 8 caracteres. Use letras, números e símbolos para maior segurança
- **Confirmação de senha** — repita a senha para confirmar

Após preencher, clique em **"Criar conta"**.

## Passo 3: Aceitar os termos de uso

Antes de finalizar o cadastro, leia e aceite os **Termos de Uso** e a **Política de Privacidade** do VitrineTurbo. Esses documentos descrevem seus direitos e responsabilidades ao usar a plataforma.

## Passo 4: Acessar o painel

Após o cadastro, você será redirecionado automaticamente para o seu **painel (dashboard)**. É aqui que você gerenciará toda a sua vitrine.

## O que fazer agora?

Com a conta criada, os próximos passos são:

1. [Configurar o perfil e informações da loja](/help/category/primeiros-passos/configurando-perfil-loja)
2. [Cadastrar seus primeiros produtos](/help/category/vitrine-produtos/cadastrando-produtos)
3. [Personalizar o visual da sua vitrine](/help/category/vitrine-produtos/personalizando-visual-vitrine)

> **Dica:** Complete todas as informações do perfil antes de divulgar sua vitrine. Uma loja completa transmite muito mais confiança para os clientes.$$,
'5fa6258d-352a-43f8-a1b2-bbafd733192c', ARRAY['cadastro', 'conta', 'registro', 'início'], true, true, now()),

('Configurando o perfil e informações da sua loja', 'configurando-perfil-loja', 'Saiba como configurar o nome, logo, foto de capa, telefone e todas as informações da sua loja no VitrineTurbo.',
$$# Configurando o perfil e informações da sua loja

Antes de divulgar sua vitrine, é fundamental preencher todas as informações da sua loja. Um perfil completo transmite profissionalismo e aumenta a confiança dos clientes.

## Onde fica o perfil?

No painel do VitrineTurbo, clique em **"Configurações"** no menu lateral esquerdo, depois em **"Perfil"**.

## Informações básicas

### Nome da loja
Este é o nome que aparecerá no topo da sua vitrine e nos links compartilhados. Use o nome oficial do seu negócio.

### Descrição
Escreva uma descrição curta e atrativa sobre o que você vende. Seja direto: "Roupas femininas plus size com entrega para todo o Brasil" é melhor do que "Minha loja".

### Telefone / WhatsApp
Informe o número do WhatsApp que seus clientes usarão para entrar em contato. Esse número aparece em toda a vitrine.

## Imagens da loja

### Logo
A logo aparece no topo da sua vitrine. Recomendamos:
- Formato: JPG ou PNG
- Proporção: quadrada (1:1) para melhor resultado
- Tamanho mínimo: 200x200 pixels
- Fundo transparente (PNG) resulta em visual mais profissional

### Foto de capa
A capa é a imagem de fundo do topo da sua vitrine. Use uma imagem de alta qualidade que represente bem seu negócio.
- Proporção ideal: 16:9 ou panorâmica (1280x720 pixels ou maior)

### Banner promocional
Opcionalmente, você pode adicionar um banner que aparece logo abaixo do cabeçalho, ideal para divulgar promoções.

## Endereço e localização

Preencha sua cidade e estado. Essas informações ajudam os clientes a entender o alcance das entregas.

## Salvando as alterações

Após preencher todos os campos desejados, clique em **"Salvar alterações"**. As mudanças são aplicadas imediatamente na sua vitrine.

> **Dica:** Visite sua vitrine pública logo após salvar para conferir como ela ficou para os clientes.$$,
'5fa6258d-352a-43f8-a1b2-bbafd733192c', ARRAY['perfil', 'loja', 'logo', 'configuração', 'nome'], true, true, now()),

('Publicando seus primeiros produtos', 'publicando-primeiros-produtos', 'Um guia passo a passo para quem nunca cadastrou produtos e quer colocar sua vitrine no ar rapidamente.',
$$# Publicando seus primeiros produtos

Este guia é para quem está começando do zero. Vamos cadastrar seu primeiro produto do início ao fim.

## Acessando a área de produtos

No painel, clique em **"Produtos"** no menu lateral. Em seguida, clique no botão **"Adicionar produto"** (ou **"Novo produto"**).

## Passo 1: Informações básicas

### Nome do produto
Seja descritivo. Em vez de "Camiseta", use "Camiseta Oversize Algodão Premium — Preta". Isso ajuda na busca da vitrine e transmite mais qualidade.

### Descrição
A descrição é fundamental para convencer o cliente. Inclua:
- Material e composição
- Medidas ou tabela de tamanhos
- Cuidados de lavagem
- Diferenciais do produto

### Preço
Informe o preço de venda. Se o produto estiver em promoção, você também pode adicionar um **preço original** para mostrar o desconto.

## Passo 2: Imagens

Adicione pelo menos 1 imagem do produto. Quanto mais imagens de qualidade, melhor. O VitrineTurbo recomenda:
- Mínimo: 1 imagem
- Ideal: 3 a 5 imagens em ângulos diferentes
- Formato: JPG ou PNG
- Resolução: mínimo 800x800 pixels

A **primeira imagem** será a foto principal exibida na listagem da vitrine.

## Passo 3: Categorias

Escolha uma categoria para o produto. Se ainda não criou categorias, você pode fazer isso em **Produtos > Categorias** ou continuar sem categoria por enquanto.

## Passo 4: Variações (opcional)

Se o produto tem tamanhos (P, M, G, GG) ou cores (Preto, Branco, Azul), você pode cadastrar isso na aba **"Variações"** dentro do produto. Isso permite que o cliente escolha na hora de comprar.

## Passo 5: Visibilidade

Certifique-se de que o produto está como **"Visível"** (ativo). Produtos marcados como ocultos não aparecem na vitrine pública.

## Passo 6: Salvar

Clique em **"Salvar"** ou **"Publicar produto"**. Pronto! O produto já está disponível na sua vitrine.

## Visualizando na vitrine

Após salvar, você pode clicar em **"Ver na vitrine"** para conferir como o produto ficou para os clientes.

> **Dica:** Cadastre pelo menos 5 a 10 produtos antes de divulgar sua vitrine. Uma loja com poucos produtos pode parecer incompleta.$$,
'5fa6258d-352a-43f8-a1b2-bbafd733192c', ARRAY['produto', 'cadastro', 'primeiro produto', 'publicar'], true, false, now()),

('Recebendo seu primeiro pedido — do zero ao resultado', 'recebendo-primeiro-pedido', 'Entenda o fluxo completo desde o cliente encontrar sua vitrine até você receber e confirmar o pedido.',
$$# Recebendo seu primeiro pedido — do zero ao resultado

Entender o fluxo completo de vendas do VitrineTurbo vai te ajudar a atender melhor e fechar mais negócios.

## Como os clientes chegam até você

1. Você compartilha o **link da sua vitrine** (disponível no painel) via WhatsApp, Instagram, TikTok ou qualquer outro canal
2. O cliente clica no link e abre sua vitrine no celular ou computador
3. O cliente navega pelos produtos, escolhe o que quer e clica em **"Comprar"** ou **"Adicionar ao carrinho"**

## O que acontece quando o cliente finaliza o pedido?

Quando o cliente clica em finalizar, ele é direcionado para o **WhatsApp da sua loja** com uma mensagem automática já preenchida contendo:
- Nome e detalhes dos produtos escolhidos
- Quantidades e variações selecionadas
- Valor total do pedido
- Dados de entrega (se configurado)

Você recebe essa mensagem no WhatsApp e pode confirmar, negociar frete ou tirar dúvidas diretamente com o cliente.

## Registrando o pedido no painel

Para manter um histórico organizado, registre o pedido no painel:

1. Acesse **Pedidos** no menu lateral
2. Clique em **"Novo pedido"** ou registre manualmente as informações do cliente
3. Atualize o status conforme o andamento: **Novo → Em preparo → Enviado → Entregue**

## Acompanhando as vendas

No painel, na seção **Dashboard**, você visualiza:
- Total de pedidos do dia/semana/mês
- Receita acumulada
- Produtos mais vendidos
- Funil de vendas (visualizações → cliques → pedidos)

## Dicas para aumentar as vendas

- Responda os clientes rapidamente no WhatsApp
- Mantenha os preços e estoque sempre atualizados
- Peça para clientes satisfeitos indicar sua vitrine para amigos
- Use o [Programa de Indicações](/help/category/indicacoes/como-funciona-indique-ganhe) para atrair novos lojistas

> **Lembre-se:** O VitrineTurbo é uma vitrine de exposição e captação de pedidos. O pagamento e a entrega são combinados diretamente entre você e o cliente via WhatsApp.$$,
'5fa6258d-352a-43f8-a1b2-bbafd733192c', ARRAY['pedido', 'venda', 'whatsapp', 'fluxo', 'primeiro pedido'], true, false, now());
