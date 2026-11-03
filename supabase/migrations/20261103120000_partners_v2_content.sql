/*
  # VitrineTurbo Partners v2 — academy, materials, directory, documents

  1. Changes
    - Academy: partner_courses, partner_lessons, partner_lesson_progress,
      partner_quiz_questions, partner_certification_attempts and
      submit_partner_certification() (grades server-side, never exposes the
      answer key to partners; passing sets partner_profiles.certified_at,
      which the Ouro/Diamante levels require).
    - Materials: partner_assets (copies, FAQ, images, presentations) managed
      by admins; public bucket `partner-assets`.
    - Documents: private bucket `partner-documents` for invoices (partner
      uploads under its own folder) and payout receipts (admins).
    - Directory (/especialistas): list_public_partners(),
      get_public_partner() and submit_partner_directory_lead() for anon.
      Only approved, public, Prata+ partners are listed.
    - Seeds the initial academy and copy library in Portuguese.
*/

-- ---------------------------------------------------------------------------
-- Academy
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.partner_courses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  title text NOT NULL,
  description text,
  sort_order integer NOT NULL DEFAULT 0,
  is_published boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.partner_lessons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id uuid NOT NULL REFERENCES public.partner_courses(id) ON DELETE CASCADE,
  slug text NOT NULL,
  title text NOT NULL,
  content_md text NOT NULL DEFAULT '',
  video_url text,
  duration_minutes integer NOT NULL DEFAULT 5,
  sort_order integer NOT NULL DEFAULT 0,
  is_published boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (course_id, slug)
);

CREATE TABLE IF NOT EXISTS public.partner_lesson_progress (
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  lesson_id uuid NOT NULL REFERENCES public.partner_lessons(id) ON DELETE CASCADE,
  completed_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, lesson_id)
);

CREATE TABLE IF NOT EXISTS public.partner_quiz_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  question text NOT NULL,
  options text[] NOT NULL CHECK (array_length(options, 1) BETWEEN 2 AND 6),
  correct_index integer NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  CHECK (correct_index >= 0 AND correct_index < array_length(options, 1))
);

CREATE TABLE IF NOT EXISTS public.partner_certification_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  score numeric NOT NULL,
  passed boolean NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.partner_courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.partner_lessons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.partner_lesson_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.partner_quiz_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.partner_certification_attempts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Partners view published courses" ON public.partner_courses;
CREATE POLICY "Partners view published courses" ON public.partner_courses FOR SELECT TO authenticated
  USING ((is_published AND public.is_partner()) OR public.is_admin());
DROP POLICY IF EXISTS "Admins manage courses" ON public.partner_courses;
CREATE POLICY "Admins manage courses" ON public.partner_courses FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Partners view published lessons" ON public.partner_lessons;
CREATE POLICY "Partners view published lessons" ON public.partner_lessons FOR SELECT TO authenticated
  USING ((is_published AND public.is_partner()) OR public.is_admin());
DROP POLICY IF EXISTS "Admins manage lessons" ON public.partner_lessons;
CREATE POLICY "Admins manage lessons" ON public.partner_lessons FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Partners manage own progress" ON public.partner_lesson_progress;
CREATE POLICY "Partners manage own progress" ON public.partner_lesson_progress FOR ALL TO authenticated
  USING (user_id = auth.uid() OR public.is_admin())
  WITH CHECK (user_id = auth.uid() AND public.is_partner());

-- Questions are read through get_partner_quiz() so correct_index never leaks.
DROP POLICY IF EXISTS "Admins manage quiz" ON public.partner_quiz_questions;
CREATE POLICY "Admins manage quiz" ON public.partner_quiz_questions FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Partners view own attempts" ON public.partner_certification_attempts;
CREATE POLICY "Partners view own attempts" ON public.partner_certification_attempts FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_admin());

