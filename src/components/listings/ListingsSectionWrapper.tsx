import React, { ReactNode } from 'react';
import { SectionErrorBoundary } from './SectionErrorBoundary';

interface ListingsSectionWrapperProps {
  children: ReactNode;
  sectionName: string;
  onRetry?: () => void;
  fallback?: ReactNode;
  isEmpty?: boolean;
  emptyMessage?: string;
}

export function ListingsSectionWrapper({
  children,
  sectionName,
  onRetry,
  fallback,
  isEmpty,
  emptyMessage,
}: ListingsSectionWrapperProps) {
  if (isEmpty) {
    return (
      <div className="text-center py-8">
        <p className="text-muted-foreground">{emptyMessage || 'Nenhum dado disponível'}</p>
      </div>
    );
  }

  return (
    <SectionErrorBoundary
      sectionName={sectionName}
      onRetry={onRetry}
      fallback={fallback}
    >
      {children}
    </SectionErrorBoundary>
  );
}
