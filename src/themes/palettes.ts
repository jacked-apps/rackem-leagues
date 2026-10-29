/**
 * @fileoverview Custom colour schemes — the fourth theme choice beside
 * Light / Dark / System. PREVIEW.
 *
 * Light vs dark is chosen by next-themes (the `dark` class on <html>). A
 * custom scheme is one complete look built on one mode: picking it sets
 * `data-palette` on <html> (the matching CSS file in this folder overrides
 * index.css tokens) AND switches next-themes to that mode. Picking Light, Dark or
 * System clears the scheme, so those three are always the standard look.
 *
 * GATED: schemes exist so Ed (and others) can compare readability across the
 * whole app before anything is chosen. Outside production only — the Custom
 * option in ThemeToggle and the start-up apply in main.tsx both check
 * `palettesEnabled`. Listed in LIST_FOR_ED.md under "Gated".
 */

import { isProduction } from '@/config/environment';

/**
 * One selectable custom scheme: a single, complete look. Ed (2026-10-29): no
 * light and dark versions — forcing every palette into both modes made some
 * of them look wrong. Each scheme is built on ONE mode instead.
 */
export interface ColourScheme {
  /** Stored id; also the `data-palette` value its CSS file targets. */
  id: string;
  /** The next-themes mode the scheme is built on (sets the `dark:` utilities). */
  mode: 'light' | 'dark';
  label: string;
  /** One line shown under the picker, so testers know what to look for. */
  description: string;
}

/**
 * Every custom scheme, in picker order. One CSS file each in this folder.
 * Pastel first — it's what "Custom" opens on (the first entry), and the
 * favourite so far; High Contrast last as the harshest, for specific needs.
 */
export const COLOUR_SCHEMES: readonly ColourScheme[] = [
  { id: 'pastel', mode: 'light', label: 'Pastel', description: 'Soft blush page, lavender buttons, periwinkle home and peach away panels.' },
  { id: 'blue-gold', mode: 'dark', label: 'Blue & Gold', description: 'Navy page, gold buttons, navy home and gold away panels.' },
  { id: 'felt', mode: 'dark', label: 'Felt', description: 'Felt-green page, green buttons, felt-green home and cue-ball away panels.' },
  { id: 'strawberry-cream', mode: 'light', label: 'Strawberry & Cream', description: 'Cream page, strawberry buttons, strawberry home and cream away panels.' },
  { id: 'high-contrast', mode: 'light', label: 'High Contrast', description: 'Black and white: black home and white away panels, strongest text.' },
];

const STORAGE_KEY = 'rackem-colour-scheme';

/** Custom schemes are a preview: switched off entirely in production. */
export const palettesEnabled = !isProduction;

/** The stored custom scheme, or null when Light / Dark / System is in use. */
export function readScheme(): ColourScheme | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return COLOUR_SCHEMES.find((s) => s.id === stored) ?? null;
  } catch {
    return null;
  }
}

/**
 * Show a custom scheme's colours now (or clear them with null) and remember
 * the choice on this device. The caller switches next-themes to `scheme.mode`.
 *
 * @param scheme - A scheme from COLOUR_SCHEMES, or null for the standard look
 */
export function applyScheme(scheme: ColourScheme | null): void {
  const root = document.documentElement;
  if (scheme) root.dataset.palette = scheme.id;
  else delete root.dataset.palette;
  try {
    if (scheme) localStorage.setItem(STORAGE_KEY, scheme.id);
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Storage blocked (private window): the colours still show, just aren't remembered.
  }
}
