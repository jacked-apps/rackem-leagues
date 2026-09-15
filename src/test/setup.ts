/**
 * @fileoverview Global test setup
 * Runs before all tests to configure the testing environment
 */
import { expect, afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';
import * as matchers from '@testing-library/jest-dom/matchers';

// Extend Vitest's expect with jest-dom matchers
expect.extend(matchers);

// Cleanup after each test
afterEach(() => {
  cleanup();
});

// Mock localStorage for tests
const localStorageMock = (() => {
  let store: Record<string, string> = {};

  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value.toString();
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
  };
})();

global.localStorage = localStorageMock as Storage;

// Mock window.confirm for tests
global.confirm = () => true;

// Suppress console errors during tests (optional)
// Uncomment if tests are too noisy
// global.console = {
//   ...console,
//   error: vi.fn(),
//   warn: vi.fn(),
// };

// ---------------------------------------------------------------------------
// DOM APIs that Radix primitives call and the test DOM does not implement.
//
// Radix (shadcn's Select, Dialog, Popover…) drives its open/close on pointer
// events and calls these during interaction. jsdom and happy-dom implement
// neither pointer capture nor scrollIntoView, so a `userEvent.click` on a
// Select trigger throws or silently fails to open — the menu never renders and
// the test fails claiming the option does not exist, which sends you looking
// for a bug in the component instead of a gap in the environment.
//
// No-ops are correct here: nothing under test depends on real capture or
// scrolling, only on the calls not exploding.
// ---------------------------------------------------------------------------
if (typeof Element !== 'undefined') {
  Element.prototype.hasPointerCapture ??= () => false;
  Element.prototype.setPointerCapture ??= () => {};
  Element.prototype.releasePointerCapture ??= () => {};
  Element.prototype.scrollIntoView ??= () => {};
}

// Radix measures its content with ResizeObserver, which happy-dom lacks.
if (!('ResizeObserver' in globalThis)) {
  (globalThis as unknown as Record<string, unknown>).ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}
