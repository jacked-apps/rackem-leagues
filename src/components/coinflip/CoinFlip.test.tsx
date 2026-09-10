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
    settle();

    expect(screen.queryByRole('button', { name: 'Flip again' })).not.toBeInTheDocument();
  });

  it('re-flips straight back to the call, not out to idle', async () => {
    render(
      <CoinFlip participantA={john} participantB={mike} random={sequence(ORDER, HEADS)} />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Flip for it' }));
    fireEvent.click(screen.getByRole('button', { name: 'Heads' }));
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
    settle();
    settle();

    expect(screen.getByText('Mike wins the flip')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Flip for it' })).not.toBeInTheDocument();
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
    unmount();
    settle();

    expect(onResult).not.toHaveBeenCalled();
  });
});
