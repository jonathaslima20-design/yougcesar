import { useState, useEffect, useCallback } from 'react';
import { Bell, FileText, Zap, Send, History, Plus, Pencil, Trash2, Search } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  fetchTemplates,
  createTemplate,
  updateTemplate,
  deleteTemplate,
  toggleTemplate,
  fetchRules,
  createRule,
  updateRule,
  deleteRule,
  toggleRule,
  fetchBroadcasts,
  createBroadcast,
  sendBroadcastNow,
  cancelBroadcast,
  estimateRecipients,
  searchUsersForBroadcast,
} from '@/lib/adminNotificationService';
import type {
  NotificationTemplate,
  NotificationRule,
  NotificationBroadcast,
  NotificationCategory,
  NotificationType,
  TargetAudience,
  RuleType,
} from '@/types';

const CATEGORY_LABELS: Record<NotificationCategory, string> = {
  vencimento: 'Vencimento',
  indicacao: 'Indicacao',
  ofertas: 'Ofertas',
  sistema: 'Sistema',
  novidades: 'Novidades',
};

const CATEGORY_COLORS: Record<NotificationCategory, string> = {
  vencimento: 'bg-orange-500/10 text-orange-600 border-orange-200',
  indicacao: 'bg-cyan-500/10 text-cyan-600 border-cyan-200',
  ofertas: 'bg-pink-500/10 text-pink-600 border-pink-200',
  sistema: 'bg-slate-500/10 text-slate-600 border-slate-200',
  novidades: 'bg-sky-500/10 text-sky-600 border-sky-200',
};

const NOTIFICATION_TYPES: { value: NotificationType; label: string }[] = [
  { value: 'subscription_expiring', label: 'Assinatura expirando' },
  { value: 'subscription_expired', label: 'Assinatura expirada' },
  { value: 'referral_signup', label: 'Indicacao - Cadastro' },
  { value: 'referral_upgrade', label: 'Indicacao - Upgrade' },
  { value: 'promotional_offer', label: 'Oferta promocional' },
  { value: 'novidades', label: 'Novidades' },
  { value: 'system', label: 'Sistema' },
];

const RULE_TYPE_LABELS: Record<RuleType, string> = {
  days_before_expiry: 'Dias antes do vencimento',
  days_after_expiry: 'Dias apos o vencimento',
  on_referral_signup: 'Ao receber indicacao',
  on_referral_upgrade: 'Ao indicado assinar',
  on_plan_change: 'Ao mudar de plano',
  periodic: 'Periodico',
};

const AUDIENCE_LABELS: Record<TargetAudience, string> = {
  all: 'Todos os usuarios',
  active: 'Plano ativo',
  expired: 'Plano expirado',
  free: 'Plano gratuito',
  specific: 'Usuarios especificos',
};

