/**
 * @fileoverview Tests for usePushSubscription (Unit 5). The browser Push APIs
 * and the DB mutations are mocked, so these pin the orchestration: subscribe
 * (granted vs denied), unsubscribe, and heal-on-mount.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';

vi.mock('@/utils/push/browserPush', () => ({
  requestNotificationPermission: vi.fn(),
  getExistingPushSubscription: vi.fn(),
  subscribeToPush: vi.fn(),
  extractSubscriptionKeys: vi.fn(),
}));
vi.mock('@/api/mutations/pushSubscriptions', () => ({
  upsertPushSubscription: vi.fn(),
  deletePushSubscriptionByEndpoint: vi.fn(),
  setMemberPushEnabled: vi.fn(),
}));
vi.mock('@/utils/push/pushCapability', () => ({
  detectPushCapability: vi.fn(() => 'supported'),
  urlBase64ToUint8Array: vi.fn(() => new Uint8Array([1])),
}));

import { usePushSubscription } from './usePushSubscription';
import * as browserPush from '@/utils/push/browserPush';
import * as mutations from '@/api/mutations/pushSubscriptions';

function makeSub(endpoint: string): PushSubscription {
  return {
    endpoint,
    unsubscribe: vi.fn().mockResolvedValue(true),
    getKey: () => null,
  } as unknown as PushSubscription;
}

describe('usePushSubscription', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv('VITE_VAPID_PUBLIC_KEY', 'test-vapid-key');
    vi.mocked(browserPush.getExistingPushSubscription).mockResolvedValue(null);
    vi.mocked(browserPush.requestNotificationPermission).mockResolvedValue('granted');
    vi.mocked(browserPush.subscribeToPush).mockResolvedValue(makeSub('https://ep'));
    vi.mocked(browserPush.extractSubscriptionKeys).mockReturnValue({
      endpoint: 'https://ep',
      p256dh: 'p',
      auth: 'a',
    });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('subscribe (granted) → subscribes, upserts the row, flips push_enabled on', async () => {
    const { result } = renderHook(() =>
      usePushSubscription({ memberId: 'm1', pushEnabled: false })
    );
    await waitFor(() => expect(result.current.capability).toBe('supported'));

    await act(async () => {
      await result.current.subscribe();
    });

    expect(browserPush.subscribeToPush).toHaveBeenCalledTimes(1);
    expect(mutations.upsertPushSubscription).toHaveBeenCalledWith(
      expect.objectContaining({ memberId: 'm1', endpoint: 'https://ep', p256dh: 'p', auth: 'a' })
    );
    expect(mutations.setMemberPushEnabled).toHaveBeenCalledWith('m1', true);
    expect(result.current.isSubscribed).toBe(true);
  });

  it('subscribe (denied) → does not subscribe, capability becomes denied', async () => {
    vi.mocked(browserPush.requestNotificationPermission).mockResolvedValue('denied');
    const { result } = renderHook(() =>
      usePushSubscription({ memberId: 'm1', pushEnabled: false })
    );
    await waitFor(() => expect(result.current.capability).toBe('supported'));

    await act(async () => {
      await result.current.subscribe();
    });

    expect(browserPush.subscribeToPush).not.toHaveBeenCalled();
    expect(mutations.upsertPushSubscription).not.toHaveBeenCalled();
    expect(result.current.capability).toBe('denied');
  });

  it('unsubscribe → deletes the row, unsubscribes the browser, flips push_enabled off', async () => {
    const sub = makeSub('https://ep');
    vi.mocked(browserPush.getExistingPushSubscription).mockResolvedValue(sub);
    const { result } = renderHook(() =>
      usePushSubscription({ memberId: 'm1', pushEnabled: false })
    );
    // heal-on-mount sees the existing subscription and marks subscribed
    await waitFor(() => expect(result.current.isSubscribed).toBe(true));

    await act(async () => {
      await result.current.unsubscribe();
    });

    expect(mutations.deletePushSubscriptionByEndpoint).toHaveBeenCalledWith('https://ep');
    expect(sub.unsubscribe).toHaveBeenCalled();
    expect(mutations.setMemberPushEnabled).toHaveBeenCalledWith('m1', false);
    expect(result.current.isSubscribed).toBe(false);
  });

  it('heal-on-mount → pushEnabled but no live subscription re-subscribes silently', async () => {
    vi.mocked(browserPush.getExistingPushSubscription).mockResolvedValue(null);
    const { result } = renderHook(() =>
      usePushSubscription({ memberId: 'm1', pushEnabled: true })
    );

    await waitFor(() => expect(browserPush.subscribeToPush).toHaveBeenCalled());
    expect(mutations.upsertPushSubscription).toHaveBeenCalled();
    await waitFor(() => expect(result.current.isSubscribed).toBe(true));
  });

  it('does nothing without a memberId', async () => {
    const { result } = renderHook(() =>
      usePushSubscription({ memberId: null, pushEnabled: true })
    );
    await act(async () => {
      await result.current.subscribe();
    });
    expect(browserPush.subscribeToPush).not.toHaveBeenCalled();
  });
});
