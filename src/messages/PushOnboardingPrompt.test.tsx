/**
 * @fileoverview Tests for PushOnboardingPrompt (Unit 6) — the three-way push
 * onboarding prompt. Verifies each outcome routes correctly and that it hides
 * when the device can't turn push on.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

vi.mock('@/api/hooks/usePushSubscription', () => ({
  usePushSubscription: vi.fn(),
}));
vi.mock('@/api/mutations/pushSubscriptions', () => ({
  setMemberPushEnabled: vi.fn(),
}));

import { PushOnboardingPrompt } from './PushOnboardingPrompt';
import {
  usePushSubscription,
  type UsePushSubscriptionResult,
} from '@/api/hooks/usePushSubscription';
import { setMemberPushEnabled } from '@/api/mutations/pushSubscriptions';

function mockPush(
  over: Partial<UsePushSubscriptionResult> = {}
): UsePushSubscriptionResult {
  return {
    capability: 'supported',
    isSubscribed: false,
    isBusy: false,
    subscribe: vi.fn().mockResolvedValue(undefined),
    unsubscribe: vi.fn().mockResolvedValue(undefined),
    ...over,
  };
}

function renderPrompt() {
  const onResolved = vi.fn();
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={qc}>
      <PushOnboardingPrompt userId="u1" memberId="m1" onResolved={onResolved} />
    </QueryClientProvider>
  );
  return { onResolved };
}

describe('PushOnboardingPrompt', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(usePushSubscription).mockReturnValue(mockPush());
    vi.mocked(setMemberPushEnabled).mockResolvedValue(undefined);
  });

  it('renders nothing when the device cannot turn push on', () => {
    vi.mocked(usePushSubscription).mockReturnValue(
      mockPush({ capability: 'needs-ios-install' })
    );
    renderPrompt();
    expect(screen.queryByTestId('push-onboarding-modal')).toBeNull();
  });

  it('Turn on → subscribes, then resolves (no decline write)', async () => {
    const subscribe = vi.fn().mockResolvedValue(undefined);
    vi.mocked(usePushSubscription).mockReturnValue(mockPush({ subscribe }));
    const { onResolved } = renderPrompt();

    fireEvent.click(screen.getByTestId('push-onboarding-yes'));

    await waitFor(() => expect(subscribe).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(onResolved).toHaveBeenCalled());
    expect(setMemberPushEnabled).not.toHaveBeenCalled();
  });

  it('No thanks → sets push_enabled false, then resolves', async () => {
    const { onResolved } = renderPrompt();

    fireEvent.click(screen.getByTestId('push-onboarding-no'));

    await waitFor(() =>
      expect(setMemberPushEnabled).toHaveBeenCalledWith('m1', false)
    );
    await waitFor(() => expect(onResolved).toHaveBeenCalled());
  });

  it('Not now → resolves without persisting (stays unanswered)', () => {
    const { onResolved } = renderPrompt();

    fireEvent.click(screen.getByTestId('push-onboarding-not-now'));

    expect(onResolved).toHaveBeenCalledTimes(1);
    expect(setMemberPushEnabled).not.toHaveBeenCalled();
  });
});
