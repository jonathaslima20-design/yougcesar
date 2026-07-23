import { useEffect, useState } from 'react';
import { Copy, Loader, MousePointerClick, UserPlus } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { generateReferralLink } from '@/lib/referralUtils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

interface ReferredViaLinkUser {
  id: string;
  name: string;
  email: string;
  created_at: string;
}

export default function PartnersReferralPage() {
  const { user, refreshUser } = useAuth();
  const [loading, setLoading] = useState(true);
  const [referralLink, setReferralLink] = useState('');
  const [clickCount, setClickCount] = useState(0);
  const [referredUsers, setReferredUsers] = useState<ReferredViaLinkUser[]>([]);

  useEffect(() => {
    if (!user?.id) return;

    (async () => {
      setLoading(true);

      let referralCode = user.referral_code;
      if (!referralCode) {
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
        let code = 'VT';
        for (let i = 0; i < 5; i++) code += chars[Math.floor(Math.random() * chars.length)];
        referralCode = code;
        await supabase.from('users').update({ referral_code: referralCode }).eq('id', user.id);
        await refreshUser();
      }
      setReferralLink(generateReferralLink(referralCode));

      const { count } = await supabase
        .from('referral_clicks')
        .select('*', { count: 'exact', head: true })
        .eq('referrer_id', user.id);
      setClickCount(count || 0);

      // Only signups that came through the link have both fields set —
      // direct partner-created accounts only get managed_by_partner_id.
      const { data: referred } = await supabase
        .from('users')
        .select('id, name, email, created_at')
        .eq('managed_by_partner_id', user.id)
        .eq('referred_by', user.id)
        .order('created_at', { ascending: false });
      setReferredUsers(referred || []);

      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const copyLink = () => {
    navigator.clipboard.writeText(referralLink);
    toast.success('Link copiado!');
  };

  return (
    <div className="container mx-auto p-6 max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Meu Link</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Compartilhe este link — quem se cadastrar por ele entra automaticamente em "Meus Usuários".
        </p>
      </div>

      {loading ? (
        <div className="flex justify-center py-10">
          <Loader className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <>
          <Card>
            <CardContent className="pt-6">
              <div className="flex gap-2">
                <Input value={referralLink} readOnly className="font-mono text-sm" />
                <Button onClick={copyLink} variant="outline" size="icon">
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <MousePointerClick className="h-4 w-4" />
                  Acessos ao link
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold">{clickCount}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <UserPlus className="h-4 w-4" />
                  Cadastros pelo link
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold">{referredUsers.length}</p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Quem se cadastrou pelo seu link</CardTitle>
            </CardHeader>
            <CardContent>
              {referredUsers.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">
                  Ninguém se cadastrou pelo seu link ainda.
                </p>
              ) : (
                <div className="space-y-2">
                  {referredUsers.map((u) => (
                    <div key={u.id} className="flex items-center justify-between border rounded-lg p-3">
                      <div>
                        <p className="font-medium text-sm">{u.name}</p>
                        <p className="text-xs text-muted-foreground">{u.email}</p>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {new Date(u.created_at).toLocaleDateString('pt-BR')}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
