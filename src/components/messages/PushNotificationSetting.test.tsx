/**
 * @fileoverview Tests for PushNotificationSetting (Unit 6) — the settings
 * control renders the right thing per capability, and the toggle calls the
 * right handler.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PushNotificationSetting } from './PushNotificationSetting';
import type { PushCapability } from '@/utils/push/pushCapability';

function setup(
  overrides: Partial<{
    capability: PushCapability;
    isSubscribed: boolean;
    isBusy: boolean;
  }> = {}
) {
  const onEnable = vi.fn();
  const onDisable = vi.fn();
  render(
    <PushNotificationSetting
      capability={overrides.capability ?? 'supported'}
      isSubscribed={overrides.isSubscribed ?? false}
      isBusy={overrides.isBusy ?? false}
      onEnable={onEnable}
      onDisable={onDisable}
    />
  );
  return { onEnable, onDisable };
}

describe('PushNotificationSetting', () => {
  it('supported + off: switch is off; toggling it on calls onEnable', () => {
    const { onEnable } = setup({ isSubscribed: false });
    const toggle = screen.getByTestId('push-toggle');
    expect(toggle.getAttribute('aria-checked')).toBe('false');
    fireEvent.click(toggle);
    expect(onEnable).toHaveBeenCalledTimes(1);
  });

  it('supported + on: switch is on; toggling it off calls onDisable', () => {
    const { onDisable } = setup({ isSubscribed: true });
    const toggle = screen.getByTestId('push-toggle');
    expect(toggle.getAttribute('aria-checked')).toBe('true');
    fireEvent.click(toggle);
    expect(onDisable).toHaveBeenCalledTimes(1);
  });

  it('needs-ios-install: shows the Add-to-Home-Screen nudge, no toggle', () => {
    setup({ capability: 'needs-ios-install' });
    expect(screen.queryByTestId('push-ios-install')).not.toBeNull();
    expect(screen.queryByTestId('push-toggle')).toBeNull();
  });

  it('denied: shows the blocked hint, no toggle', () => {
    setup({ capability: 'denied' });
    expect(screen.queryByTestId('push-denied')).not.toBeNull();
    expect(screen.queryByTestId('push-toggle')).toBeNull();
  });

  it('unsupported: shows the unsupported note', () => {
    setup({ capability: 'unsupported' });
    expect(screen.queryByTestId('push-unsupported')).not.toBeNull();
    expect(screen.queryByTestId('push-toggle')).toBeNull();
  });

  it('busy: the switch is disabled', () => {
    setup({ isBusy: true });
    expect((screen.getByTestId('push-toggle') as HTMLButtonElement).disabled).toBe(true);
  });
});
