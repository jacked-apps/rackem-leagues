/**
 * @fileoverview The coin itself — a dumb visual with no opinion about the flip.
 *
 * Split out from `CoinFlip.tsx` so the component that owns the state machine is
 * not also carrying transform maths. It knows a face and whether it is in the
 * air; it does not know who is playing or who won.
 *
 * The spin is a plain CSS transition on `rotateX`, not a keyframe animation, so
 * the component carries its own motion instead of depending on a global
 * stylesheet. That keeps "drop it on any page and it works" true.
 */

import { cn } from '@/lib/utils';
import type { Face } from './types';

/** Half-turns the coin makes before settling. Even lands heads-up, odd tails-up. */
const HALF_TURNS = 10;

interface CoinProps {
  /** The face currently showing, or resting face once settled. */
  face: Face;
  /** True while the coin is in the air. */
  spinning: boolean;
  /** How long the spin takes. Zero under reduced motion. */
  durationMs: number;
}

/**
 * Compute the resting rotation.
 *
 * Every 180deg shows the opposite side, so landing on tails means finishing on
 * an odd number of half-turns. The coin therefore genuinely comes to rest on
 * the face it reports, rather than snapping to it after an unrelated spin.
 */
function restingRotation(face: Face, spinning: boolean): number {
  if (!spinning) return face === 'heads' ? 0 : 180;

  const halfTurns = face === 'heads' ? HALF_TURNS : HALF_TURNS + 1;
  return halfTurns * 180;
}

/**
 * The coin.
 *
 * Renders the face as a letter AND spells it out beneath, because a coin that
 * distinguishes its sides only by color or shading is unreadable to anyone who
 * cannot separate those — and the face is the evidence for the result.
 */
export function Coin({ face, spinning, durationMs }: CoinProps) {
  return (
    <div className="flex flex-col items-center gap-2" style={{ perspective: '600px' }}>
      <div
        data-testid="coin"
        data-face={face}
        data-spinning={spinning}
        className={cn(
          'flex h-24 w-24 items-center justify-center rounded-full',
          'border-4 border-amber-600 bg-amber-400 text-3xl font-bold text-amber-950',
          'shadow-md'
        )}
        style={{
          transform: `rotateX(${restingRotation(face, spinning)}deg)`,
          // Transition ONLY while airborne. Once settled the rotation drops back
          // to its 0/180 resting value, which is congruent mod 360 with where
          // the spin ended — so the change is invisible, but only if nothing is
          // animating it. Leaving the transition on would play the whole spin
          // backwards the moment the coin lands.
          transition: spinning && durationMs > 0 ? `transform ${durationMs}ms ease-out` : undefined,
        }}
      >
        {face === 'heads' ? 'H' : 'T'}
      </div>
      <span className="text-sm font-medium text-muted-foreground">
        {face === 'heads' ? 'Heads' : 'Tails'}
      </span>
    </div>
  );
}
