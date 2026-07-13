import { useEffect, useState } from 'react';
import { Loader as Loader2, Save, Globe } from 'lucide-react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RichTextEditor } from '@/components/ui/rich-text-editor';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';

interface LegalDocument {
  id: string;
  document_type: string;
  title: string;
  version: string;
  content: string | null;
  is_active: boolean;
}

interface Props {
  open: boolean;
  documentType: string;
  documentTitle: string;
  currentDoc: LegalDocument | null;
  onClose: () => void;
  onSaved: () => void;
}

export function LegalDocumentEditorDialog({
  open,
  documentType,
  documentTitle,
  currentDoc,
  onClose,
  onSaved,
}: Props) {
  const [content, setContent] = useState('');
  const [version, setVersion] = useState('1.0');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setContent(currentDoc?.content ?? '');
      setVersion(currentDoc?.version ?? '1.0');
    }
  }, [open, currentDoc]);

  async function handleSave(publish: boolean) {
    setSaving(true);

    if (publish && currentDoc?.is_active) {
      const { error: deactivateError } = await supabase
        .from('legal_documents')
        .update({ is_active: false })
        .eq('document_type', documentType)
        .eq('is_active', true);

      if (deactivateError) {
        toast.error('Erro ao desativar versão anterior');
        setSaving(false);
        return;
      }
    }

    if (publish && !currentDoc) {
      const { error } = await supabase.from('legal_documents').insert({
        document_type: documentType,
        title: documentTitle,
        version,
        content,
        is_active: true,
      });
      if (error) {
        toast.error('Erro ao publicar documento');
        setSaving(false);
        return;
      }
    } else if (publish) {
      const { error } = await supabase.from('legal_documents').insert({
        document_type: documentType,
        title: documentTitle,
        version,
        content,
        is_active: true,
      });
      if (error) {
        toast.error('Erro ao publicar nova versão');
        setSaving(false);
        return;
      }
    } else {
      if (currentDoc) {
        const { error } = await supabase
          .from('legal_documents')
          .update({ content, version, updated_at: new Date().toISOString() })
          .eq('id', currentDoc.id);
        if (error) {
          toast.error('Erro ao salvar rascunho');
          setSaving(false);
          return;
        }
      } else {
        const { error } = await supabase.from('legal_documents').insert({
          document_type: documentType,
          title: documentTitle,
          version,
          content,
          is_active: false,
        });
        if (error) {
          toast.error('Erro ao salvar rascunho');
          setSaving(false);
          return;
        }
      }
    }

    toast.success(publish ? 'Documento publicado com sucesso' : 'Rascunho salvo');
    setSaving(false);
    onSaved();
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={() => !saving && onClose()}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Editar: {documentTitle}</DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-4 pr-1">
          <div className="w-40">
            <Label htmlFor="doc-version" className="text-xs text-muted-foreground mb-1.5 block">
              Versão
            </Label>
            <Input
              id="doc-version"
              value={version}
              onChange={(e) => setVersion(e.target.value)}
              placeholder="ex: 1.0, 2.0, 2026-05"
              className="h-8 text-sm"
              disabled={saving}
            />
          </div>

          <div>
            <Label className="text-xs text-muted-foreground mb-1.5 block">
              Conteúdo do documento
            </Label>
            <div className="[&_.ProseMirror]:min-h-[400px] [&_.ProseMirror]:max-h-none [&_.ProseMirror]:overflow-visible">
              <RichTextEditor
                content={content}
                onChange={setContent}
                placeholder="Escreva o conteúdo do documento aqui..."
              />
            </div>
          </div>
        </div>

        <DialogFooter className="flex-shrink-0 gap-2 pt-4 border-t border-border">
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button
            variant="outline"
            onClick={() => handleSave(false)}
            disabled={saving || !content.trim()}
            className="gap-2"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Salvar rascunho
          </Button>
          <Button
            onClick={() => handleSave(true)}
            disabled={saving || !content.trim()}
            className="gap-2"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Globe className="h-4 w-4" />}
            Publicar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
