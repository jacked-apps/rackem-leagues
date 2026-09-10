/**
 * @fileoverview Tests for the CoinFlip component.
 *
 * Fake timers throughout, because both the assignment reveal and the coin's
 * time in the air are real delays — the flip is a sequence of beats, and the
 * ordering of those beats is most of what these tests are checking.
 *
 * The randomness is injected rather than mocked, so "the coin lands tails" is
 * expressed as a value rather than a spy.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act, fireEvent } from '@testing-library/react';
import { CoinFlip } from './CoinFlip';
import { quickFlip } from './flipCoin';
import type { Participant, RandomSource } from './types';

const john: Participant = { id: 'p1', name: 'John' };
const mike: Participant = { id: 'p2', name: 'Mike' };

/** Random source yielding the given values in order, repeating the last. */
function sequence(...values: number[]): RandomSource {
  let i = 0;
  return () => values[Math.min(i++, values.length - 1)];
}

/** Order shuffle consumes one value; keep display order stable as [john, mike]. */
const ORDER = 0;
const HEADS = 0;
const TAILS = 0.9;

/** Advance past every timer the flip schedules. */
function settle() {
  act(() => {
    vi.advanceTimersByTime(5000);
  });
}


beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('CoinFlip — called mode', () => {
  it('shows both participants before anything is flipped', () => {
    render(<CoinFlip participantA={john} participantB={mike} random={sequence(ORDER)} />);

    expect(screen.getByText('John vs Mike')).toBeInTheDocument();
  });

  it('offers heads and tails only after the flip is started', async () => {
    render(<CoinFlip participantA={john} participantB={mike} random={sequence(ORDER)} />);

    // The call cannot be made while the coin is still on the table.
    expect(screen.queryByRole('button', { name: 'Heads' })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Flip for it' }));

    expect(screen.getByRole('button', { name: 'Heads' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Tails' })).toBeInTheDocument();
  });

  // Regression: the coin used to be mounted only once the flip began, which
  // meant it was created already at its final rotation. A CSS transition
  // animates a change, so it painted there and nothing ever visibly moved —
  // invisible to every state-machine test in this file. The coin must exist,
  // at rest, before anything spins.
  it('has the coin on screen at rest before any flip starts', async () => {
    render(<CoinFlip participantA={john} participantB={mike} random={sequence(ORDER)} />);

    const coin = screen.getByTestId('coin');
    expect(coin).toBeInTheDocument();
    expect(coin).toHaveAttribute('data-spinning', 'false');
  });

  it('spins the coin while it is in the air, then settles', async () => {
    render(
      <CoinFlip participantA={john} participantB={mike} random={sequence(ORDER, HEADS)} />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Flip for it' }));
    fireEvent.click(screen.getByRole('button', { name: 'Heads' }));
    fireEvent.click(screen.getByRole('button', { name: 'Throw the coin' }));

    // Airborne: spinning, and the face is deliberately not named yet.
    expect(screen.getByTestId('coin')).toHaveAttribute('data-spinning', 'true');
    expect(screen.queryByText('Heads', { selector: 'span' })).not.toBeInTheDocument();

    settle();

    expect(screen.getByTestId('coin')).toHaveAttribute('data-spinning', 'false');
    expect(screen.getByTestId('coin')).toHaveAttribute('data-face', 'heads');
  });

  it('gives the win to the caller when the coin agrees', async () => {
    render(
      <CoinFlip participantA={john} participantB={mike} random={sequence(ORDER, HEADS)} />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Flip for it' }));
    fireEvent.click(screen.getByRole('button', { name: 'Heads' }));
    fireEvent.click(screen.getByRole('button', { name: 'Throw the coin' }));
    settle();

    // Mike calls by default (the side who did not start it).
    expect(screen.getByText('Mike wins the flip')).toBeInTheDocument();
  });

  it('gives the win to the other participant when the coin disagrees', async () => {
    render(
      <CoinFlip participantA={john} participantB={mike} random={sequence(ORDER, TAILS)} />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Flip for it' }));
    fireEvent.click(screen.getByRole('button', { name: 'Heads' }));
    fireEvent.click(screen.getByRole('button', { name: 'Throw the coin' }));
    settle();

    expect(screen.getByText('John wins the flip')).toBeInTheDocument();
  });

  it('fires onResult exactly once, matching what the UI shows', async () => {
    const onResult = vi.fn();
    render(
      <CoinFlip
        participantA={john}
        participantB={mike}
        random={sequence(ORDER, TAILS)}
        onResult={onResult}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Flip for it' }));
    fireEvent.click(screen.getByRole('button', { name: 'Heads' }));
    fireEvent.click(screen.getByRole('button', { name: 'Throw the coin' }));
    settle();

    expect(onResult).toHaveBeenCalledTimes(1);
    expect(onResult.mock.calls[0][0]).toMatchObject({
      winner: john,
      loser: mike,
      call: 'heads',
      face: 'tails',
      callerId: mike.id,
    });
    expect(screen.getByText(`${onResult.mock.calls[0][0].winner.name} wins the flip`)).toBeInTheDocument();
  });

  it('lets an explicit callerId put the call on the other side', async () => {
    render(
      <CoinFlip
        participantA={john}
        participantB={mike}
        callerId={john.id}
        random={sequence(ORDER, HEADS)}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Flip for it' }));

    expect(screen.getByText('John calls it')).toBeInTheDocument();
  });

  it('falls back to the default caller when callerId matches nobody', async () => {
    render(
      <CoinFlip
        participantA={john}
        participantB={mike}
        callerId="not-a-participant"
        random={sequence(ORDER, HEADS)}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Flip for it' }));

    // Documented default, not a random pick and not a crash.
    expect(screen.getByText('Mike calls it')).toBeInTheDocument();
  });

  it('hides the re-flip control when re-flipping is disabled', async () => {
    render(
      <CoinFlip
        participantA={john}
        participantB={mike}
        allowReflip={false}
        random={sequence(ORDER, HEADS)}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Flip for it' }));
    fireEvent.click(screen.getByRole('button', { name: 'Heads' }));
    fireEvent.click(screen.getByRole('button', { name: 'Throw the coin' }));
    settle();

    expect(screen.queryByRole('button', { name: 'Flip again' })).not.toBeInTheDocument();
  });

  it('re-flips straight back to the call, not out to idle', async () => {
    render(
      <CoinFlip participantA={john} participantB={mike} random={sequence(ORDER, HEADS)} />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Flip for it' }));
    fireEvent.click(screen.getByRole('button', { name: 'Heads' }));
    fireEvent.click(screen.getByRole('button', { name: 'Throw the coin' }));
    settle();

    fireEvent.click(screen.getByRole('button', { name: 'Flip again' }));

    // Straight to the call. Sending the player back to 'Flip for it' would ask
    // them to press the same intent twice.
    expect(screen.getByRole('button', { name: 'Heads' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Flip for it' })).not.toBeInTheDocument();
  });

  it('stays on the result rather than resetting itself', async () => {
    render(
      <CoinFlip participantA={john} participantB={mike} random={sequence(ORDER, HEADS)} />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Flip for it' }));
    fireEvent.click(screen.getByRole('button', { name: 'Heads' }));
    fireEvent.click(screen.getByRole('button', { name: 'Throw the coin' }));
    settle();
    settle();

    expect(screen.getByText('Mike wins the flip')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Flip for it' })).not.toBeInTheDocument();
  });
});

describe('CoinFlip — two roles, two players', () => {
  // A coin flip is fair because the person calling is not the person who
  // controls the toss. Those are two roles, and before this they were one tap
  // performed by whoever held the phone — which is invisible on a shared
  // screen and hands the entire flip to one player once they are on separate
  // devices.

  it('will not throw until a call is on record', async () => {
    render(<CoinFlip participantA={john} participantB={mike} random={sequence(ORDER, HEADS)} />);

    fireEvent.click(screen.getByRole('button', { name: 'Flip for it' }));

    // The call comes first. There is nothing to throw against yet.
    expect(screen.queryByRole('button', { name: 'Throw the coin' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Heads' })).toBeInTheDocument();
  });

  it('shows both players the call before the coin is thrown', async () => {
    render(<CoinFlip participantA={john} participantB={mike} random={sequence(ORDER, HEADS)} />);

    fireEvent.click(screen.getByRole('button', { name: 'Flip for it' }));
    fireEvent.click(screen.getByRole('button', { name: 'Tails' }));

    // Visible to both sides while the coin is still on the table, so the throw
    // settles something already agreed rather than announced afterwards.
    expect(screen.getByText(/called tails/)).toBeInTheDocument();
    expect(screen.getByTestId('coin')).toHaveAttribute('data-spinning', 'false');
  });

  it('offers the caller only the call, on their own device', async () => {
    // Mike calls by default; this is Mike's screen.
    render(
      <CoinFlip
        participantA={john}
        participantB={mike}
        viewerId={mike.id}
        random={sequence(ORDER, HEADS)}
      />
    );

    // Mike does not hold the coin, so he cannot start it either.
    expect(screen.queryByRole('button', { name: 'Flip for it' })).not.toBeInTheDocument();
    expect(screen.getByText(/Waiting for John to start/)).toBeInTheDocument();
  });

  it('offers the flipper only the throw, on their own device', async () => {
    // John throws by default; this is John's screen.
    render(
      <CoinFlip
        participantA={john}
        participantB={mike}
        viewerId={john.id}
        random={sequence(ORDER, HEADS)}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Flip for it' }));

    // The call is Mike's to make. John waits, and is not offered it.
    expect(screen.queryByRole('button', { name: 'Heads' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Tails' })).not.toBeInTheDocument();
    expect(screen.getByText(/Waiting for Mike to call it/)).toBeInTheDocument();
  });

  it('lets the roles be swapped', async () => {
    // John calls and Mike throws — the reverse of the defaults.
    render(
      <CoinFlip
        participantA={john}
        participantB={mike}
        callerId={john.id}
        flipperId={mike.id}
        viewerId={john.id}
        random={sequence(ORDER, HEADS)}
      />
    );

    // John calls now, so he waits on Mike to start rather than starting.
    expect(screen.getByText(/Waiting for Mike to start/)).toBeInTheDocument();
  });

  it('never offers one player the other player’s control', async () => {
    // The guard that matters once they are apart: whatever state a screen is
    // in, it only ever offers its own player's move.
    //
    // Note what this does NOT test. Two mounts do not share state, so this
    // cannot drive a flip across two devices — keeping them in step is the
    // room's job, through the database, not the component's. The component
    // renders one device's view of a flip it is told about.
    const mikeView = render(
      <CoinFlip participantA={john} participantB={mike} viewerId={mike.id} random={sequence(ORDER)} />
    );

    // Mike calls, so he is never offered the coin.
    expect(screen.queryByRole('button', { name: 'Flip for it' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Throw the coin' })).not.toBeInTheDocument();
    mikeView.unmount();

    // John throws, so he is never offered the call.
    render(
      <CoinFlip participantA={john} participantB={mike} viewerId={john.id} random={sequence(ORDER)} />
    );
    fireEvent.click(screen.getByRole('button', { name: 'Flip for it' }));

    expect(screen.queryByRole('button', { name: 'Heads' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Tails' })).not.toBeInTheDocument();
  });
});

describe('CoinFlip — quick mode', () => {
  it('never offers heads or tails to the user', async () => {
    render(
      <CoinFlip
        participantA={john}
        participantB={mike}
        mode="quick"
        random={sequence(ORDER, HEADS, HEADS)}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Quick flip' }));

    expect(screen.queryByRole('button', { name: 'Heads' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Tails' })).not.toBeInTheDocument();
  });

  it('shows the assignment BEFORE the coin is in the air', async () => {
    render(
      <CoinFlip
        participantA={john}
        participantB={mike}
        mode="quick"
        random={sequence(ORDER, HEADS, HEADS)}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Quick flip' }));

    // The assignment is on screen and the coin has NOT launched yet. This is
    // the beat that makes a quick flip watchable instead of asserted. The coin
    // is present but at rest — it has to be on screen before it can spin.
    expect(screen.getByText(/Heads → John/)).toBeInTheDocument();
    expect(screen.getByTestId('coin')).toHaveAttribute('data-spinning', 'false');
  });

  it('reaches a winner named on screen', async () => {
    render(
      <CoinFlip
        participantA={john}
        participantB={mike}
        mode="quick"
        random={sequence(ORDER, HEADS, TAILS)}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Quick flip' }));
    settle();

    // John holds heads; the coin landed tails, so Mike wins.
    expect(screen.getByText('Mike wins the flip')).toBeInTheDocument();
  });

  it('re-flips straight into a new flip, not back to the button', async () => {
    render(
      <CoinFlip
        participantA={john}
        participantB={mike}
        mode="quick"
        random={sequence(ORDER, HEADS, HEADS)}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Quick flip' }));
    settle();
    fireEvent.click(screen.getByRole('button', { name: 'Flip again' }));

    // A fresh assignment is already on screen and the coin has not launched —
    // the same opening beat as the first flip, with no button in between.
    expect(screen.getByText(/Heads → /)).toBeInTheDocument();
    expect(screen.getByTestId('coin')).toHaveAttribute('data-spinning', 'false');
    expect(screen.queryByRole('button', { name: 'Quick flip' })).not.toBeInTheDocument();

    // And it still completes on its own.
    settle();
    expect(screen.getByText(/wins the flip/)).toBeInTheDocument();
  });

  it('drives the assignment from the injected source', async () => {
    render(
      <CoinFlip
        participantA={john}
        participantB={mike}
        mode="quick"
        random={sequence(ORDER, TAILS, HEADS)}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Quick flip' }));

    // Flipping the assignment source flips who holds heads — proof the
    // assignment is actually driven, not fixed to entry order.
    expect(screen.getByText(/Heads → Mike/)).toBeInTheDocument();
  });

  it('reports the same winner through onResult as it displays', async () => {
    const onResult = vi.fn();
    render(
      <CoinFlip
        participantA={john}
        participantB={mike}
        mode="quick"
        random={sequence(ORDER, HEADS, HEADS)}
        onResult={onResult}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Quick flip' }));
    settle();

    expect(onResult).toHaveBeenCalledTimes(1);
    expect(screen.getByText(`${onResult.mock.calls[0][0].winner.name} wins the flip`)).toBeInTheDocument();
  });
});

describe('CoinFlip — silent and visible flips agree', () => {
  // The silent quickFlip and the mounted component must be the SAME flip, not
  // two implementations that happen to look alike. If they ever diverge, an
  // operator who switches a league from 'flip a coin' to 'set random breaker'
  // silently changes the odds — the kind of thing nobody would think to check.
  //
  // The component draws one extra value first for its cosmetic display-order
  // shuffle, so the sources are offset by ORDER and otherwise identical.
  it.each([
    [0, 0],
    [0, 0.99],
    [0.99, 0],
    [0.99, 0.99],
  ])('agrees with quickFlip for assignment %s and toss %s', async (assign, toss) => {
    const { unmount } = render(
      <CoinFlip
        participantA={john}
        participantB={mike}
        mode="quick"
        random={sequence(ORDER, assign, toss)}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Quick flip' }));
    settle();

    const silent = quickFlip(john, mike, sequence(assign, toss));
    expect(screen.getByText(`${silent.winner.name} wins the flip`)).toBeInTheDocument();

    unmount();
  });
});

describe('CoinFlip — lifecycle', () => {
  it('does not fire onResult after unmounting mid-flight', async () => {
    const onResult = vi.fn();
    const { unmount } = render(
      <CoinFlip
        participantA={john}
        participantB={mike}
        random={sequence(ORDER, HEADS)}
        onResult={onResult}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Flip for it' }));
    fireEvent.click(screen.getByRole('button', { name: 'Heads' }));
    fireEvent.click(screen.getByRole('button', { name: 'Throw the coin' }));
    unmount();
    settle();

    expect(onResult).not.toHaveBeenCalled();
  });
});
