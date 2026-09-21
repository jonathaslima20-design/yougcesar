import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { toast } from 'sonner';
import { Loader as Loader2, CheckCircle2 } from 'lucide-react';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useCheckoutSettings } from '@/hooks/useCheckoutSettings';
import {
  getShippingCredentialsConfig,
  saveShippingCredentialsConfig,
  testShippingCredentials,
} from '@/lib/merchantShipping';
import { formatCpfCnpj, isValidCpfCnpj } from '@/lib/document';
import { fetchAddressByCep } from '@/lib/viaCep';

const SERVICE_OPTIONS = [
  { id: '1', label: 'PAC' },
  { id: '2', label: 'SEDEX' },
  { id: '17', label: 'Mini Envios' },
  { id: '3', label: 'Jadlog' },
  { id: '33', label: 'J&T' },
  { id: '31', label: 'Loggi' },
];

const formSchema = z.object({
  environment: z.enum(['sandbox', 'production']),
  origin_zip_code: z.string().optional().or(z.literal('')),
  api_token: z.string().optional().or(z.literal('')),
  is_active: z.boolean(),
  superFreteEnabled: z.boolean(),
  serviceIds: z.array(z.string()).default([]),
  label_purchase_enabled: z.boolean(),
  sender_name: z.string().optional().or(z.literal('')),
  sender_document: z.string().optional().or(z.literal('')),
  sender_phone: z.string().optional().or(z.literal('')),
  sender_street: z.string().optional().or(z.literal('')),
  sender_number: z.string().optional().or(z.literal('')),
  sender_complement: z.string().optional().or(z.literal('')),
  sender_neighborhood: z.string().optional().or(z.literal('')),
  sender_city: z.string().optional().or(z.literal('')),
  sender_state: z.string().optional().or(z.literal('')),
}).superRefine((values, ctx) => {
  if (!values.label_purchase_enabled) return;
  const required: [keyof typeof values, string][] = [
    ['sender_name', 'Nome do remetente'],
    ['sender_document', 'Documento do remetente'],
    ['sender_phone', 'Telefone do remetente'],
    ['sender_street', 'Rua do remetente'],
    ['sender_neighborhood', 'Bairro do remetente'],
    ['sender_city', 'Cidade do remetente'],
    ['sender_state', 'Estado do remetente'],
  ];
  for (const [key, label] of required) {
    if (!values[key]) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: [key], message: `${label} é obrigatório para comprar etiquetas` });
    }
  }
  if (values.sender_document && !isValidCpfCnpj(values.sender_document)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['sender_document'], message: 'CPF/CNPJ inválido' });
  }
});

type FormValues = z.infer<typeof formSchema>;

