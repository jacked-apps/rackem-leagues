/**
 * @fileoverview Guards Ed's rule for custom colour schemes (2026-10-29):
 * "changing themes or adding new themes should not change the other themes at
 * all." Light, Dark and System are the standard looks and must stay exactly as
 * they are; a scheme may only change things while it is the active scheme.
 *
 * Checked here for the CSS side: every rule in a scheme file is scoped to its
 * own `data-palette` value, and every scheme in the picker has its file. (The
 * component side follows the same rule by only using `[[data-palette]_&]:`
 * classes for scheme-specific looks — see scoreboardColors.ts.)
 */

import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { COLOUR_SCHEMES } from './palettes';

// Read from disk: vitest's CSS handling turns `?raw` CSS imports into ''.
const dir = join(process.cwd(), 'src', 'themes');
const read = (name: string) => readFileSync(join(dir, name), 'utf8');
const imports = read('palettes.css');
const files = readdirSync(dir)
  .filter((name) => name.endsWith('.css') && name !== 'palettes.css')
  .map((name) => [`./${name}`, read(name)] as const);

/** Every selector in a CSS file (comments stripped). */
function selectors(css: string): string[] {
  const code = css.replace(/\/\*[\s\S]*?\*\//g, '');
  return [...code.matchAll(/([^{}]+)\{/g)].map((m) => m[1].trim());
}

describe('custom colour schemes stay inside their own scheme', () => {
  it.each(files)('%s scopes every rule to its own data-palette', (path, css) => {
    const id = path.replace('./', '').replace('.css', '');
    const found = selectors(css);
    expect(found.length).toBeGreaterThan(0);
    for (const selector of found) {
      expect(selector).toBe(`:root[data-palette='${id}']`);
    }
  });

  it.each(COLOUR_SCHEMES.map((s) => s.id))('scheme "%s" has its file, imported', (id) => {
    expect(files.map(([path]) => path)).toContain(`./${id}.css`);
    expect(imports).toContain(`@import './${id}.css';`);
  });
});
