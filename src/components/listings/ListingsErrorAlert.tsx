import { AlertCircle, X, RefreshCw } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';

interface ListingsErrorAlertProps {
  error: string;
  category?: 'auth' | 'network' | 'database' | 'permission' | 'validation' | 'unknown';
  onDismiss?: () => void;
  onRetry?: () => void;
  showRetry?: boolean;
}

const errorMessages: Record<string, { title: string; description: string }> = {
  auth: {
    title: 'Erro de Autenticação',
    description: 'Sua sessão expirou ou você não está autenticado. Por favor, faça login novamente.',
  },
  network: {
    title: 'Erro de Conexão',
    description: 'Problema ao conectar com o servidor. Verifique sua conexão de internet.',
  },
  database: {
    title: 'Erro ao Carregar Dados',
    description: 'Não foi possível carregar os produtos. Tente novamente em alguns momentos.',
  },
  permission: {
    title: 'Erro de Permissão',
    description: 'Você não tem permissão para acessar estes dados.',
  },
  validation: {
    title: 'Erro de Validação',
    description: 'Os dados recebidos estão inválidos. Tente novamente.',
  },
  unknown: {
    title: 'Erro Desconhecido',
    description: 'Ocorreu um erro inesperado. Tente novamente.',
  },
};

export function ListingsErrorAlert({
  error,
  category = 'unknown',
  onDismiss,
  onRetry,
  showRetry = true,
}: ListingsErrorAlertProps) {
  const { title, description } = errorMessages[category] || errorMessages.unknown;

  return (
    <Alert variant="destructive" className="border-destructive/50">
      <AlertCircle className="h-4 w-4" />
      <AlertTitle className="ml-2">{title}</AlertTitle>
      <AlertDescription className="mt-2 ml-6">
        <p>{description}</p>
        <p className="text-xs text-muted-foreground mt-1">{error}</p>
      </AlertDescription>
      <div className="flex gap-2 mt-3 ml-6">
        {showRetry && onRetry && (
          <Button
            size="sm"
            variant="outline"
            onClick={onRetry}
          >
            <RefreshCw className="h-3 w-3 mr-1" />
            Tentar Novamente
          </Button>
        )}
        {onDismiss && (
          <Button
            size="sm"
            variant="ghost"
            onClick={onDismiss}
          >
            <X className="h-3 w-3" />
          </Button>
        )}
      </div>
    </Alert>
  );
}
