import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ExternalLink, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import AdminPartnersOverview from '@/components/admin/partners/AdminPartnersOverview';
import AdminPartnerApplications from '@/components/admin/partners/AdminPartnerApplications';
import AdminPartnersList from '@/components/admin/partners/AdminPartnersList';
import AdminPartnerFinance from '@/components/admin/partners/AdminPartnerFinance';
import AdminPartnerAttributions from '@/components/admin/partners/AdminPartnerAttributions';
import AdminPartnerRules from '@/components/admin/partners/AdminPartnerRules';
import AdminPartnerContent from '@/components/admin/partners/AdminPartnerContent';
import AdminPartnerFraud from '@/components/admin/partners/AdminPartnerFraud';

const TABS = [
  { value: 'overview', label: 'Visão geral' },
  { value: 'applications', label: 'Inscrições' },
  { value: 'partners', label: 'Parceiros' },
  { value: 'finance', label: 'Financeiro' },
  { value: 'attributions', label: 'Atribuições' },
  { value: 'rules', label: 'Regras e campanhas' },
  { value: 'content', label: 'Conteúdo' },
  { value: 'fraud', label: 'Antifraude' },
];

export default function PartnerManagementPage() {
  const [tab, setTab] = useState('overview');
  // Remounting the active tab is the simplest "refresh" for these self-loading panels.
  const [version, setVersion] = useState(0);

  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl page-title">Gestão de Partners</h1>
          <p className="text-muted-foreground">Inscrições, parceiros, comissões, regras e conteúdo do programa.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link to="/parceiros" target="_blank"><ExternalLink className="h-4 w-4 mr-2" />Página pública</Link>
          </Button>
          <Button variant="outline" size="sm" onClick={() => setVersion((v) => v + 1)}>
            <RefreshCw className="h-4 w-4 mr-2" />Atualizar
          </Button>
        </div>
      </div>

      <Tabs value={tab} onValueChange={setTab} className="space-y-4">
        <TabsList className="flex-wrap h-auto justify-start">
          {TABS.map((t) => <TabsTrigger key={t.value} value={t.value}>{t.label}</TabsTrigger>)}
        </TabsList>
        <TabsContent value="overview" key={`overview-${version}`}><AdminPartnersOverview onNavigate={setTab} /></TabsContent>
        <TabsContent value="applications" key={`applications-${version}`}><AdminPartnerApplications /></TabsContent>
        <TabsContent value="partners" key={`partners-${version}`}><AdminPartnersList /></TabsContent>
        <TabsContent value="finance" key={`finance-${version}`}><AdminPartnerFinance /></TabsContent>
        <TabsContent value="attributions" key={`attributions-${version}`}><AdminPartnerAttributions /></TabsContent>
        <TabsContent value="rules" key={`rules-${version}`}><AdminPartnerRules /></TabsContent>
        <TabsContent value="content" key={`content-${version}`}><AdminPartnerContent /></TabsContent>
        <TabsContent value="fraud" key={`fraud-${version}`}><AdminPartnerFraud /></TabsContent>
      </Tabs>
    </div>
  );
}
