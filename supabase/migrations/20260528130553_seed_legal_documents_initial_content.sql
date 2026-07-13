/*
  # Seed initial legal document content

  ## Summary
  Inserts the initial HTML content for the three platform legal documents based
  on the static page content already present in the codebase. Each document is
  inserted with version "1.0" and is_active = true.

  ## Documents inserted
  - terms_of_use       — Termos de Uso (14 sections)
  - privacy_policy     — Política de Privacidade (11 sections)
  - cookies_policy     — Política de Cookies (8 sections + table)

  ## Notes
  - Uses INSERT ... ON CONFLICT DO NOTHING so the migration is idempotent.
  - The unique partial index (one active doc per type) is respected because
    no prior active rows exist on a fresh database.
  - If content already exists for a type, this migration is a no-op for that row.
*/

INSERT INTO public.legal_documents (document_type, title, version, is_active, content)
VALUES (
  'terms_of_use',
  'Termos de Uso',
  '1.0',
  true,
  '<h2>1. Aceitação dos Termos</h2>
<p>Ao se cadastrar, acessar ou usar a plataforma <strong>VitrineTurbo</strong> ("Plataforma", "nós" ou "nosso"), você ("Usuário") concorda integralmente com estes Termos de Uso e com nossa Política de Privacidade. Se você não concordar com qualquer disposição destes Termos, não utilize a Plataforma.</p>
<p>Estes Termos constituem o acordo integral entre você e a VitrineTurbo e prevalecem sobre qualquer comunicação anterior.</p>

<h2>2. Definições</h2>
<ul>
<li><strong>Plataforma:</strong> o conjunto de sistemas, aplicativos web e APIs disponibilizados pela VitrineTurbo.</li>
<li><strong>Vendedor / Usuário Assinante:</strong> pessoa física ou jurídica que cria uma conta e utiliza a Plataforma para criar e gerenciar sua vitrine online.</li>
<li><strong>Vitrine:</strong> o espaço digital personalizado criado pelo Vendedor para exibir seus produtos ao público.</li>
<li><strong>Cliente Final / Visitante:</strong> o consumidor que acessa a vitrine de um Vendedor.</li>
<li><strong>Conteúdo:</strong> textos, imagens, preços, descrições e quaisquer dados inseridos pelo Vendedor na Plataforma.</li>
<li><strong>Plano:</strong> o nível de assinatura contratado, com funcionalidades e limites definidos.</li>
</ul>

<h2>3. Cadastro e Conta</h2>
<p>Para utilizar a Plataforma, o Vendedor deve:</p>
<ul>
<li>Ter capacidade civil plena (ser maior de 18 anos ou emancipado legalmente);</li>
<li>Fornecer informações verdadeiras, precisas e atualizadas no cadastro;</li>
<li>Manter a confidencialidade de sua senha e não compartilhá-la com terceiros;</li>
<li>Notificar imediatamente a VitrineTurbo em caso de acesso não autorizado à sua conta.</li>
</ul>
<p>O Vendedor é o único responsável pelas ações realizadas em sua conta. A VitrineTurbo reserva-se o direito de recusar cadastros ou encerrar contas a qualquer momento, por violação destes Termos ou por razões de segurança.</p>

<h2>4. Planos e Pagamentos</h2>
<h3>4.1 Assinatura</h3>
<p>O uso completo da Plataforma está condicionado à contratação de um Plano de assinatura. Os planos disponíveis, seus preços e funcionalidades são apresentados na página de planos da Plataforma e podem ser alterados mediante aviso prévio.</p>
<h3>4.2 Cobrança</h3>
<p>Os pagamentos são processados de forma segura via <strong>Mercado Pago</strong>. Ao assinar, você autoriza a cobrança recorrente conforme o período escolhido (mensal, trimestral ou anual). O acesso ao plano contratado é liberado imediatamente após a confirmação do pagamento.</p>
<h3>4.3 Cancelamento e Reembolso</h3>
<p>Você pode cancelar sua assinatura a qualquer momento pelo painel. O cancelamento terá efeito ao fim do período vigente, sem reembolso proporcional, salvo em casos previstos pelo Código de Defesa do Consumidor (CDC), como o direito de arrependimento de 7 dias para contratos firmados à distância.</p>
<h3>4.4 Inadimplência</h3>
<p>Em caso de falha no pagamento, o acesso às funcionalidades pagas poderá ser suspenso até a regularização. Dados e conteúdos são preservados por até 90 dias após o vencimento; após esse prazo, poderão ser excluídos.</p>
<h3>4.5 Plano Gratuito</h3>
<p>Quando disponível, o plano gratuito oferece funcionalidades limitadas e não inclui suporte prioritário. A VitrineTurbo pode descontinuar ou alterar o plano gratuito mediante aviso com antecedência mínima de 30 dias.</p>

<h2>5. Uso Aceitável</h2>
<p>O Vendedor compromete-se a NÃO utilizar a Plataforma para:</p>
<ul>
<li>Publicar, vender ou promover produtos ou serviços ilegais, falsificados, roubados ou que violem direitos de terceiros;</li>
<li>Realizar atividades que violem leis de proteção ao consumidor, tributárias, trabalhistas ou ambientais;</li>
<li>Enviar spam, comunicações não solicitadas ou enganosas;</li>
<li>Inserir vírus, malware ou qualquer código malicioso;</li>
<li>Realizar engenharia reversa, scraping não autorizado ou tentativas de invasão à Plataforma;</li>
<li>Criar múltiplas contas para burlar limites de planos ou bloqueios;</li>
<li>Comercializar produtos adultos, armas, drogas ilícitas, conteúdo de ódio ou qualquer item proibido pela legislação brasileira;</li>
<li>Usar a Plataforma de forma que prejudique outros usuários ou a própria infraestrutura.</li>
</ul>
<p>A VitrineTurbo pode remover Conteúdo ou suspender contas que violem estas regras, a qualquer tempo e sem aviso prévio quando necessário para proteger a integridade da Plataforma.</p>

<h2>6. Conteúdo do Usuário</h2>
<h3>6.1 Responsabilidade</h3>
<p>O Vendedor é inteiramente responsável por todo o Conteúdo inserido na Plataforma, incluindo textos, imagens, preços e informações de produtos. A VitrineTurbo não realiza revisão editorial prévia do Conteúdo.</p>
<h3>6.2 Licença</h3>
<p>Ao inserir Conteúdo na Plataforma, o Vendedor concede à VitrineTurbo uma licença não exclusiva, mundial, gratuita e sublicenciável para hospedar, armazenar, reproduzir e exibir o Conteúdo exclusivamente para fins de prestação do serviço.</p>
<h3>6.3 Imagens e Direitos Autorais</h3>
<p>O Vendedor declara ter os direitos necessários para publicar as imagens e demais conteúdos protegidos. A VitrineTurbo não é responsável por violações de direitos autorais cometidas por Vendedores.</p>
<h3>6.4 Remoção</h3>
<p>A VitrineTurbo pode remover Conteúdo que viole estes Termos, direitos de terceiros ou determinações legais, sem obrigação de aviso prévio nesses casos.</p>

<h2>7. Propriedade Intelectual</h2>
<p>Todos os elementos da Plataforma — incluindo marca, logotipos, interface, código-fonte, textos e funcionalidades — são de propriedade exclusiva da VitrineTurbo ou de seus licenciadores. É vedada qualquer reprodução, distribuição ou uso comercial sem autorização expressa e por escrito.</p>
<p>O Conteúdo inserido pelo Vendedor permanece de sua propriedade. A licença concedida à VitrineTurbo (seção 6.2) encerra-se quando o Conteúdo é removido ou a conta encerrada.</p>

<h2>8. Limitação de Responsabilidade</h2>
<p>Na máxima extensão permitida pela legislação aplicável:</p>
<ul>
<li>A VitrineTurbo não garante que a Plataforma estará disponível de forma ininterrupta ou sem falhas;</li>
<li>Não nos responsabilizamos por perdas indiretas, lucros cessantes, danos a dados ou reputação decorrentes do uso ou impossibilidade de uso da Plataforma;</li>
<li>Nossa responsabilidade total a você não excederá o valor pago nos últimos 3 meses de assinatura;</li>
<li>Não somos responsáveis pelas transações entre Vendedores e seus Clientes Finais, que são relações jurídicas independentes.</li>
</ul>
<p>Nada nestes Termos exclui responsabilidade por dolo, fraude ou violações de direitos do consumidor irrenunciáveis por lei.</p>

<h2>9. Disponibilidade do Serviço</h2>
<p>Envidamos esforços razoáveis para manter a Plataforma disponível 24/7. Manutenções programadas serão comunicadas com antecedência sempre que possível. Não garantimos disponibilidade mínima contratual (SLA) exceto para planos que prevejam expressamente tal garantia.</p>
<p>Podemos encerrar ou modificar funcionalidades com aviso prévio mínimo de 30 dias, exceto em situações de emergência de segurança.</p>

<h2>10. Rescisão</h2>
<p>Qualquer das partes pode encerrar o contrato a qualquer momento:</p>
<ul>
<li><strong>Pelo Vendedor:</strong> cancelando a assinatura pelo painel da conta;</li>
<li><strong>Pela VitrineTurbo:</strong> por violação grave destes Termos (efeito imediato) ou por encerramento do serviço (aviso prévio de 60 dias).</li>
</ul>
<p>Após a rescisão, o Vendedor tem 30 dias para exportar seus dados. Após esse prazo, os dados poderão ser permanentemente excluídos, salvo obrigação legal de retenção.</p>

<h2>11. Relação com Vendedores e Clientes Finais</h2>
<p>A VitrineTurbo é uma plataforma de tecnologia que fornece infraestrutura para Vendedores criarem suas vitrines. Não somos parte nas relações de consumo entre Vendedores e seus Clientes Finais, não intermediamos pagamentos entre eles (salvo onde explicitamente indicado) e não assumimos responsabilidade por:</p>
<ul>
<li>Qualidade, entrega ou conformidade dos produtos vendidos;</li>
<li>Disputas, chargebacks ou reclamações entre Vendedor e Cliente Final;</li>
<li>Cumprimento pelo Vendedor de obrigações fiscais, trabalhistas ou de proteção ao consumidor perante seus clientes.</li>
</ul>
<p>Cada Vendedor é responsável por operar sua vitrine em conformidade com o CDC, LGPD e demais normas aplicáveis ao seu negócio.</p>

<h2>12. Lei Aplicável e Foro</h2>
<p>Estes Termos são regidos pelas leis da República Federativa do Brasil. Para dirimir quaisquer controvérsias decorrentes destes Termos, fica eleito o foro da Comarca de São Paulo/SP, com renúncia expressa a qualquer outro, por mais privilegiado que seja, salvo disposição legal imperativa em contrário.</p>

<h2>13. Alterações nos Termos</h2>
<p>Podemos revisar estes Termos a qualquer momento. Alterações materiais serão comunicadas por e-mail ou notificação na Plataforma com antecedência mínima de 15 dias. O uso continuado da Plataforma após o prazo constitui aceite das novas condições.</p>

<h2>14. Contato</h2>
<p>Para esclarecimentos sobre estes Termos ou qualquer aspecto do serviço:</p>
<ul>
<li><strong>Plataforma:</strong> VitrineTurbo</li>
<li><strong>E-mail:</strong> contato@vitrine.app</li>
</ul>'
)
ON CONFLICT DO NOTHING;

