/**
 * @fileoverview Unit tests for the smart-auto-scroll DOM helpers in
 * scrollHelpers.ts. Both functions are pure-DOM-read with no side
 * effects, so the tests just construct element shapes and assert
 * the calculation / lookup.
 */

// @vitest-environment jsdom

import { describe, it, expect } from 'vitest';
import { findScrollParent, isNearBottom } from '../scrollHelpers';

describe('isNearBottom', () => {
  it('returns true when scrolled to bottom exactly', () => {
    const el = {
      scrollHeight: 1000,
      scrollTop: 500,
      clientHeight: 500,
    } as HTMLElement;
    expect(isNearBottom(el)).toBe(true);
  });

  it('returns true when within the default 150px threshold', () => {
    const el = {
      scrollHeight: 1000,
      scrollTop: 400, // 100px from bottom (1000 - 400 - 500 = 100)
      clientHeight: 500,
    } as HTMLElement;
    expect(isNearBottom(el)).toBe(true);
  });

  it('returns false when above the default threshold', () => {
    const el = {
      scrollHeight: 1000,
      scrollTop: 200, // 300px from bottom
      clientHeight: 500,
    } as HTMLElement;
    expect(isNearBottom(el)).toBe(false);
  });

  it('honors a custom threshold', () => {
    const el = {
      scrollHeight: 1000,
      scrollTop: 200, // 300px from bottom
      clientHeight: 500,
    } as HTMLElement;
    expect(isNearBottom(el, 400)).toBe(true);
    expect(isNearBottom(el, 200)).toBe(false);
  });
});

describe('findScrollParent', () => {
  it('returns the nearest ancestor with overflow-y auto', () => {
    const root = document.createElement('div');
    root.style.overflowY = 'auto';
    const middle = document.createElement('div');
    const leaf = document.createElement('span');
    middle.appendChild(leaf);
    root.appendChild(middle);
    document.body.appendChild(root);

    expect(findScrollParent(leaf as unknown as HTMLElement)).toBe(root);
    document.body.removeChild(root);
  });

  it('returns the nearest ancestor with overflow-y scroll', () => {
    const root = document.createElement('div');
    root.style.overflowY = 'scroll';
    const leaf = document.createElement('span');
    root.appendChild(leaf);
    document.body.appendChild(root);

    expect(findScrollParent(leaf as unknown as HTMLElement)).toBe(root);
    document.body.removeChild(root);
  });

  it('returns null when no ancestor has scrollable overflow-y', () => {
    const root = document.createElement('div');
    const leaf = document.createElement('span');
    root.appendChild(leaf);
    document.body.appendChild(root);

    expect(findScrollParent(leaf as unknown as HTMLElement)).toBeNull();
    document.body.removeChild(root);
  });

  it('returns null for a null input', () => {
    expect(findScrollParent(null)).toBeNull();
  });
});
