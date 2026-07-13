import { useState } from 'react';
import { Plus, X, Trash2, CircleAlert as AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useCustomFlavors } from '@/hooks/useCustomFlavors';
import { toast } from 'sonner';

interface CustomFlavorInputProps {
  value: string[];
  onChange: (flavors: string[]) => void;
  userId?: string;
  maxFlavors?: number;
  placeholder?: string;
}

export function CustomFlavorInput({
  value = [],
  onChange,
  userId,
  maxFlavors = 20,
  placeholder = 'Digite um sabor (ex.: Morango, Chocolate)...',
}: CustomFlavorInputProps) {
  const [inputValue, setInputValue] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const { customFlavors, loading, addCustomFlavor, removeCustomFlavor, error } =
    useCustomFlavors(userId);

  const savedNotInSelection = customFlavors.filter(
    (flavor) => !value.some((v) => v.toLowerCase() === flavor.toLowerCase())
  );

  const handleAdd = async () => {
    const trimmed = inputValue.trim();

    if (!trimmed) {
      toast.error('Digite um sabor');
      return;
    }

    if (value.length >= maxFlavors) {
      toast.error(`Máximo de ${maxFlavors} sabores atingido`);
      return;
    }

    if (value.some((v) => v.toLowerCase() === trimmed.toLowerCase())) {
      toast.info('Este sabor já foi adicionado');
      setInputValue('');
      return;
    }

    setIsAdding(true);

    const newFlavors = [...value, trimmed];
    onChange(newFlavors);

    if (userId) {
      const success = await addCustomFlavor(trimmed);
      if (!success) {
        toast.error('Erro ao salvar sabor no banco de dados');
        onChange(newFlavors.filter((f) => f !== trimmed));
      } else {
        toast.success('Sabor adicionado com sucesso');
      }
    } else {
      toast.success('Sabor adicionado');
    }

    setInputValue('');
    setIsAdding(false);
  };

  const handleRemove = (flavor: string) => {
    onChange(value.filter((f) => f !== flavor));
    toast.success('Sabor removido do produto');
  };

  const handleDeleteSaved = async (flavor: string) => {
    if (value.includes(flavor)) {
      toast.error('Remova o sabor do produto antes de excluí-lo da biblioteca');
      return;
    }

    const success = await removeCustomFlavor(flavor);
    if (success) {
      toast.success('Sabor excluído permanentemente');
    } else {
      toast.error('Erro ao excluir sabor');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAdd();
    }
  };

  const handleSuggestionClick = (flavor: string) => {
    if (value.includes(flavor) || value.length >= maxFlavors) return;
    onChange([...value, flavor]);
  };

  return (
    <div className="space-y-4">
      {error && (
        <div className="flex items-center gap-2 p-3 bg-destructive/10 text-destructive rounded-lg border border-destructive/20">
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          <p className="text-sm">{error}</p>
        </div>
      )}

      <div className="flex gap-2">
        <Input
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className="flex-1"
          disabled={isAdding || loading}
        />
        <Button
          type="button"
          onClick={handleAdd}
          disabled={!inputValue.trim() || value.length >= maxFlavors || isAdding || loading}
          size="sm"
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      {value.length > 0 && (
        <div className="space-y-2">
          <div className="text-sm font-medium text-foreground/80">Sabores deste produto:</div>
          <div className="flex flex-wrap gap-2">
            {value.map((flavor) => (
              <Badge
                key={flavor}
                variant="default"
                className="flex items-center gap-2 px-3 py-1.5 text-foreground bg-primary/10 border border-primary/20 hover:bg-primary/20 transition-colors"
              >
                <span>{flavor}</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-4 w-4 p-0 hover:bg-destructive hover:text-white"
                  onClick={() => handleRemove(flavor)}
                >
                  <X className="h-3 w-3" />
                </Button>
              </Badge>
            ))}
          </div>
        </div>
      )}

      {savedNotInSelection.length > 0 && (
        <div className="space-y-2">
          <div className="text-sm font-medium text-foreground/80">Sabores salvos (reutilizar):</div>
          <div className="flex flex-wrap gap-2">
            {savedNotInSelection.map((flavor) => (
              <div key={flavor} className="flex items-center gap-1 group">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => handleSuggestionClick(flavor)}
                  disabled={value.length >= maxFlavors || loading}
                  className="h-8 text-xs"
                  title={`Adicionar ${flavor} ao produto`}
                >
                  {flavor}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-destructive hover:text-white"
                  onClick={() => handleDeleteSaved(flavor)}
                  title={`Excluir ${flavor} da biblioteca`}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      {loading && (
        <div className="flex items-center gap-2 p-2 bg-muted rounded text-sm text-muted-foreground">
          <div className="h-2 w-2 bg-current rounded-full animate-pulse" />
          Carregando sabores salvos...
        </div>
      )}

      <div className="text-xs text-muted-foreground">
        {value.length}/{maxFlavors} sabores adicionados
        {customFlavors.length > 0 &&
          ` - ${customFlavors.length} sabor${customFlavors.length !== 1 ? 'es' : ''} na biblioteca`}
      </div>
    </div>
  );
}
