import { Search, Filter, Calendar, RefreshCw } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import type { DateFilterType, PlanTypeFilterType, ExpirationFilterType, ActivityFilterType } from '@/pages/admin/UsersManagementPage';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';

interface UserListControlsProps {
  searchTerm: string;
  roleFilter: string;
  statusFilter: string;
  planFilter: string;
  planTypeFilter: PlanTypeFilterType;
  dateFilter: DateFilterType;
  customStartDate?: Date;
  customEndDate?: Date;
  expirationFilter: ExpirationFilterType;
  customExpirationStartDate?: Date;
  customExpirationEndDate?: Date;
  activityFilter: ActivityFilterType;
  totalUsers: number;
  filteredUsers: number;
  onSearchChange: (query: string) => void;
  onRoleFilterChange: (role: string) => void;
  onStatusFilterChange: (status: string) => void;
  onPlanFilterChange: (plan: string) => void;
  onPlanTypeFilterChange: (planType: PlanTypeFilterType) => void;
  onDateFilterChange: (date: DateFilterType) => void;
  onCustomStartDateChange: (date: Date | undefined) => void;
  onCustomEndDateChange: (date: Date | undefined) => void;
  onExpirationFilterChange: (filter: ExpirationFilterType) => void;
  onCustomExpirationStartDateChange: (date: Date | undefined) => void;
  onCustomExpirationEndDateChange: (date: Date | undefined) => void;
  onActivityFilterChange: (filter: ActivityFilterType) => void;
  onRefresh: () => void;
}

