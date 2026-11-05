/**
 * @fileoverview Theme toggle — Light / Dark / System, plus Custom (preview).
 *
 * Renders a segmented toggle using shadcn Button components on the Profile
 * page. Light / Dark / System go through `next-themes`, which persists the
 * choice in localStorage. "Custom" (non-production only, see
 * src/themes/palettes.ts) opens a dropdown of colour schemes; a scheme sets
 * its own colours AND switches next-themes to its light or dark mode.
 * Picking Light / Dark / System clears any custom scheme, so those three are
 * always the standard look.
 */

import { useState } from 'react';
import { useTheme } from 'next-themes';
import { Sun, Moon, Monitor, Palette } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { CustomSchemePicker } from '@/components/CustomSchemePicker';
import { COLOUR_SCHEMES, applyScheme, palettesEnabled, readScheme, type ColourScheme } from '@/themes/palettes';

/** The three standard theme options exposed by next-themes. */
const THEME_OPTIONS = [
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark', label: 'Dark', icon: Moon },
  { value: 'system', label: 'System', icon: Monitor },
] as const;

/**
 * Theme toggle — Light / Dark / System (+ Custom outside production).
 *
 * The active option gets `default` variant styling; inactive options use `ghost`.
 * Compact enough to sit in a drawer section without dominating the layout.
 */
export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [scheme, setScheme] = useState<ColourScheme | null>(() => (palettesEnabled ? readScheme() : null));

  /** Light / Dark / System: back to the standard colours. */
  const chooseStandard = (value: string) => {
    applyScheme(null);
    setScheme(null);
    setTheme(value);
  };

  /** A custom scheme: its colours plus its mode. */
  const chooseScheme = (next: ColourScheme) => {
    applyScheme(next);
    setScheme(next);
    setTheme(next.mode);
  };

  const buttonProps = { type: 'button', size: 'sm', loadingText: 'none', className: 'flex-1 gap-1.5' } as const;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-1 rounded-lg border p-1">
        {THEME_OPTIONS.map(({ value, label, icon: Icon }) => (
          <Button
            key={value}
            {...buttonProps}
            variant={!scheme && theme === value ? 'default' : 'ghost'}
            onClick={() => chooseStandard(value)}
            aria-label={`Switch to ${label} theme`}
          >
            <Icon className="h-4 w-4" />
            <span className="text-xs">{label}</span>
          </Button>
        ))}
        {/* Custom — gated non-production with the rest of the scheme preview */}
        {palettesEnabled && (
          <Button
            {...buttonProps}
            variant={scheme ? 'default' : 'ghost'}
            onClick={() => chooseScheme(scheme ?? COLOUR_SCHEMES[0])}
            aria-label="Switch to a custom colour scheme"
          >
            <Palette className="h-4 w-4" />
            <span className="text-xs">Custom</span>
          </Button>
        )}
      </div>
      {scheme && <CustomSchemePicker scheme={scheme} onChange={chooseScheme} />}
    </div>
  );
}
