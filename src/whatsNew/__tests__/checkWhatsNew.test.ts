/**
 * @fileoverview The PR check behind "every PR answers the What's New question".
 *
 * The case that matters most is the release PR: it's Jack's, and a release
 * with nothing user-facing to say must pass without him doing anything
 * (docs/plans/2026-11-01-001-fix-whats-new-zero-step-release-plan.md).
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const SCRIPT = join(process.cwd(), 'scripts', 'check-whats-new.mjs');

let dir: string;

/** Run the check on a PR; returns its exit code. */
function check(changed: string[], body = '', versions: [string, string] = ['1.0.0', '1.0.0']) {
  writeFileSync(join(dir, 'changed.txt'), changed.join('\n'));
  writeFileSync(join(dir, 'body.txt'), body);
  writeFileSync(join(dir, 'base-package.json'), JSON.stringify({ version: versions[0] }));
  writeFileSync(join(dir, 'package.json'), JSON.stringify({ version: versions[1] }));
  return spawnSync('node', [SCRIPT, 'changed.txt', 'body.txt', 'base-package.json'], { cwd: dir })
    .status;
}

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'check-'));
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));

describe('check-whats-new', () => {
  it('passes a PR that adds a note file', () => {
    expect(check(['src/App.tsx', 'src/whatsNew/notes/fix-thing.json'])).toBe(0);
  });

  it('passes a PR that opts out', () => {
    expect(check(['src/App.tsx'], 'refactor [no-changelog]')).toBe(0);
  });

  it('passes a release PR with no notes at all', () => {
    expect(check(['package.json', 'package-lock.json'], '', ['1.12.0', '1.13.0'])).toBe(0);
  });

  it('fails a PR that changes package.json but not the version, with no note', () => {
    expect(check(['package.json', 'src/App.tsx'])).toBe(1);
  });

  it('fails a PR that only touches the notes README', () => {
    expect(check(['src/whatsNew/notes/README.md'])).toBe(1);
  });
});
