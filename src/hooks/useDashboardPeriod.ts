import { useState } from 'react';
import type { PeriodOption } from '@/components/dashboard/DashboardPeriodFilter';

function getStoredPeriod(storageKey: string): PeriodOption {
  const stored = localStorage.getItem(storageKey);
  if (stored && [7, 15, 30, 90].includes(Number(stored))) {
    return Number(stored) as PeriodOption;
  }
  return 30;
}

export function useDashboardPeriod(storageKey: string): [PeriodOption, (period: PeriodOption) => void] {
  const [periodDays, setPeriodDays] = useState<PeriodOption>(() => getStoredPeriod(storageKey));

  const handlePeriodChange = (period: PeriodOption) => {
    setPeriodDays(period);
    localStorage.setItem(storageKey, String(period));
  };

  return [periodDays, handlePeriodChange];
}
