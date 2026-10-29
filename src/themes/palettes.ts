/**
 * @fileoverview Custom colour schemes — the fourth theme choice beside
 * Light / Dark / System. PREVIEW.
 *
 * Light vs dark is chosen by next-themes (the `dark` class on <html>). A
 * custom scheme is one palette in one mode: picking it sets `data-palette` on
 * <html> (the matching CSS file in this folder overrides index.css tokens)
 * AND switches next-themes to that scheme's mode. Picking Light, Dark or
 * System clears the scheme, so those three are always the standard look.
 *
 * GATED: schemes exist so Ed (and others) can compare readability across the
 * whole app before anything is chosen. Outside production only — the Custom
 * option in ThemeToggle and the start-up apply in main.tsx both check
 * `palettesEnabled`. Listed in LIST_FOR_ED.md under "Gated".
 */

import { isProduction } from '@/config/environment';

/** One selectable custom scheme: a palette shown in one mode. */
export interface ColourScheme {
  /** Stored id, e.g. 'felt-dark'. */
  id: string;
  /** The `data-palette` value its CSS file targets. */
  palette: string;
  /** The next-themes mode it switches to. */
  mode: 'light' | 'dark';
  label: string;
  /** One line shown under the picker, so testers know what to look for. */
  description: string;
}

const PALETTE_INFO = [
  { palette: 'high-contrast', label: 'High Contrast', description: 'Black and white: black home and white away panels, strongest text.' },
  { palette: 'blue-gold', label: 'Blue & Gold', description: 'Gold buttons, navy home and gold away panels.' },
  { palette: 'felt', label: 'Felt', description: 'Green buttons, felt-green home and cue-ball away panels.' },
] as const;

/** Every custom scheme: each palette in light, then dark. */
export const COLOUR_SCHEMES: readonly ColourScheme[] = PALETTE_INFO.flatMap((p) =>
  (['light', 'dark'] as const).map((mode) => ({
    id: `${p.palette}-${mode}`,
    palette: p.palette,
    mode,
    label: `${p.label} — ${mode === 'light' ? 'Light' : 'Dark'}`,
    description: p.description,
  })),
);

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
  if (scheme) root.dataset.palette = scheme.palette;
  else delete root.dataset.palette;
  try {
    if (scheme) localStorage.setItem(STORAGE_KEY, scheme.id);
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Storage blocked (private window): the colours still show, just aren't remembered.
  }
}
