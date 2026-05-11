#!/usr/bin/env node
/**
 * Generates environment-specific PWA + apple-touch-icon PNGs by rasterizing
 * the staging and dev favicon SVGs at the sizes iOS and Android expect.
 *
 * Outputs:
 *   public/icons-staging/icon-192.png
 *   public/icons-staging/icon-512.png
 *   public/icons-staging/apple-touch-icon.png
 *   public/icons-dev/<same>
 *
 * Run once when the favicon SVGs change. Intentionally NOT part of the
 * default build — the outputs are committed to the repo so production
 * builds don't need the rasterizer installed.
 *
 * Usage:  node scripts/generate-env-icons.mjs
 */

import { Resvg } from '@resvg/resvg-js';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, '..');

const sizes = [
  { name: 'icon-192.png', width: 192 },
  { name: 'icon-512.png', width: 512 },
  { name: 'apple-touch-icon.png', width: 180 },
];

const envs = [
  { env: 'staging', svg: 'public/favicon-staging.svg', outDir: 'public/icons-staging' },
  { env: 'development', svg: 'public/favicon-dev.svg', outDir: 'public/icons-dev' },
];

for (const { env, svg, outDir } of envs) {
  const svgPath = resolve(projectRoot, svg);
  const outAbs = resolve(projectRoot, outDir);
  const svgContent = await readFile(svgPath, 'utf8');
  await mkdir(outAbs, { recursive: true });

  for (const { name, width } of sizes) {
    const resvg = new Resvg(svgContent, { fitTo: { mode: 'width', value: width } });
    const png = resvg.render().asPng();
    const outPath = resolve(outAbs, name);
    await writeFile(outPath, png);
    console.log(`[${env}] wrote ${outDir}/${name} (${width}x${width})`);
  }
}

console.log('Done.');
