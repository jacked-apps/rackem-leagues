/**
 * @fileoverview Every waiting note file has the shape the page and the stamp
 * expect. A malformed note caught here is caught on our side, before it can
 * trip the stamp inside Jack's `npm version`.
 */

import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const NOTES_DIR = join(process.cwd(), 'src', 'whatsNew', 'notes');
const KINDS = ['feature', 'improvement', 'fix'];
const KEYS = ['text', 'kind', 'forOperators', 'headline'];

/** What's wrong with one note, or [] when it's fine. */
function problems(note: Record<string, unknown>): string[] {
  const found: string[] = [];
  if (typeof note.text !== 'string' || !note.text.trim()) found.push('text must be non-empty');
  if (note.kind !== undefined && !KINDS.includes(note.kind as string)) found.push(`bad kind ${String(note.kind)}`);
  if (note.forOperators !== undefined && typeof note.forOperators !== 'boolean') found.push('forOperators must be true/false');
  if (note.headline !== undefined && typeof note.headline !== 'string') found.push('headline must be text');
  for (const key of Object.keys(note)) if (!KEYS.includes(key)) found.push(`unknown field ${key}`);
  return found;
}

describe('What\'s New note files', () => {
  it('the shape check catches a broken note', () => {
    expect(problems({ text: 'Fine.', kind: 'fix', headline: 'a fix' })).toEqual([]);
    expect(problems({ text: '', kind: 'bugfix', colour: 'red' })).toHaveLength(3);
  });

  it('every waiting note is well formed', () => {
    const files = readdirSync(NOTES_DIR).filter((f) => f.endsWith('.json'));
    for (const file of files) {
      const parsed: unknown = JSON.parse(readFileSync(join(NOTES_DIR, file), 'utf8'));
      const notes = (Array.isArray(parsed) ? parsed : [parsed]) as Record<string, unknown>[];
      expect(notes.length, file).toBeGreaterThan(0);
      for (const n of notes) expect(problems(n), file).toEqual([]);
    }
  });
});
