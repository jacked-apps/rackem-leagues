// @vitest-environment jsdom
/**
 * @fileoverview Tests for the create-bracket flow (Unit 4).
 *
 * Covers the happy path (fill details → add players → review → submit calls
 * create/setParticipants/start with the expected args and navigates), the
 * min-participant guard, and the duplicate-name soft warning. The mutation
 * hooks + navigation are mocked so this stays a fast UI test.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderWithProviders, screen, userEvent } from '@/test/utils';

const mockNavigate = vi.fn();
const mockCreate = vi.fn();
const mockSetParticipants = vi.fn();
const mockStart = vi.fn();
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
}));

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import { CreateBracketFlow } from './CreateBracketFlow';

/** Advance from the details step with a valid name. */
async function fillDetailsAndAdvance(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText('Bracket name'), 'Friday 9-Ball');
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
});

describe('CreateBracketFlow', () => {
  it('runs the full flow and submits with the expected args', async () => {
    const user = userEvent.setup();
    renderWithProviders(<CreateBracketFlow />);

    await fillDetailsAndAdvance(user);
    await addPlayers(user, ['Ann', 'Bo', 'Cy', 'Di']);
    await user.click(screen.getByRole('button', { name: 'Next' })); // → review
    await user.click(screen.getByRole('button', { name: 'Start bracket' }));

    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Friday 9-Ball',
        format: 'single_elimination',
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
});
