import React from 'react';
import { NumericFormat, type NumberFormatValues } from 'react-number-format';
import { FormDescription } from '@/components/ui/form';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle } from 'lucide-react';
import { getCurrencySymbol, getLocaleConfig, type SupportedLanguage, type SupportedCurrency } from '@/lib/i18n';

interface DiscountPriceInputProps {
  value?: number;
  onChange?: (value: number | undefined) => void;
  originalPrice: number;
  placeholder?: string;
  currency?: SupportedCurrency;
  locale?: SupportedLanguage;
}

export function DiscountPriceInput({
  value,
  onChange,
  originalPrice,
  placeholder = 'R$ 0,00',
  currency = 'BRL',
  locale = 'pt-BR'
}: DiscountPriceInputProps) {
  const localeConfig = getLocaleConfig(locale);
  const currencySymbol = getCurrencySymbol(currency, locale);

  const defaultPlaceholder = `${currencySymbol} 0,00`;

  const numberFormatConfig = React.useMemo(() => ({
    thousandSeparator: localeConfig.thousandsSeparator,
    decimalSeparator: localeConfig.decimalSeparator,
    prefix: currencySymbol + ' ',
    decimalScale: 2,
    fixedDecimalScale: true,
    allowNegative: false,
    allowLeadingZeros: false,
  }), [localeConfig.thousandsSeparator, localeConfig.decimalSeparator, currencySymbol, currency, locale]);

  const discountedValue = value ?? 0;
  const originalValue = originalPrice || 0;

  const hasDiscount = discountedValue > 0 && originalValue > 0;
  const isValidDiscount = hasDiscount && discountedValue < originalValue;
  const discountPercentage = isValidDiscount
    ? Math.round(((originalValue - discountedValue) / originalValue) * 100)
    : 0;
  const savings = isValidDiscount ? originalValue - discountedValue : 0;

  const handleDiscountedPriceChange = React.useCallback((values: NumberFormatValues) => {
    const { floatValue } = values;
    if (onChange) {
      onChange(floatValue);
    }
  }, [onChange]);

  const displayValue = value !== undefined && value !== null ? value : '';

  return (
    <div className="space-y-2">
      <NumericFormat
        {...numberFormatConfig}
        value={displayValue}
        onValueChange={handleDiscountedPriceChange}
        placeholder={placeholder !== 'R$ 0,00' ? placeholder : defaultPlaceholder}
        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
      />
      <FormDescription>
        Preço promocional opcional. Se preenchido, será exibido como oferta especial.
      </FormDescription>

      {hasDiscount && (
        <div className="mt-2 p-3 bg-muted rounded-lg">
          {isValidDiscount ? (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Badge className="bg-green-600 text-white">
                  -{discountPercentage}% OFF
                </Badge>
                <span className="text-sm font-medium text-green-700 dark:text-green-400">
                  Economia de {currencySymbol} {savings.toLocaleString(locale, {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2
                  })}
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                O desconto será destacado na vitrine com um badge verde
              </p>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-4 w-4" />
              <span className="text-sm">O preço promocional deve ser menor que o preço original</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
