import { useEffect, useState } from 'react';
import { ChevronDown, Copy, AlertTriangle } from 'lucide-react';
import { HexColorPicker } from 'react-colorful';
import { toast } from 'sonner';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { getContrastRatio } from '@/lib/appearanceDefaults';

const HEX_RE = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;

function normalizeHex(value: string): string | null {
  const trimmed = value.trim();
  const withHash = trimmed.startsWith('#') ? trimmed : `#${trimmed}`;
  return HEX_RE.test(withHash) ? withHash : null;
}

function copyHex(hex: string) {
  navigator.clipboard.writeText(hex);
  toast.success(`${hex.toUpperCase()} copiado`);
}

/**
 * One color's popover: swatch + wheel + editable hex + copy button + a quick-pick
 * strip of colors already used elsewhere in the theme, so matching an exact shade
 * never depends on eyeballing the wheel. `open`/`onOpenChange` are controlled by
 * the caller so siblings (e.g. bg vs text) can stay mutually exclusive.
 *
 * Uses Radix's Popover (portal-rendered) rather than a hand-rolled absolute+fixed
 * overlay: this trigger lives inside a collapsed ThemeSection's `overflow-hidden`
 * header, and an absolutely-positioned panel there gets clipped to invisibility
 * while its backdrop still blocks clicks — a portal escapes that entirely.
 */
