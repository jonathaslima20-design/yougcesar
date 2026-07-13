import { useState } from 'react';
import { ChevronDown, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { errorLogger, type ErrorLog } from '@/lib/errorLogger';

interface ListingsDebugPanelProps {
  userId?: string;
  loading?: boolean;
  error?: string | null;
  productCount?: number;
  filteredCount?: number;
}

export function ListingsDebugPanel({
  userId,
  loading = false,
  error,
  productCount = 0,
  filteredCount = 0,
}: ListingsDebugPanelProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  if (import.meta.env.PROD) {
    return null;
  }

  const allLogs = errorLogger.getLogs();
  const logs = selectedCategory
    ? allLogs.filter(log => log.category === selectedCategory)
    : allLogs;

  const categories = [...new Set(allLogs.map(log => log.category))];

  return (
    <div className="fixed bottom-4 right-4 z-50 max-w-md">
      <Button
        size="sm"
        variant="outline"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full justify-between"
      >
        🐛 Debug Panel
        <ChevronDown
          className={`h-4 w-4 transition-transform ${isOpen ? 'rotate-180' : ''}`}
        />
      </Button>

      {isOpen && (
        <Card className="mt-2 bg-background border-muted">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex justify-between items-center">
              <span>Diagnostics</span>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setIsOpen(false);
                  errorLogger.clearLogs();
                }}
              >
                <X className="h-4 w-4" />
              </Button>
            </CardTitle>
          </CardHeader>

          <CardContent className="space-y-4 text-xs max-h-96 overflow-y-auto">
            <div className="bg-muted p-2 rounded space-y-1">
              <div><strong>User ID:</strong> {userId || 'Not loaded'}</div>
              <div><strong>Loading:</strong> {loading ? '⏳ Yes' : '✅ No'}</div>
              <div><strong>Products:</strong> {productCount}</div>
              <div><strong>Filtered:</strong> {filteredCount}</div>
              {error && (
                <div className="text-destructive">
                  <strong>Error:</strong> {error}
                </div>
              )}
            </div>

            <div>
              <strong className="block mb-2">Error Logs ({allLogs.length})</strong>
              <div className="space-y-1 mb-2">
                <button
                  onClick={() => setSelectedCategory(null)}
                  className={`block w-full text-left px-2 py-1 rounded text-xs ${
                    selectedCategory === null
                      ? 'bg-primary text-primary-foreground'
                      : 'hover:bg-muted'
                  }`}
                >
                  All ({allLogs.length})
                </button>
                {categories.map(cat => {
                  const count = allLogs.filter(log => log.category === cat).length;
                  return (
                    <button
                      key={cat}
                      onClick={() =>
                        setSelectedCategory(selectedCategory === cat ? null : cat)
                      }
                      className={`block w-full text-left px-2 py-1 rounded text-xs ${
                        selectedCategory === cat
                          ? 'bg-primary text-primary-foreground'
                          : 'hover:bg-muted'
                      }`}
                    >
                      {cat.toUpperCase()} ({count})
                    </button>
                  );
                })}
              </div>

              <div className="bg-background border border-muted p-2 rounded max-h-48 overflow-y-auto space-y-2">
                {logs.length === 0 ? (
                  <p className="text-muted-foreground">No logs</p>
                ) : (
                  logs.map((log, idx) => (
                    <LogEntry key={idx} log={log} />
                  ))
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function LogEntry({ log }: { log: ErrorLog }) {
  const [expanded, setExpanded] = useState(false);

  const categoryColors: Record<string, string> = {
    auth: 'text-red-600',
    network: 'text-orange-600',
    database: 'text-yellow-600',
    permission: 'text-purple-600',
    validation: 'text-blue-600',
    unknown: 'text-gray-600',
  };

  return (
    <div className="border border-muted rounded p-1 text-xs">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full text-left hover:bg-muted p-1 rounded font-mono"
      >
        <span className={`font-bold ${categoryColors[log.category] || ''}`}>
          [{log.category.toUpperCase()}]
        </span>{' '}
        {new Date(log.timestamp).toLocaleTimeString()}
      </button>
      {expanded && (
        <div className="mt-1 p-1 bg-muted rounded text-xs space-y-1">
          <p><strong>Message:</strong> {log.message}</p>
          {log.error && (
            <p><strong>Error:</strong> {log.error.message || JSON.stringify(log.error)}</p>
          )}
          {log.context && (
            <details className="cursor-pointer">
              <summary className="font-semibold">Context</summary>
              <pre className="text-xs overflow-auto bg-background p-1 rounded mt-1">
                {JSON.stringify(log.context, null, 2)}
              </pre>
            </details>
          )}
        </div>
      )}
    </div>
  );
}
