/*
  # Help Articles - Batch 2: Vitrine & Produtos

  Inserts 6 detailed articles for the "Vitrine & Produtos" category.
  Category ID: 54b5bb6f-f733-409b-81bb-eea690a217d4
*/

INSERT INTO help_articles (title, slug, excerpt, content, category_id, tags, is_published, is_featured, published_at) VALUES

('Cadastrando e editando produtos passo a passo', 'cadastrando-produtos', 'Guia completo sobre como criar, editar e organizar produtos no VitrineTurbo, incluindo preços, descrições e imagens.',
$$# Cadastrando e editando produtos passo a passo

O VitrineTurbo oferece um cadastro de produtos completo e intuitivo. Siga este guia para criar um catálogo profissional.

## Criando um novo produto

Acesse **Produtos** no menu lateral do painel e clique em **"Novo produto"**.

## Aba: Informações

### Nome do produto
Use nomes claros e descritivos. Exemplo: "Tênis Nike Air Max 270 — Branco/Preto" em vez de apenas "Tênis Nike".

### Categoria
Selecione a categoria correta para o produto. Se ainda não criou categorias, veja o artigo [Criando e organizando categorias](/help/category/vitrine-produtos/criando-organizando-categorias).

### Descrição
A descrição é exibida na página de detalhes do produto. Seja detalhado:

```
✅ Bom exemplo:
"Tênis Nike Air Max 270 original com tecnologia Air de câmara máxima 
no calcanhar para máximo conforto. Cabedal em mesh respirável, 
solado de borracha durável. Disponível nos tamanhos 38 ao 44."

❌ Ruim:
"Tênis bonito e confortável."
```

### Preço
- **Preço de venda**: valor que o cliente pagará
- **Preço original** (opcional): valor antes do desconto — aparece riscado ao lado do preço atual, mostrando a economia

### Visibilidade
Mantenha como **"Visível"** para que o produto apareça na vitrine. Mude para **"Oculto"** se quiser esconder temporariamente sem excluir.

## Aba: Imagens

Arraste e solte as imagens ou clique para selecionar. Dicas:
- Use fotos em fundo neutro (branco ou cinza claro)
- Fotografe de diferentes ângulos: frente, verso, detalhe
- Para roupas: foto com modelo + foto do produto plano
- A primeira imagem é a imagem principal da listagem

Para reordenar, arraste as imagens na ordem desejada.

## Aba: Variações

Se o produto tem variações, ative esta aba. Você pode configurar:
- **Tamanhos**: P, M, G, GG, XGG ou numéricos (38, 39, 40...)
- **Cores**: escolha de uma paleta ou adicione cores personalizadas
- **Sabores** (para produtos alimentícios): baunilha, chocolate, morango...
- **Pesos/tamanhos personalizados**: 250g, 500g, 1kg...

Cada combinação de variação pode ter um preço diferente.

## Editando um produto existente

Na listagem de produtos, clique no ícone de **lápis** (editar) ou clique diretamente no nome do produto. Faça as alterações e clique em **"Salvar"**.

## Excluindo um produto

Clique no ícone de **lixeira** na listagem. Atenção: a exclusão é permanente. Se quiser apenas ocultar o produto, use a opção **"Oculto"** na visibilidade.

> **Dica profissional:** Use a função de **importação CSV** para cadastrar muitos produtos de uma vez. Acesse Produtos > Importar para baixar o modelo e fazer o upload.$$,
'54b5bb6f-f733-409b-81bb-eea690a217d4', ARRAY['produto', 'cadastro', 'editar', 'criar', 'variações'], true, true, now()),

