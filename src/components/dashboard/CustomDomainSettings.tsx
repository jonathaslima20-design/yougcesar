import { useState, useEffect, useRef, useCallback } from 'react';
import { Globe, CircleCheck as CheckCircle2, Clock, TriangleAlert as AlertTriangle, Copy, RefreshCw, Trash2, ExternalLink, Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Card, CardContent } from '@/components/ui/card';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import type { CustomDomain } from '@/types';

export function CustomDomainSettings() {
  const { user, refreshUser } = useAuth();
  const [domain, setDomain] = useState('');
  const [domainRecord, setDomainRecord] = useState<CustomDomain | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [instructions, setInstructions] = useState<{
    txt_host: string;
    txt_value: string;
  } | null>(null);
  const [rateLimitedUntil, setRateLimitedUntil] = useState<Date | null>(null);
  const [countdown, setCountdown] = useState('');
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const isEligible = user?.plan_status === 'active';

  const startCountdown = useCallback((until: Date) => {
    if (countdownRef.current) clearInterval(countdownRef.current);
    const tick = () => {
      const diff = until.getTime() - Date.now();
      if (diff <= 0) {
        setRateLimitedUntil(null);
        setCountdown('');
        if (countdownRef.current) clearInterval(countdownRef.current);
        return;
      }
      const minutes = Math.floor(diff / 60000);
      const seconds = Math.floor((diff % 60000) / 1000);
      setCountdown(`${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`);
    };
    tick();
    countdownRef.current = setInterval(tick, 1000);
  }, []);

  useEffect(() => {
    return () => {
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, []);

  useEffect(() => {
    if (rateLimitedUntil) startCountdown(rateLimitedUntil);
  }, [rateLimitedUntil, startCountdown]);

  useEffect(() => {
    fetchDomainStatus();
  }, []);

  const fetchDomainStatus = async () => {
    try {
      setLoading(true);
      const { data: session } = await supabase.auth.getSession();
      if (!session?.session?.access_token) return;

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/manage-custom-domain/status`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.session.access_token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (response.ok) {
        const data = await response.json();
        setDomainRecord(data.domain || null);
        if (data.rate_limited_until) {
          setRateLimitedUntil(new Date(data.rate_limited_until));
        }
        if (data.domain) {
          setDomain(data.domain.domain);
          if (data.domain.status === 'pending_dns') {
            if (data.instructions) {
              setInstructions(data.instructions);
            } else {
              const baseDomain = data.domain.domain.replace(/^www\./, '');
              setInstructions({
                txt_host: `_vitrineturbo-verify.${baseDomain}`,
                txt_value: data.domain.verification_token,
              });
            }
          }
        }
      }
    } catch (error) {
      console.error('Error fetching domain status:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async () => {
    if (!domain.trim()) {
      toast.error('Insira um domínio válido');
      return;
    }

    setActionLoading(true);
    try {
      const { data: session } = await supabase.auth.getSession();
      if (!session?.session?.access_token) return;

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/manage-custom-domain/register`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ domain: domain.trim().toLowerCase() }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        toast.error(data.error || 'Erro ao registrar domínio');
        return;
      }

      setDomainRecord(data.domain);
      setInstructions(data.instructions);
      toast.success('Domínio registrado! Configure o DNS conforme as instruções abaixo.');
    } catch (error) {
      toast.error('Erro ao registrar domínio');
    } finally {
      setActionLoading(false);
    }
  };

  const handleVerifyDns = async () => {
    setActionLoading(true);
    try {
      const { data: session } = await supabase.auth.getSession();
      if (!session?.session?.access_token) return;

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/manage-custom-domain/verify-dns`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.session.access_token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      const data = await response.json();

      if (data.success && data.domain?.status === 'dns_verified') {
        setDomainRecord(data.domain);
        toast.success('DNS verificado com sucesso! Ativando domínio...');
        await handleActivate();
      } else {
        setDomainRecord(data.domain || domainRecord);
        toast.error(data.message || 'DNS ainda não verificado');
      }
    } catch (error) {
      toast.error('Erro ao verificar DNS');
    } finally {
      setActionLoading(false);
    }
  };

  const handleActivate = async () => {
    setActionLoading(true);
    try {
      const { data: session } = await supabase.auth.getSession();
      if (!session?.session?.access_token) return;

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/manage-custom-domain/activate`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.session.access_token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      const data = await response.json();

      if (data.rate_limited && data.retry_after) {
        setRateLimitedUntil(new Date(data.retry_after));
        return;
      }

      if (data.success) {
        setDomainRecord(data.domain);
        setInstructions(null);
        await refreshUser();
        toast.success('Domínio ativado com sucesso!');
      } else {
        toast.error(data.error || 'Erro ao ativar domínio');
      }
    } catch (error) {
      toast.error('Erro ao ativar domínio');
    } finally {
      setActionLoading(false);
    }
  };

  const handleRemove = async () => {
    if (!confirm('Tem certeza que deseja remover o domínio personalizado?')) return;

    setActionLoading(true);
    try {
      const { data: session } = await supabase.auth.getSession();
      if (!session?.session?.access_token) return;

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/manage-custom-domain/remove`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.session.access_token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      const data = await response.json();

      if (data.success) {
        setDomainRecord(null);
        setDomain('');
        setInstructions(null);
        await refreshUser();
        toast.success('Domínio removido com sucesso');
      } else {
        toast.error(data.error || 'Erro ao remover domínio');
      }
    } catch (error) {
      toast.error('Erro ao remover domínio');
    } finally {
      setActionLoading(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Copiado!');
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200"><CheckCircle2 className="w-3 h-3 mr-1" /> Ativo</Badge>;
      case 'dns_verified':
        return <Badge className="bg-blue-100 text-blue-700 border-blue-200"><CheckCircle2 className="w-3 h-3 mr-1" /> DNS Verificado</Badge>;
      case 'pending_dns':
        return <Badge className="bg-amber-100 text-amber-700 border-amber-200"><Clock className="w-3 h-3 mr-1" /> Aguardando DNS</Badge>;
      case 'error':
        return <Badge className="bg-red-100 text-red-700 border-red-200"><AlertTriangle className="w-3 h-3 mr-1" /> Erro</Badge>;
      default:
        return null;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!isEligible) {
    return (
      <div className="space-y-6">
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mb-4">
              <Lock className="h-6 w-6 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold mb-2">Funcionalidade Premium</h3>
            <p className="text-muted-foreground max-w-md mb-4">
              O domínio personalizado está disponível em todos os planos pagos. Faça upgrade para usar seu próprio domínio na sua vitrine.
            </p>
            <Button
              onClick={() => {
                const event = new CustomEvent('open-subscription-modal');
                window.dispatchEvent(event);
              }}
            >
              Fazer Upgrade
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 mb-4">
        <Globe className="h-5 w-5 text-primary" />
        <div>
          <h3 className="text-lg font-semibold">Domínio Personalizado</h3>
          <p className="text-sm text-muted-foreground">Use seu próprio domínio na sua vitrine</p>
        </div>
      </div>

      {/* Current domain info */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <Label className="text-xs text-muted-foreground uppercase tracking-wider">Domínio padrão</Label>
              <p className="text-sm font-medium mt-1">
                vitrineturbo.com/{user?.slug || '...'}
              </p>
            </div>
            <Badge variant="outline" className="text-emerald-600 border-emerald-200">Sempre ativo</Badge>
          </div>

          {domainRecord?.status === 'active' && (
            <div className="flex items-center justify-between pt-4 border-t">
              <div>
                <Label className="text-xs text-muted-foreground uppercase tracking-wider">Domínio personalizado</Label>
                <div className="flex items-center gap-2 mt-1">
                  <p className="text-sm font-medium">{domainRecord.domain}</p>
                  {getStatusBadge(domainRecord.status)}
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => window.open(`https://${domainRecord.domain}`, '_blank')}
                >
                  <ExternalLink className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleRemove}
                  disabled={actionLoading}
                  className="text-destructive hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Domain configuration */}
      {!domainRecord && (
        <Card>
          <CardContent className="pt-6 space-y-4">
            <div>
              <Label htmlFor="custom-domain">Seu domínio</Label>
              <p className="text-xs text-muted-foreground mb-2">
                Insira o domínio que deseja usar (ex: www.minhaloja.com.br)
              </p>
              <div className="flex gap-2">
                <Input
                  id="custom-domain"
                  placeholder="www.seudominio.com.br"
                  value={domain}
                  onChange={(e) => setDomain(e.target.value)}
                  disabled={actionLoading}
                />
                <Button onClick={handleRegister} disabled={actionLoading || !domain.trim()}>
                  {actionLoading ? <RefreshCw className="h-4 w-4 animate-spin" /> : 'Configurar'}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Pending DNS - Instructions */}
      {domainRecord && domainRecord.status === 'pending_dns' && instructions && (
        <Card className="border-amber-200 bg-amber-50/50">
          <CardContent className="pt-6 space-y-6">
            <div className="flex items-center gap-2">
              {getStatusBadge(domainRecord.status)}
              <span className="text-sm font-medium">Configure o DNS do seu domínio</span>
            </div>

            <Alert>
              <AlertDescription className="text-sm">
                Acesse o painel de controle do seu provedor de domínio (Registro.br, GoDaddy, Cloudflare, etc.)
                e adicione os registros abaixo.
              </AlertDescription>
            </Alert>

            {/* A Record */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">1. Registro A</Label>
              <div className="bg-white border rounded-lg p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-xs text-muted-foreground">Tipo:</span>
                    <span className="ml-2 text-sm font-mono">A</span>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <span className="text-xs text-muted-foreground">Host:</span>
                    <span className="ml-2 text-sm font-mono">@</span>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => copyToClipboard('@')}>
                    <Copy className="h-3 w-3" />
                  </Button>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <span className="text-xs text-muted-foreground">Valor:</span>
                    <span className="ml-2 text-sm font-mono">75.2.60.5</span>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => copyToClipboard('75.2.60.5')}>
                    <Copy className="h-3 w-3" />
                  </Button>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <span className="text-xs text-muted-foreground">TTL:</span>
                    <span className="ml-2 text-sm font-mono">3600 (padrão)</span>
                  </div>
                </div>
              </div>
            </div>

            {/* TXT Record */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">2. Registro TXT (verificação)</Label>
              <div className="bg-white border rounded-lg p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-xs text-muted-foreground">Tipo:</span>
                    <span className="ml-2 text-sm font-mono">TXT</span>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <span className="text-xs text-muted-foreground">Host:</span>
                    <span className="ml-2 text-sm font-mono break-all">{instructions.txt_host}</span>
                  </div>
                  <Button variant="ghost" size="sm" className="shrink-0" onClick={() => copyToClipboard(instructions.txt_host)}>
                    <Copy className="h-3 w-3" />
                  </Button>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <span className="text-xs text-muted-foreground">Valor:</span>
                    <span className="ml-2 text-sm font-mono break-all">{instructions.txt_value}</span>
                  </div>
                  <Button variant="ghost" size="sm" className="shrink-0" onClick={() => copyToClipboard(instructions.txt_value)}>
                    <Copy className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            </div>

            <Alert>
              <AlertDescription className="text-xs">
                A propagação DNS pode levar de alguns minutos até 48 horas. Se você usa Cloudflare, desative o proxy (nuvem laranja) e use "DNS Only".
              </AlertDescription>
            </Alert>

            <div className="flex gap-2 pt-2">
              <Button onClick={handleVerifyDns} disabled={actionLoading} className="flex-1">
                {actionLoading ? <RefreshCw className="h-4 w-4 animate-spin mr-2" /> : <CheckCircle2 className="h-4 w-4 mr-2" />}
                Verificar DNS
              </Button>
              <Button variant="outline" onClick={handleRemove} disabled={actionLoading}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* DNS Verified - Ready to activate */}
      {domainRecord && domainRecord.status === 'dns_verified' && (
        <Card className="border-blue-200 bg-blue-50/50">
          <CardContent className="pt-6 space-y-4">
            <div className="flex items-center gap-2">
              {getStatusBadge(domainRecord.status)}
              <span className="text-sm font-medium">DNS verificado — pronto para ativar</span>
            </div>
            {rateLimitedUntil && countdown ? (
              <div className="flex items-center gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
                <Clock className="h-4 w-4 shrink-0 text-amber-600" />
                <div className="flex-1 text-sm text-amber-800">
                  Aguarde para realizar uma nova alteração.
                </div>
                <span className="font-mono text-sm font-semibold text-amber-700">{countdown}</span>
              </div>
            ) : (
              <div className="flex gap-2">
                <Button onClick={handleActivate} disabled={actionLoading} className="flex-1">
                  {actionLoading ? <RefreshCw className="h-4 w-4 animate-spin mr-2" /> : <Globe className="h-4 w-4 mr-2" />}
                  Ativar domínio
                </Button>
                <Button variant="outline" onClick={handleRemove} disabled={actionLoading}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Error state */}
      {domainRecord && domainRecord.status === 'error' && (
        <Card className="border-red-200 bg-red-50/50">
          <CardContent className="pt-6 space-y-4">
            <div className="flex items-center gap-2">
              {getStatusBadge(domainRecord.status)}
              <span className="text-sm font-medium">Erro na ativação</span>
            </div>
            {domainRecord.error_message && (
              <p className="text-sm text-red-600">{domainRecord.error_message}</p>
            )}
            {rateLimitedUntil && countdown ? (
              <div className="flex items-center gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
                <Clock className="h-4 w-4 shrink-0 text-amber-600" />
                <div className="flex-1 text-sm text-amber-800">
                  Aguarde para realizar uma nova alteração.
                </div>
                <span className="font-mono text-sm font-semibold text-amber-700">{countdown}</span>
              </div>
            ) : (
              <div className="flex gap-2">
                <Button onClick={handleActivate} disabled={actionLoading} className="flex-1">
                  {actionLoading ? <RefreshCw className="h-4 w-4 animate-spin mr-2" /> : null}
                  Tentar novamente
                </Button>
                <Button variant="outline" onClick={handleRemove} disabled={actionLoading}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
