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
import { assignFaces, QUICK_CALL, resolveFlip, shuffleOrder, tossCoin } from './flipCoin';
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
 *
 * `called` is the beat between the two people: the call is locked in and the
 * coin has not been thrown yet. It exists because calling and throwing are
 * done by DIFFERENT players, and collapsing them into one tap quietly hands
 * the whole flip to whoever is holding the phone.
 */
type Phase = 'idle' | 'calling' | 'called' | 'assigned' | 'flipping' | 'result';

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
   * Who calls heads or tails, in `call` mode. Defaults to `participantB` on
   * the reasoning that the side who did not start the flip should call it.
   * Ignored in `quick` mode, where the app calls.
   */
  callerId?: string;
  /**
   * Who throws the coin. Defaults to `participantA`, the side that started it.
   *
   * A coin flip is fair because the person calling is NOT the person who
   * controls the toss. Those are two roles held by two people, and they get
   * two separate acts here rather than one tap that does both.
   */
  flipperId?: string;
  /**
   * Whose device this is, when the two players are on separate screens.
   *
   * Given, the component renders only the controls belonging to that player
   * and tells them what the other side is doing. Omitted, both roles are
   * rendered on the one screen in turn — the standalone case, and the case
   * where two people share a phone.
   */
  viewerId?: string;
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
  flipperId,
  viewerId,
  onResult,
  allowReflip = true,
  random = Math.random,
}: CoinFlipProps) {
  const [phase, setPhase] = useState<Phase>('idle');
  const [assignment, setAssignment] = useState<FaceAssignment | null>(null);
  const [landedFace, setLandedFace] = useState<Face>('heads');
  const [result, setResult] = useState<FlipResult | null>(null);
  /** The call, held between the caller making it and the flipper throwing. */
  const [pendingCall, setPendingCall] = useState<Call | null>(null);
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
      () => launch(QUICK_CALL, assigned.heads, assigned.tails),
      ASSIGNMENT_REVEAL_MS
    );
  }, [mode, participantA, participantB, random, launch]);

  /**
   * A human called a side. Record it and wait for the OTHER player to throw.
   *
   * This used to toss the coin in the same breath, which made calling and
   * throwing one act performed by one person. On a shared screen nobody
   * noticed; with a player on each device it hands the entire flip to the
   * caller while the other watches.
   */
  const handleCall = useCallback((call: Call) => {
    setPendingCall(call);
    setPhase('called');
  }, []);

  /** The flipper throws the coin, against the call already on record. */
  const handleThrow = useCallback(() => {
    if (!pendingCall) return;
    const callerP = participantA.id === callerId ? participantA : participantB;
    const other = callerP.id === participantA.id ? participantB : participantA;
    launch(pendingCall, callerP, other);
  }, [pendingCall, participantA, participantB, callerId, launch]);

  /**
   * Flip again, straight back into the flip rather than out to idle.
   *
   * `Flip again` and the idle button are the same intent, so routing through
   * idle asks the player to press the same thing twice — press it, then press
   * `Quick flip` (or `Flip for it`) to get what they already asked for.
   * Reusing `start` means each mode re-enters at its own first real beat: the
   * call buttons in called mode, a freshly assigned pair of faces in quick.
   */
  const flipAgain = useCallback(() => {
    setResult(null);
    setAssignment(null);
    setPendingCall(null);
    start();
  }, [start]);

  const caller = participantA.id === callerId ? participantA : participantB;
  const flipper = participantB.id === flipperId ? participantB : participantA;

  // With no viewer named, one screen carries both roles in turn — the
  // standalone case, and two people sharing a phone. With a viewer named,
  // each device shows only what its own player may do.
  const isSharedScreen = viewerId === undefined;
  const viewerCalls = isSharedScreen || viewerId === caller.id;
  const viewerThrows = isSharedScreen || viewerId === flipper.id;

  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle>
          {first.name} vs {second.name}
        </CardTitle>
      </CardHeader>

      <CardContent className="flex flex-col items-center gap-4">
        {/* The flipper holds the coin, so the flipper starts it. */}
        {phase === 'idle' &&
          (viewerThrows ? (
            <Button loadingText="none" onClick={start}>
              {mode === 'quick' ? 'Quick flip' : 'Flip for it'}
            </Button>
          ) : (
            <p className="text-sm text-muted-foreground">
              Waiting for {flipper.name} to start
            </p>
          ))}

        {phase === 'calling' &&
          (viewerCalls ? (
            <>
              <p className="text-sm text-muted-foreground">
                {isSharedScreen ? `${caller.name} calls it` : 'Your call'}
              </p>
              <div className="flex gap-2">
                <Button loadingText="none" onClick={() => handleCall('heads')}>Heads</Button>
                <Button loadingText="none" onClick={() => handleCall('tails')}>Tails</Button>
              </div>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">
              Waiting for {caller.name} to call it
            </p>
          ))}

        {/* The call is on record and the coin has not been thrown. Both sides
            can see what was called, so the throw settles something already
            agreed rather than something announced afterwards. */}
        {phase === 'called' && pendingCall && (
          <>
            <p className="text-sm text-muted-foreground">
              {caller.name} called {pendingCall}
            </p>
            {viewerThrows ? (
              <Button loadingText="none" onClick={handleThrow}>
                Throw the coin
              </Button>
            ) : (
              <p className="text-sm text-muted-foreground">
                Waiting for {flipper.name} to throw
              </p>
            )}
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
              <Button variant="outline" onClick={flipAgain}>
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
