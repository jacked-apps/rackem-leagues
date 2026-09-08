// @vitest-environment jsdom
/**
 * @fileoverview Tests for the create-bracket flow (Unit 4).
 *
 * Covers the happy path (fill details → add players → review → submit calls
 * create/setParticipants/start with the expected args and navigates), the
 * min-participant guard, the duplicate-name soft warning, and the Unit C3 fork
 * where "Real players & sign-up" ends the flow after Details and hands off to
 * the setup page instead of starting anything. The mutation hooks + navigation
 * are mocked so this stays a fast UI test.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderWithProviders, screen, userEvent } from '@/test/utils';

const mockNavigate = vi.fn();
const mockCreate = vi.fn();
const mockSetParticipants = vi.fn();
const mockStart = vi.fn();
const mockCharge = vi.fn();
const mockUseCurrentMember = vi.fn();

vi.mock('react-router-dom', async (orig) => ({
  ...(await orig<typeof import('react-router-dom')>()),
  useNavigate: () => mockNavigate,
}));

vi.mock('@/api/hooks/useCurrentMember', () => ({
  useCurrentMember: () => mockUseCurrentMember(),
}));

vi.mock('@/api/hooks/useBrackets', () => ({
  useCreateBracket: () => ({ mutateAsync: mockCreate }),
  useSetParticipants: () => ({ mutateAsync: mockSetParticipants }),
  useStartBracket: () => ({ mutateAsync: mockStart }),
  useChargeForStart: () => ({ mutateAsync: mockCharge }),
}));

// A card already on file, so turning on a premium feature enables it straight
// away instead of opening the set-up-a-payment-method dialog.
const mockDefaultCard = vi.fn();
vi.mock('@/api/hooks/usePaymentMethods', () => ({
  useDefaultPaymentMethod: () => mockDefaultCard(),
  useSaveDefaultPaymentMethod: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import { CreateBracketFlow } from './CreateBracketFlow';

/** Advance from the details step with a valid name. */
async function fillDetailsAndAdvance(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText('Tournament name'), 'Friday 9-Ball');
  await user.click(screen.getByRole('button', { name: 'Next' }));
}

/** Add a list of players on the participants step. */
async function addPlayers(user: ReturnType<typeof userEvent.setup>, names: string[]) {
  const input = screen.getByLabelText('Add players');
  for (const name of names) {
    await user.type(input, name);
    await user.click(screen.getByRole('button', { name: 'Add' }));
  }
}

beforeEach(() => {
  vi.clearAllMocks();
  mockUseCurrentMember.mockReturnValue({ data: { id: 'member-1' } });
  mockCreate.mockResolvedValue({ id: 'bracket-1', created_by: 'member-1' });
  mockSetParticipants.mockResolvedValue(undefined);
  mockStart.mockResolvedValue(undefined);
  mockDefaultCard.mockReturnValue({ data: null });
});

describe('CreateBracketFlow', () => {
  it('runs the full flow and submits with the expected args', async () => {
    const user = userEvent.setup();
    renderWithProviders(<CreateBracketFlow />);

    await fillDetailsAndAdvance(user);
    await addPlayers(user, ['Ann', 'Bo', 'Cy', 'Di']);
    await user.click(screen.getByRole('button', { name: 'Next' })); // → review
    await user.click(screen.getByRole('button', { name: 'Start tournament' }));

    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Friday 9-Ball',
        format: 'double_elimination', // the default
        seedingMode: 'seeded',
        createdBy: 'member-1',
      })
    );
    expect(mockSetParticipants).toHaveBeenCalledWith(
      expect.objectContaining({
        bracketId: 'bracket-1',
        participants: [
          { displayName: 'Ann' },
          { displayName: 'Bo' },
          { displayName: 'Cy' },
          { displayName: 'Di' },
        ],
      })
    );
    expect(mockStart).toHaveBeenCalledWith(
      expect.objectContaining({ bracketId: 'bracket-1', participantCount: 4 })
    );
    expect(mockNavigate).toHaveBeenCalledWith('/brackets/bracket-1');
  });

  it('blocks advancing past participants with fewer than 2 players', async () => {
    const user = userEvent.setup();
    renderWithProviders(<CreateBracketFlow />);

    await fillDetailsAndAdvance(user);
    await addPlayers(user, ['Solo']);

    // Can't even reach review with a single player.
    expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled();
    expect(mockStart).not.toHaveBeenCalled();
  });

  it('warns about duplicate names but still allows them', async () => {
    const user = userEvent.setup();
    renderWithProviders(<CreateBracketFlow />);

    await fillDetailsAndAdvance(user);
    await addPlayers(user, ['Sam', 'Sam']);

    expect(screen.getByText(/some names are duplicated/i)).toBeInTheDocument();
  });

  describe('with "Real players & sign-up" (the hopper fork)', () => {
    beforeEach(() => {
      mockDefaultCard.mockReturnValue({
        data: { id: 'pm-1', card_last4: '4242', card_brand: 'visa', nickname: null },
      });
    });

    it('ends after Details and hands off to the setup page without starting', async () => {
      const user = userEvent.setup();
      renderWithProviders(<CreateBracketFlow />);

      await user.type(screen.getByLabelText('Tournament name'), 'Friday 9-Ball');
      await user.click(screen.getByLabelText('Real players & sign-up'));
      await user.click(screen.getByRole('button', { name: 'Create & add players' }));

      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Friday 9-Ball',
          premiumFeatures: ['real_players'],
        })
      );
      // Players arrive via the hopper, so there is nothing to seed or start yet
      // — and nothing to charge until the organizer actually starts.
      expect(mockSetParticipants).not.toHaveBeenCalled();
      expect(mockStart).not.toHaveBeenCalled();
      expect(mockCharge).not.toHaveBeenCalled();
      expect(mockNavigate).toHaveBeenCalledWith('/brackets/bracket-1/setup');
    });

    it('offers no player-typing step at all', async () => {
      const user = userEvent.setup();
      renderWithProviders(<CreateBracketFlow />);

      await user.type(screen.getByLabelText('Tournament name'), 'Friday 9-Ball');
      await user.click(screen.getByLabelText('Real players & sign-up'));

      expect(screen.queryByRole('button', { name: 'Next' })).toBeNull();
    });
  });
});
