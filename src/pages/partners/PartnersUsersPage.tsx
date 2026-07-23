import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Search, Loader, Users as UsersIcon } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

interface ManagedUser {
  id: string;
  name: string;
  email: string;
  whatsapp: string | null;
  is_blocked: boolean;
  plan_status: string;
  created_at: string;
}

export default function PartnersUsersPage() {
  const { user } = useAuth();
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (!user?.id) return;

    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from('users')
        .select('id, name, email, whatsapp, is_blocked, plan_status, created_at')
        .eq('managed_by_partner_id', user.id)
        .order('created_at', { ascending: false });

      setUsers(data || []);
      setLoading(false);
    })();
  }, [user?.id]);

  const filteredUsers = users.filter((u) => {
    const term = search.trim().toLowerCase();
    if (!term) return true;
    return u.name?.toLowerCase().includes(term) || u.email?.toLowerCase().includes(term);
  });

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Meus Usuários</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Usuários cadastrados diretamente por você ou que se registraram pelo seu link.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center justify-between">
            <span>{filteredUsers.length} usuário{filteredUsers.length === 1 ? '' : 's'}</span>
            <div className="relative w-64">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome ou email..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8 h-9 text-sm font-normal"
              />
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-10">
              <Loader className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground">
              <UsersIcon className="h-10 w-10 mx-auto mb-3 opacity-50" />
              <p>Nenhum usuário encontrado.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>WhatsApp</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Cadastro</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredUsers.map((u) => (
                  <TableRow key={u.id} className="cursor-pointer">
                    <TableCell className="font-medium">
                      <Link to={`/partners/users/${u.id}`} className="hover:underline">
                        {u.name}
                      </Link>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{u.email}</TableCell>
                    <TableCell className="text-muted-foreground">{u.whatsapp || '—'}</TableCell>
                    <TableCell>
                      <Badge variant={u.is_blocked ? 'destructive' : 'default'}>
                        {u.is_blocked ? 'Bloqueado' : 'Ativo'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {new Date(u.created_at).toLocaleDateString('pt-BR')}
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