INSERT INTO public.legal_documents (document_type, title, version, is_active, content)
VALUES (
  'privacy_policy',
  'Política de Privacidade',
  '1.0',
  true,
  '<h2>1. Introdução</h2>
<p>A <strong>VitrineTurbo</strong> ("nós", "nosso" ou "Plataforma") valoriza a sua privacidade e está comprometida em proteger os seus dados pessoais. Esta Política de Privacidade descreve como coletamos, usamos, armazenamos e compartilhamos informações quando você utiliza nossa plataforma, em conformidade com a Lei Geral de Proteção de Dados (Lei nº 13.709/2018 — LGPD) e demais normas aplicáveis.</p>
<p>Ao acessar ou utilizar a VitrineTurbo, você concorda com os termos desta Política. Caso não concorde, recomendamos que não utilize nossos serviços.</p>

<h2>2. Dados Coletados</h2>
<p>Coletamos diferentes categorias de dados dependendo do seu relacionamento com a Plataforma:</p>
<h3>2.1 Dados fornecidos por você</h3>
<ul>
<li>Nome completo e nome de exibição</li>
<li>Endereço de e-mail</li>
<li>Número de telefone / WhatsApp</li>
<li>Logotipo, foto de perfil e imagem de capa</li>
<li>Informações de produtos (título, descrição, preço, imagens)</li>
<li>Dados de pedidos e clientes inseridos manualmente</li>
<li>Chave Pix e dados bancários (para programa de indicação)</li>
<li>Dados de pagamento processados via Mercado Pago (não armazenamos dados de cartão)</li>
</ul>
<h3>2.2 Dados coletados automaticamente</h3>
<ul>
<li>Endereço IP e dados de geolocalização aproximada</li>
<li>Tipo de dispositivo, sistema operacional e navegador</li>
<li>Páginas visitadas, tempo de permanência e eventos de clique</li>
<li>Cookies e identificadores de sessão (veja nossa Política de Cookies)</li>
<li>Logs de acesso e erros técnicos</li>
</ul>
<h3>2.3 Dados de visitantes das vitrines</h3>
<p>Quando um consumidor final visita uma vitrine criada na Plataforma, podemos coletar dados de navegação e interação para fins de analytics fornecidos ao vendedor. O vendedor é corresponsável pelo tratamento desses dados perante seus próprios clientes.</p>

<h2>3. Finalidade do Tratamento</h2>
<p>Utilizamos seus dados para as seguintes finalidades:</p>
<ul>
<li><strong>Prestação do serviço:</strong> criar e manter sua conta, vitrine, produtos e pedidos;</li>
<li><strong>Pagamentos:</strong> processar assinaturas e transações via Mercado Pago;</li>
<li><strong>Comunicações:</strong> enviar notificações transacionais, atualizações e suporte;</li>
<li><strong>Analytics:</strong> fornecer métricas de desempenho da sua vitrine;</li>
<li><strong>Segurança:</strong> prevenir fraudes, abusos e acessos não autorizados;</li>
<li><strong>Melhorias do produto:</strong> analisar padrões de uso para aprimorar funcionalidades;</li>
<li><strong>Obrigações legais:</strong> cumprir determinações de autoridades competentes.</li>
</ul>

<h2>4. Compartilhamento de Dados</h2>
<p>Não vendemos seus dados pessoais. Podemos compartilhá-los com:</p>
<ul>
<li><strong>Mercado Pago:</strong> para processamento de pagamentos de assinaturas;</li>
<li><strong>Supabase:</strong> provedor de infraestrutura de banco de dados e autenticação;</li>
<li><strong>Provedores de hospedagem e CDN:</strong> para disponibilização da Plataforma;</li>
<li><strong>Ferramentas de analytics:</strong> configuradas por você (ex.: Google Analytics, Meta Pixel), mediante sua própria responsabilidade;</li>
<li><strong>Autoridades públicas:</strong> quando exigido por lei ou ordem judicial.</li>
</ul>
<p>Todos os terceiros são contratualmente obrigados a tratar os dados de forma segura e apenas para as finalidades autorizadas.</p>

<h2>5. Retenção de Dados</h2>
<p>Mantemos seus dados enquanto sua conta estiver ativa ou pelo período necessário para cumprir as finalidades descritas nesta Política. Após o encerramento da conta:</p>
<ul>
<li>Dados de conta e produtos são excluídos ou anonimizados em até 90 dias;</li>
<li>Dados de faturamento e fiscais podem ser retidos por até 5 anos, conforme legislação tributária;</li>
<li>Logs de segurança são mantidos por até 6 meses.</li>
</ul>

<h2>6. Seus Direitos</h2>
<p>Nos termos da LGPD, você possui os seguintes direitos:</p>
<ul>
<li><strong>Acesso:</strong> confirmar a existência de tratamento e obter cópia dos seus dados;</li>
<li><strong>Correção:</strong> solicitar correção de dados incompletos ou desatualizados;</li>
<li><strong>Exclusão:</strong> requerer a exclusão dos seus dados pessoais;</li>
<li><strong>Portabilidade:</strong> receber seus dados em formato estruturado;</li>
<li><strong>Revogação do consentimento:</strong> retirar consentimentos previamente concedidos;</li>
<li><strong>Oposição:</strong> opor-se a tratamentos realizados com base em legítimo interesse;</li>
<li><strong>Informação:</strong> ser informado sobre o uso e compartilhamento dos seus dados.</li>
</ul>
<p>Para exercer seus direitos, entre em contato pelo e-mail indicado na seção 11.</p>

<h2>7. Segurança</h2>
<p>Adotamos medidas técnicas e organizacionais adequadas para proteger seus dados contra acessos não autorizados, perda, destruição ou divulgação indevida, incluindo:</p>
<ul>
<li>Criptografia em trânsito via TLS/HTTPS;</li>
<li>Controles de acesso baseados em função (RBAC) e Row Level Security (RLS) no banco de dados;</li>
<li>Autenticação segura com hashing de senhas;</li>
<li>Monitoramento contínuo e alertas de segurança.</li>
</ul>
<p>Nenhum sistema é absolutamente inviolável. Em caso de incidente de segurança, notificaremos os afetados e a ANPD nos prazos legais.</p>

<h2>8. Cookies</h2>
<p>Utilizamos cookies e tecnologias similares para funcionamento da Plataforma e analytics. Para detalhes completos, consulte nossa Política de Cookies.</p>

<h2>9. Menores de Idade</h2>
<p>A VitrineTurbo não é direcionada a menores de 18 anos. Não coletamos intencionalmente dados de crianças ou adolescentes. Se identificarmos tal situação, excluiremos os dados imediatamente.</p>

<h2>10. Alterações nesta Política</h2>
<p>Podemos atualizar esta Política periodicamente. Alterações materiais serão comunicadas por e-mail ou notificação na Plataforma com antecedência mínima de 15 dias. O uso continuado dos serviços após essa data implica aceitação das mudanças.</p>

<h2>11. Contato</h2>
<p>Para dúvidas, solicitações ou exercício de direitos relacionados a esta Política, entre em contato com nosso Encarregado de Proteção de Dados (DPO):</p>
<ul>
<li><strong>Plataforma:</strong> VitrineTurbo</li>
<li><strong>E-mail:</strong> privacidade@vitrine.app</li>
</ul>'
)
ON CONFLICT DO NOTHING;

