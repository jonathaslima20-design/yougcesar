import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { OfferFormData, OfferTemplate } from '@/types/offers';

interface Props {
  form: OfferFormData;
  updateForm: (updates: Partial<OfferFormData>) => void;
}

const TEMPLATE_OPTIONS: { value: OfferTemplate; label: string; description: string }[] = [
  { value: 'fullscreen', label: 'Tela Cheia', description: 'Overlay com card central grande' },
  { value: 'modal_central', label: 'Modal Central', description: 'Dialog padrao centralizado' },
  { value: 'banner_topo', label: 'Banner Topo', description: 'Barra fixa no topo da pagina' },
  { value: 'slide_lateral', label: 'Slide Lateral', description: 'Painel deslizante pela direita' },
];

export function OfferEditorDesign({ form, updateForm }: Props) {
  return (
    <div className="space-y-5 rounded-xl border bg-card p-6">
      <h3 className="font-semibold text-base">Design e Template</h3>

      <div className="space-y-2">
        <Label>Template de Exibicao</Label>
        <div className="grid grid-cols-2 gap-3">
          {TEMPLATE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => updateForm({ template: opt.value })}
              className={`p-4 rounded-lg border-2 text-left transition-all ${
                form.template === opt.value
                  ? 'border-primary bg-primary/5'
                  : 'border-muted hover:border-muted-foreground/30'
              }`}
            >
              <span className="font-medium text-sm">{opt.label}</span>
              <p className="text-xs text-muted-foreground mt-0.5">{opt.description}</p>
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="cor_fundo">Cor de Fundo</Label>
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={form.cor_fundo}
              onChange={(e) => updateForm({ cor_fundo: e.target.value })}
              className="w-10 h-10 rounded-lg border cursor-pointer"
            />
            <Input
              id="cor_fundo"
              value={form.cor_fundo}
              onChange={(e) => updateForm({ cor_fundo: e.target.value })}
              className="flex-1"
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="cor_texto">Cor do Texto</Label>
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={form.cor_texto}
              onChange={(e) => updateForm({ cor_texto: e.target.value })}
              className="w-10 h-10 rounded-lg border cursor-pointer"
            />
            <Input
              id="cor_texto"
              value={form.cor_texto}
              onChange={(e) => updateForm({ cor_texto: e.target.value })}
              className="flex-1"
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="cor_destaque">Cor de Destaque</Label>
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={form.cor_destaque}
              onChange={(e) => updateForm({ cor_destaque: e.target.value })}
              className="w-10 h-10 rounded-lg border cursor-pointer"
            />
            <Input
              id="cor_destaque"
              value={form.cor_destaque}
              onChange={(e) => updateForm({ cor_destaque: e.target.value })}
              className="flex-1"
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="botao_cor">Cor do Botao</Label>
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={form.botao_cor}
              onChange={(e) => updateForm({ botao_cor: e.target.value })}
              className="w-10 h-10 rounded-lg border cursor-pointer"
            />
            <Input
              id="botao_cor"
              value={form.botao_cor}
              onChange={(e) => updateForm({ botao_cor: e.target.value })}
              className="flex-1"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
