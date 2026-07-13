import { Calendar } from 'lucide-react';

export type PeriodOption = 7 | 15 | 30 | 90;

interface DashboardPeriodFilterProps {
  value: PeriodOption;
  onChange: (period: PeriodOption) => void;
}

const options: { label: string; value: PeriodOption }[] = [
  { label: '7 dias', value: 7 },
  { label: '15 dias', value: 15 },
  { label: '30 dias', value: 30 },
  { label: '90 dias', value: 90 },
];

export function DashboardPeriodFilter({ value, onChange }: DashboardPeriodFilterProps) {
  return (
    <div className="flex items-center gap-1 sm:gap-1.5 bg-muted/60 rounded-lg p-0.5 sm:p-1 w-full sm:w-auto">
      <Calendar className="h-3.5 w-3.5 text-muted-foreground ml-1.5 sm:ml-2 hidden sm:block" />
      {options.map(opt => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className={`flex-1 sm:flex-initial px-2 sm:px-2.5 py-1.5 sm:py-1 text-xs font-medium rounded-md transition-all ${
            value === opt.value
              ? 'bg-background text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
