import { useState } from 'react';
import { User, MessageCircle, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { PhoneInputWithCountry } from '@/components/ui/phone-input-with-country';

interface CustomerInfo {
  name: string;
  whatsapp: string;
  countryCode: string;
}

interface CustomerInfoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (info: CustomerInfo) => void;
  loading?: boolean;
  title?: string;
  description?: string;
  confirmLabel?: string;
}

export type { CustomerInfo };

export default function CustomerInfoDialog({
  open,
  onOpenChange,
  onConfirm,
  loading = false,
  title = 'Identificacao',
  description = 'Informe seus dados para enviar o pedido pelo WhatsApp.',
  confirmLabel = 'Confirmar e Enviar',
}: CustomerInfoDialogProps) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [countryCode, setCountryCode] = useState('55');
  const [errors, setErrors] = useState<{ name?: string; phone?: string }>({});

  const validate = (): boolean => {
    const newErrors: { name?: string; phone?: string } = {};
    if (!name.trim()) {
      newErrors.name = 'Informe seu nome';
    }
    const cleanPhone = phone.replace(/\D/g, '');
    if (!cleanPhone || cleanPhone.length < 8) {
      newErrors.phone = 'Informe um numero de WhatsApp valido';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleConfirm = () => {
    if (!validate()) return;
    const cleanPhone = phone.replace(/\D/g, '');
    onConfirm({
      name: name.trim(),
      whatsapp: cleanPhone,
      countryCode,
    });
  };

  const handleClose = (open: boolean) => {
    if (!open) {
      setName('');
      setPhone('');
      setCountryCode('55');
      setErrors({});
    }
    onOpenChange(open);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            {title}
          </DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          <div className="space-y-2">
            <Label htmlFor="customer-name">Nome</Label>
            <Input
              id="customer-name"
              placeholder="Seu nome"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (errors.name) setErrors((prev) => ({ ...prev, name: undefined }));
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleConfirm();
              }}
              autoFocus
            />
            {errors.name && (
              <p className="text-xs text-destructive">{errors.name}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label>WhatsApp</Label>
            <PhoneInputWithCountry
              value={phone}
              defaultCountry="BR"
              onChange={(data) => {
                setPhone(data.phone);
                setCountryCode(data.ddi.replace('+', ''));
                if (errors.phone) setErrors((prev) => ({ ...prev, phone: undefined }));
              }}
            />
            {errors.phone && (
              <p className="text-xs text-destructive">{errors.phone}</p>
            )}
          </div>

          <div className="flex gap-2 pt-2">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => handleClose(false)}
              disabled={loading}
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Voltar
            </Button>
            <Button
              className="flex-1"
              onClick={handleConfirm}
              disabled={loading}
            >
              <MessageCircle className="h-4 w-4 mr-2" />
              {loading ? 'Enviando...' : confirmLabel}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
