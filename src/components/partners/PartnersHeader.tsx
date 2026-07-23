import { ThemeToggle } from '@/components/ui/theme-toggle';

export default function PartnersHeader() {
  return (
    <header className="sticky top-0 z-30 glass-header py-3 px-4 lg:px-8 flex items-center justify-between">
      <div></div>
      <div className="flex items-center gap-1 md:gap-2">
        <ThemeToggle />
      </div>
    </header>
  );
}
