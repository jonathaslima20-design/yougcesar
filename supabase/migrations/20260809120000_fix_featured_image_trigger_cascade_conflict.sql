/*
  # Corrige conflito do trigger de imagem em destaque ao excluir produto

  1. Problema
    - Excluir um produto (`DELETE FROM products`) faz CASCADE em
      `product_images`, e o trigger `trg_auto_promote_featured_image`
      (AFTER DELETE, criado em 20251108175023) roda para cada imagem
      apagada nesse cascade. Quando a imagem apagada era a featured, o
      trigger faz `UPDATE product_images SET is_featured = true` em OUTRA
      linha do mesmo produto — linha que tambem esta na fila de exclusao
      do MESMO comando (o cascade apaga todas as imagens do produto de
      uma vez).
    - Se essa outra linha ainda nao tinha sido fisicamente apagada quando
      o trigger roda, o UPDATE funciona; mas quando o cascade chega nela
      para deletar, o Postgres ve que ela ja foi modificada pelo mesmo
      comando e aborta com "tuple to be updated or deleted was already
      modified by an operation triggered by the current command" —
      derrubando a transacao inteira (produto NAO e excluido, so os
      arquivos de imagem no storage ja tinham sumido antes, via chamada
      JS separada). A ordem de exclusao das linhas nao e garantida pelo
      Postgres, entao o erro e intermitente: falha numa tentativa,
      funciona na seguinte — exatamente o sintoma relatado (excluir
      produto do usuario sneakerhouse@vitrineturbo.com).

  2. Fix
    - A promocao de imagem em destaque so faz sentido se o PRODUTO for
      continuar existindo (usuario removeu 1 foto, mantendo o produto).
      Se o produto foi apagado (cascade), a linha em `products` ja nao
      existe mais nesse ponto — a FK cascade so dispara depois do DELETE
      do pai ser efetivado, entao um SELECT ja nao a enxerga. Adiciona um
      guard: se `products.id` nao existe mais, o trigger nao mexe em mais
      nenhuma linha (nem de product_images, nem de products) e sai.
*/

CREATE OR REPLACE FUNCTION auto_promote_next_featured_image()
RETURNS TRIGGER AS $FUNC$
DECLARE
  v_next_image_id uuid;
  v_next_image_url text;
  v_remaining_count integer;
BEGIN
  IF OLD.is_featured = true THEN
    IF NOT EXISTS (SELECT 1 FROM products WHERE id = OLD.product_id) THEN
      RETURN OLD;
    END IF;

    SELECT COUNT(*) INTO v_remaining_count
    FROM product_images
    WHERE product_id = OLD.product_id;

    IF v_remaining_count > 0 THEN
      SELECT id, url INTO v_next_image_id, v_next_image_url
      FROM product_images
      WHERE product_id = OLD.product_id
      ORDER BY display_order ASC
      LIMIT 1;

      UPDATE product_images
      SET is_featured = true
      WHERE id = v_next_image_id;

      UPDATE products
      SET featured_image_url = v_next_image_url
      WHERE id = OLD.product_id;
    ELSE
      UPDATE products
      SET featured_image_url = NULL
      WHERE id = OLD.product_id;
    END IF;
  END IF;

  RETURN OLD;
END;
$FUNC$ LANGUAGE plpgsql SECURITY DEFINER;
