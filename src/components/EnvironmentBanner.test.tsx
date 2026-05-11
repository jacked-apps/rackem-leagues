/**
 * @fileoverview Unit tests for EnvironmentBanner — focused on the
 * `--env-banner-height` CSS variable contract that the global header
 * consumes for sticky stacking.
 *
 * The banner copy/colors are not retested here (already covered implicitly
 * by integration tests that render pages inside the banner).
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render } from '@testing-library/react';

// Mock the env config so we can drive 'production' vs 'staging' branches
// from the test rather than relying on VITE_APP_ENV at module-load time.
vi.mock('@/config/environment', () => ({
  env: 'staging',
  ENV_BANNER_CONFIG: {
    staging: {
      label: 'BETA',
      message: 'staging msg',
      bgClass: 'bg-amber-500',
      textClass: 'text-black',
      faviconPath: '/x.svg',
      appleTouchIconPath: '/x.png',
      titlePrefix: '[BETA]',
    },
    development: {
      label: 'DEV',
      message: 'dev msg',
      bgClass: 'bg-red-600',
      textClass: 'text-white',
      faviconPath: '/x.svg',
      appleTouchIconPath: '/x.png',
      titlePrefix: '[DEV]',
    },
  },
}));

import { EnvironmentBanner } from './EnvironmentBanner';

describe('EnvironmentBanner sticky stacking contract', () => {
  beforeEach(() => {
    document.documentElement.style.removeProperty('--env-banner-height');
  });

  afterEach(() => {
    document.documentElement.style.removeProperty('--env-banner-height');
  });

  it('publishes --env-banner-height on the document root after mount', () => {
    // happy-dom returns 0 for unstyled getBoundingClientRect, so we stub it
    // to a deterministic value to verify the round-trip.
    const origGBCR = HTMLDivElement.prototype.getBoundingClientRect;
    HTMLDivElement.prototype.getBoundingClientRect = vi.fn(() => ({
      height: 28,
      width: 360,
      top: 0,
      left: 0,
      right: 360,
      bottom: 28,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    })) as unknown as typeof HTMLDivElement.prototype.getBoundingClientRect;

    render(<EnvironmentBanner />);

    expect(
      document.documentElement.style.getPropertyValue('--env-banner-height'),
    ).toBe('28px');

    HTMLDivElement.prototype.getBoundingClientRect = origGBCR;
  });

  it('clears --env-banner-height on unmount', () => {
    const origGBCR = HTMLDivElement.prototype.getBoundingClientRect;
    HTMLDivElement.prototype.getBoundingClientRect = vi.fn(() => ({
      height: 28,
      width: 360,
      top: 0,
      left: 0,
      right: 360,
      bottom: 28,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    })) as unknown as typeof HTMLDivElement.prototype.getBoundingClientRect;

    const view = render(<EnvironmentBanner />);
    expect(
      document.documentElement.style.getPropertyValue('--env-banner-height'),
    ).toBe('28px');

    view.unmount();

    expect(
      document.documentElement.style.getPropertyValue('--env-banner-height'),
    ).toBe('');

    HTMLDivElement.prototype.getBoundingClientRect = origGBCR;
  });
});
