import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { OfferDisplayConfigFormData, OfferTrigger } from '@/types/offers';

interface Props {
  config: OfferDisplayConfigFormData;
  setConfig: (config: OfferDisplayConfigFormData) => void;
}

const TRIGGER_OPTIONS: { value: OfferTrigger; label: string; description: string }[] = [
  { value: 'ao_entrar', label: 'Ao Entrar no Dashboard', description: 'Exibe apos o usuario fazer login ou acessar o painel' },
  { value: 'apos_cadastrar_produto', label: 'Apos Cadastrar Produto', description: 'Exibe quando o usuario salva um novo produto' },
  { value: 'apos_atingir_limite', label: 'Ao Atingir Limite', description: 'Exibe quando o usuario atinge o limite de produtos/categorias' },
  { value: 'ao_navegar_planos', label: 'Ao Ver Planos', description: 'Exibe quando o usuario visita a pagina de planos' },
  { value: 'manual_apenas', label: 'Apenas Manual', description: 'So exibe quando atribuida manualmente pelo admin' },
];

export function OfferEditorDisplay({ config, setConfig }: Props) {
  const update = (updates: Partial<OfferDisplayConfigFormData>) => {
    setConfig({ ...config, ...updates });
  };

  return (
    <div className="space-y-5 rounded-xl border bg-card p-6">
      <h3 className="font-semibold text-base">Configuracao de Exibicao</h3>

      <div className="space-y-2">
        <Label>Gatilho de Exibicao</Label>
        <Select
          value={config.gatilho_acao}
          onValueChange={(v) => update({ gatilho_acao: v as OfferTrigger })}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {TRIGGER_OPTIONS.map(opt => (
              <SelectItem key={opt.value} value={opt.value}>
                <div>
                  <span className="font-medium">{opt.label}</span>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">
          {TRIGGER_OPTIONS.find(t => t.value === config.gatilho_acao)?.description}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="max_exib">Max. Exibicoes por Usuario</Label>
          <Input
            id="max_exib"
            type="number"
            min={0}
            value={config.max_exibicoes_por_usuario}
            onChange={(e) => update({ max_exibicoes_por_usuario: Number(e.target.value) })}
          />
          <p className="text-xs text-muted-foreground">0 = ilimitado</p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="intervalo_h">Intervalo entre Exibicoes (horas)</Label>
          <Input
            id="intervalo_h"
            type="number"
            min={0}
            value={config.intervalo_horas_entre_exibicoes}
            onChange={(e) => update({ intervalo_horas_entre_exibicoes: Number(e.target.value) })}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="delay_min">Delay antes de Exibir (minutos navegando)</Label>
        <Input
          id="delay_min"
          type="number"
          min={0}
          value={config.exibir_apos_minutos_navegando}
          onChange={(e) => update({ exibir_apos_minutos_navegando: Number(e.target.value) })}
        />
        <p className="text-xs text-muted-foreground">
          Quantos minutos o usuario deve navegar antes de ver a oferta (0 = imediato)
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="horario_ini">Horario Inicio Exibicao</Label>
          <Input
            id="horario_ini"
            type="time"
            value={config.horario_inicio_exibicao}
            onChange={(e) => update({ horario_inicio_exibicao: e.target.value })}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="horario_fim">Horario Fim Exibicao</Label>
          <Input
            id="horario_fim"
            type="time"
            value={config.horario_fim_exibicao}
            onChange={(e) => update({ horario_fim_exibicao: e.target.value })}
          />
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        A oferta so sera exibida dentro deste horario (fuso do navegador do usuario).
      </p>
    </div>
  );
}
