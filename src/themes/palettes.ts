/**
 * @fileoverview Colour palettes layered on top of light / dark mode — PREVIEW.
 *
 * Light vs dark is chosen by next-themes (the `dark` class on <html>). A
 * palette is a second, independent choice: it sets `data-palette` on <html>,
 * and the matching file in this folder overrides theme tokens from
 * src/index.css, with its own light AND dark values. So every palette can be
 * viewed in both modes.
 *
 * GATED: palettes exist so Ed (and others) can compare readability across the
 * whole app before anything is chosen. Outside production only — the picker
 * on the Profile page and the start-up sync both check `isProduction`.
 * Listed in LIST_FOR_ED.md under "Gated".
 */

import { isProduction } from '@/config/environment';

/** One selectable palette. `id` matches the `data-palette` value in its CSS file. */
export interface Palette {
  id: string;
  label: string;
  /** One line shown under the picker, so testers know what to look for. */
  description: string;
}

/** Every palette. 'standard' means no override: the plain index.css tokens. */
export const PALETTES: readonly Palette[] = [
  { id: 'standard', label: 'Standard', description: 'The current look.' },
  { id: 'high-contrast', label: 'High Contrast', description: 'Darker text and stronger borders; true black in dark mode.' },
  { id: 'blue-gold', label: 'Blue & Gold', description: 'Standard page; away team is gold instead of orange.' },
  { id: 'felt', label: 'Felt', description: 'Pool-table green page; away team is amber.' },
];

const STORAGE_KEY = 'rackem-palette';

/** Palettes are a preview: switched off entirely in production. */
export const palettesEnabled = !isProduction;

/** The stored palette id, or 'standard' when none is stored or storage is blocked. */
export function readPalette(): string {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return PALETTES.some((p) => p.id === stored) ? (stored as string) : 'standard';
  } catch {
    return 'standard';
  }
}

/**
 * Show a palette now and remember it on this device.
 *
 * @param id - A palette id from PALETTES
 */
export function applyPalette(id: string): void {
  const root = document.documentElement;
  if (id === 'standard') delete root.dataset.palette;
  else root.dataset.palette = id;
  try {
    localStorage.setItem(STORAGE_KEY, id);
  } catch {
    // Storage blocked (private window): the palette still shows, just isn't remembered.
  }
}
