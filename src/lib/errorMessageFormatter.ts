export type ErrorCategory = 'auth' | 'network' | 'database' | 'permission' | 'validation' | 'unknown';

interface ErrorMessage {
  title: string;
  description: string;
  suggestion: string;
  severity: 'error' | 'warning' | 'info';
}

const errorMessages: Record<ErrorCategory, ErrorMessage> = {
  auth: {
    title: 'Autenticação Expirou',
    description: 'Sua sessão expirou ou você foi desconectado.',
    suggestion: 'Por favor, faça login novamente para continuar.',
    severity: 'error',
  },
  network: {
    title: 'Erro de Conexão',
    description: 'Não foi possível conectar ao servidor.',
    suggestion: 'Verifique sua conexão com a internet e tente novamente.',
    severity: 'error',
  },
  database: {
    title: 'Erro ao Carregar Dados',
    description: 'Houve um problema ao acessar o banco de dados.',
    suggestion: 'O servidor pode estar temporariamente indisponível. Tente novamente em alguns momentos.',
    severity: 'error',
  },
  permission: {
    title: 'Acesso Negado',
    description: 'Você não tem permissão para realizar esta ação.',
    suggestion: 'Verifique suas permissões e tente novamente.',
    severity: 'error',
  },
  validation: {
    title: 'Dados Inválidos',
    description: 'Os dados recebidos não estão no formato esperado.',
    suggestion: 'Recarregue a página e tente novamente.',
    severity: 'warning',
  },
  unknown: {
    title: 'Erro Desconhecido',
    description: 'Algo deu errado, mas não sabemos exatamente o quê.',
    suggestion: 'Tente recarregar a página ou contatar o suporte.',
    severity: 'error',
  },
};

export function getErrorMessage(category: ErrorCategory, customMessage?: string): ErrorMessage {
  const baseMessage = errorMessages[category];

  if (customMessage) {
    return {
      ...baseMessage,
      description: customMessage,
    };
  }

  return baseMessage;
}

export function formatErrorForUser(error: unknown, category: ErrorCategory): string {
  const errorMessage = getErrorMessage(category);
  const customMsg = error instanceof Error ? error.message : String(error);

  return `${errorMessage.title}: ${errorMessage.description} ${errorMessage.suggestion}`;
}

export function getRetryStrategy(category: ErrorCategory): {
  shouldRetry: boolean;
  maxAttempts: number;
  initialDelayMs: number;
} {
  switch (category) {
    case 'network':
      return { shouldRetry: true, maxAttempts: 5, initialDelayMs: 1000 };
    case 'database':
      return { shouldRetry: true, maxAttempts: 3, initialDelayMs: 2000 };
    case 'auth':
      return { shouldRetry: false, maxAttempts: 0, initialDelayMs: 0 };
    case 'permission':
      return { shouldRetry: false, maxAttempts: 0, initialDelayMs: 0 };
    case 'validation':
      return { shouldRetry: false, maxAttempts: 0, initialDelayMs: 0 };
    case 'unknown':
    default:
      return { shouldRetry: true, maxAttempts: 2, initialDelayMs: 1000 };
  }
}