function ColorPickerPopover({
  value,
  label,
  onCommit,
  palette,
  open,
  onOpenChange,
  trigger,
}: {
  value: string;
  label: string;
  onCommit: (value: string) => void;
  palette?: string[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  trigger: (props: { color: string }) => React.ReactElement;
}) {
  const [local, setLocal] = useState(value);
  const [hexInput, setHexInput] = useState(value);

  useEffect(() => {
    if (open) {
      setLocal(value);
      setHexInput(value);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const handleOpenChange = (next: boolean) => {
    if (!next && local !== value) onCommit(local);
    onOpenChange(next);
  };

  const applyHexInput = () => {
    const normalized = normalizeHex(hexInput);
    if (normalized) {
      setLocal(normalized);
      setHexInput(normalized);
      onCommit(normalized);
    } else {
      setHexInput(local);
    }
  };

  const applyQuickPick = (hex: string) => {
    setLocal(hex);
    setHexInput(hex);
    onCommit(hex);
  };

  const otherColors = (palette || []).filter((hex) => hex.toLowerCase() !== local.toLowerCase());

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>{trigger({ color: value })}</PopoverTrigger>
      <PopoverContent className="w-auto space-y-2 p-3" align="end">
        <p className="text-xs text-muted-foreground">{label}</p>
        <HexColorPicker
          color={local}
          onChange={(c) => {
            setLocal(c);
            setHexInput(c);
          }}
        />
        <div className="flex items-center gap-1.5">
          <Input
            value={hexInput}
            onChange={(e) => setHexInput(e.target.value)}
            onBlur={applyHexInput}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                applyHexInput();
              }
            }}
            className="h-7 flex-1 px-2 font-mono text-xs"
            maxLength={7}
          />
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-7 w-7 shrink-0"
            title="Copiar código"
            onClick={() => copyHex(local)}
          >
            <Copy className="h-3 w-3" />
          </Button>
        </div>
        {otherColors.length > 0 && (
          <div>
            <p className="mb-1 text-[11px] text-muted-foreground">Cores em uso neste tema</p>
            <div className="flex max-w-[13rem] flex-wrap gap-1">
              {otherColors.map((hex) => (
                <button
                  key={hex}
                  type="button"
                  title={hex.toUpperCase()}
                  onClick={() => applyQuickPick(hex)}
                  className="h-5 w-5 shrink-0 rounded-full border border-border shadow-sm transition-transform hover:scale-110"
                  style={{ backgroundColor: hex }}
                />
              ))}
            </div>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

/**
 * Single color swatch (used for the product-grid rows, where bg/text aren't a
 * pair). Manages its own open state since these rows don't need to be mutually
 * exclusive with a sibling.
 */
export function ColorSwatchField({
  value,
  label,
  onCommit,
  palette,
  disabled,
  className,
}: {
  value: string;
  label: string;
  onCommit: (value: string) => void;
  palette?: string[];
  disabled?: boolean;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className={cn('relative', disabled && 'pointer-events-none opacity-50')}>
      <ColorPickerPopover
        value={value}
        label={label}
        onCommit={onCommit}
        palette={palette}
        open={open}
        onOpenChange={setOpen}
        trigger={({ color }) => (
          <button
            type="button"
            title={label}
            aria-label={label}
            className={cn('h-9 w-12 shrink-0 cursor-pointer rounded border shadow-sm transition-transform hover:scale-105', className)}
            style={{ backgroundColor: color }}
          />
        )}
      />
    </div>
  );
}

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
  palette,
}: {
  icon: React.ReactNode;
  title: string;
  description?: string;
  bgColor: string;
  textColor: string;
  onBgChange: (value: string) => void;
  onTextChange: (value: string) => void;
  disabled?: boolean;
  palette?: string[];
}) {
  return (
    <div className="flex w-full items-center gap-2 rounded-lg border p-3">
      <span className="shrink-0 text-muted-foreground">{icon}</span>
      <div className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium">{title}</span>
        {description && <span className="block text-xs text-muted-foreground">{description}</span>}
      </div>
      <SectionColorSwatches
        bgColor={bgColor}
        textColor={textColor}
        onBgChange={onBgChange}
        onTextChange={onTextChange}
        disabled={disabled}
        palette={palette}
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
 * Benefícios, Categorias, Mini banners, Novidades). Each swatch opens a popover
 * with an editable hex code, a copy button and quick-picks from colors already
 * used in the theme; a value only commits when its popover closes or a quick-pick
 * is clicked, so dragging around the color wheel doesn't fire a save per pixel.
 */
export function SectionColorSwatches({
  bgColor,
  textColor,
  onBgChange,
  onTextChange,
  disabled,
  palette,
}: {
  bgColor: string;
  textColor: string;
  onBgChange: (value: string) => void;
  onTextChange: (value: string) => void;
  disabled?: boolean;
  palette?: string[];
}) {
  const [open, setOpen] = useState<'bg' | 'text' | null>(null);
  const lowContrast = getContrastRatio(bgColor, textColor) < 3;

  return (
    <div className={cn('flex items-center gap-1.5 shrink-0', disabled && 'opacity-50 pointer-events-none')}>
      {lowContrast && (
        <span title="Contraste baixo entre fundo e texto — pode ficar difícil de ler" className="text-amber-500">
          <AlertTriangle className="h-3.5 w-3.5" />
        </span>
      )}
      <ColorPickerPopover
        value={bgColor}
        label="Cor de fundo"
        onCommit={onBgChange}
        palette={palette}
        open={open === 'bg'}
        onOpenChange={(o) => setOpen(o ? 'bg' : null)}
        trigger={({ color }) => (
          <button
            type="button"
            title="Cor de fundo da seção"
            className="h-5 w-5 rounded-full border border-border shadow-sm transition-transform hover:scale-110"
            style={{ backgroundColor: color }}
          />
        )}
      />
      <ColorPickerPopover
        value={textColor}
        label="Cor do texto"
        onCommit={onTextChange}
        palette={palette}
        open={open === 'text'}
        onOpenChange={(o) => setOpen(o ? 'text' : null)}
        trigger={({ color }) => (
          <button
            type="button"
            title="Cor do texto da seção"
            className="h-5 w-5 rounded-full border border-border shadow-sm flex items-center justify-center text-[9px] font-bold leading-none transition-transform hover:scale-110"
            style={{ backgroundColor: color, color: bgColor }}
          >
            A
          </button>
        )}
      />
    </div>
  );
}
