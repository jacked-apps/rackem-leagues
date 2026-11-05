/**
 * @fileoverview Tests for the race game's Play screen: lone host → invite
 * message (open never asked); two members → ScoreRace on the opened race,
 * winner-only, named from the room; finished → Run it back states for the
 * requester, the answerer and a spectator; after an accept the new race shows
 * and the old one moves to the earlier-races list.
 *
 * Hooks are mocked at the module boundary and `ScoreRace` is a stub — its own
 * tests cover scoring and the spectator view. The RPCs are proven in
 * src/__tests__/database/roomRaces.db.test.ts.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import type { RoomPhone } from '@/api/queries/rooms';
import type { RoomRaceLink } from './roomRaceApi';

const mockOpen = vi.fn();
const mockLinks = vi.fn();
const mockRace = vi.fn();
const mockRequest = vi.fn();
const mockAnswer = vi.fn();
const toastError = vi.fn();
vi.mock('./useRoomRace', () => ({
  useOpenRoomRace: (_r: string, enabled: boolean) => mockOpen(enabled),
  useRoomRaceLinks: () => mockLinks(),
  useRequestRoomRaceRematch: () => ({ mutateAsync: mockRequest, isPending: false }),
  useAnswerRoomRaceRematch: () => ({ mutateAsync: mockAnswer, isPending: false }),
}));
vi.mock('@/race/useRaceData', () => ({ useRace: (id: string | undefined) => mockRace(id) }));
vi.mock('@/race/ScoreRace', () => ({
  ScoreRace: (p: { raceId: string; names?: { home?: string; away?: string }; extras?: boolean }) => (
    <div data-testid="score-race">
      {p.raceId} {p.names?.home} vs {p.names?.away} extras={String(p.extras)}
    </div>
  ),
}));
vi.mock('sonner', () => ({ toast: { error: (m: string) => toastError(m), success: vi.fn() } }));

import { RoomRace } from './RoomRace';

const phone = (id: string, member: string, name: string, isHost = false): RoomPhone => ({
  id, member_id: member, device_id: `d-${id}`, display_name: name,
  is_host: isHost, is_present: true, has_left: false, last_seen_at: '', joined_at: '',
});
const ED = phone('p1', 'm-ed', 'Ed', true);
const ED_TABLET = phone('p1b', 'm-ed', 'Ed', true);
const JACK = phone('p2', 'm-jack', 'Jack');
const SAM = phone('p3', 'm-sam', 'Sam');

const race = (status: string) => ({ id: 'race-1', status, home_member_id: 'm-ed', away_member_id: 'm-jack' });
const settled = (winner: string) => ({ winner_player_id: winner, confirmed_by_home: 'x', confirmed_by_away: 'x' });
const link = (seq: number, raceId: string, over: Partial<RoomRaceLink> = {}): RoomRaceLink => ({
  id: `l${seq}`, race_id: raceId, seq, rematch_requested_by: null,
  race: {
    status: 'finished', home_member_id: 'm-ed', away_member_id: 'm-jack', winner_player_id: 'm-ed',
    // Two settled Ed wins, one Jack win, and one unconfirmed result that must not count.
    race_games: [settled('m-ed'), settled('m-jack'), settled('m-ed'),
      { winner_player_id: 'm-jack', confirmed_by_home: 'x', confirmed_by_away: null }],
  },
  ...over,
});

const renderAs = (me: RoomPhone, phones: RoomPhone[] = [ED, JACK]) =>
  render(<RoomRace roomId="r1" myPhone={me} phones={phones} settings={{}} isHost={me.is_host} />);

/** The latest race is finished and `by` has asked to run it back. */
const finishedAndAskedBy = (by: string | null) => {
  mockRace.mockReturnValue({ data: race('finished') });
  mockLinks.mockReturnValue({ data: [link(1, 'race-1', { rematch_requested_by: by })] });
};

