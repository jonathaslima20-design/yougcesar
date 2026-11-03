import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Download, ExternalLink, FileText, Image as ImageIcon, Loader2, Megaphone, MessageCircle, Presentation } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { usePartner } from '@/contexts/PartnerContext';
import { supabase } from '@/lib/supabase';
import { SITE_URL, whatsappShareUrl } from '@/lib/partners/partnerApi';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CopyButton, EmptyState, PageHeader, ToneBadge } from '@/components/partners/PartnerUi';

interface Asset {
  id: string;
  title: string;
  description: string | null;
  category: 'copy' | 'faq' | 'image' | 'video' | 'presentation' | 'document';
  channel: string | null;
  body_text: string | null;
  file_url: string | null;
  thumbnail_url: string | null;
}

const CHANNEL_LABELS: Record<string, string> = { whatsapp: 'WhatsApp', instagram: 'Instagram', email: 'E-mail', linkedin: 'LinkedIn', geral: 'Geral' };

export default function PartnersMaterialsPage() {
  const { user } = useAuth();
  const { profile, settings } = usePartner();
  const [assets, setAssets] = useState<Asset[] | null>(null);

  useEffect(() => {
    supabase
      .from('partner_assets')
      .select('*')
      .eq('is_published', true)
      .order('sort_order')
      .then(({ data }) => setAssets((data as Asset[]) ?? []));
  }, []);

  const mainLink = profile?.public_slug ? `${SITE_URL}/p/${profile.public_slug}` : `${SITE_URL}/`;
  const fill = useMemo(
    () => (text: string) =>
      text
        .split('{link}').join(mainLink)
        .split('{seu nome}').join(profile?.company_name || user?.name || ''),
    [mainLink, profile?.company_name, user?.name],
  );

  const byCategory = (cats: Asset['category'][]) => (assets ?? []).filter((a) => cats.includes(a.category));

  return (
    <div className="container mx-auto p-4 sm:p-6 space-y-6">
      <PageHeader
        title="Materiais"
        description="Textos prontos, respostas para objeções, imagens e a proposta com a sua marca. Seu link já vem preenchido."
        actions={
          <>
            {settings?.demo_store_url && (
              <Button variant="outline" asChild>
                <a href={settings.demo_store_url} target="_blank" rel="noopener noreferrer"><ExternalLink className="h-4 w-4 mr-2" />Loja demo</a>
              </Button>
            )}
            <Button asChild><Link to="/partners/proposal"><FileText className="h-4 w-4 mr-2" />Gerar proposta</Link></Button>
          </>
        }
      />

      {assets === null ? (
        <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : (
        <Tabs defaultValue="copy">
          <TabsList className="flex-wrap h-auto">
            <TabsTrigger value="copy"><Megaphone className="h-4 w-4 mr-1.5" />Textos</TabsTrigger>
            <TabsTrigger value="faq"><MessageCircle className="h-4 w-4 mr-1.5" />Objeções</TabsTrigger>
            <TabsTrigger value="media"><ImageIcon className="h-4 w-4 mr-1.5" />Imagens e vídeos</TabsTrigger>
            <TabsTrigger value="docs"><Presentation className="h-4 w-4 mr-1.5" />Apresentações</TabsTrigger>
          </TabsList>

          <TabsContent value="copy" className="mt-4">
            <div className="grid lg:grid-cols-2 gap-4">
              {byCategory(['copy']).map((a) => {
                const text = fill(a.body_text ?? '');
                return (
                  <Card key={a.id}>
                    <CardHeader className="pb-2 flex flex-row items-start justify-between gap-2 space-y-0">
                      <CardTitle className="text-sm">{a.title}</CardTitle>
                      {a.channel && <ToneBadge tone="muted">{CHANNEL_LABELS[a.channel] ?? a.channel}</ToneBadge>}
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <p className="text-sm whitespace-pre-line text-muted-foreground bg-muted/40 rounded-lg p-3">{text}</p>
                      <div className="flex gap-2">
                        <CopyButton value={text} label="Copiar" />
                        {a.channel === 'whatsapp' && (
                          <Button size="sm" variant="outline" asChild>
                            <a href={whatsappShareUrl(text)} target="_blank" rel="noopener noreferrer"><MessageCircle className="h-4 w-4 mr-1.5" />Abrir no WhatsApp</a>
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
            <p className="text-xs text-muted-foreground mt-3">Troque {'{nome}'} e {'{loja}'} pelos dados do seu contato antes de enviar.</p>
          </TabsContent>

          <TabsContent value="faq" className="mt-4">
            <div className="grid md:grid-cols-2 gap-4">
              {byCategory(['faq']).map((a) => (
                <Card key={a.id}>
                  <CardContent className="pt-5 space-y-2">
                    <p className="font-medium">{a.title}</p>
                    <p className="text-sm text-muted-foreground">{fill(a.body_text ?? '')}</p>
                    <CopyButton value={fill(a.body_text ?? '')} label="Copiar resposta" />
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="media" className="mt-4">
            {byCategory(['image', 'video']).length === 0 ? (
              <Card><EmptyState icon={ImageIcon} title="Novas artes em breve" description="O time VitrineTurbo publica aqui posts, stories e vídeos para você usar." /></Card>
            ) : (
              <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {byCategory(['image', 'video']).map((a) => (
                  <Card key={a.id} className="overflow-hidden">
                    <div className="aspect-square bg-muted">
                      {a.category === 'video' ? (
                        <video src={a.file_url ?? undefined} poster={a.thumbnail_url ?? undefined} className="h-full w-full object-cover" controls preload="none" />
                      ) : (
                        <img src={a.thumbnail_url ?? a.file_url ?? ''} alt={a.title} className="h-full w-full object-cover" loading="lazy" />
                      )}
                    </div>
                    <CardContent className="pt-3 space-y-2">
                      <p className="text-sm font-medium">{a.title}</p>
                      {a.body_text && <CopyButton value={fill(a.body_text)} label="Copiar legenda" />}
                      {a.file_url && (
                        <Button size="sm" variant="outline" className="w-full" asChild>
                          <a href={a.file_url} download target="_blank" rel="noopener noreferrer"><Download className="h-4 w-4 mr-1.5" />Baixar</a>
                        </Button>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="docs" className="mt-4 space-y-4">
            <Card>
              <CardContent className="pt-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <p className="font-medium">Proposta comercial com a sua marca</p>
                  <p className="text-sm text-muted-foreground">Preencha os dados do cliente e salve em PDF pelo navegador.</p>
                </div>
                <Button asChild><Link to="/partners/proposal">Gerar proposta</Link></Button>
              </CardContent>
            </Card>
            {byCategory(['presentation', 'document']).map((a) => (
              <Card key={a.id}>
                <CardContent className="pt-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <p className="font-medium">{a.title}</p>
                    {a.description && <p className="text-sm text-muted-foreground">{a.description}</p>}
                  </div>
                  {a.file_url && <Button variant="outline" asChild><a href={a.file_url} target="_blank" rel="noopener noreferrer"><Download className="h-4 w-4 mr-2" />Abrir</a></Button>}
                </CardContent>
              </Card>
            ))}
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
