import { UseFormReturn } from 'react-hook-form';
import { FormField, FormItem, FormLabel, FormControl, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { PhoneInputWithCountry, COUNTRIES } from '@/components/ui/phone-input-with-country';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface User {
  id: string;
  slug?: string;
}

interface BasicInfoFormProps {
  form: UseFormReturn<any>;
  user: User | null;
  onNameChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

export function BasicInfoForm({ form, user, onNameChange }: BasicInfoFormProps) {
  // Reactive (not getValues, which wouldn't re-render once the profile finishes
  // loading and form.reset() fires) — needed so the widget below opens already
  // showing the merchant's real saved country/number instead of a blank Brazil
  // default, which is what led them to "fix" it by picking a wrong country again.
  const currentWhatsapp = form.watch('whatsapp');

  return (
    <div className="space-y-4">
      <FormField
        control={form.control}
        name="owner_name"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Seu Nome</FormLabel>
            <FormControl>
              <Input {...field} placeholder="Seu nome" />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={form.control}
        name="name"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Nome do Negócio</FormLabel>
            <FormControl>
              <Input
                {...field}
                placeholder="Nome da sua empresa ou negócio"
                onChange={(e) => {
                  field.onChange(e);
                  onNameChange(e);
                }}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={form.control}
        name="email"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Email</FormLabel>
            <FormControl>
              <Input {...field} type="email" />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={form.control}
        name="slug"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Link da Vitrine</FormLabel>
            <FormControl>
              <div className="flex items-center">
                <span className="text-sm text-muted-foreground mr-2">
                  vitrine.app/
                </span>
                <Input {...field} placeholder="seu-link" />
              </div>
            </FormControl>
            <FormMessage />
            {user?.slug && (
              <p className="text-sm text-muted-foreground">
                Seu link atual: vitrine.app/{user.slug}
              </p>
            )}
          </FormItem>
        )}
      />

      <FormField
        control={form.control}
        name="country_code"
        render={({ field }) => {
          // This DDI is your OWN phone's country code, not your store's — the picker
          // used to always reopen showing Brazil with a blank number, regardless of
          // what was actually saved, which is what led merchants to "correct" it by
          // picking the wrong country again. Now it reflects the real saved value.
          const savedCountry = COUNTRIES.find((c) => c.ddi === `+${field.value}`)?.code || 'BR';
          return (
            <FormItem>
              <FormLabel>DDI, Telefone e WhatsApp (o código do país do seu número — não da sua loja)</FormLabel>
              <FormControl>
                <PhoneInputWithCountry
                  defaultCountry={savedCountry}
                  value={currentWhatsapp}
                  onChange={(data) => {
                    form.setValue('country_code', data.ddi.replace('+', ''));
                    form.setValue('phone', data.phone);
                    form.setValue('whatsapp', data.phone);
                  }}
                  placeholder="(11) 99999-9999"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          );
        }}
      />

      <FormField
        control={form.control}
        name="instagram"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Instagram</FormLabel>
            <FormControl>
              <div className="flex items-center">
                <span className="text-sm text-muted-foreground mr-2">@</span>
                <Input {...field} placeholder="usuario" />
              </div>
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={form.control}
        name="location_url"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Link do Google Maps</FormLabel>
            <FormControl>
              <Input {...field} placeholder="https://maps.google.com/..." />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={form.control}
        name="language"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Idioma</FormLabel>
            <Select onValueChange={field.onChange} defaultValue={field.value}>
              <FormControl>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o idioma" />
                </SelectTrigger>
              </FormControl>
              <SelectContent>
                <SelectItem value="pt-BR">Português (BR)</SelectItem>
                <SelectItem value="en-US">English (US)</SelectItem>
                <SelectItem value="es-ES">Español</SelectItem>
              </SelectContent>
            </Select>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={form.control}
        name="currency"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Moeda</FormLabel>
            <Select onValueChange={field.onChange} defaultValue={field.value}>
              <FormControl>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a moeda" />
                </SelectTrigger>
              </FormControl>
              <SelectContent>
                <SelectItem value="BRL">Real (BRL)</SelectItem>
                <SelectItem value="USD">Dólar (USD)</SelectItem>
                <SelectItem value="EUR">Euro (EUR)</SelectItem>
                <SelectItem value="GBP">Libra (GBP)</SelectItem>
              </SelectContent>
            </Select>
            <FormMessage />
          </FormItem>
        )}
      />
    </div>
  );
}
