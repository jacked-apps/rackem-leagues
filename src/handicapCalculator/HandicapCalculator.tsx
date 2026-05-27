/**
 * @fileoverview Fargo-style team handicap calculator (dev/staging only).
 *
 * Standalone explainer page. Enter 5 Fargo ratings per side, get an
 * estimated spot-games handicap plus a plain-English "how to win"
 * breakdown. Math lives in fargoHandicap.ts. Gated to non-production by
 * NonProdGate (wired up in NavRoutes).
 */

import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Home } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { NumberInput } from '@/components/ui/number-input';
import {
  computeHandicap,
  TOTAL_GAMES_PER_MATCH,
} from './fargoHandicap';

type RatingSlots = [number, number, number, number, number];

const EMPTY: RatingSlots = [0, 0, 0, 0, 0];

export function HandicapCalculator() {
  const [home, setHome] = useState<RatingSlots>(EMPTY);
  const [away, setAway] = useState<RatingSlots>(EMPTY);

  const result = useMemo(() => computeHandicap(home, away), [home, away]);
  const ready = home.every((r) => r > 0) && away.every((r) => r > 0);

  const setSlot =
    (setter: typeof setHome) =>
    (idx: number, val: number) => {
      setter((prev) => {
        const next = [...prev] as RatingSlots;
        next[idx] = val;
        return next;
      });
    };

  return (
    <div className="mx-auto max-w-3xl space-y-4 p-4">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Fargo Handicap Calculator</h1>
          <p className="text-sm text-muted-foreground">
            Educational estimate for a 5v5, 25-game team match. Not an official
            Fargo Rate calculation — values may differ from LMS by ±1–2 games.
          </p>
        </div>
        <Button variant="outline" size="sm" asChild>
          <Link to="/">
            <Home className="size-4" />
            Home
          </Link>
        </Button>
      </header>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <TeamCard title="Home Team" ratings={home} onChange={setSlot(setHome)} />
        <TeamCard title="Away Team" ratings={away} onChange={setSlot(setAway)} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Result</CardTitle>
        </CardHeader>
        <CardContent>
          {ready ? <ResultBlock result={result} /> : <EmptyState />}
        </CardContent>
      </Card>
    </div>
  );
}

interface TeamCardProps {
  title: string;
  ratings: RatingSlots;
  onChange: (idx: number, val: number) => void;
}

function TeamCard({ title, ratings, onChange }: TeamCardProps) {
  const total = ratings.reduce((a, b) => a + b, 0);
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {ratings.map((r, i) => (
          <div key={i} className="flex items-center gap-2">
            <Label className="w-20 text-xs">Player {i + 1}</Label>
            <NumberInput
              value={r}
              onChange={(v) => onChange(i, v)}
              min={0}
              max={900}
            />
          </div>
        ))}
        <div className="pt-2 text-sm font-medium">Total: {total}</div>
      </CardContent>
    </Card>
  );
}

function EmptyState() {
  return (
    <p className="text-sm text-muted-foreground">
      Enter all 10 ratings (5 per team) to see the handicap estimate.
    </p>
  );
}

function ResultBlock({
  result,
}: {
  result: ReturnType<typeof computeHandicap>;
}) {
  const {
    homeRatingTotal,
    awayRatingTotal,
    ratingGap,
    spotTeam,
    spotGames,
    homeGamesToWin,
    awayGamesToWin,
  } = result;

  const spotLabel =
    spotTeam === null
      ? 'Teams are evenly rated — no handicap spot awarded.'
      : `${spotTeam === 'home' ? 'Home' : 'Away'} team gets a ${spotGames}-game head start.`;

  return (
    <div className="space-y-3 text-sm">
      <div className="grid grid-cols-2 gap-2">
        <Row label="Home total" value={homeRatingTotal} />
        <Row label="Away total" value={awayRatingTotal} />
        <Row label="Rating gap" value={ratingGap} />
        <Row label="Spot games" value={spotGames} />
      </div>

      <p className="font-medium">{spotLabel}</p>

      <div className="rounded-md border bg-muted/40 p-3 space-y-1">
        <p className="font-semibold">To win the match:</p>
        <p>
          Home needs to win at least{' '}
          <strong>{homeGamesToWin}</strong> of the {TOTAL_GAMES_PER_MATCH} games.
        </p>
        <p>
          Away needs to win at least{' '}
          <strong>{awayGamesToWin}</strong> of the {TOTAL_GAMES_PER_MATCH} games.
        </p>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex justify-between border-b py-1">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}
