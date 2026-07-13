import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, X, Tag } from 'lucide-react';
import type { ProductTag } from '@/hooks/useProductTags';

const TAG_COLORS = [
  '#3b82f6', '#10b981', '#f59e0b', '#ef4444',
  '#8b5cf6', '#ec4899', '#06b6d4', '#64748b',
];

interface TagManagerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tags: ProductTag[];
  onCreateTag: (name: string, color: string) => Promise<ProductTag | null>;
  onDeleteTag: (tagId: string) => Promise<void>;
}

export function TagManagerDialog({
  open,
  onOpenChange,
  tags,
  onCreateTag,
  onDeleteTag,
}: TagManagerDialogProps) {
  const [newTagName, setNewTagName] = useState('');
  const [selectedColor, setSelectedColor] = useState(TAG_COLORS[0]);
  const [creating, setCreating] = useState(false);

  const handleCreate = async () => {
    if (!newTagName.trim()) return;
    setCreating(true);
    await onCreateTag(newTagName.trim(), selectedColor);
    setNewTagName('');
    setCreating(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Tag className="h-4 w-4" />
            Gerenciar Tags
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Create new tag */}
          <div className="space-y-2">
            <div className="flex gap-2">
              <Input
                value={newTagName}
                onChange={(e) => setNewTagName(e.target.value)}
                placeholder="Nova tag..."
                className="h-8 text-sm"
                maxLength={30}
                onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
              />
              <Button size="sm" className="h-8 px-3" onClick={handleCreate} disabled={creating || !newTagName.trim()}>
                <Plus className="h-3.5 w-3.5" />
              </Button>
            </div>

            {/* Color picker */}
            <div className="flex items-center gap-1.5">
              {TAG_COLORS.map(color => (
                <button
                  key={color}
                  onClick={() => setSelectedColor(color)}
                  className={`
                    w-5 h-5 rounded-full transition-all
                    ${selectedColor === color ? 'ring-2 ring-offset-2 ring-offset-background scale-110' : 'hover:scale-110'}
                  `}
                  style={{ backgroundColor: color, ringColor: color }}
                />
              ))}
            </div>
          </div>

          {/* Existing tags */}
          <div className="space-y-1.5 max-h-[200px] overflow-y-auto">
            {tags.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-4">
                Nenhuma tag criada ainda
              </p>
            ) : (
              tags.map(tag => (
                <div
                  key={tag.id}
                  className="flex items-center justify-between px-2 py-1.5 rounded-lg hover:bg-muted/50 group"
                >
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: tag.color }} />
                    <span className="text-sm">{tag.name}</span>
                  </div>
                  <button
                    onClick={() => onDeleteTag(tag.id)}
                    className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