('Criando e organizando categorias da vitrine', 'criando-organizando-categorias', 'Aprenda a criar categorias, definir a ordem de exibição e organizar seus produtos de forma que facilite a navegação dos clientes.',
$$# Criando e organizando categorias da vitrine

Categorias organizam seus produtos e tornam a navegação da vitrine muito mais agradável para os clientes.

## Por que usar categorias?

Imagine entrar em uma loja onde tudo está misturado: roupas, calçados e acessórios no mesmo lugar, sem nenhuma divisão. Difícil encontrar o que você quer, certo? As categorias resolvem isso.

Exemplos de categorias bem organizadas:
- Loja de moda: Camisetas | Calças | Vestidos | Acessórios | Calçados
- Loja de suplementos: Proteínas | Pré-treinos | Vitaminas | Queimadores
- Loja de cosméticos: Skincare | Maquiagem | Cabelos | Perfumes

## Criando uma categoria

1. No painel, acesse **Produtos > Categorias**
2. Clique em **"Nova categoria"**
3. Preencha:
   - **Nome**: nome que aparecerá na vitrine (ex: "Camisetas")
   - **Descrição** (opcional): breve descrição da categoria
4. Clique em **"Salvar"**

## Reordenando categorias

A ordem das categorias determina como elas aparecem no menu de navegação da vitrine. Para reordenar:

1. Na lista de categorias, clique em **"Reordenar"** ou use o ícone de arrastar (⠿) ao lado de cada categoria
2. Arraste as categorias para a ordem desejada
3. Clique em **"Salvar ordem"**

> **Dica:** Coloque as categorias com mais produtos ou mais populares no início da lista.

## Vinculando produtos a categorias

Existem duas formas de vincular um produto a uma categoria:

**Opção 1 — Direto no produto:**
Ao criar ou editar um produto, selecione a categoria no campo **"Categoria"**.

**Opção 2 — Edição em massa:**
Na listagem de produtos, selecione vários produtos com as caixas de seleção e use a opção **"Edição em massa > Mudar categoria"**.

## Ocultando e excluindo categorias

- **Ocultar**: a categoria some da vitrine mas os produtos ficam no sistema
- **Excluir**: remove permanentemente a categoria (os produtos não são excluídos, ficam sem categoria)

> **Dica:** Categorias com apenas 1 ou 2 produtos podem ser agrupadas em uma categoria maior para não deixar a vitrine fragmentada.$$,
'54b5bb6f-f733-409b-81bb-eea690a217d4', ARRAY['categoria', 'organização', 'menu', 'navegação'], true, false, now()),

('Gerenciando imagens e galeria de fotos dos produtos', 'gerenciando-imagens-galeria', 'Tudo sobre o upload de imagens, ordem das fotos, recorte e boas práticas de fotografia para e-commerce.',
$$# Gerenciando imagens e galeria de fotos dos produtos

A qualidade das imagens é um dos fatores que mais influenciam a decisão de compra online. Este guia cobre tudo sobre imagens no VitrineTurbo.

## Padrões recomendados

| Tipo | Formato | Resolução mínima | Proporção |
|------|---------|-----------------|-----------|
| Produto | JPG ou PNG | 800x800px | 1:1 (quadrado) |
| Banner da loja | JPG | 1280x400px | 16:5 |
| Logo | PNG (fundo transparente) | 400x400px | 1:1 |

## Adicionando imagens ao produto

1. Abra o produto no painel (Produtos > clique no produto)
2. Clique na aba **"Imagens"**
3. Arraste as fotos para a área de upload ou clique em **"Selecionar imagens"**
4. Aguarde o processamento — o VitrineTurbo comprime automaticamente para carregamento rápido

## Ferramenta de recorte

Ao fazer upload, o VitrineTurbo abre automaticamente uma ferramenta de recorte. Use-a para:
- Centralizar o produto na imagem
- Remover bordas desnecessárias
- Garantir a proporção correta

## Reordenando as fotos

A ordem das imagens na galeria pode ser alterada arrastando os itens. A **primeira imagem** é sempre a principal que aparece na listagem da vitrine.

## Quantas imagens usar?

- **Mínimo recomendado:** 2 imagens
- **Ideal para roupas:** 4–6 imagens (produto plano, detalhe, foto com modelo, costas)
- **Ideal para calçados:** 3–5 imagens (frente, lateral, detalhe da sola)
- **Ideal para alimentos/suplementos:** 2–3 imagens (embalagem fechada, etiqueta nutricional, produto aberto)

## Removendo imagens

Passe o mouse sobre uma imagem e clique no ícone **"X"** vermelho que aparece no canto. A imagem é removida imediatamente da galeria.

## Boas práticas de fotografia para e-commerce

### Iluminação
- Prefira luz natural (perto de uma janela)
- Evite sombras fortes
- Luz difusa (nuvens, cortina fina) resulta em fotos mais suaves

### Fundo
- Fundo branco ou cinza claro é o mais profissional
- Uma cartolina branca já resolve para a maioria dos produtos
- Evite fundos com muita textura ou cores fortes

### Enquadramento
- Centralize o produto
- Deixe um espaço (margem) ao redor do produto
- Para roupas dobradas: use uma superfície limpa e plana

> **Dica:** Antes de fotografar, ligue para uma gráfica ou papelaria e peça uma cartolina branca 50x70cm. Com menos de R$ 5, você transforma completamente a qualidade das suas fotos.$$,
'54b5bb6f-f733-409b-81bb-eea690a217d4', ARRAY['imagens', 'fotos', 'galeria', 'upload', 'fotografia'], true, false, now()),