beforeEach(() => {
  mockOpen.mockReset().mockReturnValue({ data: { ok: true, race_id: 'race-1', seq: 1, created: true }, isLoading: false });
  mockLinks.mockReset().mockReturnValue({ data: [link(1, 'race-1')] });
  mockRace.mockReset().mockReturnValue({ data: race('in_progress') });
  mockRequest.mockReset().mockResolvedValue({ ok: true, state: 'requested' });
  mockAnswer.mockReset().mockResolvedValue({ ok: true, state: 'accepted', race_id: 'race-2', seq: 2 });
  toastError.mockReset();
});

describe('RoomRace', () => {
  it('two members: ScoreRace renders the opened race, winner-only, named from the room', () => {
    renderAs(ED);
    expect(mockOpen).toHaveBeenLastCalledWith(true);
    expect(mockRace).toHaveBeenLastCalledWith('race-1');
    expect(screen.getByTestId('score-race')).toHaveTextContent('race-1 Ed vs Jack extras=false');
    expect(screen.queryByRole('button', { name: 'Run it back' })).toBeNull();
  });

  it.each([
    ['one device', [ED]],
    ['the host on two devices', [ED, ED_TABLET]],
  ])('only the host (%s): invite message, open never asked', (_label, phones) => {
    renderAs(ED, phones);
    expect(mockOpen).toHaveBeenLastCalledWith(false);
    expect(screen.getByText(/A race takes two players/)).toBeInTheDocument();
    expect(screen.queryByTestId('score-race')).toBeNull();
  });

  it('a refusal from open is said in words', () => {
    mockOpen.mockReturnValue({ data: { ok: false, reason: 'missing_setting', setting: 'base' }, isLoading: false });
    renderAs(ED);
    expect(screen.getByText(/race settings are incomplete/)).toBeInTheDocument();
  });

  it('finished, nobody asked: a player taps Run it back → request_room_race_rematch', async () => {
    finishedAndAskedBy(null);
    renderAs(JACK);
    fireEvent.click(screen.getByRole('button', { name: 'Run it back' }));
    await waitFor(() => expect(mockRequest).toHaveBeenCalledTimes(1));
  });

  it('finished, I asked: waiting for the other player, no buttons', () => {
    finishedAndAskedBy('m-ed');
    renderAs(ED);
    expect(screen.getByText('Waiting for Jack to answer.')).toBeInTheDocument();
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('finished, they asked: the other player gets Accept and Deny', async () => {
    finishedAndAskedBy('m-ed');
    renderAs(JACK);
    expect(screen.getByText('Ed wants to run it back.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Deny' }));
    await waitFor(() => expect(mockAnswer).toHaveBeenCalledWith(false));
    fireEvent.click(screen.getByRole('button', { name: 'Accept' }));
    await waitFor(() => expect(mockAnswer).toHaveBeenCalledWith(true));
  });

  it('a refused answer is a toast in words', async () => {
    finishedAndAskedBy('m-ed');
    mockAnswer.mockResolvedValue({ ok: false, reason: 'no_request' });
    renderAs(JACK);
    fireEvent.click(screen.getByRole('button', { name: 'Accept' }));
    await waitFor(() => expect(toastError).toHaveBeenCalledWith(expect.stringMatching(/Nobody asked/)));
  });

  it('a third member viewing: the race shows, no Run it back controls', () => {
    finishedAndAskedBy(null);
    renderAs(SAM, [ED, JACK, SAM]);
    expect(screen.getByTestId('score-race')).toBeInTheDocument();
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('after an accept: the new race renders and the previous result is listed', () => {
    mockOpen.mockReturnValue({ data: { ok: true, race_id: 'race-2', seq: 2, created: false }, isLoading: false });
    mockLinks.mockReturnValue({ data: [link(1, 'race-1'), link(2, 'race-2')] });
    renderAs(ED);
    expect(screen.getByTestId('score-race')).toHaveTextContent('race-2');
    expect(screen.getByText('Earlier races')).toBeInTheDocument();
    expect(screen.getByText(/Ed 2, Jack 1 — Ed won\./)).toBeInTheDocument();
    expect(screen.queryByText(/Race 2:/)).toBeNull();
  });
});
