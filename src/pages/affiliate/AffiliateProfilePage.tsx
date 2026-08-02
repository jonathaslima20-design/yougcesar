import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { useAffiliateAuth } from '@/contexts/AffiliateAuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PasswordInput } from '@/components/ui/password-input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { validatePixKey } from '@/lib/referralUtils';
import type { AffiliateProfile } from '@/lib/auth/affiliateAuth';

const PAYMENT_FREQUENCY_LABELS: Record<AffiliateProfile['payment_frequency'], string> = {
  weekly: 'Semanal',
  biweekly: 'Quinzenal',
  monthly: 'Mensal',
};

export default function AffiliateProfilePage() {
  const { affiliate, updateProfile, changePassword } = useAffiliateAuth();
  const [name, setName] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);

  const [pixKeyType, setPixKeyType] = useState<NonNullable<AffiliateProfile['pix_key_type']>>('cpf');
  const [pixKey, setPixKey] = useState('');
  const [pixHolderName, setPixHolderName] = useState('');
  const [savingPix, setSavingPix] = useState(false);

  useEffect(() => {
    if (affiliate) {
      setName(affiliate.name);
      setWhatsapp(affiliate.whatsapp || '');
      setPixKeyType(affiliate.pix_key_type || 'cpf');
      setPixKey(affiliate.pix_key || '');
      setPixHolderName(affiliate.pix_holder_name || affiliate.name || '');
    }
  }, [affiliate]);

  if (!affiliate) return null;

  const handleSaveProfile = async () => {
    if (!name.trim()) {
      toast.error('Informe seu nome');
      return;
    }
    setSavingProfile(true);
    try {
      const { error } = await updateProfile({ name: name.trim(), whatsapp: whatsapp.trim() || null });
      if (error) throw new Error(error);
      toast.success('Perfil atualizado');
    } catch (err: any) {
      toast.error(err.message || 'Erro ao atualizar perfil');
    } finally {
      setSavingProfile(false);
    }
  };

  const handleSavePix = async () => {
    if (!pixKey.trim() || !pixHolderName.trim()) {
      toast.error('Preencha a chave Pix e o nome do titular');
      return;
    }
    if (!validatePixKey(pixKey.trim(), pixKeyType)) {
      toast.error('Chave Pix inválida para o tipo selecionado');
      return;
    }
    setSavingPix(true);
    try {
      const { error } = await updateProfile({
        name: affiliate.name,
        pix_key: pixKey.trim(),
        pix_key_type: pixKeyType,
        pix_holder_name: pixHolderName.trim(),
      });
      if (error) throw new Error(error);
      toast.success('Chave Pix salva');
    } catch (err: any) {
      toast.error(err.message || 'Erro ao salvar chave Pix');
    } finally {
      setSavingPix(false);
    }
  };

  const handleChangePassword = async () => {
    if (newPassword.length < 6) {
      toast.error('A nova senha deve ter pelo menos 6 caracteres');
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error('As senhas não coincidem');
      return;
    }
    setSavingPassword(true);
    try {
      const { error } = await changePassword(newPassword);
      if (error) throw new Error(error);
      toast.success('Senha alterada com sucesso');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      toast.error(err.message || 'Erro ao alterar senha');
    } finally {
      setSavingPassword(false);
    }
  };

  return (
    <div className="w-full px-4 sm:px-6 lg:px-8 py-6 max-w-3xl mx-auto space-y-6">
        <h1 className="text-2xl font-bold tracking-tight">Perfil</h1>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Dados pessoais</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label>E-mail</Label>
              <Input value={affiliate.email} disabled />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="name">Nome</Label>
              <Input id="name" value={name} onChange={e => setName(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="whatsapp">WhatsApp</Label>
              <Input id="whatsapp" value={whatsapp} onChange={e => setWhatsapp(e.target.value)} placeholder="11999999999" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Comissão geral</Label>
                <Input value={`${affiliate.default_commission_percentage}%`} disabled />
              </div>
              <div className="space-y-1.5">
                <Label>Frequência de pagamento</Label>
                <Input value={PAYMENT_FREQUENCY_LABELS[affiliate.payment_frequency]} disabled />
              </div>
            </div>
            <p className="text-xs text-muted-foreground -mt-2">Definidas pelo lojista .</p>
            <Button onClick={handleSaveProfile} disabled={savingProfile}>
              {savingProfile ? 'Salvando...' : 'Salvar alterações'}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Chave Pix</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-xs text-muted-foreground -mt-2">
              O lojista usa essa chave para te pagar as comissões. Mantenha atualizada.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Tipo de chave</Label>
                <Select value={pixKeyType} onValueChange={(v) => setPixKeyType(v as NonNullable<AffiliateProfile['pix_key_type']>)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cpf">CPF</SelectItem>
                    <SelectItem value="cnpj">CNPJ</SelectItem>
                    <SelectItem value="email">E-mail</SelectItem>
                    <SelectItem value="phone">Telefone</SelectItem>
                    <SelectItem value="random">Chave aleatória</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="pix-key">Chave Pix</Label>
                <Input id="pix-key" value={pixKey} onChange={e => setPixKey(e.target.value)} placeholder="Sua chave Pix" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pix-holder">Nome do titular</Label>
              <Input id="pix-holder" value={pixHolderName} onChange={e => setPixHolderName(e.target.value)} placeholder="Nome completo do titular da conta" />
            </div>
            <Button onClick={handleSavePix} disabled={savingPix}>
              {savingPix ? 'Salvando...' : 'Salvar chave Pix'}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Alterar senha</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="new-password">Nova senha</Label>
              <PasswordInput id="new-password" value={newPassword} onChange={e => setNewPassword(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="confirm-password">Confirmar nova senha</Label>
              <PasswordInput id="confirm-password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} />
            </div>
            <Button onClick={handleChangePassword} disabled={savingPassword}>
              {savingPassword ? 'Salvando...' : 'Alterar senha'}
            </Button>
          </CardContent>
        </Card>
    </div>
  );
}