export default function ShippingIntegrationSettingsContent() {
  const { settings: checkoutSettings, loading: checkoutLoading, updateSettings } = useCheckoutSettings();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [lastValidatedAt, setLastValidatedAt] = useState<string | null>(null);
  const [senderCepLoading, setSenderCepLoading] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      environment: 'sandbox',
      origin_zip_code: '',
      api_token: '',
      is_active: false,
      superFreteEnabled: false,
      serviceIds: [],
      label_purchase_enabled: false,
      sender_name: '',
      sender_document: '',
      sender_phone: '',
      sender_street: '',
      sender_number: '',
      sender_complement: '',
      sender_neighborhood: '',
      sender_city: '',
      sender_state: '',
    },
  });

  const isActive = form.watch('is_active');
  const selectedServiceIds = form.watch('serviceIds');
  const labelPurchaseEnabled = form.watch('label_purchase_enabled');

  // Compra de etiqueta depende da cotação automática — se o lojista desliga
  // "Ativar cotação automática de frete", desliga isso também, em vez de só
  // desabilitar o switch (que travaria o formulário: o valor continuaria
  // "true" e o salvamento seria rejeitado no servidor com um erro sobre
  // dados do remetente, sem relação com o que ele estava tentando fazer).
  useEffect(() => {
    if (!isActive) form.setValue('label_purchase_enabled', false);
  }, [isActive]);

  const handleOriginCepBlur = async () => {
    const cep = form.getValues('origin_zip_code') || '';
    const digits = cep.replace(/\D/g, '');
    if (digits.length !== 8) return;
    setSenderCepLoading(true);
    try {
      const result = await fetchAddressByCep(cep);
      if (!result || !result.city) {
        toast.error('CEP não encontrado');
        return;
      }
      if (!form.getValues('sender_street')) form.setValue('sender_street', result.street);
      if (!form.getValues('sender_neighborhood')) form.setValue('sender_neighborhood', result.neighborhood);
      form.setValue('sender_city', result.city);
      form.setValue('sender_state', result.state);
    } finally {
      setSenderCepLoading(false);
    }
  };

  useEffect(() => {
    loadConfig();
  }, []);

  useEffect(() => {
    if (!checkoutLoading) {
      form.setValue('superFreteEnabled', checkoutSettings.superFrete?.enabled ?? false);
      form.setValue('serviceIds', checkoutSettings.superFrete?.serviceIds ?? []);
    }
  }, [checkoutLoading, checkoutSettings.superFrete]);

  const loadConfig = async () => {
    try {
      const { config } = await getShippingCredentialsConfig();
      if (config) {
        form.reset({
          environment: config.environment,
          origin_zip_code: config.origin_zip_code || '',
          api_token: config.api_token || '',
          is_active: config.is_active,
          superFreteEnabled: form.getValues('superFreteEnabled'),
          serviceIds: form.getValues('serviceIds'),
          label_purchase_enabled: config.label_purchase_enabled ?? false,
          sender_name: config.sender_name || '',
          sender_document: config.sender_document || '',
          sender_phone: config.sender_phone || '',
          sender_street: config.sender_street || '',
          sender_number: config.sender_number || '',
          sender_complement: config.sender_complement || '',
          sender_neighborhood: config.sender_neighborhood || '',
          sender_city: config.sender_city || '',
          sender_state: config.sender_state || '',
        });
        setLastValidatedAt(config.last_validated_at || null);
      }
    } catch (error) {
      console.error('Error loading shipping config:', error);
      toast.error('Erro ao carregar configurações de frete');
    } finally {
      setLoading(false);
    }
  };

  const onSubmit = async (values: FormValues) => {
    setSaving(true);
    try {
      await saveShippingCredentialsConfig({
        environment: values.environment,
        api_token: values.api_token || '',
        origin_zip_code: values.origin_zip_code || '',
        is_active: values.is_active,
        label_purchase_enabled: values.label_purchase_enabled,
        sender_name: values.sender_name || '',
        sender_document: values.sender_document || '',
        sender_phone: values.sender_phone || '',
        sender_street: values.sender_street || '',
        sender_number: values.sender_number || '',
        sender_complement: values.sender_complement || '',
        sender_neighborhood: values.sender_neighborhood || '',
        sender_city: values.sender_city || '',
        sender_state: values.sender_state || '',
      });

      await updateSettings({
        ...checkoutSettings,
        superFrete: {
          enabled: values.superFreteEnabled,
          serviceIds: values.serviceIds,
        },
      });

      toast.success('Configurações salvas com sucesso');
      loadConfig();
    } catch (error: any) {
      toast.error(error.message || 'Erro ao salvar configurações');
    } finally {
      setSaving(false);
    }
  };

  const handleTestCredentials = async () => {
    setTesting(true);
    try {
      const apiToken = form.getValues('api_token');
      const result = await testShippingCredentials({
        api_token: apiToken && !apiToken.startsWith('****') ? apiToken : undefined,
        environment: form.getValues('environment'),
        origin_zip_code: form.getValues('origin_zip_code'),
      });
      if (result.success) {
        toast.success('Conexão com a SuperFrete confirmada');
        setLastValidatedAt(new Date().toISOString());
      } else {
        toast.error(result.error || 'Credenciais inválidas');
      }
    } catch (error: any) {
      toast.error(error.message || 'Erro ao testar credenciais');
    } finally {
      setTesting(false);
    }
  };

  const toggleService = (id: string, checked: boolean) => {
    const current = form.getValues('serviceIds');
    form.setValue(
      'serviceIds',
      checked ? [...current, id] : current.filter((s) => s !== id)
    );
  };

  if (loading || checkoutLoading) {
    return (
      <div className="flex items-center justify-center min-h-[200px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
          <Card>
            <CardHeader>
              <CardTitle>Credenciais SuperFrete</CardTitle>
              <CardDescription>
                Conecte sua conta da SuperFrete para calcular fretes reais (PAC, SEDEX, etc.) na hora
                do checkout.
                {lastValidatedAt && (
                  <span className="block mt-1 text-green-600 dark:text-green-400 flex items-center gap-1">
                    <CheckCircle2 className="h-3.5 w-3.5" /> Conexão validada em{' '}
                    {new Date(lastValidatedAt).toLocaleString('pt-BR')}
                  </span>
                )}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <FormField
                control={form.control}
                name="environment"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Ambiente</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="production">Produção</SelectItem>
                        <SelectItem value="sandbox">Sandbox (teste)</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="origin_zip_code"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>CEP de origem</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="00000-000"
                        {...field}
                        onBlur={() => {
                          field.onBlur();
                          handleOriginCepBlur();
                        }}
                      />
                    </FormControl>
                    <FormDescription>
                      CEP de onde seus pacotes saem — usado em todo cálculo de frete.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="api_token"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Token da API</FormLabel>
                    <FormControl>
                      <Input placeholder="Token gerado no painel da SuperFrete" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Button type="button" variant="outline" onClick={handleTestCredentials} disabled={testing}>
                {testing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Testar Conexão
              </Button>

              <FormField
                control={form.control}
                name="is_active"
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between rounded-lg border border-border p-4">
                    <div>
                      <FormLabel>Ativar cotação automática de frete</FormLabel>
                      <FormDescription>
                        Precisa de token e CEP de origem preenchidos para ativar.
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="label_purchase_enabled"
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between rounded-lg border border-border p-4">
                    <div>
                      <FormLabel>Permitir comprar etiqueta e gerar rastreio automaticamente</FormLabel>
                      <FormDescription>
                        Além de calcular o frete, compra a etiqueta direto do painel do pedido
                        (debita o saldo da sua carteira SuperFrete) e preenche transportadora e
                        rastreio sozinho. Sem isso, você continua só cotando e informando o
                        rastreio manualmente. Desliga automaticamente se você desligar a cotação
                        automática acima.
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        disabled={!isActive}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          {labelPurchaseEnabled && (
            <Card>
              <CardHeader>
                <CardTitle>Dados do remetente</CardTitle>
                <CardDescription>
                  Usados como remetente ao gerar a etiqueta de envio na SuperFrete. Rua, bairro,
                  cidade e UF são sugeridos a partir do CEP de origem acima, mas podem ser
                  ajustados aqui.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="sender_name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nome do remetente</FormLabel>
                        <FormControl>
                          <Input placeholder="Nome completo ou razão social" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="sender_document"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>CPF/CNPJ</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="000.000.000-00"
                            {...field}
                            onChange={(e) => field.onChange(formatCpfCnpj(e.target.value))}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="sender_phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Telefone</FormLabel>
                      <FormControl>
                        <Input placeholder="(11) 91234-5678" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <FormField
                    control={form.control}
                    name="sender_street"
                    render={({ field }) => (
                      <FormItem className="sm:col-span-2">
                        <FormLabel>Rua</FormLabel>
                        <FormControl>
                          <Input placeholder={senderCepLoading ? 'Buscando...' : 'Rua/Avenida'} {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="sender_number"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Número</FormLabel>
                        <FormControl>
                          <Input placeholder="123" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="sender_complement"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Complemento</FormLabel>
                        <FormControl>
                          <Input placeholder="Apto, sala, bloco (opcional)" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="sender_neighborhood"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Bairro</FormLabel>
                        <FormControl>
                          <Input placeholder={senderCepLoading ? 'Buscando...' : 'Bairro'} {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="sender_city"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Cidade</FormLabel>
                        <FormControl>
                          <Input placeholder={senderCepLoading ? 'Buscando...' : 'Cidade'} {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="sender_state"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>UF</FormLabel>
                        <FormControl>
                          <Input placeholder="SP" maxLength={2} {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </CardContent>
            </Card>
          )}

          <Card className={!isActive ? 'opacity-50 pointer-events-none' : undefined}>
            <CardHeader>
              <CardTitle>Serviços de Frete</CardTitle>
              <CardDescription>
                Escolha quais serviços da SuperFrete aparecem para o comprador no checkout.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <FormField
                control={form.control}
                name="superFreteEnabled"
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between rounded-lg border border-border p-4">
                    <div>
                      <FormLabel>Mostrar cotação SuperFrete no checkout</FormLabel>
                      <FormDescription>
                        Some junto das suas opções de entrega manuais, se houver.
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        disabled={!isActive}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {SERVICE_OPTIONS.map((service) => (
                  <label
                    key={service.id}
                    className="flex items-center gap-2 rounded-lg border p-3 cursor-pointer"
                  >
                    <Checkbox
                      checked={selectedServiceIds.includes(service.id)}
                      onCheckedChange={(checked) => toggleService(service.id, checked === true)}
                      disabled={!isActive}
                    />
                    <span className="text-sm">{service.label}</span>
                  </label>
                ))}
              </div>
            </CardContent>
          </Card>

          <div className="flex justify-end">
            <Button type="submit" disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {saving ? 'Salvando...' : 'Salvar Configurações'}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}
