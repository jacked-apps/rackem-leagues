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
 *
 * Two things here are load-bearing and easy to undo by accident:
 *
 *   1. The coin has TWO faces stacked back to back, each hiding its own
 *      backside. A single face rotated 180deg renders its letter upside down at
 *      rest, and shows nothing recognisable as "the other side" mid-spin.
 *   2. The coin must already be on screen, at rest, BEFORE it spins. A CSS
 *      transition animates a CHANGE; an element born at its final rotation just
 *      paints there. `CoinFlip` therefore mounts this in every phase and only
 *      toggles `spinning` — do not move it back inside a phase check.
 */

import { cn } from '@/lib/utils';
import type { Face } from './types';

/** Half-turns the coin makes before settling. Even lands heads-up, odd tails-up. */
const HALF_TURNS = 10;

interface CoinProps {
  /** The face showing once settled, and the face the spin is aimed at. */
  face: Face;
  /** True while the coin is in the air. */
  spinning: boolean;
  /** How long the spin takes. Zero under reduced motion. */
  durationMs: number;
}

/**
 * Compute the rotation to render at.
 *
 * Every 180deg shows the opposite side, so landing on tails means finishing on
 * an odd number of half-turns. The coin therefore genuinely comes to rest on
 * the face it reports, rather than snapping to it after an unrelated spin.
 */
function rotationFor(face: Face, spinning: boolean): number {
  if (!spinning) return face === 'heads' ? 0 : 180;

  const halfTurns = face === 'heads' ? HALF_TURNS : HALF_TURNS + 1;
  return halfTurns * 180;
}

/** Shared look of both sides, so heads and tails are the same physical coin. */
const FACE_CLASSES = cn(
  'absolute inset-0 flex items-center justify-center rounded-full',
  'border-4 border-amber-600 bg-amber-400 text-3xl font-bold text-amber-950',
  'shadow-md'
);

/**
 * The coin.
 *
 * Renders the face as a letter AND spells it out beneath, because a coin that
 * distinguishes its sides only by color or shading is unreadable to anyone who
 * cannot separate those — and the face is the evidence for the result.
 */
export function Coin({ face, spinning, durationMs }: CoinProps) {
  return (
    <div className="flex flex-col items-center gap-2">
      <div className="h-24 w-24" style={{ perspective: '600px' }}>
        <div
          data-testid="coin"
          data-face={face}
          data-spinning={spinning}
          className="relative h-full w-full"
          style={{
            transformStyle: 'preserve-3d',
            transform: `rotateX(${rotationFor(face, spinning)}deg)`,
            // Transition ONLY while airborne. Once settled the rotation drops
            // back to its 0/180 resting value, which is congruent mod 360 with
            // where the spin ended — so the change is invisible, but only if
            // nothing is animating it. Leaving the transition on would play the
            // whole spin backwards the moment the coin lands.
            transition: spinning && durationMs > 0 ? `transform ${durationMs}ms ease-out` : undefined,
          }}
        >
          <div className={FACE_CLASSES} style={{ backfaceVisibility: 'hidden' }}>
            H
          </div>
          <div
            className={FACE_CLASSES}
            style={{ backfaceVisibility: 'hidden', transform: 'rotateX(180deg)' }}
          >
            T
          </div>
        </div>
      </div>

      {/* Blank while airborne: naming the face mid-spin would announce the
          outcome a beat before the coin has actually landed on it. */}
      <span className="min-h-5 text-sm font-medium text-muted-foreground">
        {spinning ? '' : face === 'heads' ? 'Heads' : 'Tails'}
      </span>
    </div>
  );
}
