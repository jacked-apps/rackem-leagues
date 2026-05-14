/**
 * @fileoverview Tests for the Unit 9 profanity onboarding modal.
 *
 * Covers the persistence contract:
 *   - Yes button → mutation called with filterEnabled=true.
 *   - No button → mutation called with filterEnabled=false.
 *   - Decide later button → mutation NOT called; modal closes.
 *   - Backdrop / Escape via onOpenChange(false) → mutation NOT called.
 *
 * The `useMarkProfanityOnboardingComplete` hook is mocked so each test
 * controls the mutation contract directly, without exercising
 * supabase-js / React Query plumbing.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderWithProviders, screen, userEvent } from '@/test/utils';

const mockMutateAsync = vi.fn();

vi.mock('@/api/hooks', () => ({
  useMarkProfanityOnboardingComplete: () => ({
    mutateAsync: mockMutateAsync,
    isPending: false,
  }),
}));

import { ProfanityOnboardingModal } from '../ProfanityOnboardingModal';

const USER_ID = 'user-abc';

function renderModal(onOpenChange = vi.fn()) {
  renderWithProviders(
    <ProfanityOnboardingModal
      open
      onOpenChange={onOpenChange}
      userId={USER_ID}
    />,
  );
  return { onOpenChange };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockMutateAsync.mockResolvedValue(undefined);
});

describe('ProfanityOnboardingModal — render', () => {
  it('renders the explanatory copy with the "you" emphasis and all three actions', () => {
    renderModal();
    expect(screen.getByTestId('profanity-onboarding-modal')).toBeInTheDocument();
    expect(
      screen.getByText(/this only changes what/i),
    ).toBeInTheDocument();
    // "you" is wrapped in <strong> in the copy — assert the text node exists.
    expect(screen.getByText('you')).toBeInTheDocument();
    expect(screen.getByTestId('onboarding-yes')).toBeInTheDocument();
    expect(screen.getByTestId('onboarding-no')).toBeInTheDocument();
    expect(screen.getByTestId('onboarding-later')).toBeInTheDocument();
  });
});

describe('ProfanityOnboardingModal — Yes / No persist the choice', () => {
  it('Yes calls the mutation with filterEnabled=true and closes the modal', async () => {
    const user = userEvent.setup();
    const { onOpenChange } = renderModal();

    await user.click(screen.getByTestId('onboarding-yes'));

    expect(mockMutateAsync).toHaveBeenCalledWith({
      userId: USER_ID,
      filterEnabled: true,
    });
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('No calls the mutation with filterEnabled=false and closes the modal', async () => {
    const user = userEvent.setup();
    const { onOpenChange } = renderModal();

    await user.click(screen.getByTestId('onboarding-no'));

    expect(mockMutateAsync).toHaveBeenCalledWith({
      userId: USER_ID,
      filterEnabled: false,
    });
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('does NOT close the modal when the mutation rejects (user can try again)', async () => {
    const user = userEvent.setup();
    mockMutateAsync.mockRejectedValueOnce(new Error('network'));
    const { onOpenChange } = renderModal();

    await user.click(screen.getByTestId('onboarding-yes'));

    expect(mockMutateAsync).toHaveBeenCalledWith({
      userId: USER_ID,
      filterEnabled: true,
    });
    // onOpenChange(false) is NOT called on failure — the modal stays open
    // so the user can retry their choice.
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
  });
});

describe('ProfanityOnboardingModal — Decide later / dismiss paths do not persist', () => {
  it('Decide later closes the modal without calling the mutation', async () => {
    const user = userEvent.setup();
    const { onOpenChange } = renderModal();

    await user.click(screen.getByTestId('onboarding-later'));

    expect(mockMutateAsync).not.toHaveBeenCalled();
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('Escape key closes via onOpenChange and does NOT call the mutation', async () => {
    const user = userEvent.setup();
    const { onOpenChange } = renderModal();

    await user.keyboard('{Escape}');

    expect(mockMutateAsync).not.toHaveBeenCalled();
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