('Configurando variações de produtos — cores, tamanhos e mais', 'configurando-variacoes-produtos', 'Aprenda a configurar variações de tamanho, cor, sabor e peso nos seus produtos para que os clientes possam escolher na vitrine.',
$$# Configurando variações de produtos — cores, tamanhos e mais

Variações permitem que um único produto seja oferecido em diferentes opções (tamanho P, M, G ou cor preta, branca, azul). Isso organiza melhor o catálogo e melhora a experiência do cliente.

## Quando usar variações?

Use variações quando um produto tem opções que o cliente precisa escolher antes de comprar:

- **Tamanho**: roupas (P/M/G), calçados (38/39/40), cinto (90cm/100cm)
- **Cor**: camiseta preta, branca ou azul
- **Sabor**: suplemento de baunilha, chocolate ou morango
- **Peso/Volume**: 250g, 500g, 1kg; 200ml, 400ml

## Ativando variações no produto

1. Acesse o produto no painel
2. Clique na aba **"Variações"** ou **"Tamanhos e Cores"**
3. Ative a opção de variações

## Tipos de variação disponíveis no VitrineTurbo

### Tamanhos de roupa
Oferece uma grade com os tamanhos PP, P, M, G, GG, XG e XGG. Marque apenas os disponíveis.

### Tamanhos de calçado
Grade numérica de 33 a 46. Marque os números disponíveis.

### Cores
Selecione as cores da paleta padrão ou adicione cores personalizadas clicando em **"+ Adicionar cor personalizada"**. Você pode nomear a cor (ex: "Azul petróleo") e escolher o tom na roda de cores.

### Sabores personalizados
Adicione manualmente cada sabor disponível (ex: "Baunilha", "Chocolate Belga", "Morango com Leite").

### Pesos e medidas personalizados
Útil para produtos vendidos em gramagens ou volumes diferentes.

## Preço por variação

Se as variações têm preços diferentes, ative a opção **"Preço individual por variação"** e defina o preço de cada uma.

## Estoque por variação

Se o controle de estoque estiver ativo, você pode definir a quantidade em estoque para cada variação separadamente. Veja mais em [Controle de Estoque](/help/category/controle-estoque/ativando-controle-estoque).

## Como o cliente vê as variações?

Na vitrine, o cliente vê os botões ou chips de seleção logo abaixo do preço. Ele seleciona as opções e depois clica em comprar. As escolhas aparecem automaticamente na mensagem enviada ao WhatsApp.

> **Dica:** Se um tamanho específico está esgotado, ele aparece riscado ou desativado para o cliente, evitando frustrações.$$,
'54b5bb6f-f733-409b-81bb-eea690a217d4', ARRAY['variações', 'tamanho', 'cor', 'sabor', 'peso'], true, false, now()),

