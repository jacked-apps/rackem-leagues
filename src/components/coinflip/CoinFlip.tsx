/**
 * @fileoverview A reusable coin flip: two participants in, one winner out.
 *
 * Knows nothing about matches, leagues, breaks or ties. Callers bring two
 * names and receive a result; what the result decides is entirely theirs.
 *
 * Two modes share one state machine:
 *   - `call`  — a human picks heads or tails, then the coin flips.
 *   - `quick` — the app assigns the faces, SHOWS the assignment, then flips.
 *
 * They differ in exactly one state. Both arrive at `flipping` and resolve
 * through the same rules, so neither mode has its own notion of who won.
 *
 * The ordering is structural, not conventional: a call is recorded in state
 * before `tossCoin` is ever invoked, so nobody can call it after the coin is
 * already in the air. That is the difference between a flip people watch and a
 * result they are asked to believe.
 *
 * @example
 * <CoinFlip
 *   participantA={{ id: 'p1', name: 'John' }}
 *   participantB={{ id: 'p2', name: 'Mike' }}
 *   onResult={(r) => console.log(`${r.winner.name} breaks`)}
 * />
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Coin } from './Coin';
import { assignFaces, resolveFlip, shuffleOrder, tossCoin } from './flipCoin';
import type { Call, Face, FaceAssignment, FlipResult, Participant, RandomSource } from './types';

/** How long the assignment is on screen before the coin launches, in quick mode. */
const ASSIGNMENT_REVEAL_MS = 900;

/** How long the coin is in the air. Shared by the CSS transition and the timer. */
const FLIP_DURATION_MS = 1400;

/**
 * Where the flip currently is.
 *
 * `calling` (human picks) and `assigned` (app picked, showing its work) are the
 * mode-specific states. Everything else is shared.
 */
type Phase = 'idle' | 'calling' | 'assigned' | 'flipping' | 'result';

interface CoinFlipProps {
  /** One side of the flip. */
  participantA: Participant;
  /** The other side. */
  participantB: Participant;
  /**
   * `call` waits for a human to pick heads or tails. `quick` has the app assign
   * the faces and show the assignment before flipping. Defaults to `call`.
   */
  mode?: 'call' | 'quick';
  /**
   * Who makes the call, in `call` mode. Defaults to `participantB` on the
   * reasoning that the side who did not start the flip should call it. Ignored
   * in `quick` mode, where the app calls.
   */
  callerId?: string;
  /** Fired once per settled flip, with the same result the UI displays. */
  onResult?: (result: FlipResult) => void;
  /** Whether a "Flip again" control is offered after a result. Defaults to true. */
  allowReflip?: boolean;
  /** Source of randomness. Injected so tests can pin an outcome. */
  random?: RandomSource;
}

export function CoinFlip({
  participantA,
  participantB,
  mode = 'call',
  callerId,
  onResult,
  allowReflip = true,
  random = Math.random,
}: CoinFlipProps) {
  const [phase, setPhase] = useState<Phase>('idle');
  const [assignment, setAssignment] = useState<FaceAssignment | null>(null);
  const [landedFace, setLandedFace] = useState<Face>('heads');
  const [result, setResult] = useState<FlipResult | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Shuffled once, not per render, so the order does not jitter as state
  // changes. Cosmetic only — `flipCoin.test.ts` pins that it cannot affect
  // who wins.
  const [[first, second]] = useState(() => shuffleOrder(participantA, participantB, random));

  // Under reduced motion the coin does not spin, but every state is still
  // entered in order — the assignment is still shown before the winner.
  const spinDuration = usePrefersReducedMotion() ? 0 : FLIP_DURATION_MS;

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  /** Toss the coin, then settle after it lands. */
  const launch = useCallback(
    (call: Call, caller: Participant, other: Participant) => {
      const face = tossCoin(random);
      setLandedFace(face);
      setPhase('flipping');

      timer.current = setTimeout(() => {
        const settled = resolveFlip(call, face, caller, other);
        setResult(settled);
        setPhase('result');
        onResult?.(settled);
      }, spinDuration);
    },
    [random, spinDuration, onResult]
  );

  /** Begin a flip. In quick mode this reveals the assignment first. */
  const start = useCallback(() => {
    if (mode === 'call') {
      setPhase('calling');
      return;
    }

    // Quick mode: the app calls. Assignment is shown as its own beat, then the
    // coin launches — a winner announced without a visible prior assignment is
    // a claim rather than an event.
    const assigned = assignFaces(participantA, participantB, random);
    setAssignment(assigned);
    setPhase('assigned');
    timer.current = setTimeout(
      () => launch('heads', assigned.heads, assigned.tails),
      ASSIGNMENT_REVEAL_MS
    );
  }, [mode, participantA, participantB, random, launch]);

  /** A human picked a side. Record it, then flip. */
  const handleCall = useCallback(
    (call: Call) => {
      const caller = participantA.id === callerId ? participantA : participantB;
      const other = caller.id === participantA.id ? participantB : participantA;
      launch(call, caller, other);
    },
    [participantA, participantB, callerId, launch]
  );

  const reset = useCallback(() => {
    setPhase('idle');
    setAssignment(null);
    setResult(null);
  }, []);

  const caller = participantA.id === callerId ? participantA : participantB;

  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle>
          {first.name} vs {second.name}
        </CardTitle>
      </CardHeader>

      <CardContent className="flex flex-col items-center gap-4">
        {phase === 'idle' && (
          <Button loadingText="none" onClick={start}>
            {mode === 'quick' ? 'Quick flip' : 'Flip for it'}
          </Button>
        )}

        {phase === 'calling' && (
          <>
            <p className="text-sm text-muted-foreground">{caller.name} calls it</p>
            <div className="flex gap-2">
              <Button loadingText="none" onClick={() => handleCall('heads')}>Heads</Button>
              <Button loadingText="none" onClick={() => handleCall('tails')}>Tails</Button>
            </div>
          </>
        )}

        {assignment && (phase === 'assigned' || phase === 'flipping' || phase === 'result') && (
          <p className="text-sm text-muted-foreground">
            Heads &rarr; {assignment.heads.name} &middot; Tails &rarr; {assignment.tails.name}
          </p>
        )}

        {/* Always mounted, never conditional. A CSS transition animates a
            CHANGE, so the coin has to be on screen at rest before it can be
            seen to spin — mounting it at the moment the flip starts paints it
            straight at its final rotation and nothing appears to move. */}
        <Coin face={landedFace} spinning={phase === 'flipping'} durationMs={spinDuration} />

        {phase === 'result' && result && (
          <>
            {/* The winner is stated by NAME — the face is supporting evidence,
                never the answer on its own. */}
            <p className="text-lg font-semibold">{result.winner.name} wins the flip</p>
            <p className="text-sm text-muted-foreground">
              Called {result.call} &middot; landed {result.face}
            </p>
            {allowReflip && (
              <Button variant="outline" onClick={reset}>
                Flip again
              </Button>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

/** True when the viewer has asked the OS for less motion. */
function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    // Guarded because jsdom/happy-dom do not always provide matchMedia.
    if (typeof window.matchMedia !== 'function') return;

    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReduced(query.matches);

    const onChange = (e: MediaQueryListEvent) => setReduced(e.matches);
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, []);

  return reduced;
}
