/**
 * @fileoverview Dev-only sandbox for the reusable CoinFlip component.
 *
 * The component is finished and tested but nothing in the app mounts it yet,
 * so there is no way to watch it move. This page exists purely to give it a
 * surface: every prop combination side by side, plus a log of what `onResult`
 * actually handed back, so the callback can be checked against what the UI
 * announced.
 *
 * Dev-only and deliberately unlinked — reach it by typing `/dev/coin-flip`,
 * the same way `/dev/rls-tests` is reached. Delete this file and its route
 * once a real caller mounts CoinFlip.
 */

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CoinFlip } from '@/components/coinflip/CoinFlip';
import { quickFlip } from '@/components/coinflip/flipCoin';
import type { FlipResult, Participant } from '@/components/coinflip/types';

const ED: Participant = { id: 'p1', name: 'Ed' };
const JACK: Participant = { id: 'p2', name: 'Jack' };

/** One mounted configuration of the component, with a note on what to watch for. */
interface Scenario {
  key: string;
  title: string;
  watchFor: string;
  mode?: 'call' | 'quick';
  callerId?: string;
  allowReflip?: boolean;
}

const SCENARIOS: Scenario[] = [
  {
    key: 'called-default',
    title: 'Called — default caller',
    watchFor: 'Jack calls it (the second participant calls by default).',
  },
  {
    key: 'called-explicit',
    title: 'Called — Ed calls',
    watchFor: 'An explicit callerId moves the call to the first participant.',
    callerId: ED.id,
  },
  {
    key: 'quick',
    title: 'Quick flip',
    watchFor: 'Assignment appears on its own beat, THEN the coin launches. No heads/tails buttons ever.',
    mode: 'quick',
  },
  {
    key: 'quick-no-reflip',
    title: 'Quick flip — no re-flip',
    watchFor: 'No "Flip again" button in the result state.',
    mode: 'quick',
    allowReflip: false,
  },
];

export default function CoinFlipSandbox() {
  const [log, setLog] = useState<string[]>([]);
  // Bumping this remounts every flip, which re-rolls the cosmetic display-order
  // shuffle — the only way to see that shuffle happen more than once.
  const [nonce, setNonce] = useState(0);

  const record = (title: string) => (r: FlipResult) =>
    setLog((prev) => [`${title} → ${r.winner.name} wins (called ${r.call}, landed ${r.face})`, ...prev]);

  return (
    <div className="container mx-auto space-y-6 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-bold">Coin flip sandbox</h1>
        <Button variant="outline" onClick={() => { setNonce((n) => n + 1); setLog([]); }}>
          Reset all
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {SCENARIOS.map((s) => (
          <div key={s.key} className="space-y-2">
            <div>
              <p className="font-semibold">{s.title}</p>
              <p className="text-sm text-muted-foreground">{s.watchFor}</p>
            </div>
            <CoinFlip
              key={`${s.key}-${nonce}`}
              participantA={ED}
              participantB={JACK}
              mode={s.mode}
              callerId={s.callerId}
              allowReflip={s.allowReflip}
              onResult={record(s.title)}
            />
          </div>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Silent flip — no UI at all</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <p className="text-sm text-muted-foreground">
            The same flip as a plain function call. Nothing mounts, nothing animates, nothing
            is watched — it just returns a winner. This is what a &quot;set random breaker&quot;
            setting would call. A test pins that it agrees with the visible flip.
          </p>
          <Button
            loadingText="none"
            onClick={() => {
              const r = quickFlip(ED, JACK);
              setLog((prev) => [`Silent flip → ${r.winner.name} wins (id ${r.winner.id}, landed ${r.face})`, ...prev]);
            }}
          >
            Run silent flip
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Flip log ({log.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {log.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nothing yet — flip something above.</p>
          ) : (
            <ul className="space-y-1 text-sm">
              {log.map((line, i) => (
                <li key={i} className="font-mono">{line}</li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
