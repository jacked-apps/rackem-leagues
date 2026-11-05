/**
 * @fileoverview Lists the files `tsconfig.app.json` leaves out of the build,
 * for `importPaths.test.ts`. The path logic itself lives in
 * `scripts/reorg/paths.ts`, shared with the reorg move script.
 */

import { readdirSync } from 'node:fs';
import { join } from 'node:path';

export { extractLocalSpecifiers, findBrokenPaths, resolveSpecifier } from '../../../scripts/reorg/paths';

/**
 * The source files the build skips: everything under `src/__tests__/` and
 * `src/test/`, plus every `*.test.ts(x)`.
 *
 * @param root - Repo root on disk.
 * @returns Repo-relative paths with forward slashes.
 */
export function listBuildSkippedFiles(root: string): string[] {
  const out: string[] = [];
  const walk = (rel: string) => {
    for (const entry of readdirSync(join(root, rel), { withFileTypes: true })) {
      const child = `${rel}/${entry.name}`;
      if (entry.isDirectory()) walk(child);
      else if (/\.(ts|tsx)$/.test(entry.name) && isBuildSkipped(child)) out.push(child);
    }
  };
  walk('src');
  return out.sort();
}

function isBuildSkipped(rel: string): boolean {
  return rel.startsWith('src/__tests__/') || rel.startsWith('src/test/') || /\.test\.tsx?$/.test(rel);
}
