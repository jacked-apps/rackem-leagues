/**
 * @fileoverview Guards the service worker's update path.
 *
 * This is a source-level assertion rather than a behavioural test, and that's
 * deliberate — the failure it guards against is invisible by every other means.
 *
 * `updateServiceWorker(true)` (the "Update Now" button) posts a SKIP_WAITING
 * message to the waiting worker and waits for `controllerchange` before
 * reloading. If `src/sw.ts` doesn't listen for that message, the worker sits in
 * `waiting` forever, `controllerchange` never fires, and the app can NEVER
 * update — on every device, permanently, with no error anywhere.
 *
 * vite-plugin-pwa injects this handler under `generateSW`. It does NOT under
 * `injectManifest`, which we use so we can write our own push handlers. It went
 * missing when we made that switch and stayed missing until 2026-09-05; nothing
 * caught it because every test, typecheck and build passed the whole time. The
 * only symptom was a button that did nothing.
 *
 * If this test fails, do not delete it — the app cannot ship updates without
 * what it's checking.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const sw = readFileSync(resolve(process.cwd(), 'src/sw.ts'), 'utf8');

describe('service worker update path', () => {
  it('listens for the SKIP_WAITING message', () => {
    expect(sw).toMatch(/addEventListener\(\s*['"]message['"]/);
    expect(sw).toContain('SKIP_WAITING');
  });

  it('calls skipWaiting when it receives that message', () => {
    expect(sw).toMatch(/skipWaiting\(\)/);
  });

  it('claims open pages on activate, so the reload is served by the new worker', () => {
    // Without this the page can reload and still be served by the OUTGOING
    // worker — it looks like the update was applied and nothing changed.
    expect(sw).toMatch(/clients\.claim\(\)/);
  });
});
