import React from 'react';
import { Input } from '@/components/ui/input';
import { getCurrencySymbol, getLocaleConfig, type SupportedLanguage, type SupportedCurrency } from '@/lib/i18n';

interface CurrencyInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'> {
  value?: number | string;
  onChange?: (value: number) => void;
  currency?: SupportedCurrency;
  locale?: SupportedLanguage;
}

export function CurrencyInput({
  value,
  onChange,
  currency = 'BRL',
  locale = 'pt-BR',
  ...props
}: CurrencyInputProps) {
  const localeConfig = getLocaleConfig(locale);
  const currencySymbol = getCurrencySymbol(currency, locale);

  const formatValue = (val: number | string | undefined): string => {
    if (val === undefined || val === null || val === '') return '';

    const numValue = typeof val === 'string' ? parseFloat(val) : val;

    if (isNaN(numValue)) return '';

    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(numValue);
  };

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    let newValue = event.target.value;

    // Remove any existing formatting
    newValue = newValue.replace(/[^\d]/g, '');

    // Convert to number
    if (newValue) {
      const number = parseInt(newValue, 10);
      if (!isNaN(number) && onChange) {
        onChange(number / 100);
      }
    } else if (onChange) {
      onChange(0);
    }
  };

  return (
    <Input
      {...props}
      value={formatValue(value)}
      onChange={handleChange}
      inputMode="numeric"
    />
  );
}