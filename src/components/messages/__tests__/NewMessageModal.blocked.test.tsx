/**
 * @fileoverview NewMessageModal — blocked members are hidden, and the member
 * list loads once (not in a loop).
 *
 * Regression cover for two linked bugs: the blocked-ID list was read as
 * objects (`.blocked_id` on plain strings → nobody filtered), and that list
 * was a fresh array each render, so the fetch effect that depends on it
 * re-ran forever while the modal was open.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';

const members = [
  { id: 'm-alice', first_name: 'Alice', last_name: 'Able', system_player_number: 1 },
  { id: 'm-bob', first_name: 'Bob', last_name: 'Blocked', system_player_number: 2 },
];

const fetchMembers = vi.fn();

vi.mock('@/supabaseClient', () => {
  // members query chain: from().select().not().neq().order() → { data, error }
  const chain = {
    select: () => chain,
    not: () => chain,
    neq: () => chain,
    order: () => {
      fetchMembers();
      return Promise.resolve({ data: members, error: null });
    },
  };
  return { supabase: { from: () => chain } };
});

// Stable reference, as TanStack Query returns for unchanged data.
const blockedIds = ['m-bob'];
vi.mock('@/api/hooks', () => ({
  useBlockedUsers: () => ({ data: blockedIds }),
}));

vi.mock('@/utils/logger', () => ({
  logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

import { NewMessageModal } from '../NewMessageModal';

describe('NewMessageModal — blocked members', () => {
  beforeEach(() => {
    fetchMembers.mockClear();
  });

  it('hides blocked members from the list', async () => {
    render(
      <NewMessageModal onClose={vi.fn()} onCreateConversation={vi.fn()} currentUserId="m-me" />,
    );
    expect(await screen.findByText(/Alice/)).toBeInTheDocument();
    expect(screen.queryByText(/Bob/)).not.toBeInTheDocument();
  });

  it('loads the member list once, not on every render', async () => {
    render(
      <NewMessageModal onClose={vi.fn()} onCreateConversation={vi.fn()} currentUserId="m-me" />,
    );
    await screen.findByText(/Alice/);
    // Give a looping effect time to show itself.
    await new Promise((r) => setTimeout(r, 50));
    await waitFor(() => expect(fetchMembers).toHaveBeenCalledTimes(1));
  });
});
