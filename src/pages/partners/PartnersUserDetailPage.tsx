import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { ArrowLeft, Loader, ShieldAlert, ShieldCheck } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { PhoneInputWithCountry } from '@/components/ui/phone-input-with-country';
import { Separator } from '@/components/ui/separator';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { formatCurrencyI18n } from '@/lib/i18n';

interface ManagedUserDetail {
  id: string;
  name: string;
  email: string;
  whatsapp: string | null;
  country_code: string | null;
  is_blocked: boolean;
  plan_status: string;
  created_at: string;
}

interface ManagedUserCommission {
  id: string;
  plan_name: string | null;
  amount: number;
  type: string;
  status: string;
  created_at: string;
}

const PLAN_STATUS_LABELS: Record<string, string> = {
  active: 'Ativo',
  free: 'Free',
  expired: 'Expirado',
  suspended: 'Suspenso',
  inactive: 'Inativo',
};

const profileSchema = z.object({
  name: z.string().min(1, 'Nome é obrigatório'),
  country_code: z.string().default('55'),
  whatsapp: z.string().optional(),
});

type ProfileFormValues = z.infer<typeof profileSchema>;

export default function PartnersUserDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [managedUser, setManagedUser] = useState<ManagedUserDetail | null>(null);
  const [commissions, setCommissions] = useState<ManagedUserCommission[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [togglingBlock, setTogglingBlock] = useState(false);
  const [notFound, setNotFound] = useState(false);

  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: { name: '', country_code: '55', whatsapp: '' },
  });

  const loadUser = async () => {
    if (!id) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('users')
      .select('id, name, email, whatsapp, country_code, is_blocked, plan_status, created_at')
      .eq('id', id)
      .maybeSingle();

    // RLS already scopes this to managed_by_partner_id = auth.uid() — a null
    // result here means either it doesn't exist or isn't one of this
    // partner's users, both of which should read as "not found".
    if (error || !data) {
      setNotFound(true);
      setLoading(false);
      return;
    }

    setManagedUser(data);
    form.reset({
      name: data.name,
      country_code: data.country_code || '55',
      whatsapp: data.whatsapp || '',
    });

    const { data: commissionRows } = await supabase
      .from('partner_commissions')
      .select('id, plan_name, amount, type, status, created_at')
      .eq('managed_user_id', id)
      .order('created_at', { ascending: false });
    setCommissions(commissionRows || []);

    setLoading(false);
  };

  useEffect(() => {
    loadUser();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const onSubmit = async (values: ProfileFormValues) => {
    if (!id) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from('users')
        .update({
          name: values.name,
          country_code: values.country_code,
          whatsapp: values.whatsapp || null,
        })
        .eq('id', id);

      if (error) throw error;
      toast.success('Dados atualizados!');
      await loadUser();
    } catch (error: any) {
      toast.error(error.message || 'Erro ao atualizar usuário');
    } finally {
      setSaving(false);
    }
  };

  const toggleBlock = async () => {
    if (!id || !managedUser) return;
    setTogglingBlock(true);
    try {
      const { error } = await supabase
        .from('users')
        .update({ is_blocked: !managedUser.is_blocked })
        .eq('id', id);

      if (error) throw error;
      toast.success(managedUser.is_blocked ? 'Usuário desbloqueado' : 'Usuário bloqueado');
      await loadUser();
    } catch (error: any) {
      toast.error(error.message || 'Erro ao atualizar status');
    } finally {
      setTogglingBlock(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (notFound || !managedUser) {
    return (
      <div className="container mx-auto p-6 max-w-2xl text-center py-20">
        <p className="text-muted-foreground">Usuário não encontrado.</p>
        <Button variant="outline" className="mt-4" onClick={() => navigate('/partners/users')}>
          Voltar para Meus Usuários
        </Button>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 max-w-2xl space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate('/partners/users')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-semibold text-foreground">{managedUser.name}</h1>
          <p className="text-sm text-muted-foreground">{managedUser.email}</p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <Badge variant="outline">
            Plano: {PLAN_STATUS_LABELS[managedUser.plan_status] || managedUser.plan_status}
          </Badge>
          <Badge variant={managedUser.is_blocked ? 'destructive' : 'default'}>
            {managedUser.is_blocked ? 'Bloqueado' : 'Ativo'}
          </Badge>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Editar dados</CardTitle>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nome</FormLabel>
                    <FormControl>
                      <Input disabled={saving} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormItem>
                <FormLabel>Email</FormLabel>
                <FormControl>
                  <Input value={managedUser.email} disabled />
                </FormControl>
              </FormItem>
              <FormField
                control={form.control}
                name="country_code"
                render={() => (
                  <FormItem>
                    <FormLabel>WhatsApp</FormLabel>
                    <FormControl>
                      <PhoneInputWithCountry
                        value={managedUser.whatsapp || ''}
                        defaultCountry="BR"
                        onChange={(data) => {
                          form.setValue('country_code', data.ddi.replace('+', ''));
                          form.setValue('whatsapp', data.phone);
                        }}
                        placeholder="(11) 99999-9999"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" disabled={saving}>
                {saving ? <Loader className="mr-2 h-4 w-4 animate-spin" /> : null}
                Salvar
              </Button>
            </form>
          </Form>

          <Separator className="my-6" />

          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-sm">
                {managedUser.is_blocked ? 'Desbloquear acesso' : 'Bloquear acesso'}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {managedUser.is_blocked
                  ? 'O usuário voltará a acessar a plataforma normalmente.'
                  : 'O usuário perde acesso à plataforma imediatamente.'}
              </p>
            </div>
            <Button
              type="button"
              variant={managedUser.is_blocked ? 'outline' : 'destructive'}
              onClick={toggleBlock}
              disabled={togglingBlock}
            >
              {togglingBlock ? (
                <Loader className="mr-2 h-4 w-4 animate-spin" />
              ) : managedUser.is_blocked ? (
                <ShieldCheck className="mr-2 h-4 w-4" />
              ) : (
                <ShieldAlert className="mr-2 h-4 w-4" />
              )}
              {managedUser.is_blocked ? 'Desbloquear' : 'Bloquear'}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Comissões geradas por este usuário</CardTitle>
        </CardHeader>
        <CardContent>
          {commissions.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">
              Nenhuma comissão gerada por este usuário ainda.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Plano</TableHead>
                  <TableHead>Valor</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Data</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {commissions.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">
                        {c.type === 'renewal' ? 'Renovação' : 'Nova assinatura'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm">{c.plan_name || '-'}</TableCell>
                    <TableCell className="font-medium">{formatCurrencyI18n(c.amount, 'BRL', 'pt-BR')}</TableCell>
                    <TableCell>
                      <CommissionStatusBadge status={c.status} />
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {new Date(c.created_at).toLocaleDateString('pt-BR')}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function CommissionStatusBadge({ status }: { status: string }) {
  switch (status) {
    case 'pending':
      return <Badge variant="outline" className="text-xs border-amber-300 text-amber-600">Pendente</Badge>;
    case 'paid':
      return <Badge className="bg-green-500 text-xs">Pago</Badge>;
    case 'reversed':
      return <Badge variant="destructive" className="text-xs">Revertido</Badge>;
    default:
      return <Badge variant="outline" className="text-xs">{status}</Badge>;
  }
}
