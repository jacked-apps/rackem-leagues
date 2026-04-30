/**
 * @fileoverview Theme toggle control for switching between light, dark, and system themes.
 *
 * Renders a three-way segmented toggle using shadcn Button components.
 * Designed to sit inside the AppDrawer navigation surface. Uses `next-themes`
 * to read and set the current theme, which persists the choice in localStorage.
 */

import { useTheme } from 'next-themes';
import { Sun, Moon, Monitor } from 'lucide-react';
import { Button } from '@/components/ui/button';

/** The three theme options exposed by next-themes. */
const THEME_OPTIONS = [
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark', label: 'Dark', icon: Moon },
  { value: 'system', label: 'System', icon: Monitor },
] as const;

/**
 * Three-way theme toggle — Light / Dark / System.
 *
 * The active option gets `default` variant styling; inactive options use `ghost`.
 * Compact enough to sit in a drawer section without dominating the layout.
 */
export function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  return (
    <div className="flex items-center gap-1 rounded-lg border p-1">
      {THEME_OPTIONS.map(({ value, label, icon: Icon }) => (
        <Button
          key={value}
          type="button"
          variant={theme === value ? 'default' : 'ghost'}
          size="sm"
          loadingText="none"
          onClick={() => setTheme(value)}
          className="flex-1 gap-1.5"
          aria-label={`Switch to ${label} theme`}
        >
          <Icon className="h-4 w-4" />
          <span className="text-xs">{label}</span>
        </Button>
      ))}
    </div>
  );
}
