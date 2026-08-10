import { Minus, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface QuantityStepperProps {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  disabled?: boolean;
}

export function QuantityStepper({ value, onChange, min = 1, max, disabled }: QuantityStepperProps) {
  return (
    <div className="flex items-center gap-3">
      <Button
        type="button"
        size="sm"
        variant="outline"
        onClick={() => onChange(Math.max(min, value - 1))}
        disabled={disabled || value <= min}
      >
        <Minus className="h-4 w-4" />
      </Button>
      <span className="w-8 text-center font-medium">{value}</span>
      <Button
        type="button"
        size="sm"
        variant="outline"
        onClick={() => {
          if (max !== undefined && value >= max) return;
          onChange(value + 1);
        }}
        disabled={disabled || (max !== undefined && value >= max)}
      >
        <Plus className="h-4 w-4" />
      </Button>
    </div>
  );
}
