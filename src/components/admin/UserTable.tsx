import { useState, useMemo, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Eye, Trash2, Ban, CircleCheck as CheckCircle, MessageCircle, ExternalLink, MoveHorizontal as MoreHorizontal, CircleAlert as AlertCircle, Image, Key, ArrowRightLeft, Copy, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Card, CardContent } from '@/components/ui/card';
import { getInitials, formatWhatsAppForDisplay, generateWhatsAppUrl } from '@/lib/utils';
import { format, formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import PlanTypeBadge from '@/components/subscription/PlanTypeBadge';
import type { User } from '@/types';
import { ChangePasswordDialog } from './ChangePasswordDialog';
import { EditImageLimitDialog } from './EditImageLimitDialog';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface UserTableProps {
  users: User[];
  selectedUsers: Set<string>;
  onSelectUser: (userId: string, checked: boolean) => void;
  onSelectAll: (checked: boolean) => void;
  onToggleBlock: (userId: string, currentBlocked: boolean) => Promise<void>;
  onDeleteUser: (userId: string) => Promise<void>;
  loading: boolean;
  currentUserRole: string;
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  pageSize: number;
  totalCount: number;
}

function getDaysUntilExpiration(nextPaymentDate: string): number {
  const expDate = new Date(nextPaymentDate);
  const now = new Date();
  return Math.ceil((expDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

export function UserTable({
  users,
  selectedUsers,
  onSelectUser,
  onSelectAll,
  onToggleBlock,
  onDeleteUser,
  loading,
  currentUserRole,
  page,
  totalPages,
  onPageChange,
  pageSize,
  totalCount,
}: UserTableProps) {
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);
  const [selectedUserForPassword, setSelectedUserForPassword] = useState<{ id: string; name: string } | null>(null);
  const [showImageLimitDialog, setShowImageLimitDialog] = useState(false);
  const [selectedUserForImageLimit, setSelectedUserForImageLimit] = useState<{ id: string; name: string; currentLimit: number } | null>(null);

  const allSelected = users.length > 0 && users.every(u => selectedUsers.has(u.id));
  const someSelected = selectedUsers.size > 0 && !allSelected;

  const expirationMap = useMemo(() => {
    const map = new Map<string, number>();
    for (const user of users) {
      if (user.next_payment_date) {
        map.set(user.id, getDaysUntilExpiration(user.next_payment_date));
      }
    }
    return map;
  }, [users]);

  const handleCloneUser = useCallback((userId: string) => {
    window.dispatchEvent(new CustomEvent('openCloneUserDialog', { detail: { targetUserId: userId } }));
  }, []);

  const handleCopyProducts = useCallback((userId: string) => {
    window.dispatchEvent(new CustomEvent('openCopyProducts', { detail: { targetUserId: userId } }));
  }, []);

  const handleChangePassword = useCallback((userId: string, userName: string) => {
    setSelectedUserForPassword({ id: userId, name: userName });
    setShowPasswordDialog(true);
  }, []);

  const handleEditImageLimit = useCallback((userId: string, userName: string, currentLimit: number) => {
    setSelectedUserForImageLimit({ id: userId, name: userName, currentLimit });
    setShowImageLimitDialog(true);
  }, []);

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center min-h-[200px]">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (users.length === 0) {
    return (
      <Card>
        <CardContent className="text-center py-12">
          <h3 className="text-lg font-semibold mb-2">Nenhum usuario encontrado</h3>
          <p className="text-muted-foreground">Nao ha usuarios que correspondam aos filtros selecionados.</p>
        </CardContent>
      </Card>
    );
  }

  const showingFrom = page * pageSize + 1;
  const showingTo = Math.min((page + 1) * pageSize, totalCount);

  return (
    <Card>
      <CardContent className="p-0">
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">
                  <Checkbox
                    checked={allSelected}
                    onCheckedChange={onSelectAll}
                    aria-label="Selecionar todos"
                    className={someSelected ? "data-[state=checked]:bg-primary" : ""}
                  />
                </TableHead>
                <TableHead className="min-w-[220px]">Usuario</TableHead>
                <TableHead className="w-28">Plano</TableHead>
                <TableHead className="w-24">Vencimento</TableHead>
                <TableHead className="w-12 text-center">WhatsApp</TableHead>
                <TableHead className="w-20">Status</TableHead>
                <TableHead className="w-24">Cadastro</TableHead>
                <TableHead className="w-28">Último Acesso</TableHead>
                <TableHead className="w-20 text-right">Acoes</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((user) => {
                const daysUntil = expirationMap.get(user.id);
                return (
                  <TableRow key={user.id} className={selectedUsers.has(user.id) ? "bg-muted/50" : ""}>
                    <TableCell>
                      <Checkbox
                        checked={selectedUsers.has(user.id)}
                        onCheckedChange={(checked) => onSelectUser(user.id, checked as boolean)}
                        aria-label={`Selecionar ${user.name}`}
                      />
                    </TableCell>
                    <TableCell className="min-w-0">
                      <div className="flex items-center gap-2">
                        <Avatar className="h-8 w-8 flex-shrink-0">
                          <AvatarImage src={user.avatar_url} alt={user.name} />
                          <AvatarFallback>{getInitials(user.name)}</AvatarFallback>
                        </Avatar>
                        <div className="min-w-0 flex-1">
                          <div className="font-medium truncate text-sm">{user.name}</div>
                          <div className="text-xs text-muted-foreground truncate">{user.email}</div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="w-28">
                      <div className="truncate">
                        {user.plan_status === 'free' ? (
                          <Badge variant="outline" className="text-xs">Free</Badge>
                        ) : (
                          <PlanTypeBadge billingCycle={user.billing_cycle} />
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="w-24">
                      {user.next_payment_date && daysUntil !== undefined ? (
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div className="flex items-center gap-1 cursor-help">
                                <span className="text-xs">
                                  {format(new Date(user.next_payment_date), 'dd/MM', { locale: ptBR })}
                                </span>
                                {daysUntil < 0 && <AlertCircle className="h-3 w-3 text-red-500 flex-shrink-0" />}
                                {daysUntil >= 0 && daysUntil <= 7 && <AlertCircle className="h-3 w-3 text-amber-500 flex-shrink-0" />}
                              </div>
                            </TooltipTrigger>
                            <TooltipContent>
                              {daysUntil < 0
                                ? `Vencido ha ${Math.abs(daysUntil)} dia(s)`
                                : daysUntil === 0
                                ? 'Vence hoje'
                                : `Vence em ${daysUntil} dia(s)`}
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      ) : (
                        <span className="text-xs text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell className="w-12 text-center">
                      {user.whatsapp ? (
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button variant="ghost" size="sm" className="h-8 w-8 p-0 hover:bg-green-50 hover:text-green-700" asChild>
                                <a
                                  href={generateWhatsAppUrl(user.whatsapp, `Ola ${user.name}, sou da equipe VitrineTurbo. Como posso ajudar?`, user.country_code || '55')}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                >
                                  <MessageCircle className="h-4 w-4" />
                                </a>
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              {formatWhatsAppForDisplay(user.whatsapp, user.country_code || '55')}
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      ) : (
                        <span className="text-xs text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell className="w-20">
                      {user.is_blocked || user.plan_status === 'suspended' ? (
                        <Badge variant="destructive" className="text-xs">Bloqueado</Badge>
                      ) : user.plan_status === 'expired' ? (
                        <Badge className="border-amber-300 bg-amber-50 text-amber-800 text-xs">Vencido</Badge>
                      ) : (
                        <Badge className="bg-green-500 text-white text-xs">Ativo</Badge>
                      )}
                    </TableCell>
                    <TableCell className="w-24">
                      <div className="text-xs">
                        {format(new Date(user.created_at), 'dd/MM/yy', { locale: ptBR })}
                      </div>
                    </TableCell>
                    <TableCell className="w-28">
                      {(user as any).last_login_at ? (
                        <div className="flex items-center gap-1.5">
                          <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                            (() => {
                              const hours = (Date.now() - new Date((user as any).last_login_at).getTime()) / 3600000;
                              if (hours < 24) return 'bg-green-500';
                              if (hours < 168) return 'bg-yellow-500';
                              return 'bg-red-500';
                            })()
                          }`} />
                          <span className="text-xs truncate">
                            {formatDistanceToNow(new Date((user as any).last_login_at), { locale: ptBR, addSuffix: false })}
                          </span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5">
                          <div className="w-1.5 h-1.5 rounded-full bg-gray-300 shrink-0" />
                          <span className="text-xs text-muted-foreground">Nunca</span>
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="w-20">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0" asChild>
                          <Link to={`/admin/users/${user.id}`} title="Ver perfil">
                            <Eye className="h-4 w-4" />
                          </Link>
                        </Button>
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => onToggleBlock(user.id, user.is_blocked)} title={user.is_blocked ? "Desbloquear" : "Bloquear"}>
                          {user.is_blocked
                            ? <CheckCircle className="h-4 w-4 text-green-600" />
                            : <Ban className="h-4 w-4 text-red-600" />}
                        </Button>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm" className="h-8 w-8 p-0" title="Mais acoes">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-56">
                            {user.slug && (
                              <DropdownMenuItem asChild>
                                <a href={`/${user.slug}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 cursor-pointer">
                                  <ExternalLink className="h-4 w-4" />
                                  Ver loja do cliente
                                </a>
                              </DropdownMenuItem>
                            )}
                            {currentUserRole === 'admin' && (
                              <>
                                <DropdownMenuItem onClick={() => handleEditImageLimit(user.id, user.name, user.max_images_per_product || 10)}>
                                  <Image className="h-4 w-4 mr-2" />
                                  Limite de imagens
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleChangePassword(user.id, user.name)}>
                                  <Key className="h-4 w-4 mr-2" />
                                  Alterar senha
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleCopyProducts(user.id)}>
                                  <ArrowRightLeft className="h-4 w-4 mr-2" />
                                  Copiar produtos
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleCloneUser(user.id)}>
                                  <Copy className="h-4 w-4 mr-2" />
                                  Clonar usuario
                                </DropdownMenuItem>
                                {user.role !== 'admin' && (
                                  <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                      <div className="relative flex cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-destructive/10 focus:bg-destructive/10 text-destructive data-[disabled]:pointer-events-none data-[disabled]:opacity-50">
                                        <Trash2 className="h-4 w-4 mr-2" />
                                        Excluir usuario
                                      </div>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent>
                                      <AlertDialogHeader>
                                        <AlertDialogTitle>Excluir usuario</AlertDialogTitle>
                                        <AlertDialogDescription>
                                          Tem certeza que deseja excluir o usuario "{user.name}"?
                                          Esta acao nao pode ser desfeita e todos os dados do usuario serao removidos.
                                        </AlertDialogDescription>
                                      </AlertDialogHeader>
                                      <AlertDialogFooter>
                                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                        <AlertDialogAction
                                          onClick={() => onDeleteUser(user.id)}
                                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                        >
                                          Excluir
                                        </AlertDialogAction>
                                      </AlertDialogFooter>
                                    </AlertDialogContent>
                                  </AlertDialog>
                                )}
                              </>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t">
            <p className="text-sm text-muted-foreground">
              {showingFrom}-{showingTo} de {totalCount}
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => onPageChange(page - 1)}
                disabled={page === 0}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-sm text-muted-foreground">
                {page + 1} / {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => onPageChange(page + 1)}
                disabled={page >= totalPages - 1}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </CardContent>

      <ChangePasswordDialog
        open={showPasswordDialog}
        onOpenChange={setShowPasswordDialog}
        userId={selectedUserForPassword?.id || ''}
        userName={selectedUserForPassword?.name || ''}
      />

      <EditImageLimitDialog
        open={showImageLimitDialog}
        onOpenChange={setShowImageLimitDialog}
        userId={selectedUserForImageLimit?.id || ''}
        userName={selectedUserForImageLimit?.name || ''}
        currentLimit={selectedUserForImageLimit?.currentLimit || 10}
      />
    </Card>
  );
}
