/**
 * @fileoverview Colour-palette picker — PREVIEW, non-production only.
 *
 * Sits under the Light / Dark / System toggle on the Profile page. Picking a
 * palette re-colours the whole app at once (see src/themes/palettes.ts), so
 * testers can walk around and compare readability in both modes. The parent
 * renders it only when `palettesEnabled` is true.
 */

import { useState } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { PALETTES, applyPalette, readPalette } from '@/themes/palettes';

/**
 * Dropdown of colour palettes, with the chosen palette's one-line description.
 */
export function PalettePicker() {
  const [palette, setPalette] = useState(readPalette);
  const current = PALETTES.find((p) => p.id === palette);

  const choose = (id: string) => {
    applyPalette(id);
    setPalette(id);
  };

  return (
    <div className="space-y-2">
      <Label htmlFor="palette-picker">Colour palette (preview)</Label>
      <Select value={palette} onValueChange={choose}>
        <SelectTrigger id="palette-picker" className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {PALETTES.map((p) => (
            <SelectItem key={p.id} value={p.id}>
              {p.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {current && <p className="text-sm text-muted-foreground">{current.description}</p>}
    </div>
  );
}