INSERT INTO public.legal_documents (document_type, title, version, is_active, content)
VALUES (
  'cookies_policy',
  'Política de Cookies',
  '1.0',
  true,
  '<h2>1. O que são Cookies?</h2>
<p>Cookies são pequenos arquivos de texto armazenados no seu dispositivo (computador, tablet ou celular) quando você acessa um site. Eles permitem que o site reconheça seu dispositivo em visitas futuras e ofereça uma experiência mais personalizada e eficiente.</p>
<p>Além dos cookies tradicionais, utilizamos tecnologias similares como <em>localStorage</em>, <em>sessionStorage</em> e identificadores de sessão para fins funcionais.</p>

<h2>2. Tipos de Cookies que Usamos</h2>
<p><strong>Essenciais / Necessários</strong> — Garantem o funcionamento básico da Plataforma: autenticação, sessão, segurança e preferências de interface. Duração: Sessão ou até 1 ano. Opt-out: Não disponível — necessários para o serviço.</p>
<p><strong>Funcionais</strong> — Lembram preferências como tema (claro/escuro), idioma e configurações de exibição. Duração: Até 1 ano. Opt-out: Sim, via configurações do navegador.</p>
<p><strong>Analytics (plataforma)</strong> — Coletam dados agregados sobre uso da Plataforma para identificar melhorias e erros. Não identificam o usuário individualmente. Duração: Até 2 anos. Opt-out: Sim, via configurações do navegador.</p>
<p><strong>Analytics (vitrine do vendedor)</strong> — Cookies de ferramentas configuradas pelo próprio vendedor em sua vitrine (ex.: Google Analytics, Meta Pixel). O vendedor é responsável por obter o consentimento dos seus visitantes. Duração: Definida pelo vendedor. Opt-out: Sim, via configurações do navegador ou ferramentas de opt-out do provedor.</p>

<h2>3. Cookies de Terceiros</h2>
<p>Alguns cookies são definidos por serviços de terceiros que aparecem em nossas páginas. Não controlamos esses cookies, mas a seguir listamos os principais:</p>
<ul>
<li><strong>Supabase:</strong> infraestrutura de autenticação e banco de dados. Cookies de sessão JWT necessários para login seguro.</li>
<li><strong>Mercado Pago:</strong> processamento de pagamentos. Cookies de segurança antifraude definidos durante o fluxo de checkout.</li>
<li><strong>Google Analytics / Meta Pixel (opcional):</strong> definidos apenas nas vitrines onde o vendedor os configurou. Consulte as políticas de privacidade do Google e da Meta para mais informações.</li>
</ul>

<h2>4. Como Controlar Cookies</h2>
<p>Você pode gerenciar ou bloquear cookies a qualquer momento por meio das configurações do seu navegador. Veja como fazer isso nos principais navegadores:</p>
<ul>
<li><strong>Google Chrome:</strong> Configurações &gt; Privacidade e segurança &gt; Cookies e outros dados do site</li>
<li><strong>Mozilla Firefox:</strong> Opções &gt; Privacidade e Segurança &gt; Cookies e dados do site</li>
<li><strong>Safari:</strong> Preferências &gt; Privacidade &gt; Gerenciar dados do site</li>
<li><strong>Microsoft Edge:</strong> Configurações &gt; Privacidade, pesquisa e serviços &gt; Cookies</li>
</ul>
<p>Você também pode usar extensões de navegador como uBlock Origin ou Privacy Badger para controle avançado.</p>

<h2>5. Consequências da Recusa</h2>
<p>Bloquear cookies essenciais pode impedir o funcionamento correto da Plataforma, incluindo login, manutenção de sessão e salvar preferências. Cookies funcionais e de analytics podem ser desativados sem comprometer as funções principais.</p>

<h2>6. Retenção de Cookies</h2>
<p>Os cookies são retidos pelo tempo indicado na seção 2. Cookies de sessão são excluídos automaticamente ao fechar o navegador. Você pode excluir cookies armazenados a qualquer momento pelas configurações do navegador.</p>

<h2>7. Alterações nesta Política</h2>
<p>Esta Política pode ser atualizada para refletir mudanças nas tecnologias utilizadas ou na legislação. Alterações relevantes serão comunicadas via e-mail ou notificação na Plataforma.</p>

<h2>8. Contato</h2>
<p>Em caso de dúvidas sobre o uso de cookies, entre em contato:</p>
<ul>
<li><strong>Plataforma:</strong> VitrineTurbo</li>
<li><strong>E-mail:</strong> privacidade@vitrine.app</li>
</ul>
<p>Consulte também nossa Política de Privacidade para entender o tratamento completo dos seus dados pessoais.</p>'
)
ON CONFLICT DO NOTHING;
