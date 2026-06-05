/**
 * @fileoverview Tests for the open-redirect guard.
 *
 * The security review called out these exact bypass attempts; each must be
 * rejected, and legitimate relative paths must pass through.
 */
import { describe, it, expect } from 'vitest';
import { getSafeRedirectPath } from './redirect';

describe('getSafeRedirectPath', () => {
  it('returns a safe relative path unchanged (decoded)', () => {
    expect(getSafeRedirectPath('/my-teams')).toBe('/my-teams');
    expect(
      getSafeRedirectPath(encodeURIComponent('/claim-player?claim=X&token=Y')),
    ).toBe('/claim-player?claim=X&token=Y');
  });

  it('rejects null/empty/undefined', () => {
    expect(getSafeRedirectPath(null)).toBeNull();
    expect(getSafeRedirectPath(undefined)).toBeNull();
    expect(getSafeRedirectPath('')).toBeNull();
  });

  it('rejects protocol-relative URLs (//evil.com)', () => {
    expect(getSafeRedirectPath('//evil.com')).toBeNull();
  });

  it('rejects absolute URLs (https://evil.com)', () => {
    expect(getSafeRedirectPath('https://evil.com')).toBeNull();
    expect(getSafeRedirectPath('http://evil.com/path')).toBeNull();
  });

  it('rejects an encoded protocol-relative URL (%2F%2Fevil.com)', () => {
    expect(getSafeRedirectPath('%2F%2Fevil.com')).toBeNull();
  });

  it('rejects a double-encoded variant', () => {
    // Decodes once to "%2F%2Fevil.com", which does not start with "/".
    expect(getSafeRedirectPath('%252F%252Fevil.com')).toBeNull();
  });

  it('rejects values that are not relative paths', () => {
    expect(getSafeRedirectPath('my-teams')).toBeNull();
    expect(getSafeRedirectPath('javascript:alert(1)')).toBeNull();
  });
});
