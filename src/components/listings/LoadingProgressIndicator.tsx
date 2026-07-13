import { Loader2, AlertCircle } from 'lucide-react';
import { Progress } from '@/components/ui/progress';

interface LoadingProgressIndicatorProps {
  isLoading: boolean;
  isRetrying: boolean;
  retryCount: number;
  maxRetries: number;
  message: string;
  estimatedTimeSeconds?: number;
}

export function LoadingProgressIndicator({
  isLoading,
  isRetrying,
  retryCount,
  maxRetries,
  message,
  estimatedTimeSeconds = 5,
}: LoadingProgressIndicatorProps) {
  if (!isLoading && !isRetrying) {
    return null;
  }

  const progress = isRetrying ? (retryCount / maxRetries) * 100 : 50;
  const displayMessage = isRetrying
    ? `${message} (Tentativa ${retryCount} de ${maxRetries})`
    : message;

  return (
    <div className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-sm border-b">
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center gap-3 mb-2">
          {isRetrying ? (
            <AlertCircle className="h-5 w-5 text-yellow-500 animate-pulse" />
          ) : (
            <Loader2 className="h-5 w-5 text-primary animate-spin" />
          )}
          <p className="text-sm font-medium">{displayMessage}</p>
        </div>
        <Progress value={progress} className="h-1" />
      </div>
    </div>
  );
}
