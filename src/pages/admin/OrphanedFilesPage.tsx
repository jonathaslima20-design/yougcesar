import { useEffect, useRef, useState } from 'react';
import { OrphanedFilesTable } from '@/components/admin/OrphanedFilesTable';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import {
  OrphanedFile,
  ScanStatus,
  listOrphanedFiles,
  startScan,
  formatFileSize,
  formatDate,
} from '@/lib/orphanedFilesService';
import { toast } from 'sonner';
import { RefreshCw, ScanSearch, Activity, CircleAlert as AlertCircle, CircleCheck as CheckCircle2, Clock } from 'lucide-react';

const ITEMS_PER_PAGE = 500;
const POLL_INTERVAL_MS = 2500;

export function OrphanedFilesPage() {
  const [files, setFiles] = useState<OrphanedFile[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isStartingScan, setIsStartingScan] = useState(false);
  const [totalCount, setTotalCount] = useState(0);
  const [totalSizeBytes, setTotalSizeBytes] = useState(0);
  const [currentPage, setCurrentPage] = useState(0);
  const [scanStatus, setScanStatus] = useState<ScanStatus>({
    status: 'idle',
    totalFilesFound: 0,
    totalSizeBytes: 0,
  });
  const [typeFilter, setTypeFilter] = useState<'all' | 'product' | 'user'>('all');
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPolling = () => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  };

  const loadFiles = async (page: number = 0, filter = typeFilter) => {
    setIsLoading(true);
    try {
      const result = await listOrphanedFiles(
        ITEMS_PER_PAGE,
        page * ITEMS_PER_PAGE,
        filter
      );

      if (result.success) {
        setFiles(result.files);
        setTotalCount(result.totalCount);
        setTotalSizeBytes(result.totalSizeBytes);
        setCurrentPage(page);
        setScanStatus(result.scanStatus);
      } else {
        toast.error(result.error || 'Erro ao carregar arquivos órfãos');
      }
    } catch (error) {
      toast.error('Erro ao carregar arquivos órfãos');
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const pollScanStatus = () => {
    stopPolling();
    pollRef.current = setInterval(async () => {
      try {
        const result = await listOrphanedFiles(ITEMS_PER_PAGE, 0, typeFilter);
        if (result.success) {
          setScanStatus(result.scanStatus);
          if (result.scanStatus.status !== 'scanning') {
            stopPolling();
            setFiles(result.files);
            setTotalCount(result.totalCount);
            setTotalSizeBytes(result.totalSizeBytes);
            setCurrentPage(0);
            if (result.scanStatus.status === 'ready') {
              toast.success(`Scan concluído! ${result.scanStatus.totalFilesFound} arquivos órfãos encontrados.`);
            } else if (result.scanStatus.status === 'error') {
              toast.error(`Scan falhou: ${result.scanStatus.errorMessage}`);
            }
          }
        }
      } catch {
        stopPolling();
      }
    }, POLL_INTERVAL_MS);
  };

  useEffect(() => {
    loadFiles(0);
    return () => stopPolling();
  }, []);

  const handleStartScan = async () => {
    setIsStartingScan(true);
    try {
      const result = await startScan();
      if (result.success) {
        setScanStatus(prev => ({ ...prev, status: 'scanning' }));
        toast.info('Scan iniciado. Aguarde...');
        pollScanStatus();
      } else {
        if (result.error?.includes('already in progress')) {
          toast.info('Scan já em andamento...');
          pollScanStatus();
        } else {
          toast.error(result.error || 'Erro ao iniciar scan');
        }
      }
    } catch (error) {
      toast.error('Erro ao iniciar scan');
      console.error(error);
    } finally {
      setIsStartingScan(false);
    }
  };

  const handleRefreshList = () => loadFiles(currentPage);

  const handleFilterChange = (filter: 'all' | 'product' | 'user') => {
    setTypeFilter(filter);
    loadFiles(0, filter);
  };

  const handlePageChange = (page: number) => loadFiles(page);

  const totalPages = Math.ceil(totalCount / ITEMS_PER_PAGE);
  const isScanning = scanStatus.status === 'scanning';

  const scanStatusBadge = () => {
    if (isScanning) {
      return (
        <div className="flex items-center gap-2 text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-sm">
          <RefreshCw className="w-4 h-4 animate-spin" />
          <span>Escaneando storage...</span>
        </div>
      );
    }
    if (scanStatus.status === 'ready' && scanStatus.completedAt) {
      return (
        <div className="flex items-center gap-2 text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2 text-sm">
          <CheckCircle2 className="w-4 h-4" />
          <span>Scan concluído em {formatDate(scanStatus.completedAt)}</span>
        </div>
      );
    }
    if (scanStatus.status === 'error') {
      return (
        <div className="flex items-center gap-2 text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-sm">
          <AlertCircle className="w-4 h-4" />
          <span>Scan falhou: {scanStatus.errorMessage}</span>
        </div>
      );
    }
    return (
      <div className="flex items-center gap-2 text-gray-500 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm">
        <Clock className="w-4 h-4" />
        <span>Nenhum scan realizado</span>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl page-title text-gray-900">
            Gerenciador de Arquivos Órfãos
          </h1>
          <p className="text-gray-600 mt-2">
            Identifique e delete arquivos que não estão vinculados a produtos ou usuários
          </p>
        </div>
        <Button
          onClick={handleStartScan}
          disabled={isStartingScan || isScanning}
          className="flex items-center gap-2"
        >
          <ScanSearch className="w-4 h-4" />
          {isScanning ? 'Escaneando...' : isStartingScan ? 'Iniciando...' : 'Iniciar Scan'}
        </Button>
      </div>

      {isScanning && (
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="pt-4">
            <div className="flex items-center gap-3 mb-3">
              <RefreshCw className="w-5 h-5 text-amber-600 animate-spin flex-shrink-0" />
              <div>
                <p className="font-medium text-amber-800">Escaneando o storage...</p>
                <p className="text-sm text-amber-700">
                  Isso pode levar alguns minutos dependendo da quantidade de arquivos.
                </p>
              </div>
            </div>
            <Progress value={undefined} className="h-2 bg-amber-200" />
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">Arquivos Órfãos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-gray-900">
              {scanStatus.status === 'idle' ? '-' : scanStatus.totalFilesFound.toLocaleString('pt-BR')}
            </div>
            <p className="text-xs text-gray-500 mt-1">
              {totalCount !== scanStatus.totalFilesFound && typeFilter !== 'all'
                ? `${totalCount} com filtro atual`
                : 'total encontrado'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">Espaço a Liberar</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-gray-900">
              {scanStatus.status === 'idle' ? '-' : formatFileSize(totalSizeBytes)}
            </div>
            <p className="text-xs text-gray-500 mt-1">total de todos os arquivos</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">Status do Scan</CardTitle>
          </CardHeader>
          <CardContent className="pt-2">
            {scanStatusBadge()}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <div>
            <CardTitle>Arquivos</CardTitle>
            <CardDescription>
              {scanStatus.status === 'idle'
                ? 'Clique em "Iniciar Scan" para detectar arquivos órfãos'
                : `${totalCount.toLocaleString('pt-BR')} arquivo(s) encontrado(s)`}
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex rounded-lg border overflow-hidden">
              {(['all', 'product', 'user'] as const).map((filter) => (
                <button
                  key={filter}
                  onClick={() => handleFilterChange(filter)}
                  className={`px-3 py-1.5 text-sm font-medium transition-colors ${
                    typeFilter === filter
                      ? 'bg-gray-900 text-white'
                      : 'bg-white text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  {filter === 'all' ? 'Todos' : filter === 'product' ? 'Produtos' : 'Usuários'}
                </button>
              ))}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefreshList}
              disabled={isLoading || isScanning}
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
              Atualizar
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <OrphanedFilesTable
            files={files}
            isLoading={isLoading}
            totalCount={totalCount}
            onRefresh={handleRefreshList}
          />

          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-6 pt-4 border-t">
              <div className="text-sm text-gray-500">
                Página {currentPage + 1} de {totalPages} &middot;{' '}
                {((currentPage * ITEMS_PER_PAGE) + 1).toLocaleString('pt-BR')}–
                {Math.min((currentPage + 1) * ITEMS_PER_PAGE, totalCount).toLocaleString('pt-BR')} de{' '}
                {totalCount.toLocaleString('pt-BR')}
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePageChange(currentPage - 1)}
                  disabled={currentPage === 0 || isLoading}
                >
                  Anterior
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePageChange(currentPage + 1)}
                  disabled={currentPage >= totalPages - 1 || isLoading}
                >
                  Próxima
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="bg-blue-50 border-blue-200">
        <CardHeader>
          <div className="flex gap-2">
            <Activity className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <CardTitle className="text-base">Como funciona</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="text-sm text-gray-700 space-y-2">
          <p>
            Clique em <strong>Iniciar Scan</strong> para escanear o storage. O scan roda em segundo plano
            e pode levar alguns minutos para volumes grandes.
          </p>
          <p>
            Arquivos órfãos são criados quando imagens de produtos ou perfis são atualizadas sem remover
            a versão anterior.
          </p>
          <p>
            Após o scan, você pode filtrar por tipo, selecionar todos os arquivos de uma vez e deletar
            em lote com alta performance — suportando até 5.000 arquivos por operação.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
