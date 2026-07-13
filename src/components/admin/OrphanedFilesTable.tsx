import { useState } from 'react';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  OrphanedFile,
  deleteOrphanedFiles,
  deleteAllOrphanedFiles,
  formatFileSize,
  formatDate,
} from '@/lib/orphanedFilesService';
import { toast } from 'sonner';
import { Trash2, ExternalLink, PackageSearch } from 'lucide-react';

interface OrphanedFilesTableProps {
  files: OrphanedFile[];
  isLoading: boolean;
  totalCount: number;
  onRefresh: () => void;
}

type DeleteMode = 'selected' | 'all';

export function OrphanedFilesTable({
  files,
  isLoading,
  totalCount,
  onRefresh,
}: OrphanedFilesTableProps) {
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleteMode, setDeleteMode] = useState<DeleteMode>('selected');
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteProgress, setDeleteProgress] = useState<{ done: number; total: number } | null>(null);

  const toggleFileSelection = (path: string) => {
    setSelectedFiles(prev => {
      const next = new Set(prev);
      next.has(path) ? next.delete(path) : next.add(path);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedFiles.size === files.length) {
      setSelectedFiles(new Set());
    } else {
      setSelectedFiles(new Set(files.map(f => f.path)));
    }
  };

  const openDeleteDialog = (mode: DeleteMode) => {
    setDeleteMode(mode);
    setShowDeleteDialog(true);
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    setDeleteProgress(null);

    try {
      if (deleteMode === 'all') {
        setDeleteProgress({ done: 0, total: totalCount });
        const result = await deleteAllOrphanedFiles();
        if (result.success) {
          toast.success(
            `${result.summary.successful.toLocaleString('pt-BR')} arquivo(s) deletado(s). ${result.summary.storageFreeUpMB} MB liberados.`
          );
          setSelectedFiles(new Set());
          onRefresh();
        } else {
          toast.error(result.error || 'Erro ao deletar arquivos');
        }
      } else {
        const filesToDelete = files
          .filter(f => selectedFiles.has(f.path))
          .map(f => ({ bucket: f.bucket, path: f.path, name: f.name, size: f.size }));

        setDeleteProgress({ done: 0, total: filesToDelete.length });
        const result = await deleteOrphanedFiles(filesToDelete, (done, total) => {
          setDeleteProgress({ done, total });
        });

        if (result.success) {
          toast.success(
            `${result.summary.successful.toLocaleString('pt-BR')} arquivo(s) deletado(s). ${result.summary.storageFreeUpMB} MB liberados.`
          );
          setSelectedFiles(new Set());
          onRefresh();
        } else {
          toast.error(result.error || 'Erro ao deletar arquivos');
        }
      }
    } catch (error) {
      toast.error('Erro ao deletar arquivos');
      console.error(error);
    } finally {
      setIsDeleting(false);
      setDeleteProgress(null);
      setShowDeleteDialog(false);
    }
  };

  const selectedCount = selectedFiles.size;
  const selectedSize = files
    .filter(f => selectedFiles.has(f.path))
    .reduce((sum, f) => sum + f.size, 0);

  const dialogTitle = deleteMode === 'all'
    ? `Deletar todos os ${totalCount.toLocaleString('pt-BR')} arquivos`
    : `Deletar ${selectedCount.toLocaleString('pt-BR')} arquivo(s)`;

  const dialogDescription = deleteMode === 'all'
    ? `Você está prestes a deletar TODOS os ${totalCount.toLocaleString('pt-BR')} arquivos órfãos do cache. Esta ação não pode ser desfeita.`
    : `Você está prestes a deletar ${selectedCount.toLocaleString('pt-BR')} arquivo(s), liberando ${formatFileSize(selectedSize)} de espaço. Esta ação não pode ser desfeita.`;

  if (isLoading) {
    return (
      <div className="space-y-3 py-6">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="h-10 bg-gray-100 rounded animate-pulse" />
        ))}
      </div>
    );
  }

  if (files.length === 0) {
    return (
      <div className="py-16 flex flex-col items-center justify-center text-center text-gray-500">
        <PackageSearch className="w-12 h-12 mb-3 text-gray-300" />
        <p className="text-base font-medium">Nenhum arquivo órfão encontrado</p>
        <p className="text-sm mt-1">
          {totalCount === 0
            ? 'Inicie um scan para verificar o storage'
            : 'Nenhum resultado para o filtro selecionado'}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {(selectedCount > 0 || totalCount > 0) && (
        <div className="flex items-center justify-between gap-4 bg-gray-50 border rounded-lg p-3">
          <div className="text-sm text-gray-700">
            {selectedCount > 0 ? (
              <span>
                <strong>{selectedCount.toLocaleString('pt-BR')}</strong> selecionado(s) desta página
                &nbsp;&middot;&nbsp;
                <span className="text-gray-500">{formatFileSize(selectedSize)}</span>
              </span>
            ) : (
              <span className="text-gray-500">
                {totalCount.toLocaleString('pt-BR')} arquivo(s) no total
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {selectedCount > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => openDeleteDialog('selected')}
                disabled={isDeleting}
                className="text-red-600 border-red-200 hover:bg-red-50 hover:border-red-300"
              >
                <Trash2 className="w-3.5 h-3.5 mr-1.5" />
                Deletar Selecionados ({selectedCount.toLocaleString('pt-BR')})
              </Button>
            )}
            {totalCount > 0 && (
              <Button
                variant="destructive"
                size="sm"
                onClick={() => openDeleteDialog('all')}
                disabled={isDeleting}
              >
                <Trash2 className="w-3.5 h-3.5 mr-1.5" />
                Deletar Todos ({totalCount.toLocaleString('pt-BR')})
              </Button>
            )}
          </div>
        </div>
      )}

      {isDeleting && deleteProgress && (
        <div className="space-y-2 p-3 bg-red-50 border border-red-200 rounded-lg">
          <div className="flex items-center justify-between text-sm text-red-700">
            <span>Deletando arquivos em lote...</span>
            <span>{deleteProgress.done.toLocaleString('pt-BR')} / {deleteProgress.total.toLocaleString('pt-BR')}</span>
          </div>
          <Progress
            value={deleteProgress.total > 0 ? Math.round((deleteProgress.done / deleteProgress.total) * 100) : 0}
            className="h-2 bg-red-200"
          />
        </div>
      )}

      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-gray-50">
              <TableHead className="w-10">
                <Checkbox
                  checked={files.length > 0 && selectedFiles.size === files.length}
                  onCheckedChange={toggleSelectAll}
                  aria-label="Selecionar todos"
                />
              </TableHead>
              <TableHead>Arquivo</TableHead>
              <TableHead className="w-24">Tipo</TableHead>
              <TableHead className="w-24">Tamanho</TableHead>
              <TableHead className="w-36">Data de Criação</TableHead>
              <TableHead className="w-10"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {files.map((file) => (
              <TableRow
                key={file.path}
                className={`hover:bg-gray-50 cursor-pointer ${selectedFiles.has(file.path) ? 'bg-blue-50/50' : ''}`}
                onClick={() => toggleFileSelection(file.path)}
              >
                <TableCell onClick={e => e.stopPropagation()}>
                  <Checkbox
                    checked={selectedFiles.has(file.path)}
                    onCheckedChange={() => toggleFileSelection(file.path)}
                  />
                </TableCell>
                <TableCell>
                  <span className="font-mono text-xs text-gray-700 break-all line-clamp-1">
                    {file.name}
                  </span>
                  <div className="text-xs text-gray-400 mt-0.5">{file.bucket}</div>
                </TableCell>
                <TableCell>
                  <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${
                    file.isProductImage
                      ? 'bg-blue-100 text-blue-700'
                      : file.isUserImage
                        ? 'bg-green-100 text-green-700'
                        : 'bg-gray-100 text-gray-600'
                  }`}>
                    {file.isProductImage ? 'Produto' : file.isUserImage ? 'Usuário' : 'Outro'}
                  </span>
                </TableCell>
                <TableCell className="text-sm text-gray-600">
                  {formatFileSize(file.size)}
                </TableCell>
                <TableCell className="text-xs text-gray-500">
                  {file.createdAt ? formatDate(file.createdAt) : '-'}
                </TableCell>
                <TableCell onClick={e => e.stopPropagation()}>
                  <a
                    href={file.publicUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-1 rounded hover:bg-gray-100 inline-flex text-gray-400 hover:text-gray-600 transition-colors"
                    title="Abrir arquivo"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogTitle>{dialogTitle}</AlertDialogTitle>
          <AlertDialogDescription>{dialogDescription}</AlertDialogDescription>
          <div className="flex gap-3 justify-end mt-2">
            <AlertDialogCancel disabled={isDeleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isDeleting}
              className="bg-red-600 hover:bg-red-700"
            >
              {isDeleting ? 'Deletando...' : 'Deletar'}
            </AlertDialogAction>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
