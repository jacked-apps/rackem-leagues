/**
 * @fileoverview Tests for the coin flip's Play screen: no row → setup;
 * a row without a call → the caller's choice; after the call → the flipper's
 * throw; a face → the same winner on either phone. The hooks are mocked at
 * the module boundary; the RPCs are proven in
 * src/__tests__/database/roomCoinFlips.db.test.ts.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import type { RoomPhone } from '@/api/queries/rooms';
import type { RoomCoinFlipRow } from './coinFlipApi';

const mockLatest = vi.fn();
const mockStart = vi.fn();
const mockCall = vi.fn();
const mockThrow = vi.fn();
vi.mock('./useRoomCoinFlip', () => ({
  useLatestRoomFlip: () => mockLatest(),
  useStartRoomCoinFlip: () => ({ mutateAsync: mockStart }),
  useCallRoomCoin: () => ({ mutateAsync: mockCall }),
  useThrowRoomCoin: () => ({ mutateAsync: mockThrow }),
}));
vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

import { RoomCoinFlip } from './RoomCoinFlip';

const phone = (id: string, name: string): RoomPhone => ({
  id, member_id: `m-${id}`, device_id: `d-${id}`, display_name: name,
  is_host: id === 'p1', is_present: true, last_seen_at: '', joined_at: '',
});
const ED = phone('p1', 'Ed');
const JACK = phone('p2', 'Jack');
const PHONES = [ED, JACK];

/** Jack calls, Ed throws. */
const row = (over: Partial<RoomCoinFlipRow> = {}): RoomCoinFlipRow => ({
  id: 'f1', room_id: 'r1', caller_phone_id: 'p2', flipper_phone_id: 'p1',
  call: null, face: null, thrown_at: null, created_at: '', ...over,
});

const renderAs = (me: RoomPhone) =>
  render(<RoomCoinFlip roomId="r1" myPhone={me} phones={PHONES} settings={{}} isHost={me.is_host} />);

beforeEach(() => {
  vi.useFakeTimers();
  mockLatest.mockReset().mockReturnValue({ data: null, isLoading: false });
  mockStart.mockReset().mockResolvedValue({ ok: true, flip_id: 'f1' });
  mockCall.mockReset().mockResolvedValue({ ok: true });
  mockThrow.mockReset().mockResolvedValue({ ok: true, face: 'heads' });
});
afterEach(() => vi.useRealTimers());

describe('RoomCoinFlip', () => {
  it('with no flip yet: pick the other phone; default = they call, I throw', async () => {
    renderAs(ED);
    expect(screen.getByText(/Jack call heads or tails; you throw/)).toBeInTheDocument();
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Flip for it' }));
    });
    expect(mockStart).toHaveBeenCalledWith({ callerPhoneId: 'p2', flipperPhoneId: 'p1' });
  });

  it('"I call, they throw" swaps the roles', async () => {
    renderAs(ED);
    fireEvent.click(screen.getByRole('switch', { name: /I call, they throw/ }));
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Flip for it' }));
    });
    expect(mockStart).toHaveBeenCalledWith({ callerPhoneId: 'p1', flipperPhoneId: 'p2' });
  });

  it('alone in the room: no flip is offered, the panel points at the door', () => {
    render(<RoomCoinFlip roomId="r1" myPhone={ED} phones={[ED]} settings={{}} isHost />);
    expect(screen.getByText(/A flip takes two phones/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Flip for it' })).toBeNull();
  });

  it("a row without a call: the caller's phone gets heads/tails → call_room_coin; the flipper waits", async () => {
    mockLatest.mockReturnValue({ data: row(), isLoading: false });

    const jack = renderAs(JACK);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Heads' }));
    });
    expect(mockCall).toHaveBeenCalledWith({ flipId: 'f1', side: 'heads' });
    jack.unmount();

    renderAs(ED);
    expect(screen.getByText(/Waiting for Jack to call it/)).toBeInTheDocument();
    expect(screen.queryByRole('button')).toBeNull();
  });

  it("after the call: the flipper's phone throws → throw_room_coin; the caller waits", async () => {
    mockLatest.mockReturnValue({ data: row({ call: 'heads' }), isLoading: false });

    const ed = renderAs(ED);
    expect(screen.getByText(/Jack called heads/)).toBeInTheDocument();
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Throw the coin' }));
    });
    expect(mockThrow).toHaveBeenCalledWith('f1');
    ed.unmount();

    renderAs(JACK);
    expect(screen.getByText(/Waiting for Ed to throw/)).toBeInTheDocument();
  });

  it('once the row has a face, both phones render the same winner from the record', () => {
    mockLatest.mockReturnValue({ data: row({ call: 'heads', face: 'tails', thrown_at: 't' }), isLoading: false });

    const ed = renderAs(ED);
    expect(screen.getByText('Ed wins the flip')).toBeInTheDocument();
    expect(screen.getByText(/Called heads · landed tails/)).toBeInTheDocument();
    ed.unmount();

    renderAs(JACK);
    expect(screen.getByText('Ed wins the flip')).toBeInTheDocument();
  });

  it('"Flip again" shows the setup panel; a new row replaces it', () => {
    mockLatest.mockReturnValue({ data: row({ call: 'heads', face: 'tails' }), isLoading: false });
    const { rerender } = renderAs(ED);

    fireEvent.click(screen.getByRole('button', { name: 'Flip again' }));
    expect(screen.getByRole('button', { name: 'Flip for it' })).toBeInTheDocument();

    mockLatest.mockReturnValue({ data: row({ id: 'f2' }), isLoading: false });
    rerender(<RoomCoinFlip roomId="r1" myPhone={ED} phones={PHONES} settings={{}} isHost />);
    expect(screen.queryByRole('button', { name: 'Flip for it' })).toBeNull();
    expect(screen.getByText(/Waiting for Jack to call it/)).toBeInTheDocument();
  });
});