export default function NotificationSettingsPage() {
  return (
    <div className="container mx-auto p-4 md:p-6 space-y-6 max-w-6xl">
      <div className="flex items-center gap-3">
        <Bell className="h-6 w-6" />
        <div>
          <h1 className="text-2xl font-bold">Central de Notificacoes</h1>
          <p className="text-sm text-muted-foreground">Gerencie templates, regras automaticas e envios manuais</p>
        </div>
      </div>

      <Tabs defaultValue="templates" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="templates" className="gap-1.5">
            <FileText className="h-4 w-4" />
            <span className="hidden sm:inline">Templates</span>
          </TabsTrigger>
          <TabsTrigger value="rules" className="gap-1.5">
            <Zap className="h-4 w-4" />
            <span className="hidden sm:inline">Regras</span>
          </TabsTrigger>
          <TabsTrigger value="broadcast" className="gap-1.5">
            <Send className="h-4 w-4" />
            <span className="hidden sm:inline">Enviar</span>
          </TabsTrigger>
          <TabsTrigger value="history" className="gap-1.5">
            <History className="h-4 w-4" />
            <span className="hidden sm:inline">Historico</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="templates">
          <TemplatesTab />
        </TabsContent>
        <TabsContent value="rules">
          <RulesTab />
        </TabsContent>
        <TabsContent value="broadcast">
          <BroadcastTab />
        </TabsContent>
        <TabsContent value="history">
          <HistoryTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ============= TEMPLATES TAB =============
function TemplatesTab() {
  const [templates, setTemplates] = useState<NotificationTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingTemplate, setEditingTemplate] = useState<NotificationTemplate | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [filterCategory, setFilterCategory] = useState<NotificationCategory | 'all'>('all');

  const loadTemplates = useCallback(async () => {
    try {
      setLoading(true);
      const data = await fetchTemplates();
      setTemplates(data);
    } catch {
      toast.error('Erro ao carregar templates');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadTemplates(); }, [loadTemplates]);

  const handleToggle = async (id: string, enabled: boolean) => {
    try {
      await toggleTemplate(id, enabled);
      setTemplates(prev => prev.map(t => t.id === id ? { ...t, is_enabled: enabled } : t));
    } catch {
      toast.error('Erro ao atualizar template');
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteTemplate(deleteTarget);
      setTemplates(prev => prev.filter(t => t.id !== deleteTarget));
      toast.success('Template excluido');
    } catch {
      toast.error('Erro ao excluir template');
    } finally {
      setDeleteTarget(null);
    }
  };

  const filteredTemplates = filterCategory === 'all'
    ? templates
    : templates.filter(t => t.category === filterCategory);

  const groupedTemplates = filteredTemplates.reduce<Record<string, NotificationTemplate[]>>((acc, t) => {
    (acc[t.category] = acc[t.category] || []).push(t);
    return acc;
  }, {});

  if (loading) {
    return <div className="space-y-4">{[1,2,3].map(i => <Skeleton key={i} className="h-24 rounded-xl" />)}</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 flex-wrap">
          <Badge
            variant={filterCategory === 'all' ? 'default' : 'outline'}
            className="cursor-pointer"
            onClick={() => setFilterCategory('all')}
          >
            Todos
          </Badge>
          {(Object.keys(CATEGORY_LABELS) as NotificationCategory[]).map(cat => (
            <Badge
              key={cat}
              variant={filterCategory === cat ? 'default' : 'outline'}
              className="cursor-pointer"
              onClick={() => setFilterCategory(cat)}
            >
              {CATEGORY_LABELS[cat]}
            </Badge>
          ))}
        </div>
        <Button size="sm" onClick={() => setShowCreateDialog(true)}>
          <Plus className="h-4 w-4 mr-1" />
          Novo Template
        </Button>
      </div>

      {Object.entries(groupedTemplates).map(([category, items]) => (
        <div key={category} className="space-y-3">
          <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
            {CATEGORY_LABELS[category as NotificationCategory]}
          </h3>
          <div className="grid gap-3">
            {items.map(template => (
              <Card key={template.id} className="transition-all duration-200 hover:shadow-sm">
                <CardContent className="flex items-center gap-4 py-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-sm">{template.title_template}</span>
                      <Badge variant="outline" className={`text-[10px] ${CATEGORY_COLORS[template.category as NotificationCategory]}`}>
                        {CATEGORY_LABELS[template.category as NotificationCategory]}
                      </Badge>
                      {template.is_system && <Badge variant="secondary" className="text-[10px]">Sistema</Badge>}
                    </div>
                    <p className="text-xs text-muted-foreground truncate">{template.message_template}</p>
                    {template.cta_label && (
                      <p className="text-[11px] text-muted-foreground/70 mt-0.5">CTA: {template.cta_label} → {template.cta_url}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Switch
                      checked={template.is_enabled}
                      onCheckedChange={(checked) => handleToggle(template.id, checked)}
                    />
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setEditingTemplate(template)}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    {!template.is_system && (
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => setDeleteTarget(template.id)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      ))}

      <TemplateDialog
        open={showCreateDialog || !!editingTemplate}
        onOpenChange={(open) => { if (!open) { setShowCreateDialog(false); setEditingTemplate(null); } }}
        template={editingTemplate}
        onSave={loadTemplates}
      />

      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir template?</AlertDialogTitle>
            <AlertDialogDescription>Esta acao nao pode ser desfeita.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ============= TEMPLATE DIALOG =============
function TemplateDialog({
  open, onOpenChange, template, onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  template: NotificationTemplate | null;
  onSave: () => void;
}) {
  const [slug, setSlug] = useState('');
  const [category, setCategory] = useState<NotificationCategory>('sistema');
  const [notificationType, setNotificationType] = useState<NotificationType>('system');
  const [titleTemplate, setTitleTemplate] = useState('');
  const [messageTemplate, setMessageTemplate] = useState('');
  const [ctaLabel, setCtaLabel] = useState('');
  const [ctaUrl, setCtaUrl] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (template) {
      setSlug(template.slug);
      setCategory(template.category);
      setNotificationType(template.notification_type);
      setTitleTemplate(template.title_template);
      setMessageTemplate(template.message_template);
      setCtaLabel(template.cta_label || '');
      setCtaUrl(template.cta_url || '');
    } else {
      setSlug('');
      setCategory('sistema');
      setNotificationType('system');
      setTitleTemplate('');
      setMessageTemplate('');
      setCtaLabel('');
      setCtaUrl('');
    }
  }, [template, open]);

  const handleSubmit = async () => {
    if (!titleTemplate.trim() || !messageTemplate.trim()) {
      toast.error('Titulo e mensagem sao obrigatorios');
      return;
    }
    setSaving(true);
    try {
      if (template) {
        await updateTemplate(template.id, {
          title_template: titleTemplate,
          message_template: messageTemplate,
          cta_label: ctaLabel || null,
          cta_url: ctaUrl || null,
          category,
          notification_type: notificationType,
        });
        toast.success('Template atualizado');
      } else {
        if (!slug.trim()) { toast.error('Slug e obrigatorio'); setSaving(false); return; }
        await createTemplate({
          slug: slug.trim().toLowerCase().replace(/\s+/g, '_'),
          category,
          notification_type: notificationType,
          title_template: titleTemplate,
          message_template: messageTemplate,
          cta_label: ctaLabel || null,
          cta_url: ctaUrl || null,
        });
        toast.success('Template criado');
      }
      onSave();
      onOpenChange(false);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Erro ao salvar');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{template ? 'Editar Template' : 'Novo Template'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {!template && (
            <div>
              <Label>Slug (identificador unico)</Label>
              <Input value={slug} onChange={e => setSlug(e.target.value)} placeholder="ex: meu_template_custom" />
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Categoria</Label>
              <Select value={category} onValueChange={(v) => setCategory(v as NotificationCategory)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Object.keys(CATEGORY_LABELS) as NotificationCategory[]).map(cat => (
                    <SelectItem key={cat} value={cat}>{CATEGORY_LABELS[cat]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Tipo</Label>
              <Select value={notificationType} onValueChange={(v) => setNotificationType(v as NotificationType)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {NOTIFICATION_TYPES.map(t => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label>Titulo</Label>
            <Input value={titleTemplate} onChange={e => setTitleTemplate(e.target.value)} placeholder="Titulo da notificacao" />
          </div>
          <div>
            <Label>Mensagem</Label>
            <Textarea value={messageTemplate} onChange={e => setMessageTemplate(e.target.value)} placeholder="Corpo da mensagem..." rows={3} />
          </div>
          <div className="rounded-md bg-muted p-2.5">
            <p className="text-[11px] font-medium text-muted-foreground mb-1">Placeholders disponiveis:</p>
            <p className="text-[11px] text-muted-foreground">{'{{nome}}, {{dias}}, {{plano}}, {{produto}}, {{mensagem}}, {{url}}'}</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>CTA Label (opcional)</Label>
              <Input value={ctaLabel} onChange={e => setCtaLabel(e.target.value)} placeholder="Ex: Renovar agora" />
            </div>
            <div>
              <Label>CTA URL (opcional)</Label>
              <Input value={ctaUrl} onChange={e => setCtaUrl(e.target.value)} placeholder="Ex: /dashboard/settings" />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={saving}>
            {saving ? 'Salvando...' : 'Salvar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============= RULES TAB =============
function RulesTab() {
  const [rules, setRules] = useState<NotificationRule[]>([]);
  const [templates, setTemplates] = useState<NotificationTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [editingRule, setEditingRule] = useState<NotificationRule | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [rulesData, templatesData] = await Promise.all([fetchRules(), fetchTemplates()]);
      setRules(rulesData);
      setTemplates(templatesData);
    } catch {
      toast.error('Erro ao carregar regras');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const handleToggle = async (id: string, enabled: boolean) => {
    try {
      await toggleRule(id, enabled);
      setRules(prev => prev.map(r => r.id === id ? { ...r, is_enabled: enabled } : r));
    } catch {
      toast.error('Erro ao atualizar regra');
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteRule(deleteTarget);
      setRules(prev => prev.filter(r => r.id !== deleteTarget));
      toast.success('Regra excluida');
    } catch {
      toast.error('Erro ao excluir regra');
    } finally {
      setDeleteTarget(null);
    }
  };

  if (loading) {
    return <div className="space-y-4">{[1,2,3].map(i => <Skeleton key={i} className="h-16 rounded-xl" />)}</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Regras automaticas definem quando cada template e disparado pelo sistema.
        </p>
        <Button size="sm" onClick={() => setShowCreateDialog(true)}>
          <Plus className="h-4 w-4 mr-1" />
          Nova Regra
        </Button>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Template</TableHead>
              <TableHead>Tipo de Regra</TableHead>
              <TableHead>Condicao</TableHead>
              <TableHead>Audiencia</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-[100px]">Acoes</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rules.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                  Nenhuma regra configurada
                </TableCell>
              </TableRow>
            ) : (
              rules.map(rule => (
                <TableRow key={rule.id}>
                  <TableCell className="font-medium text-sm">
                    {rule.notification_templates?.title_template || '—'}
                  </TableCell>
                  <TableCell className="text-sm">{RULE_TYPE_LABELS[rule.rule_type]}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {formatRuleConfig(rule)}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-xs">{AUDIENCE_LABELS[rule.target_audience]}</Badge>
                  </TableCell>
                  <TableCell>
                    <Switch checked={rule.is_enabled} onCheckedChange={(c) => handleToggle(rule.id, c)} />
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEditingRule(rule)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => setDeleteTarget(rule.id)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <RuleDialog
        open={showCreateDialog || !!editingRule}
        onOpenChange={(open) => { if (!open) { setShowCreateDialog(false); setEditingRule(null); } }}
        rule={editingRule}
        templates={templates}
        onSave={loadData}
      />

      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir regra?</AlertDialogTitle>
            <AlertDialogDescription>Esta acao nao pode ser desfeita.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function formatRuleConfig(rule: NotificationRule): string {
  const config = rule.rule_config as Record<string, number>;
  if (rule.rule_type === 'days_before_expiry') return `${config.days} dia(s) antes`;
  if (rule.rule_type === 'days_after_expiry') return `${config.days} dia(s) apos`;
  if (rule.rule_type === 'periodic') return `A cada ${config.days} dia(s)`;
  return 'Automatico';
}

// ============= RULE DIALOG =============
function RuleDialog({
  open, onOpenChange, rule, templates, onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rule: NotificationRule | null;
  templates: NotificationTemplate[];
  onSave: () => void;
}) {
  const [templateId, setTemplateId] = useState('');
  const [ruleType, setRuleType] = useState<RuleType>('days_before_expiry');
  const [days, setDays] = useState(7);
  const [targetAudience, setTargetAudience] = useState<TargetAudience>('all');
  const [cooldown, setCooldown] = useState(72);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (rule) {
      setTemplateId(rule.template_id);
      setRuleType(rule.rule_type);
      setDays((rule.rule_config as Record<string, number>).days || 7);
      setTargetAudience(rule.target_audience);
      setCooldown(rule.cooldown_hours);
    } else {
      setTemplateId(templates[0]?.id || '');
      setRuleType('days_before_expiry');
      setDays(7);
      setTargetAudience('all');
      setCooldown(72);
    }
  }, [rule, open, templates]);

  const needsDaysConfig = ['days_before_expiry', 'days_after_expiry', 'periodic'].includes(ruleType);

  const handleSubmit = async () => {
    if (!templateId) { toast.error('Selecione um template'); return; }
    setSaving(true);
    try {
      const ruleConfig = needsDaysConfig ? { days } : {};
      if (rule) {
        await updateRule(rule.id, { rule_type: ruleType, rule_config: ruleConfig, target_audience: targetAudience, cooldown_hours: cooldown });
        toast.success('Regra atualizada');
      } else {
        await createRule({ template_id: templateId, rule_type: ruleType, rule_config: ruleConfig, target_audience: targetAudience, cooldown_hours: cooldown });
        toast.success('Regra criada');
      }
      onSave();
      onOpenChange(false);
    } catch {
      toast.error('Erro ao salvar regra');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{rule ? 'Editar Regra' : 'Nova Regra'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Template</Label>
            <Select value={templateId} onValueChange={setTemplateId}>
              <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
              <SelectContent>
                {templates.filter(t => t.is_enabled).map(t => (
                  <SelectItem key={t.id} value={t.id}>{t.title_template}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Tipo de Regra</Label>
            <Select value={ruleType} onValueChange={(v) => setRuleType(v as RuleType)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {(Object.keys(RULE_TYPE_LABELS) as RuleType[]).map(rt => (
                  <SelectItem key={rt} value={rt}>{RULE_TYPE_LABELS[rt]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {needsDaysConfig && (
            <div>
              <Label>Dias</Label>
              <Input type="number" min={0} value={days} onChange={e => setDays(Number(e.target.value))} />
            </div>
          )}
          <div>
            <Label>Audiencia alvo</Label>
            <Select value={targetAudience} onValueChange={(v) => setTargetAudience(v as TargetAudience)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {(Object.entries(AUDIENCE_LABELS) as [TargetAudience, string][])
                  .filter(([k]) => k !== 'specific')
                  .map(([value, label]) => (
                    <SelectItem key={value} value={value}>{label}</SelectItem>
                  ))
                }
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Cooldown (horas)</Label>
            <Input type="number" min={1} value={cooldown} onChange={e => setCooldown(Number(e.target.value))} />
            <p className="text-[11px] text-muted-foreground mt-1">Tempo minimo entre envios duplicados para o mesmo usuario</p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={saving}>{saving ? 'Salvando...' : 'Salvar'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============= BROADCAST TAB =============
function BroadcastTab() {
  const { user } = useAuth();
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [notificationType, setNotificationType] = useState<NotificationType>('system');
  const [ctaLabel, setCtaLabel] = useState('');
  const [ctaUrl, setCtaUrl] = useState('');
  const [targetAudience, setTargetAudience] = useState<TargetAudience>('all');
  const [scheduleMode, setScheduleMode] = useState<'now' | 'schedule'>('now');
  const [scheduledDate, setScheduledDate] = useState('');
  const [scheduledTime, setScheduledTime] = useState('');
  const [recipientEstimate, setRecipientEstimate] = useState(0);
  const [sending, setSending] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<{ id: string; name: string; email: string }[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<{ id: string; name: string; email: string }[]>([]);
  const [showConfirm, setShowConfirm] = useState(false);

  useEffect(() => {
    const loadEstimate = async () => {
      const count = await estimateRecipients(
        targetAudience,
        targetAudience === 'specific' ? selectedUsers.map(u => u.id) : undefined
      );
      setRecipientEstimate(count);
    };
    loadEstimate();
  }, [targetAudience, selectedUsers]);

  const handleSearch = async (q: string) => {
    setSearchQuery(q);
    if (q.length < 2) { setSearchResults([]); return; }
    try {
      const results = await searchUsersForBroadcast(q);
      setSearchResults(results.filter(r => !selectedUsers.some(s => s.id === r.id)));
    } catch { /* ignore */ }
  };

  const handleSend = async () => {
    if (!title.trim() || !message.trim()) { toast.error('Titulo e mensagem sao obrigatorios'); return; }
    setSending(true);
    try {
      let scheduledAt: string | null = null;
      let status: 'draft' | 'scheduled' = 'draft';

      if (scheduleMode === 'schedule' && scheduledDate && scheduledTime) {
        scheduledAt = new Date(`${scheduledDate}T${scheduledTime}`).toISOString();
        status = 'scheduled';
      }

      const broadcast = await createBroadcast({
        title: title.trim(),
        message: message.trim(),
        notification_type: notificationType,
        cta_label: ctaLabel || null,
        cta_url: ctaUrl || null,
        target_audience: targetAudience,
        target_user_ids: targetAudience === 'specific' ? selectedUsers.map(u => u.id) : null,
        scheduled_at: scheduledAt,
        status: scheduleMode === 'now' ? 'draft' : status,
        sent_by: user?.id,
      });

      if (scheduleMode === 'now') {
        const count = await sendBroadcastNow(broadcast.id);
        toast.success(`Notificacao enviada para ${count} usuario(s)`);
      } else {
        toast.success('Notificacao agendada com sucesso');
      }

      setTitle('');
      setMessage('');
      setCtaLabel('');
      setCtaUrl('');
      setSelectedUsers([]);
      setScheduledDate('');
      setScheduledTime('');
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Erro ao enviar');
    } finally {
      setSending(false);
      setShowConfirm(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-base">Enviar Notificacao</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-4">
              <div>
                <Label>Titulo</Label>
                <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="Titulo da notificacao" />
              </div>
              <div>
                <Label>Mensagem</Label>
                <Textarea value={message} onChange={e => setMessage(e.target.value)} placeholder="Corpo da mensagem..." rows={4} />
              </div>
              <div>
                <Label>Tipo</Label>
                <Select value={notificationType} onValueChange={(v) => setNotificationType(v as NotificationType)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {NOTIFICATION_TYPES.map(t => (
                      <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>CTA Label</Label>
                  <Input value={ctaLabel} onChange={e => setCtaLabel(e.target.value)} placeholder="Ex: Ver mais" />
                </div>
                <div>
                  <Label>CTA URL</Label>
                  <Input value={ctaUrl} onChange={e => setCtaUrl(e.target.value)} placeholder="Ex: /dashboard" />
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <Label>Audiencia</Label>
                <Select value={targetAudience} onValueChange={(v) => setTargetAudience(v as TargetAudience)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(Object.entries(AUDIENCE_LABELS) as [TargetAudience, string][]).map(([value, label]) => (
                      <SelectItem key={value} value={value}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground mt-1">
                  Estimativa: <span className="font-medium">{recipientEstimate}</span> destinatario(s)
                </p>
              </div>

              {targetAudience === 'specific' && (
                <div>
                  <Label>Buscar usuarios</Label>
                  <div className="relative">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      className="pl-9"
                      value={searchQuery}
                      onChange={e => handleSearch(e.target.value)}
                      placeholder="Nome ou email..."
                    />
                  </div>
                  {searchResults.length > 0 && (
                    <div className="mt-1 rounded-md border max-h-32 overflow-y-auto">
                      {searchResults.map(u => (
                        <button
                          key={u.id}
                          className="w-full px-3 py-1.5 text-left text-sm hover:bg-muted flex justify-between"
                          onClick={() => { setSelectedUsers(prev => [...prev, u]); setSearchResults([]); setSearchQuery(''); }}
                        >
                          <span>{u.name || u.email}</span>
                          <span className="text-muted-foreground text-xs">{u.email}</span>
                        </button>
                      ))}
                    </div>
                  )}
                  {selectedUsers.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {selectedUsers.map(u => (
                        <Badge key={u.id} variant="secondary" className="text-xs gap-1">
                          {u.name || u.email}
                          <button onClick={() => setSelectedUsers(prev => prev.filter(p => p.id !== u.id))} className="ml-0.5 hover:text-destructive">&times;</button>
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <div>
                <Label>Agendamento</Label>
                <div className="flex items-center gap-4 mt-1.5">
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input type="radio" name="schedule" checked={scheduleMode === 'now'} onChange={() => setScheduleMode('now')} className="accent-primary" />
                    Enviar agora
                  </label>
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input type="radio" name="schedule" checked={scheduleMode === 'schedule'} onChange={() => setScheduleMode('schedule')} className="accent-primary" />
                    Agendar
                  </label>
                </div>
                {scheduleMode === 'schedule' && (
                  <div className="grid grid-cols-2 gap-2 mt-2">
                    <Input type="date" value={scheduledDate} onChange={e => setScheduledDate(e.target.value)} />
                    <Input type="time" value={scheduledTime} onChange={e => setScheduledTime(e.target.value)} />
                  </div>
                )}
              </div>

              {title && message && (
                <div className="rounded-lg border p-3 bg-muted/30">
                  <p className="text-[11px] font-medium text-muted-foreground mb-1">Preview:</p>
                  <p className="text-sm font-medium">{title}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{message}</p>
                  {ctaLabel && (
                    <span className="inline-block mt-1.5 text-[11px] border rounded px-1.5 py-0.5">{ctaLabel}</span>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t">
            <Button
              onClick={() => setShowConfirm(true)}
              disabled={!title.trim() || !message.trim() || sending || recipientEstimate === 0}
            >
              <Send className="h-4 w-4 mr-1.5" />
              {scheduleMode === 'now' ? 'Enviar agora' : 'Agendar envio'}
            </Button>
          </div>
        </CardContent>
      </Card>

      <AlertDialog open={showConfirm} onOpenChange={setShowConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar envio</AlertDialogTitle>
            <AlertDialogDescription>
              {scheduleMode === 'now'
                ? `Deseja enviar esta notificacao para ${recipientEstimate} usuario(s) agora?`
                : `Deseja agendar esta notificacao para ${recipientEstimate} usuario(s)?`
              }
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleSend} disabled={sending}>
              {sending ? 'Enviando...' : 'Confirmar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ============= HISTORY TAB =============
function HistoryTab() {
  const [broadcasts, setBroadcasts] = useState<NotificationBroadcast[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);

  const loadBroadcasts = useCallback(async () => {
    try {
      setLoading(true);
      const { data, count } = await fetchBroadcasts(page);
      setBroadcasts(data);
      setTotal(count);
    } catch {
      toast.error('Erro ao carregar historico');
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => { loadBroadcasts(); }, [loadBroadcasts]);

  const handleCancel = async (id: string) => {
    try {
      await cancelBroadcast(id);
      loadBroadcasts();
      toast.success('Agendamento cancelado');
    } catch {
      toast.error('Erro ao cancelar');
    }
  };

  const statusBadge = (status: string) => {
    const map: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
      draft: { label: 'Rascunho', variant: 'secondary' },
      scheduled: { label: 'Agendado', variant: 'outline' },
      sending: { label: 'Enviando', variant: 'default' },
      sent: { label: 'Enviado', variant: 'default' },
      failed: { label: 'Falhou', variant: 'destructive' },
    };
    const config = map[status] || map.draft;
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  if (loading) {
    return <div className="space-y-4">{[1,2,3].map(i => <Skeleton key={i} className="h-12 rounded-lg" />)}</div>;
  }

  return (
    <div className="space-y-4">
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Data</TableHead>
              <TableHead>Titulo</TableHead>
              <TableHead>Audiencia</TableHead>
              <TableHead>Enviados</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-[80px]">Acao</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {broadcasts.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                  Nenhum envio registrado
                </TableCell>
              </TableRow>
            ) : (
              broadcasts.map(b => (
                <TableRow key={b.id}>
                  <TableCell className="text-sm">
                    {new Date(b.sent_at || b.scheduled_at || b.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                  </TableCell>
                  <TableCell className="font-medium text-sm max-w-[200px] truncate">{b.title}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-xs">{AUDIENCE_LABELS[b.target_audience]}</Badge>
                  </TableCell>
                  <TableCell className="text-sm">{b.recipients_count}</TableCell>
                  <TableCell>{statusBadge(b.status)}</TableCell>
                  <TableCell>
                    {b.status === 'scheduled' && (
                      <Button variant="ghost" size="sm" className="text-xs h-7" onClick={() => handleCancel(b.id)}>
                        Cancelar
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {total > 20 && (
        <div className="flex justify-center gap-2">
          <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(p => p - 1)}>
            Anterior
          </Button>
          <Button variant="outline" size="sm" disabled={(page + 1) * 20 >= total} onClick={() => setPage(p => p + 1)}>
            Proximo
          </Button>
        </div>
      )}
    </div>
  );
}