('Definindo preços, descontos e preço de atacado', 'definindo-precos-descontos', 'Entenda as opções de precificação do VitrineTurbo: preço normal, preço promocional, desconto por quantidade e preço de atacado.',
$$# Definindo preços, descontos e preço de atacado

O VitrineTurbo oferece opções flexíveis de precificação para atender diferentes estratégias de venda.

## Preço de venda

É o preço principal do produto — o que o cliente pagará. Sempre preencha esse campo.

## Preço original (para mostrar desconto)

Quando você quer mostrar que o produto está em promoção, preencha o **preço original** com o valor anterior e coloque o preço promocional no campo **"Preço de venda"**.

O resultado na vitrine fica assim:
```
~~R$ 89,90~~  R$ 59,90  (33% OFF)
```

O VitrineTurbo calcula e exibe a porcentagem de desconto automaticamente.

## Preço por atacado / Faixas de preço

O VitrineTurbo suporta **precificação por faixas de quantidade** (atacado progressivo). Isso é ideal para lojistas que vendem em grandes quantidades.

Exemplo:
| Quantidade | Preço unitário |
|------------|---------------|
| 1–4 unidades | R$ 50,00 |
| 5–9 unidades | R$ 45,00 |
| 10+ unidades | R$ 38,00 |

Para configurar:
1. Abra o produto
2. Ative a opção **"Preço por faixas"** ou **"Atacado"**
3. Adicione cada faixa com a quantidade mínima e o preço correspondente

O cliente vê uma tabela de preços na página do produto e o sistema aplica automaticamente o desconto conforme a quantidade no carrinho.

## Cupons de desconto

Além dos descontos no produto, você pode criar cupons promocionais que os clientes aplicam no checkout. Veja o artigo [Criando cupons de desconto](/help/category/cupons-promocoes/criando-cupons-desconto).

## Moeda

O VitrineTurbo opera em **Real (BRL)** por padrão. Todos os preços são exibidos em R$.

## Dicas de precificação

- **Calcule sua margem** antes de definir o preço: custo + frete + embalagem + margem de lucro = preço de venda
- **Teste diferentes faixas de atacado** para ver qual gera mais volume de pedidos
- **Use o preço original** para produtos com desconto — o "De/Por" aumenta a percepção de valor

> **Atenção:** Mantenha os preços sempre atualizados. Um preço desatualizado gera frustração no cliente e problemas na hora de fechar o pedido.$$,
'54b5bb6f-f733-409b-81bb-eea690a217d4', ARRAY['preço', 'desconto', 'atacado', 'promoção', 'faixas'], true, false, now()),

('Personalizando o visual da sua vitrine', 'personalizando-visual-vitrine', 'Aprenda a customizar cores, fontes, layout e aparência geral da sua vitrine para criar uma identidade visual única.',
$$# Personalizando o visual da sua vitrine

O VitrineTurbo permite personalizar a aparência da sua vitrine para criar uma experiência única e coerente com a identidade do seu negócio.

## Acessando as configurações visuais

No painel, acesse **Configurações > Aparência** (ou **Configurações > Vitrine**).

## Tema: claro ou escuro

Escolha entre o tema **claro** (fundo branco, ideal para a maioria das lojas) e o tema **escuro** (fundo preto, ideal para lojas de eletrônicos, games ou marcas premium).

A escolha do tema afeta toda a vitrine, incluindo menus, cards de produtos e página de detalhes.

## Cores personalizadas

Você pode definir a **cor principal** da vitrine (chamada de "cor primária"). Essa cor é usada em:
- Botões de ação ("Comprar", "Adicionar ao carrinho")
- Destaques e hover de links
- Bordas de elementos ativos

Para escolher:
1. Clique no seletor de cor ao lado de **"Cor principal"**
2. Escolha uma cor usando a roda de cores ou insira o código hexadecimal (#FF5733)
3. A prévia atualiza em tempo real

> **Dica:** Use a cor principal da sua marca para criar consistência visual.

## Fonte

Selecione a tipografia da vitrine entre as opções disponíveis. Recomendações:
- **Lojas de moda/luxo**: fontes com serifa ou elegantes (ex: Playfair Display)
- **Lojas de tecnologia/esporte**: fontes sem serifa e modernas (ex: Inter, Montserrat)
- **Lojas infantis/coloridas**: fontes mais arredondadas e amigáveis

## Filtros e organização da listagem

Na seção de configurações da vitrine, você pode definir:
- **Ordenação padrão dos produtos**: mais recentes, mais vendidos, ordem manual
- **Número de colunas na grade**: 2 ou 3 colunas no mobile, 3 ou 4 no desktop
- **Exibir ou ocultar o preço** na listagem (útil para quem trabalha com orçamentos)
- **Mostrar ou ocultar filtros** de categorias para os clientes

## Frases promocionais

Adicione frases rotativas que aparecem no topo da vitrine, como:
- "Frete grátis para pedidos acima de R$ 200"
- "Novos produtos toda semana"
- "Atendimento via WhatsApp das 8h às 18h"

## Botão de WhatsApp flutuante

Ative o botão flutuante do WhatsApp que aparece no canto inferior da vitrine, facilitando o contato imediato dos clientes.

> **Dica:** Após personalizar, compartilhe o link da sua vitrine com alguém de confiança para obter uma opinião externa sobre o visual.$$,
'54b5bb6f-f733-409b-81bb-eea690a217d4', ARRAY['visual', 'aparência', 'cores', 'tema', 'personalização'], true, false, now());