CREATE OR REPLACE FUNCTION public.get_partner_quiz()
RETURNS TABLE (id uuid, question text, options text[])
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT q.id, q.question, q.options
  FROM public.partner_quiz_questions q
  WHERE q.is_active AND public.is_partner()
  ORDER BY q.sort_order;
$$;
REVOKE ALL ON FUNCTION public.get_partner_quiz() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_partner_quiz() TO authenticated;

-- p_answers: {"<question id>": <chosen index>, ...}
CREATE OR REPLACE FUNCTION public.submit_partner_certification(p_answers jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_total integer;
  v_correct integer;
  v_score numeric;
  v_passed boolean;
BEGIN
  IF v_uid IS NULL OR NOT is_partner() THEN RAISE EXCEPTION 'Apenas parceiros.' USING ERRCODE = '42501'; END IF;
  IF (SELECT count(*) FROM partner_certification_attempts WHERE user_id = v_uid AND created_at > now() - interval '1 hour') >= 3 THEN
    RAISE EXCEPTION 'Você já fez 3 tentativas na última hora. Revise as aulas e tente de novo mais tarde.';
  END IF;

  SELECT count(*), count(*) FILTER (WHERE (p_answers ->> q.id::text)::integer = q.correct_index)
  INTO v_total, v_correct
  FROM partner_quiz_questions q WHERE q.is_active;

  IF v_total = 0 THEN RAISE EXCEPTION 'Prova indisponível no momento.'; END IF;
  v_score := round(100.0 * v_correct / v_total, 0);
  v_passed := v_score >= 80;

  INSERT INTO partner_certification_attempts (user_id, score, passed) VALUES (v_uid, v_score, v_passed);

  -- Certification belongs to the partner account (agency owner), not staff.
  IF v_passed AND partner_team_role() = 'owner' THEN
    UPDATE partner_profiles SET certified_at = COALESCE(certified_at, now()) WHERE user_id = v_uid;
    UPDATE partner_profiles SET onboarding = onboarding || '{"certified": true}'::jsonb WHERE user_id = v_uid;
    PERFORM partner_recompute_level(v_uid);
  END IF;

  RETURN jsonb_build_object('score', v_score, 'passed', v_passed, 'correct', v_correct, 'total', v_total);
END;
$$;
REVOKE ALL ON FUNCTION public.submit_partner_certification(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.submit_partner_certification(jsonb) TO authenticated;

-- ---------------------------------------------------------------------------
-- Materials
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.partner_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  category text NOT NULL CHECK (category IN ('copy', 'faq', 'image', 'video', 'presentation', 'document')),
  channel text CHECK (channel IN ('whatsapp', 'instagram', 'email', 'linkedin', 'geral')),
  body_text text,
  file_url text,
  thumbnail_url text,
  sort_order integer NOT NULL DEFAULT 0,
  is_published boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (body_text IS NOT NULL OR file_url IS NOT NULL)
);

ALTER TABLE public.partner_assets ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Partners view published assets" ON public.partner_assets;
CREATE POLICY "Partners view published assets" ON public.partner_assets FOR SELECT TO authenticated
  USING ((is_published AND public.is_partner()) OR public.is_admin());
DROP POLICY IF EXISTS "Admins manage assets" ON public.partner_assets;
CREATE POLICY "Admins manage assets" ON public.partner_assets FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

-- ---------------------------------------------------------------------------
-- Storage
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'storage') THEN
    INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    VALUES ('partner-assets', 'partner-assets', true, 20971520,
            ARRAY['image/webp', 'image/png', 'image/jpeg', 'image/gif', 'video/mp4', 'application/pdf'])
    ON CONFLICT (id) DO NOTHING;

    INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    VALUES ('partner-documents', 'partner-documents', false, 10485760,
            ARRAY['application/pdf', 'image/png', 'image/jpeg', 'application/xml', 'text/xml'])
    ON CONFLICT (id) DO NOTHING;

    -- Partner logos live in partner-assets/logos/<partner id>/...
    EXECUTE $p$DROP POLICY IF EXISTS "Admins write partner assets" ON storage.objects$p$;
    EXECUTE $p$CREATE POLICY "Admins write partner assets" ON storage.objects FOR ALL TO authenticated
      USING (bucket_id = 'partner-assets' AND public.is_admin())
      WITH CHECK (bucket_id = 'partner-assets' AND public.is_admin())$p$;

    EXECUTE $p$DROP POLICY IF EXISTS "Partners upload own logo" ON storage.objects$p$;
    EXECUTE $p$CREATE POLICY "Partners upload own logo" ON storage.objects FOR INSERT TO authenticated
      WITH CHECK (bucket_id = 'partner-assets' AND public.is_partner()
                  AND (storage.foldername(name))[1] = 'logos'
                  AND (storage.foldername(name))[2] = auth.uid()::text)$p$;

    EXECUTE $p$DROP POLICY IF EXISTS "Partners upload own documents" ON storage.objects$p$;
    EXECUTE $p$CREATE POLICY "Partners upload own documents" ON storage.objects FOR INSERT TO authenticated
      WITH CHECK (bucket_id = 'partner-documents' AND public.is_partner()
                  AND (storage.foldername(name))[1] = auth.uid()::text)$p$;

    EXECUTE $p$DROP POLICY IF EXISTS "Partners read own documents" ON storage.objects$p$;
    EXECUTE $p$CREATE POLICY "Partners read own documents" ON storage.objects FOR SELECT TO authenticated
      USING (bucket_id = 'partner-documents' AND ((storage.foldername(name))[1] = auth.uid()::text OR public.is_admin()))$p$;

    EXECUTE $p$DROP POLICY IF EXISTS "Admins write partner documents" ON storage.objects$p$;
    EXECUTE $p$CREATE POLICY "Admins write partner documents" ON storage.objects FOR INSERT TO authenticated
      WITH CHECK (bucket_id = 'partner-documents' AND public.is_admin())$p$;
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- Public directory (/especialistas)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.list_public_partners(p_state text DEFAULT NULL, p_niche text DEFAULT NULL)
RETURNS TABLE (
  slug text, name text, partner_type text, city text, state text, niches text[], services text[],
  bio text, logo_url text, level_slug text, level_name text, certified boolean, instagram text, website text
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT pp.public_slug, COALESCE(pp.company_name, u.name), pp.partner_type, pp.city, pp.state, pp.niches, pp.services,
         pp.bio, pp.logo_url, l.slug, l.name, pp.certified_at IS NOT NULL, pp.instagram, pp.website
  FROM partner_profiles pp
  JOIN users u ON u.id = pp.user_id AND u.is_blocked = false
  JOIN partner_levels l ON l.id = pp.level_id
  WHERE pp.status = 'approved' AND pp.is_public AND pp.public_slug IS NOT NULL
    AND l.sort_order >= 2
    AND (p_state IS NULL OR pp.state = upper(p_state))
    AND (p_niche IS NULL OR p_niche = ANY (pp.niches))
  ORDER BY l.sort_order DESC, (pp.certified_at IS NOT NULL) DESC, pp.approved_at;
$$;
GRANT EXECUTE ON FUNCTION public.list_public_partners(text, text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_public_partner(p_slug text)
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT jsonb_build_object(
    'slug', pp.public_slug, 'name', COALESCE(pp.company_name, u.name), 'partner_type', pp.partner_type,
    'city', pp.city, 'state', pp.state, 'niches', pp.niches, 'services', pp.services, 'bio', pp.bio,
    'logo_url', pp.logo_url, 'instagram', pp.instagram, 'website', pp.website,
    'level_slug', l.slug, 'level_name', l.name, 'certified', pp.certified_at IS NOT NULL,
    'listed', pp.is_public AND l.sort_order >= 2,
    'portfolio', (
      SELECT COALESCE(jsonb_agg(jsonb_build_object('name', c.name, 'slug', c.slug) ORDER BY c.created_at DESC), '[]'::jsonb)
      FROM (
        SELECT cu.name, cu.slug, cu.created_at FROM users cu
        JOIN partner_store_access sa ON sa.store_user_id = cu.id AND sa.partner_id = pp.user_id AND sa.granted
        WHERE cu.managed_by_partner_id = pp.user_id AND cu.plan_status = 'active' AND cu.slug IS NOT NULL AND cu.is_blocked = false
        LIMIT 6
      ) c
    )
  )
  FROM partner_profiles pp
  JOIN users u ON u.id = pp.user_id AND u.is_blocked = false
  LEFT JOIN partner_levels l ON l.id = pp.level_id
  WHERE pp.public_slug = lower(p_slug) AND pp.status = 'approved';
$$;
GRANT EXECUTE ON FUNCTION public.get_public_partner(text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.submit_partner_directory_lead(p_slug text, p_name text, p_email text, p_whatsapp text, p_message text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_partner uuid;
  v_email text := NULLIF(lower(trim(p_email)), '');
  v_whatsapp text := NULLIF(regexp_replace(COALESCE(p_whatsapp, ''), '\D', '', 'g'), '');
BEGIN
  SELECT pp.user_id INTO v_partner FROM partner_profiles pp
  JOIN partner_levels l ON l.id = pp.level_id
  WHERE pp.public_slug = lower(p_slug) AND pp.status = 'approved' AND pp.is_public AND l.sort_order >= 2;
  IF v_partner IS NULL THEN RAISE EXCEPTION 'Especialista não encontrado.'; END IF;
  IF COALESCE(trim(p_name), '') = '' OR (v_email IS NULL AND (v_whatsapp IS NULL OR length(v_whatsapp) < 10)) THEN
    RAISE EXCEPTION 'Informe seu nome e um e-mail ou WhatsApp.';
  END IF;
  IF v_email IS NOT NULL AND v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' THEN
    RAISE EXCEPTION 'E-mail inválido.';
  END IF;
  IF (SELECT count(*) FROM partner_leads
      WHERE source = 'directory' AND created_at > now() - interval '1 day'
        AND ((v_email IS NOT NULL AND email = v_email) OR (v_whatsapp IS NOT NULL AND whatsapp = v_whatsapp))) >= 3 THEN
    RAISE EXCEPTION 'Você já enviou contatos hoje. O especialista vai responder em breve.';
  END IF;

  INSERT INTO partner_leads (partner_id, name, email, whatsapp, source, notes, stage)
  VALUES (v_partner, left(trim(p_name), 120), v_email, v_whatsapp, 'directory', left(p_message, 1000), 'contact');

  INSERT INTO notifications (user_id, type, title, message, related_entity_type)
  VALUES (v_partner, 'partner_lead', 'Novo contato pelo diretório!',
          left(trim(p_name), 120) || ' quer ajuda para montar a loja. Veja em Oportunidades.', 'partner_lead');
END;
$$;
GRANT EXECUTE ON FUNCTION public.submit_partner_directory_lead(text, text, text, text, text) TO anon, authenticated;

-- ---------------------------------------------------------------------------
-- Seed: academy
-- ---------------------------------------------------------------------------
INSERT INTO public.partner_courses (slug, title, description, sort_order) VALUES
  ('primeiros-passos', 'Primeiros passos no Partners', 'Como o programa funciona, como você ganha e como usar o painel.', 1),
  ('produto', 'Conhecendo o VitrineTurbo', 'O que o lojista ganha com a plataforma e como apresentar cada recurso.', 2),
  ('vendas', 'Como vender para pequenos lojistas', 'Prospecção, diagnóstico, objeções e fechamento.', 3),
  ('implantacao', 'Implantação em 1 hora', 'Do cadastro à loja publicada, pronta para vender.', 4)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO public.partner_lessons (course_id, slug, title, duration_minutes, sort_order, content_md)
SELECT c.id, v.slug, v.title, v.minutes, v.ord, v.body
FROM public.partner_courses c
JOIN (VALUES
  ('primeiros-passos', 'como-voce-ganha', 'Como você ganha', 6, 1,
$md$## Comissão recorrente

Você ganha uma porcentagem de **toda mensalidade paga** pelos clientes que trouxe, enquanto eles continuarem assinando. Não é uma comissão única: cada renovação gera uma nova comissão.

## Níveis

A porcentagem depende do seu nível. Ele é calculado pela receita mensal (MRR) da sua carteira ou pelo número de clientes ativos, o que for melhor para você.

- **Subir de nível é imediato.** No momento em que você atinge o critério, a nova taxa já vale para toda a carteira.
- **Descer de nível só acontece depois de 2 meses** abaixo do critério. Um mês ruim não derruba sua taxa.

## Carência de 30 dias

Toda comissão nasce **em carência** e fica disponível para saque depois de 30 dias. Isso protege o programa contra reembolsos e contestações. Se um pagamento for reembolsado ou contestado, a comissão correspondente é estornada.

## Planos anuais

Quando o cliente assina um plano anual, a comissão é paga em **12 parcelas mensais**. Você recebe todo mês, sem risco de devolver tudo se o cliente cancelar.

## Bônus

- **Primeira venda:** um bônus fixo se o seu primeiro cliente pagar nos primeiros 30 dias de programa.
- **Campanhas:** metas e multiplicadores divulgados no painel.
- **Indique um parceiro:** uma porcentagem da comissão dos parceiros que você trouxer, por 12 meses.
$md$),
  ('primeiros-passos', 'seu-painel', 'Seu painel em 10 minutos', 8, 2,
$md$## O que tem em cada área

- **Início:** sua receita de carteira, nível, saldo e alertas do que precisa de atenção hoje.
- **Clientes:** todos os lojistas que você trouxe, com a saúde de cada loja.
- **Nova loja:** crie a loja do cliente, configure e envie o convite para ele assumir.
- **Oportunidades:** registre seus contatos. Um contato registrado fica **protegido por 60 dias**: se ele assinar nesse período, o cliente é seu.
- **Links & Campanhas:** crie um link para cada canal (Instagram, WhatsApp, anúncio) e veja qual traz mais clientes.
- **Desempenho:** o funil de cliques até clientes pagantes.
- **Financeiro:** extrato, previsão e saques via PIX.
- **Materiais:** textos prontos, imagens e o gerador de proposta.

## Dica

Comece criando um link por canal. Assim você descobre onde vale a pena investir seu tempo.
$md$),
  ('primeiros-passos', 'regras', 'Regras e boas práticas', 5, 3,
$md$## O que é proibido

- Anunciar no Google ou em redes sociais usando a marca **VitrineTurbo** nas palavras-chave.
- Enviar spam ou usar listas de contatos compradas.
- Prometer recursos que a plataforma não tem.
- Se apresentar como funcionário ou como o próprio VitrineTurbo.
- Indicar a si mesmo ou criar contas falsas.

Descumprir essas regras pode levar ao estorno de comissões e ao encerramento da parceria.

## Dados dos clientes

Você terá acesso a dados dos seus clientes e das lojas deles. Use esses dados apenas para prestar o serviço, nunca para outros fins, conforme a LGPD. O acesso à loja do cliente depende da permissão dele, e ele pode revogar a qualquer momento.
$md$),
  ('produto', 'o-que-e', 'O que é o VitrineTurbo', 5, 1,
$md$## Em uma frase

O VitrineTurbo é a loja online do pequeno lojista: **catálogo profissional, estoque, pedidos e domínio próprio**, com venda pelo WhatsApp ou pagamento online via Pix e cartão.

## Para quem é

- Quem já vende pelo WhatsApp e Instagram e perde tempo mandando foto e preço um por um.
- Quem quer um site próprio sem pagar comissão por venda.
- Quem precisa de algo simples de manter no dia a dia.

## Como explicar ao cliente

Fale do problema dele, não do recurso: "Você vai mandar um link e o cliente escolhe sozinho, com foto, preço e tamanho. O pedido chega pronto no seu WhatsApp."
$md$),
  ('produto', 'recursos-que-vendem', 'Recursos que vendem', 8, 2,
$md$## Os argumentos que mais convertem

1. **Catálogo com link próprio:** um endereço para colocar na bio do Instagram e no status do WhatsApp.
2. **Pedido pronto no WhatsApp:** o cliente monta o carrinho e o lojista recebe a mensagem organizada.
3. **Pagamento online:** Pix e cartão direto na loja, para quem quer receber antes de separar o pedido.
4. **Domínio próprio:** a loja com o nome da marca, passando mais confiança.
5. **Estoque e pedidos em um só lugar:** menos planilha e menos erro.

## Como demonstrar

Use a **loja demo** do painel. Mostre o celular do comprador: abrir o link, escolher, finalizar. Em 2 minutos o lojista entende o valor.
$md$),
  ('produto', 'planos', 'Planos e como recomendar', 4, 3,
$md$## Qual plano indicar

- **Mensal:** para quem quer testar sem compromisso.
- **Trimestral e semestral:** bom equilíbrio entre preço e compromisso.
- **Anual:** o menor custo por mês. Indique para quem já vende bem e quer economizar.

Os preços atualizados ficam na página de planos e na calculadora do programa. Nunca prometa preço diferente do oficial.

## Teste grátis

Todo cliente que entra pelo seu link ganha **teste grátis**. Use isso no fechamento: "Monta comigo hoje, você testa sem pagar nada e só assina se gostar."
$md$),
  ('vendas', 'prospeccao', 'Onde encontrar clientes', 7, 1,
$md$## Comece pela sua carteira

Seus clientes atuais de social media, tráfego ou design são os primeiros candidatos. Eles já confiam em você.

## Depois, vá onde o lojista está

- Lojas de bairro com Instagram ativo, mas sem site.
- Perfis que respondem "chama no direct" para saber o preço.
- Feiras, bazares e grupos de empreendedores da sua cidade.

## Registre tudo em Oportunidades

Cada contato registrado fica protegido por 60 dias. Se outro parceiro trouxer o mesmo lojista nesse período, o cliente continua sendo seu.
$md$),
  ('vendas', 'diagnostico', 'Abordagem e diagnóstico', 6, 2,
$md$## Três perguntas que abrem a conversa

1. "Como seus clientes escolhem os produtos hoje?"
2. "Quanto tempo por dia você gasta respondendo preço e foto?"
3. "Quantas vendas você acha que perde porque demorou a responder?"

## Mostre, não explique

Depois das respostas, abra a loja demo no celular dele. Peça para ele mesmo fazer um pedido de teste.
$md$),
  ('vendas', 'objecoes', 'Objeções comuns', 8, 3,
$md$## "Já vendo pelo Instagram"

Ótimo, a loja não substitui o Instagram, ela **fecha a venda** que o Instagram começa. O link vai na bio.

## "Não tenho tempo para cadastrar produtos"

Você cadastra para ele. A implantação é o seu serviço, e é por ela que você cobra.

## "É caro"

Compare com uma venda perdida por semana. Na maioria das lojas, uma venda a mais por mês já paga o plano.

## "Vou pensar"

Ofereça o teste grátis e marque a data de revisão. Registre em Oportunidades com a próxima ação.
$md$),
  ('vendas', 'fechamento', 'Fechando a venda', 5, 4,
$md$## O roteiro

1. Monte a loja junto com o cliente, ou crie pelo painel em **Nova loja**.
2. Envie o convite: ele define a senha e já entra com a loja pronta.
3. Durante o teste, publique o link na bio e no status do WhatsApp dele.
4. No fim do teste, ajude a escolher o plano.

## Cobre pela implantação

O VitrineTurbo paga a comissão recorrente. A implantação, a configuração e a gestão são serviços seus: cobre por eles.
$md$),
  ('implantacao', 'checklist', 'Checklist de implantação', 6, 1,
$md$## Antes de começar, peça ao cliente

- Logo e cores da marca.
- Lista de produtos com preço, variações e estoque (planilha ajuda).
- Fotos dos produtos.
- WhatsApp que vai receber os pedidos.

## Ordem recomendada

1. Dados da loja e WhatsApp.
2. Aparência (tema, logo, banner).
3. Categorias.
4. Produtos (use a importação em massa para muitos itens).
5. Pagamentos e entrega.
6. Domínio próprio, se o cliente tiver.
7. Pedido de teste.
$md$),
  ('implantacao', 'entrega', 'Entregando a loja ao cliente', 5, 2,
$md$## Convite

Em **Clientes**, abra a loja e clique em **Enviar convite**. O cliente recebe um link válido por 7 dias para definir a senha.

## Acesso de gestor

Ao aceitar, o cliente escolhe se você continua com acesso para gerenciar a loja. Ele pode mudar isso depois nas configurações. Combine com ele antes, principalmente se você vai cobrar pela gestão mensal.

## Treinamento rápido

Mostre ao cliente como cadastrar um produto, ver um pedido e mudar o estoque. Cinco minutos de treino evitam muitos chamados.
$md$)
) AS v(course_slug, slug, title, minutes, ord, body) ON v.course_slug = c.slug
ON CONFLICT (course_id, slug) DO NOTHING;

INSERT INTO public.partner_quiz_questions (question, options, correct_index, sort_order)
SELECT * FROM (VALUES
  ('Quando uma comissão fica disponível para saque?', ARRAY['Na hora em que o cliente paga', 'Depois da carência de 30 dias', 'Só no fim do ano', 'Quando o cliente renova'], 1, 1),
  ('O que acontece com a comissão se o pagamento do cliente for reembolsado?', ARRAY['Nada, a comissão é mantida', 'A comissão é estornada', 'A comissão dobra', 'O cliente paga a comissão'], 1, 2),
  ('Como é paga a comissão de um plano anual?', ARRAY['Tudo de uma vez', 'Em 12 parcelas mensais', 'Só no final do ano', 'Não gera comissão'], 1, 3),
  ('Por quanto tempo um contato registrado em Oportunidades fica protegido?', ARRAY['7 dias', '30 dias', '60 dias', 'Para sempre'], 2, 4),
  ('Qual destas práticas é proibida?', ARRAY['Criar um link por canal', 'Anunciar usando a marca VitrineTurbo como palavra-chave', 'Oferecer o teste grátis', 'Cobrar pela implantação'], 1, 5),
  ('Quando a nova taxa de um nível superior passa a valer?', ARRAY['Imediatamente, para toda a carteira', 'Só para clientes novos', 'No ano seguinte', 'Depois de 2 meses'], 0, 6),
  ('O que é preciso para gerenciar a loja de um cliente pelo painel?', ARRAY['Nada, o acesso é automático para sempre', 'A permissão do cliente, que ele pode revogar', 'A senha do cliente', 'Pagar uma taxa'], 1, 7),
  ('Qual é a melhor forma de demonstrar o VitrineTurbo?', ARRAY['Enviar um PDF longo', 'Mostrar a loja demo no celular e deixar o cliente fazer um pedido', 'Falar só do preço', 'Mandar o link do site institucional'], 1, 8),
  ('Quem define a senha do cliente em uma loja criada pelo parceiro?', ARRAY['O parceiro', 'O suporte', 'O próprio cliente, pelo convite', 'Ninguém'], 2, 9),
  ('Qual resposta é adequada para "já vendo pelo Instagram"?', ARRAY['Pare de usar o Instagram', 'A loja fecha a venda que o Instagram começa; o link vai na bio', 'O Instagram vai acabar', 'Não responda'], 1, 10)
) AS v(question, options, correct_index, sort_order)
WHERE NOT EXISTS (SELECT 1 FROM public.partner_quiz_questions);

-- ---------------------------------------------------------------------------
-- Seed: copy library
-- ---------------------------------------------------------------------------
INSERT INTO public.partner_assets (title, category, channel, sort_order, body_text)
SELECT * FROM (VALUES
  ('Primeira abordagem no WhatsApp', 'copy', 'whatsapp', 1,
   $t$Oi, {nome}! Tudo bem? Vi o perfil da {loja} e reparei que os pedidos são feitos pelo direct. Hoje eu monto lojas online para negócios como o seu: o cliente escolhe os produtos sozinho, com foto e preço, e o pedido chega pronto no seu WhatsApp. Posso te mostrar em 2 minutos como ficaria?$t$),
  ('Follow-up depois da demonstração', 'copy', 'whatsapp', 2,
   $t${nome}, como combinamos, segue o link para você testar grátis: {link}

Se quiser, eu já cadastro os produtos para você e te entrego a loja pronta. Qual dia fica bom?$t$),
  ('Legenda para Instagram (carrossel)', 'copy', 'instagram', 3,
   $t$Seu cliente pergunta "quanto custa?" e você responde 30 vezes por dia? 🙋

Com uma loja online, ele vê foto, preço e tamanho sozinho, e o pedido chega pronto no seu WhatsApp. Pix e cartão também.

Eu monto a sua. Chama no direct ou toque no link da bio. 👆$t$),
  ('Stories: pergunta para gerar conversa', 'copy', 'instagram', 4,
   $t$Enquete: "Você perde venda porque demora a responder no direct?" Sim / Às vezes. Quem votar, chame no direct com a demonstração da loja.$t$),
  ('E-mail para carteira de clientes', 'copy', 'email', 5,
   $t$Assunto: Uma loja online para a {loja}, pronta em poucos dias

Olá, {nome}!

Além do trabalho que já fazemos juntos, agora eu monto lojas online completas: catálogo com fotos e preços, pedidos pelo WhatsApp, pagamento por Pix e cartão e domínio próprio.

Você testa grátis antes de assinar, e eu cuido de toda a configuração.

Posso te mostrar como ficaria a sua? Responda este e-mail e marcamos 15 minutos.

Abraço,
{seu nome}$t$),
  ('Post para LinkedIn (agências)', 'copy', 'linkedin', 6,
   $t$Pequenos negócios vendem pelo Instagram, mas fecham no WhatsApp, e é ali que muita venda se perde.

Começamos a entregar lojas online completas para nossos clientes: catálogo, pedido pronto no WhatsApp, Pix e cartão, domínio próprio. A implantação leva poucos dias e o cliente testa grátis.

Se você tem um negócio local e quer vender mais sem depender só do direct, fale com a gente.$t$),
  ('Objeção: "é caro"', 'faq', 'geral', 7,
   $t$Compare com uma venda perdida por semana. Na maioria das lojas, uma venda a mais por mês já paga o plano. E dá para testar grátis antes de decidir.$t$),
  ('Objeção: "não tenho tempo"', 'faq', 'geral', 8,
   $t$Você não precisa fazer nada técnico: eu cadastro os produtos e entrego a loja pronta. No dia a dia, atualizar estoque e preço leva poucos minutos pelo celular.$t$),
  ('Objeção: "já vendo pelo Instagram"', 'faq', 'geral', 9,
   $t$A loja não substitui o Instagram, ela fecha a venda que o Instagram começa. O link vai na bio e no status do WhatsApp, e o cliente compra sem esperar resposta.$t$),
  ('Objeção: "e se eu não gostar?"', 'faq', 'geral', 10,
   $t$Você testa grátis antes de assinar, com a loja já montada. Só assina se fizer sentido para o seu negócio.$t$)
) AS v(title, category, channel, sort_order, body_text)
WHERE NOT EXISTS (SELECT 1 FROM public.partner_assets);
