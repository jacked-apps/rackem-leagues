/**
 * @fileoverview Guards "a theme reaches every screen" (Ed, 2026-11-01).
 *
 * A colour scheme can only recolour what is built on theme tokens
 * (`bg-info/10`, `text-success`, `border-warning/40`, `bg-card`, …, defined
 * in src/index.css and overridden per scheme in src/themes/). A fixed
 * Tailwind colour such as `bg-blue-50` or `text-red-600` ignores every
 * scheme, so that spot keeps the standard colours whatever theme is picked.
 *
 * This test fails when a fixed colour class appears in app code. Use the
 * matching meaning token instead (see the header of src/themes/palettes.ts):
 * blue → info, green → success, amber/yellow/orange → warning,
 * red → destructive, purple → highlight, gray → muted.
 *
 * Allowed on purpose (see ALLOWED_FILES): things whose colour IS the content
 * (pool-ball icons, the gold coin, the Google logo, printed QR posters), the staging/prod
 * environment banner (must never be themed away), and dev-only pages.
 * Dark see-through overlays behind pop-ups (`bg-black/50`) are allowed too.
 */

import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

const SRC = join(process.cwd(), 'src');

/** Files whose fixed colours are deliberate, with the reason. */
const ALLOWED_FILES: Record<string, string> = {
  'src/components/icons/': 'pool-ball colours are the real ball colours',
  'src/components/coinflip/Coin.tsx': 'the coin face is gold — the colour is the coin',
  'src/login/Login.tsx': 'Google sign-in button uses Google brand colours',
  'src/login/Register.tsx': 'Google sign-in button uses Google brand colours',
  'src/brackets/paid/JoinQrPoster.tsx': 'printed poster — fixed black on white',
  'src/brackets/paid/qrExport.ts': 'exported QR image — fixed black on white',
  'src/config/environment.ts': 'staging/prod banner must never be themed away',
  'src/dev/': 'developer-only pages, never shown to users',
};

const FAMILIES =
  'slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose|white|black';
const UTILITIES = 'bg|text|border|ring|from|to|via|fill|stroke|divide|outline|decoration|placeholder|shadow|caret';
const FIXED = new RegExp(`(?<![\\w-])(?:${UTILITIES})-(?:${FAMILIES})(?:-\\d{2,3})?(?:/\\d+)?(?![\\w-])`, 'g');
/** See-through dark overlays behind dialogs/photos — not a themed surface. */
const OVERLAY = /^bg-black\/\d+$/;

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) return walk(full);
    return /\.(tsx?|jsx?)$/.test(name) && !/\.test\./.test(name) ? [full] : [];
  });
}

const allowed = (path: string) => Object.keys(ALLOWED_FILES).some((p) => path.startsWith(p));

describe('every screen follows the theme', () => {
  it('uses theme tokens, not fixed Tailwind colours', () => {
    const offenders: string[] = [];
    for (const full of walk(SRC)) {
      const path = relative(process.cwd(), full).split(sep).join('/');
      if (allowed(path)) continue;
      readFileSync(full, 'utf8')
        .split('\n')
        .forEach((line, i) => {
          for (const [cls] of line.matchAll(FIXED)) {
            if (!OVERLAY.test(cls)) offenders.push(`${path}:${i + 1}  ${cls}`);
          }
        });
    }
    expect(offenders, `Fixed colours ignore themes — use a token:\n${offenders.join('\n')}`).toEqual([]);
  });
});
