import { useState, useEffect } from 'react';
import { Upload } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import type { Affiliate, AffiliateCommission } from '@/hooks/useAffiliates';

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

interface RecordAffiliatePaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  affiliate: Affiliate | null;
  pendingCommissions: AffiliateCommission[];
  onRecordPayment: (affiliateId: string, commissionIds: string[], options: { receiptFile?: File | null; notes?: string }) => Promise<unknown>;
}

export default function RecordAffiliatePaymentDialog({
  open, onOpenChange, affiliate, pendingCommissions, onRecordPayment,
}: RecordAffiliatePaymentDialogProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setSelectedIds(new Set(pendingCommissions.map(c => c.id)));
      setReceiptFile(null);
      setNotes('');
    }
  }, [open, pendingCommissions]);

  const toggleCommission = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const total = pendingCommissions
    .filter(c => selectedIds.has(c.id))
    .reduce((sum, c) => sum + Number(c.commission_amount), 0);

  const handleSubmit = async () => {
    if (!affiliate || selectedIds.size === 0) {
      toast.error('Selecione ao menos uma comissão');
      return;
    }
    setSaving(true);
    try {
      await onRecordPayment(affiliate.id, Array.from(selectedIds), { receiptFile, notes: notes.trim() || undefined });
      toast.success('Pagamento registrado');
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err.message || 'Erro ao registrar pagamento');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Registrar pagamento — {affiliate?.name}</DialogTitle>
          <DialogDescription>
            Marque as comissões incluídas neste pagamento e, se quiser, anexe o comprovante.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2 max-h-56 overflow-y-auto border rounded-md p-2">
            {pendingCommissions.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">Nenhuma comissão pendente.</p>
            ) : (
              pendingCommissions.map((c) => (
                <label key={c.id} className="flex items-center gap-3 py-1.5 px-1 rounded hover:bg-muted/50 cursor-pointer">
                  <Checkbox checked={selectedIds.has(c.id)} onCheckedChange={() => toggleCommission(c.id)} />
                  <span className="flex-1 text-sm truncate">{c.product_name_snapshot || 'Produto'}</span>
                  <span className="text-sm font-medium shrink-0">{formatCurrency(Number(c.commission_amount))}</span>
                </label>
              ))
            )}
          </div>

          <div className="flex items-center justify-between text-sm font-semibold px-1">
            <span>Total selecionado</span>
            <span>{formatCurrency(total)}</span>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="receipt">Comprovante (opcional)</Label>
            <div className="flex items-center gap-2">
              <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={() => document.getElementById('receipt')?.click()}>
                <Upload className="h-3.5 w-3.5" />
                {receiptFile ? 'Trocar arquivo' : 'Selecionar arquivo'}
              </Button>
              {receiptFile && <span className="text-xs text-muted-foreground truncate">{receiptFile.name}</span>}
            </div>
            <input
              id="receipt"
              type="file"
              accept="image/*,application/pdf"
              className="hidden"
              onChange={(e) => setReceiptFile(e.target.files?.[0] || null)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="payment-notes">Observações (opcional)</Label>
            <Textarea id="payment-notes" value={notes} onChange={e => setNotes(e.target.value)} placeholder="Ex: pago via Pix em 05/08" rows={2} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={saving || selectedIds.size === 0}>
            {saving ? 'Registrando...' : `Confirmar pagamento de ${formatCurrency(total)}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
