import { useState, useRef } from 'react';
import { Upload, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { uploadOfferImage } from '@/lib/offerService';
import { toast } from 'sonner';
import type { OfferFormData, OfferType } from '@/types/offers';

interface Props {
  form: OfferFormData;
  updateForm: (updates: Partial<OfferFormData>) => void;
  offerId?: string;
}

const MAX_FILE_SIZE = 5 * 1024 * 1024;

export function OfferEditorContent({ form, updateForm, offerId }: Props) {
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      toast.error('Selecione um arquivo de imagem');
      return;
    }
    if (file.size > MAX_FILE_SIZE) {
      toast.error('Imagem deve ter no maximo 5MB');
      return;
    }

    try {
      setUploading(true);
      const url = await uploadOfferImage(file, offerId);
      updateForm({ imagem_url: url });
      toast.success('Imagem carregada');
    } catch (err) {
      console.error('Upload error:', err);
      toast.error('Erro ao carregar imagem');
    } finally {
      setUploading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFileSelect(file);
    e.target.value = '';
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFileSelect(file);
  };

  const handleRemoveImage = () => {
    updateForm({ imagem_url: '' });
  };

  return (
    <div className="space-y-5 rounded-xl border bg-card p-6">
      <h3 className="font-semibold text-base">Conteudo da Oferta</h3>

      <div className="space-y-2">
        <Label htmlFor="titulo">Titulo *</Label>
        <Input
          id="titulo"
          value={form.titulo}
          onChange={(e) => updateForm({ titulo: e.target.value })}
          placeholder="Ex: 50% OFF no Plano Anual"
          maxLength={80}
        />
        <p className="text-xs text-muted-foreground">{form.titulo.length}/80 caracteres</p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="subtitulo">Subtitulo</Label>
        <Input
          id="subtitulo"
          value={form.subtitulo}
          onChange={(e) => updateForm({ subtitulo: e.target.value })}
          placeholder="Ex: Oferta exclusiva por tempo limitado"
          maxLength={120}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="descricao">Descricao</Label>
        <Textarea
          id="descricao"
          value={form.descricao}
          onChange={(e) => updateForm({ descricao: e.target.value })}
          placeholder="Descreva os beneficios desta oferta..."
          rows={4}
        />
      </div>

      <div className="space-y-2">
        <Label>Tipo de Oferta</Label>
        <Select
          value={form.tipo_oferta}
          onValueChange={(v) => updateForm({ tipo_oferta: v as OfferType })}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="upgrade">Upgrade de Plano</SelectItem>
            <SelectItem value="renovacao">Renovacao</SelectItem>
            <SelectItem value="desconto_geral">Desconto Geral</SelectItem>
            <SelectItem value="parceiro">Parceiro Externo</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label>Imagem da Oferta</Label>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          onChange={handleInputChange}
          className="hidden"
        />

        {form.imagem_url ? (
          <div className="relative group rounded-lg overflow-hidden border bg-muted">
            <img
              src={form.imagem_url}
              alt="Preview"
              className="w-full h-40 object-cover"
            />
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100">
              <Button
                type="button"
                size="sm"
                variant="secondary"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
              >
                Trocar
              </Button>
              <Button
                type="button"
                size="sm"
                variant="destructive"
                onClick={handleRemoveImage}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>
        ) : (
          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => !uploading && fileInputRef.current?.click()}
            className={`
              flex flex-col items-center justify-center gap-2 h-36 rounded-lg border-2 border-dashed cursor-pointer
              transition-colors
              ${dragOver ? 'border-primary bg-primary/5' : 'border-muted-foreground/25 hover:border-muted-foreground/50'}
              ${uploading ? 'pointer-events-none opacity-60' : ''}
            `}
          >
            {uploading ? (
              <div className="flex flex-col items-center gap-2">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                <p className="text-sm text-muted-foreground">Carregando...</p>
              </div>
            ) : (
              <>
                <div className="p-3 rounded-full bg-muted">
                  <Upload className="w-5 h-5 text-muted-foreground" />
                </div>
                <div className="text-center">
                  <p className="text-sm font-medium">Clique ou arraste uma imagem</p>
                  <p className="text-xs text-muted-foreground">PNG, JPG ou WebP (max. 5MB)</p>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="botao_texto">Texto do Botao (CTA)</Label>
        <Input
          id="botao_texto"
          value={form.botao_texto}
          onChange={(e) => updateForm({ botao_texto: e.target.value })}
          placeholder="Ex: Aproveitar Oferta"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="url_destino">URL de Destino (ao clicar no CTA)</Label>
        <Input
          id="url_destino"
          value={form.url_destino}
          onChange={(e) => updateForm({ url_destino: e.target.value })}
          placeholder="Ex: /dashboard/checkout?plan=anual"
        />
      </div>
    </div>
  );
}
