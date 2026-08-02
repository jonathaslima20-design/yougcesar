import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { PasswordInput } from '@/components/ui/password-input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import type { Affiliate } from '@/hooks/useAffiliates';

interface ResetAffiliatePasswordDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  affiliate: Affiliate | null;
  onReset: (affiliateId: string, password: string) => Promise<void>;
}

export default function ResetAffiliatePasswordDialog({
  open, onOpenChange, affiliate, onReset,
}: ResetAffiliatePasswordDialogProps) {
  const [password, setPassword] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async () => {
    if (!affiliate) return;
    if (password.length < 6) {
      toast.error('A senha deve ter pelo menos 6 caracteres');
      return;
    }
    setSaving(true);
    try {
      await onReset(affiliate.id, password);
      toast.success(`Senha de ${affiliate.name} redefinida`);
      setPassword('');
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err.message || 'Erro ao redefinir senha');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) setPassword(''); }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Redefinir senha</DialogTitle>
          <DialogDescription>
            Defina uma nova senha para {affiliate?.name}. Compartilhe com ele por fora da plataforma — não há envio de e-mail automático.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-1.5">
          <Label htmlFor="reset-password">Nova senha</Label>
          <PasswordInput id="reset-password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Mínimo 6 caracteres" />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={saving}>{saving ? 'Salvando...' : 'Redefinir'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
