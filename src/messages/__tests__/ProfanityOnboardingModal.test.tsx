/**
 * @fileoverview Tests for the Unit 9 profanity onboarding modal.
 *
 * The modal is a one-time, defaulted-ON prompt shown the first time a
 * member opens Messages. Every exit path records a choice:
 *   - "Turn filter off" → mutation with filterEnabled=false.
 *   - "Keep filter on"  → mutation with filterEnabled=true.
 *   - Dismiss (Escape / backdrop / X) → mutation with filterEnabled=true
 *     (defaults the filter ON — "one-time bother, defaulted on").
 * `onResolved` fires only after the mutation resolves successfully; a
 * rejected mutation leaves the modal open for a retry.
 *
 * `useMarkProfanityOnboardingComplete` is mocked so each test controls
 * the persistence contract directly.
 *
 * NOTE ON `waitFor`: `onResolved` fires AFTER the awaited mutation, so asserting
 * it synchronously right after a click races the microtask queue — the same
 * flake that hit ChangeSeasonLengthDialog under parallel load on 2026-09-05.
 * Assertions on `mockMutateAsync` need no wait: that call is synchronous, it is
 * only its EFFECT that is deferred.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderWithProviders, screen, userEvent, waitFor } from '@/test/utils';

const mockMutateAsync = vi.fn();

vi.mock('@/api/hooks', () => ({
  useMarkProfanityOnboardingComplete: () => ({
    mutateAsync: mockMutateAsync,
    isPending: false,
  }),
}));

import { ProfanityOnboardingModal } from '../ProfanityOnboardingModal';

const USER_ID = 'user-abc';

function renderModal(onResolved = vi.fn()) {
  renderWithProviders(
    <ProfanityOnboardingModal userId={USER_ID} onResolved={onResolved} />,
  );
  return { onResolved };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockMutateAsync.mockResolvedValue(undefined);
});

describe('ProfanityOnboardingModal — render', () => {
  it('explains the filter, states it is on by default, and points at Settings', () => {
    renderModal();
    expect(screen.getByTestId('profanity-onboarding-modal')).toBeInTheDocument();
    expect(
      screen.getByText(/hide profane language from your/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/change this anytime in settings/i)).toBeInTheDocument();
    expect(
      screen.getByText(/would you like to turn the filter off/i),
    ).toBeInTheDocument();
    expect(screen.getByTestId('onboarding-keep-on')).toBeInTheDocument();
    expect(screen.getByTestId('onboarding-turn-off')).toBeInTheDocument();
  });
});

describe('ProfanityOnboardingModal — explicit choices', () => {
  it('"Keep filter on" persists filterEnabled=true and calls onResolved', async () => {
    const user = userEvent.setup();
    const { onResolved } = renderModal();

    await user.click(screen.getByTestId('onboarding-keep-on'));

    expect(mockMutateAsync).toHaveBeenCalledWith({
      userId: USER_ID,
      filterEnabled: true,
    });
    await waitFor(() => expect(onResolved).toHaveBeenCalledTimes(1));
  });

  it('"Turn filter off" persists filterEnabled=false and calls onResolved', async () => {
    const user = userEvent.setup();
    const { onResolved } = renderModal();

    await user.click(screen.getByTestId('onboarding-turn-off'));

    expect(mockMutateAsync).toHaveBeenCalledWith({
      userId: USER_ID,
      filterEnabled: false,
    });
    await waitFor(() => expect(onResolved).toHaveBeenCalledTimes(1));
  });
});

describe('ProfanityOnboardingModal — dismiss defaults the filter ON', () => {
  it('Escape records filterEnabled=true (default ON) and calls onResolved', async () => {
    const user = userEvent.setup();
    const { onResolved } = renderModal();

    await user.keyboard('{Escape}');

    expect(mockMutateAsync).toHaveBeenCalledWith({
      userId: USER_ID,
      filterEnabled: true,
    });
    await waitFor(() => expect(onResolved).toHaveBeenCalledTimes(1));
  });
});

describe('ProfanityOnboardingModal — failure + double-resolve guards', () => {
  it('does NOT call onResolved when the mutation rejects (modal stays open for retry)', async () => {
    const user = userEvent.setup();
    mockMutateAsync.mockRejectedValueOnce(new Error('network'));
    const { onResolved } = renderModal();

    await user.click(screen.getByTestId('onboarding-keep-on'));

    expect(mockMutateAsync).toHaveBeenCalledTimes(1);
    expect(onResolved).not.toHaveBeenCalled();
  });

  it('a retry after a failed attempt succeeds and resolves', async () => {
    const user = userEvent.setup();
    mockMutateAsync
      .mockRejectedValueOnce(new Error('network'))
      .mockResolvedValueOnce(undefined);
    const { onResolved } = renderModal();

    await user.click(screen.getByTestId('onboarding-turn-off'));
    expect(onResolved).not.toHaveBeenCalled();

    await user.click(screen.getByTestId('onboarding-turn-off'));
    expect(mockMutateAsync).toHaveBeenCalledTimes(2);
    await waitFor(() => expect(onResolved).toHaveBeenCalledTimes(1));
  });

  it('only resolves once even if a choice is followed by a dismiss', async () => {
    const user = userEvent.setup();
    const { onResolved } = renderModal();

    await user.click(screen.getByTestId('onboarding-keep-on'));
    await user.keyboard('{Escape}');

    // The post-choice dismiss must NOT fire a second mutation or resolve.
    expect(mockMutateAsync).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(onResolved).toHaveBeenCalledTimes(1));
  });
});
