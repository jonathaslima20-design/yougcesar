export type ErrorCategory = 'auth' | 'network' | 'database' | 'permission' | 'validation' | 'unknown';

export interface ErrorLog {
  timestamp: string;
  category: ErrorCategory;
  message: string;
  error?: any;
  context?: Record<string, any>;
  stack?: string;
}

class ErrorLogger {
  private logs: ErrorLog[] = [];
  private maxLogs = 50;
  private isDevelopment = import.meta.env.DEV;

  logError(
    message: string,
    category: ErrorCategory = 'unknown',
    error?: any,
    context?: Record<string, any>
  ) {
    const log: ErrorLog = {
      timestamp: new Date().toISOString(),
      category,
      message,
      error: error instanceof Error ? {
        message: error.message,
        name: error.name,
      } : error,
      context,
      stack: error instanceof Error ? error.stack : undefined,
    };

    this.logs.push(log);

    if (this.logs.length > this.maxLogs) {
      this.logs.shift();
    }

    if (this.isDevelopment) {
      console.group(`[${category.toUpperCase()}] ${message}`);
      console.error('Error:', error);
      if (context) console.table(context);
      console.groupEnd();
    }

    return log;
  }

  logAuthError(message: string, context?: Record<string, any>) {
    return this.logError(message, 'auth', undefined, context);
  }

  logNetworkError(message: string, error?: any, context?: Record<string, any>) {
    return this.logError(message, 'network', error, context);
  }

  logDatabaseError(message: string, error?: any, context?: Record<string, any>) {
    return this.logError(message, 'database', error, context);
  }

  logPermissionError(message: string, context?: Record<string, any>) {
    return this.logError(message, 'permission', undefined, context);
  }

  logValidationError(message: string, context?: Record<string, any>) {
    return this.logError(message, 'validation', undefined, context);
  }

  categorizeError(error: any): ErrorCategory {
    if (!error) return 'unknown';

    const message = error.message?.toLowerCase() || '';
    const code = error.code?.toString() || '';

    if (message.includes('jwt') || message.includes('unauthorized') || code === '401') {
      return 'auth';
    }
    if (message.includes('permission') || message.includes('policy') || code === '403') {
      return 'permission';
    }
    if (message.includes('network') || message.includes('fetch') || message.includes('timeout')) {
      return 'network';
    }
    if (message.includes('database') || message.includes('postgres') || code === 'PGRST') {
      return 'database';
    }
    if (message.includes('validation') || message.includes('type')) {
      return 'validation';
    }

    return 'unknown';
  }

  getLogs(): ErrorLog[] {
    return [...this.logs];
  }

  getLogsByCategory(category: ErrorCategory): ErrorLog[] {
    return this.logs.filter(log => log.category === category);
  }

  clearLogs() {
    this.logs = [];
  }

  exportLogs(): string {
    return JSON.stringify(this.logs, null, 2);
  }
}

export const errorLogger = new ErrorLogger();
