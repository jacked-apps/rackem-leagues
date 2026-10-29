/**
 * @fileoverview Type declarations for Vitest with jest-dom matchers
 * Extends Vitest's Assertion interface to include jest-dom matchers
 */
import type { TestingLibraryMatchers } from '@testing-library/jest-dom/matchers';
import 'vitest';

declare module 'vitest' {
  // Module augmentation: these must stay (empty) interfaces so they merge
  // into Vitest's own declarations — a type alias can't do that.
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type, @typescript-eslint/no-explicit-any
  interface Assertion<T = any> extends TestingLibraryMatchers<T, void> {}
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  interface AsymmetricMatchersContaining extends TestingLibraryMatchers {}
}
