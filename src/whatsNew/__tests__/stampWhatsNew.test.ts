/**
 * @fileoverview The release stamp runs unattended inside Jack's `npm version`,
 * so it must never be what breaks a release (Ed, 2026-11-01: Jack should never
 * have to remember an extra step or untangle anything).
 *
 * Each test runs the real script against a throwaway copy of the REAL
 * releases.ts. A change on main that would make the stamp fail (the marker
 * deleted, the block shape changed) fails here first, on our side.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { execFileSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import ts from 'typescript';

const ROOT = process.cwd();
const SCRIPT = join(ROOT, 'scripts', 'stamp-whats-new.mjs');
const MARKER = '// STAMP: new releases are inserted directly below this line. Keep it.';

let dir: string;
const releases = () => readFileSync(join(dir, 'src/whatsNew/releases.ts'), 'utf8');
const note = (name: string, body: unknown) =>
  writeFileSync(join(dir, 'src/whatsNew/notes', name), JSON.stringify(body));
const stamp = () => execFileSync('node', [SCRIPT], { cwd: dir, encoding: 'utf8' });

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'stamp-'));
  mkdirSync(join(dir, 'src/whatsNew/notes'), { recursive: true });
  cpSync(join(ROOT, 'src/whatsNew/releases.ts'), join(dir, 'src/whatsNew/releases.ts'));
  writeFileSync(join(dir, 'src/whatsNew/notes/README.md'), 'keep me');
  writeFileSync(join(dir, 'package.json'), JSON.stringify({ version: '99.0.0' }));
});

afterEach(() => rmSync(dir, { recursive: true, force: true }));

describe('stamp-whats-new', () => {
  it('folds every note into a dated block under the marker and removes the files', () => {
    note('a-feat-stats.json', [
      { text: "You can see who you've played.", kind: 'feature', headline: 'my stats' },
      { text: 'Filters for venue.', forOperators: true },
    ]);
    note('b-fix-block.json', { text: 'Blocking works.', kind: 'fix', headline: 'blocking in Messages' });

    stamp();
    const out = releases();

    const block = out.slice(out.indexOf(MARKER));
    expect(block).toMatch(/version: '99\.0\.0',\n\s+date: '\d{4}-\d{2}-\d{2}',/);
    expect(block).toContain("summary: 'My stats and blocking in Messages',");
    expect(block).toContain("text: 'You can see who you\\'ve played.',");
    expect(block).toContain('forOperators: true,');
    expect(block.indexOf('99.0.0')).toBeLessThan(block.indexOf("version: '1.12.0'"));

    // Still valid TypeScript, so the build after the release can't break.
    const { diagnostics } = ts.transpileModule(out, { reportDiagnostics: true });
    expect(diagnostics).toEqual([]);

    expect(existsSync(join(dir, 'src/whatsNew/notes/a-feat-stats.json'))).toBe(false);
    expect(existsSync(join(dir, 'src/whatsNew/notes/b-fix-block.json'))).toBe(false);
    expect(existsSync(join(dir, 'src/whatsNew/notes/README.md'))).toBe(true);
  });

  it('uses a plain summary when no note has a headline', () => {
    note('fix.json', { text: 'A small fix.', kind: 'fix' });
    stamp();
    expect(releases()).toContain("summary: 'Fixes and improvements',");
  });

  it('succeeds and changes nothing when no notes are waiting', () => {
    const before = releases();
    expect(stamp()).toContain('nothing to stamp');
    expect(releases()).toBe(before);
  });

  it('succeeds and keeps the notes when the version is already stamped', () => {
    writeFileSync(join(dir, 'package.json'), JSON.stringify({ version: '1.12.0' }));
    note('fix.json', { text: 'A small fix.' });
    const before = releases();
    expect(stamp()).toContain('already stamped');
    expect(releases()).toBe(before);
    expect(existsSync(join(dir, 'src/whatsNew/notes/fix.json'))).toBe(true);
  });

  it('keeps Windows line endings intact', () => {
    writeFileSync(join(dir, 'src/whatsNew/releases.ts'), releases().replace(/\n/g, '\r\n'));
    note('fix.json', { text: 'A small fix.' });
    stamp();
    expect(releases().replace(/\r\n/g, '')).not.toContain('\n');
  });
});
