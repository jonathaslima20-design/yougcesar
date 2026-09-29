import { useEffect, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { HexColorPicker } from 'react-colorful';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';

/**
 * Plain, non-collapsible row for a block that is *only* a color choice — nothing
 * to expand or hide, so wrapping it in an accordion would just be an empty click.
 * Same card look as ThemeSection, minus the trigger/chevron.
 */
export function ColorOnlyRow({
  icon,
  title,
  description,
  bgColor,
  textColor,
  onBgChange,
  onTextChange,
  disabled,
}: {
  icon: React.ReactNode;
  title: string;
  description?: string;
  bgColor: string;
  textColor: string;
  onBgChange: (value: string) => void;
  onTextChange: (value: string) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-center gap-2 w-full rounded-lg border p-3">
      <span className="text-muted-foreground shrink-0">{icon}</span>
      <div className="flex-1 min-w-0">
        <span className="text-sm font-medium block truncate">{title}</span>
        {description && <span className="text-xs text-muted-foreground block">{description}</span>}
      </div>
      <SectionColorSwatches
        bgColor={bgColor}
        textColor={textColor}
        onBgChange={onBgChange}
        onTextChange={onTextChange}
        disabled={disabled}
      />
    </div>
  );
}

/**
 * Collapsible wrapper for one block in "Personalizar Eletrônicos" (Banners,
 * Benefícios, Categorias...). Keeps every block closed by default so the page
 * doesn't dump every control on screen at once — only `defaultOpen` starts expanded.
 */
export function ThemeSection({
  icon,
  title,
  description,
  defaultOpen = false,
  headerExtra,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  description?: string;
  defaultOpen?: boolean;
  headerExtra?: React.ReactNode;
  children: React.ReactNode;
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen} className="rounded-lg border overflow-hidden">
      <div className={cn('flex items-center gap-2 w-full pr-2 transition-colors', isOpen ? 'bg-muted/30' : 'hover:bg-muted/50')}>
        <CollapsibleTrigger asChild>
          <button type="button" className="flex items-center gap-2 flex-1 min-w-0 p-3 text-left">
            <span className="text-muted-foreground shrink-0">{icon}</span>
            <span className="text-sm font-medium truncate">{title}</span>
          </button>
        </CollapsibleTrigger>
        {headerExtra}
        <CollapsibleTrigger asChild>
          <button type="button" className="shrink-0 p-1.5 rounded-md text-muted-foreground">
            <ChevronDown className={cn('h-4 w-4 transition-transform duration-200', isOpen && 'rotate-180')} />
          </button>
        </CollapsibleTrigger>
      </div>
      <CollapsibleContent className="px-3 pt-4 pb-4 border-t">
        {description && <p className="text-sm text-muted-foreground mb-4">{description}</p>}
        {children}
      </CollapsibleContent>
    </Collapsible>
  );
}

/**
 * Discreet "background color / text color" pair shown in a ThemeSection's header,
 * for sections that don't already have their own color controls inside (Banners,
 * Benefícios, Categorias, Mini banners, Novidades). Each swatch opens a small
 * picker on click and commits the value only when the picker closes, so dragging
 * around the color wheel doesn't fire a save on every pixel.
 */
export function SectionColorSwatches({
  bgColor,
  textColor,
  onBgChange,
  onTextChange,
  disabled,
}: {
  bgColor: string;
  textColor: string;
  onBgChange: (value: string) => void;
  onTextChange: (value: string) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState<'bg' | 'text' | null>(null);
  const [localBg, setLocalBg] = useState(bgColor);
  const [localText, setLocalText] = useState(textColor);

  useEffect(() => setLocalBg(bgColor), [bgColor]);
  useEffect(() => setLocalText(textColor), [textColor]);

  const close = () => {
    if (open === 'bg' && localBg !== bgColor) onBgChange(localBg);
    if (open === 'text' && localText !== textColor) onTextChange(localText);
    setOpen(null);
  };

  return (
    <div className={cn('flex items-center gap-1.5 shrink-0', disabled && 'opacity-50 pointer-events-none')}>
      <div className="relative">
        <button
          type="button"
          title="Cor de fundo da seção"
          onClick={() => setOpen(open === 'bg' ? null : 'bg')}
          className="h-5 w-5 rounded-full border border-border shadow-sm transition-transform hover:scale-110"
          style={{ backgroundColor: localBg }}
        />
        {open === 'bg' && (
          <>
            <div className="fixed inset-0 z-40" onClick={close} />
            <div className="absolute right-0 z-50 mt-2 p-3 rounded-lg border bg-popover shadow-lg">
              <p className="text-xs text-muted-foreground mb-2">Cor de fundo</p>
              <HexColorPicker color={localBg} onChange={setLocalBg} />
            </div>
          </>
        )}
      </div>
      <div className="relative">
        <button
          type="button"
          title="Cor do texto da seção"
          onClick={() => setOpen(open === 'text' ? null : 'text')}
          className="h-5 w-5 rounded-full border border-border shadow-sm flex items-center justify-center text-[9px] font-bold leading-none transition-transform hover:scale-110"
          style={{ backgroundColor: localText, color: localBg }}
        >
          A
        </button>
        {open === 'text' && (
          <>
            <div className="fixed inset-0 z-40" onClick={close} />
            <div className="absolute right-0 z-50 mt-2 p-3 rounded-lg border bg-popover shadow-lg">
              <p className="text-xs text-muted-foreground mb-2">Cor do texto</p>
              <HexColorPicker color={localText} onChange={setLocalText} />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
