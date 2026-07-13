import React, { ReactNode } from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { errorLogger } from '@/lib/errorLogger';

interface Props {
  children: ReactNode;
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
  errorCount: number;
}

export class ListingsErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      errorCount: 0,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    this.setState(prevState => ({
      errorInfo,
      errorCount: prevState.errorCount + 1,
    }));

    const category = errorLogger.categorizeError(error);
    errorLogger.logError(
      'Listings component error',
      category,
      error,
      {
        componentStack: errorInfo.componentStack,
        errorCount: this.state.errorCount + 1,
      }
    );

    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }

    console.error('ListingsErrorBoundary caught error:', error);
  }

  resetError = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-background p-4">
          <div className="max-w-2xl mx-auto mt-8">
            <Card className="border-destructive">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-destructive">
                  <AlertCircle className="h-5 w-5" />
                  Erro ao Carregar Listagens
                </CardTitle>
                <CardDescription>
                  Ocorreu um problema ao exibir a página de produtos
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    {this.state.error?.message || 'Erro desconhecido'}
                  </AlertDescription>
                </Alert>

                {import.meta.env.DEV && this.state.errorInfo && (
                  <details className="bg-muted p-4 rounded-md">
                    <summary className="cursor-pointer font-semibold mb-2">
                      Detalhes técnicos
                    </summary>
                    <pre className="text-xs overflow-auto bg-background p-2 rounded border">
                      {this.state.errorInfo.componentStack}
                    </pre>
                  </details>
                )}

                <div className="flex gap-2">
                  <Button
                    onClick={this.resetError}
                    className="flex-1"
                  >
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Tentar Novamente
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => window.location.href = '/dashboard'}
                    className="flex-1"
                  >
                    Voltar ao Dashboard
                  </Button>
                </div>

                {import.meta.env.DEV && (
                  <div className="bg-muted p-4 rounded-md">
                    <p className="text-xs font-semibold mb-2">Logs de Erro:</p>
                    <pre className="text-xs overflow-auto max-h-40">
                      {JSON.stringify(
                        errorLogger.getLogs().slice(-5),
                        null,
                        2
                      )}
                    </pre>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