export function UserListControls({
  searchTerm,
  roleFilter,
  statusFilter,
  planFilter,
  planTypeFilter,
  dateFilter,
  customStartDate,
  customEndDate,
  expirationFilter,
  customExpirationStartDate,
  customExpirationEndDate,
  totalUsers,
  filteredUsers,
  onSearchChange,
  onRoleFilterChange,
  onStatusFilterChange,
  onPlanFilterChange,
  onPlanTypeFilterChange,
  onDateFilterChange,
  onCustomStartDateChange,
  onCustomEndDateChange,
  onExpirationFilterChange,
  onCustomExpirationStartDateChange,
  onCustomExpirationEndDateChange,
  activityFilter,
  onActivityFilterChange,
  onRefresh,
}: UserListControlsProps) {
  const hasActiveFilters =
    searchTerm ||
    roleFilter !== 'all' ||
    statusFilter !== 'all' ||
    planFilter !== 'all' ||
    planTypeFilter !== 'all' ||
    dateFilter !== 'all' ||
    expirationFilter !== 'all' ||
    activityFilter !== 'all';

  const handleClearFilters = () => {
    onSearchChange('');
    onRoleFilterChange('all');
    onStatusFilterChange('all');
    onPlanFilterChange('all');
    onPlanTypeFilterChange('all');
    onDateFilterChange('all');
    onCustomStartDateChange(undefined);
    onCustomEndDateChange(undefined);
    onExpirationFilterChange('all');
    onCustomExpirationStartDateChange(undefined);
    onCustomExpirationEndDateChange(undefined);
    onActivityFilterChange('all');
  };

  const getDateFilterLabel = () => {
    switch (dateFilter) {
      case 'today':
        return 'Hoje';
      case 'last7days':
        return 'Últimos 7 dias';
      case 'last30days':
        return 'Últimos 30 dias';
      case 'last3months':
        return 'Últimos 3 meses';
      case 'custom':
        if (customStartDate && customEndDate) {
          return `${format(customStartDate, 'dd/MM/yyyy')} - ${format(customEndDate, 'dd/MM/yyyy')}`;
        }
        return 'Período customizado';
      default:
        return 'Todas as datas';
    }
  };

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome, email ou slug..."
              value={searchTerm}
              onChange={(e) => onSearchChange(e.target.value)}
              className="pl-9"
            />
          </div>

          <Sheet>
            <SheetTrigger asChild>
              <Button variant="outline" className="flex items-center gap-2">
                <Filter className="h-4 w-4" />
                Filtros
                {hasActiveFilters && (
                  <Badge variant="secondary" className="ml-1 h-5 w-5 rounded-full p-0 flex items-center justify-center text-xs">
                    !
                  </Badge>
                )}
              </Button>
            </SheetTrigger>
            <SheetContent>
              <SheetHeader>
                <SheetTitle>Filtros de Usuários</SheetTitle>
                <SheetDescription>
                  Refine a lista de usuários usando os filtros abaixo
                </SheetDescription>
              </SheetHeader>

              <div className="space-y-6 mt-6">
                <div className="space-y-2">
                  <Label>Função</Label>
                  <Select value={roleFilter} onValueChange={onRoleFilterChange}>
                    <SelectTrigger>
                      <SelectValue placeholder="Função" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todas as funções</SelectItem>
                      <SelectItem value="admin">Administrador</SelectItem>
                      <SelectItem value="parceiro">Parceiro</SelectItem>
                      <SelectItem value="corretor">Vendedor</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Status de Acesso</Label>
                  <Select value={statusFilter} onValueChange={onStatusFilterChange}>
                    <SelectTrigger>
                      <SelectValue placeholder="Status de Acesso" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      <SelectItem value="active">Desbloqueados</SelectItem>
                      <SelectItem value="blocked">Bloqueados</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Status do Plano</Label>
                  <Select value={planFilter} onValueChange={onPlanFilterChange}>
                    <SelectTrigger>
                      <SelectValue placeholder="Status do Plano" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos os status</SelectItem>
                      <SelectItem value="active">Plano Ativo</SelectItem>
                      <SelectItem value="free">Plano Free</SelectItem>
                      <SelectItem value="expired">Plano Expirado</SelectItem>
                      <SelectItem value="suspended">Plano Suspenso</SelectItem>
                      <SelectItem value="no-plan">Sem Plano</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Tipo de Plano</Label>
                  <Select value={planTypeFilter} onValueChange={(value) => onPlanTypeFilterChange(value as PlanTypeFilterType)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Tipo de Plano" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos os tipos</SelectItem>
                      <SelectItem value="monthly">Mensal</SelectItem>
                      <SelectItem value="quarterly">Trimestral</SelectItem>
                      <SelectItem value="semiannually">Semestral</SelectItem>
                      <SelectItem value="annually">Anual</SelectItem>
                      <SelectItem value="no-plan">Sem Plano</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    Data de Cadastro
                  </Label>
                  <Select value={dateFilter} onValueChange={(value) => onDateFilterChange(value as DateFilterType)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Data de Cadastro" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todas as datas</SelectItem>
                      <SelectItem value="today">Hoje</SelectItem>
                      <SelectItem value="last7days">Últimos 7 dias</SelectItem>
                      <SelectItem value="last30days">Últimos 30 dias</SelectItem>
                      <SelectItem value="last3months">Últimos 3 meses</SelectItem>
                      <SelectItem value="custom">Período customizado</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {dateFilter === 'custom' && (
                  <div className="space-y-4 pt-2 border-t">
                    <div className="space-y-2">
                      <Label>Data Inicial</Label>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            className={cn(
                              'w-full justify-start text-left font-normal',
                              !customStartDate && 'text-muted-foreground'
                            )}
                          >
                            <Calendar className="mr-2 h-4 w-4" />
                            {customStartDate ? (
                              format(customStartDate, 'dd/MM/yyyy', { locale: ptBR })
                            ) : (
                              'Selecione a data'
                            )}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <CalendarComponent
                            mode="single"
                            selected={customStartDate}
                            onSelect={onCustomStartDateChange}
                            disabled={(date) => date > new Date()}
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                    </div>

                    <div className="space-y-2">
                      <Label>Data Final</Label>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            className={cn(
                              'w-full justify-start text-left font-normal',
                              !customEndDate && 'text-muted-foreground'
                            )}
                          >
                            <Calendar className="mr-2 h-4 w-4" />
                            {customEndDate ? (
                              format(customEndDate, 'dd/MM/yyyy', { locale: ptBR })
                            ) : (
                              'Selecione a data'
                            )}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <CalendarComponent
                            mode="single"
                            selected={customEndDate}
                            onSelect={onCustomEndDateChange}
                            disabled={(date) =>
                              date > new Date() ||
                              (customStartDate ? date < customStartDate : false)
                            }
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                    </div>

                    {customStartDate && customEndDate && customEndDate < customStartDate && (
                      <p className="text-sm text-destructive">
                        A data final deve ser posterior à data inicial
                      </p>
                    )}
                  </div>
                )}

                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    Data de Vencimento do Plano
                  </Label>
                  <Select value={expirationFilter} onValueChange={(value) => onExpirationFilterChange(value as ExpirationFilterType)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Data de Vencimento" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos os prazos</SelectItem>
                      <SelectItem value="expiring-today">Vence hoje</SelectItem>
                      <SelectItem value="expiring-7days">Vence em até 7 dias</SelectItem>
                      <SelectItem value="expiring-30days">Vence em até 30 dias</SelectItem>
                      <SelectItem value="expired">Vencidos</SelectItem>
                      <SelectItem value="custom">Período customizado</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {expirationFilter === 'custom' && (
                  <div className="space-y-4 pt-2 border-t">
                    <div className="space-y-2">
                      <Label>Data Inicial de Vencimento</Label>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            className={cn(
                              'w-full justify-start text-left font-normal',
                              !customExpirationStartDate && 'text-muted-foreground'
                            )}
                          >
                            <Calendar className="mr-2 h-4 w-4" />
                            {customExpirationStartDate ? (
                              format(customExpirationStartDate, 'dd/MM/yyyy', { locale: ptBR })
                            ) : (
                              'Selecione a data'
                            )}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <CalendarComponent
                            mode="single"
                            selected={customExpirationStartDate}
                            onSelect={onCustomExpirationStartDateChange}
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                    </div>

                    <div className="space-y-2">
                      <Label>Data Final de Vencimento</Label>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            className={cn(
                              'w-full justify-start text-left font-normal',
                              !customExpirationEndDate && 'text-muted-foreground'
                            )}
                          >
                            <Calendar className="mr-2 h-4 w-4" />
                            {customExpirationEndDate ? (
                              format(customExpirationEndDate, 'dd/MM/yyyy', { locale: ptBR })
                            ) : (
                              'Selecione a data'
                            )}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <CalendarComponent
                            mode="single"
                            selected={customExpirationEndDate}
                            onSelect={onCustomExpirationEndDateChange}
                            disabled={(date) =>
                              customExpirationStartDate ? date < customExpirationStartDate : false
                            }
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                    </div>

                    {customExpirationStartDate && customExpirationEndDate && customExpirationEndDate < customExpirationStartDate && (
                      <p className="text-sm text-destructive">
                        A data final deve ser posterior à data inicial
                      </p>
                    )}
                  </div>
                )}

                <div className="space-y-2">
                  <Label className="text-sm font-medium flex items-center gap-2">
                    Atividade
                  </Label>
                  <Select value={activityFilter} onValueChange={(value) => onActivityFilterChange(value as ActivityFilterType)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Atividade" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      <SelectItem value="active-7d">Ativos (últimos 7 dias)</SelectItem>
                      <SelectItem value="inactive-30d">Inativos (30+ dias)</SelectItem>
                      <SelectItem value="never">Nunca acessaram</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {hasActiveFilters && (
                  <Button
                    variant="outline"
                    onClick={handleClearFilters}
                    className="w-full"
                  >
                    Limpar Filtros
                  </Button>
                )}
              </div>
            </SheetContent>
          </Sheet>

          <Button
            variant="outline"
            size="icon"
            onClick={onRefresh}
            title="Atualizar lista"
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex items-center justify-between text-sm text-muted-foreground mt-3">
          <div className="flex items-center gap-4 flex-wrap">
            <span>
              Exibindo {filteredUsers} de {totalUsers} usuários
            </span>
            {hasActiveFilters && (
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="secondary" className="text-xs">
                  Filtros ativos
                </Badge>
                {dateFilter !== 'all' && (
                  <Badge variant="outline" className="text-xs">
                    {getDateFilterLabel()}
                  </Badge>
                )}
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
