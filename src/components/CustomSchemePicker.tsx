/**
 * @fileoverview Custom colour-scheme dropdown — PREVIEW, non-production only.
 *
 * Shown by ThemeToggle under its buttons while "Custom" is selected. Each
 * entry is one palette in one mode (see src/themes/palettes.ts); picking one
 * re-colours the whole app at once so testers can compare readability.
 */

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { COLOUR_SCHEMES, type ColourScheme } from '@/themes/palettes';

interface CustomSchemePickerProps {
  /** The scheme currently shown. */
  scheme: ColourScheme;
  /** Called with the newly picked scheme. */
  onChange: (scheme: ColourScheme) => void;
}

/**
 * Dropdown of custom schemes, with the chosen scheme's one-line description.
 */
export function CustomSchemePicker({ scheme, onChange }: CustomSchemePickerProps) {
  const choose = (id: string) => {
    const next = COLOUR_SCHEMES.find((s) => s.id === id);
    if (next) onChange(next);
  };

  return (
    <div className="space-y-2">
      <Label htmlFor="custom-scheme-picker">Colour scheme (preview)</Label>
      <Select value={scheme.id} onValueChange={choose}>
        <SelectTrigger id="custom-scheme-picker" className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {COLOUR_SCHEMES.map((s) => (
            <SelectItem key={s.id} value={s.id}>
              {s.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <p className="text-sm text-muted-foreground">{scheme.description}</p>
    </div>
  );
}
