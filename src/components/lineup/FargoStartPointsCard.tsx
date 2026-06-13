/**
 * @fileoverview Fargo Start-Points Negotiation Card (Unit 11c)
 *
 * Renders after both captains have locked their lineups on a Fargo match.
 * Both captains must agree on the start-points value before the match
 * proceeds to scoring. Either captain can edit the value (BCA's official
 * FargoRate app is the source of truth if it disagrees with our computed
 * number), and the opponent must re-confirm after any edit.
 *
 * States surfaced:
 *   - awaiting_opponent_confirm: I proposed/confirmed; opponent hasn't
 *   - awaiting_my_confirm: opponent proposed; I need to confirm or edit
 *   - pending_initial_write: waiting for home client to write default
 *   - both_confirmed: (not rendered — parent navigates instead)
 */

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';
import type { FargoNegotiationState } from '@/hooks/lineup/useFargoStartPointsNegotiation';

interface FargoStartPointsCardProps {
  negotiation: FargoNegotiationState;
  homeTeamName: string;
  awayTeamName: string;
  isHomeTeam: boolean;
}

export function FargoStartPointsCard({
  negotiation,
  homeTeamName,
  awayTeamName,
  isHomeTeam,
}: FargoStartPointsCardProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);

  // Reset the draft whenever the current value changes (e.g., opponent
  // edited while we had the form open).
  useEffect(() => {
    if (negotiation.currentValue !== null) {
      setDraft(String(negotiation.currentValue));
    }
  }, [negotiation.currentValue]);

  if (!negotiation.applicable || negotiation.bothConfirmed) return null;

  const { status, currentValue, computedDefault, weakerTeam } = negotiation;

  const weakerTeamName =
    weakerTeam === 'home'
      ? homeTeamName
      : weakerTeam === 'away'
        ? awayTeamName
        : weakerTeam === 'even'
          ? null // perfectly matched — show "teams are evenly rated" note
          : null;
  const teamsEvenlyMatched = weakerTeam === 'even';

  const myLabel = isHomeTeam ? homeTeamName : awayTeamName;
  const opponentLabel = isHomeTeam ? awayTeamName : homeTeamName;

  const computedMatchesCurrent =
    computedDefault !== null && currentValue === computedDefault;

  const handleSubmitEdit = async () => {
    const parsed = Number.parseInt(draft, 10);
    if (!Number.isFinite(parsed) || parsed < 0) return;
    setSaving(true);
    try {
      await negotiation.propose(parsed);
      setEditing(false);
    } finally {
      setSaving(false);
    }
  };

  const handleConfirm = async () => {
    setSaving(true);
    try {
      await negotiation.confirm();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="border-info/40 bg-info/10">
      <CardHeader>
        <CardTitle className="text-lg">Confirm Start Points</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {status === 'pending_initial_write' && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Calculating start points from the locked lineups...
          </div>
        )}

        {status !== 'pending_initial_write' && currentValue !== null && (
          <>
            <p className="text-sm text-foreground">
              Before the match starts, both captains must agree on the
              start-points value the weaker team receives. If BCA&apos;s FargoRate
              app shows a different number, edit the value here so both apps
              match.
            </p>

            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <div className="text-muted-foreground">Computed default</div>
                <div className="text-lg font-semibold">
                  {computedDefault !== null ? computedDefault : '—'}
                </div>
              </div>
              <div>
                <div className="text-muted-foreground">Current proposal</div>
                <div className="text-lg font-semibold">{currentValue}</div>
              </div>
            </div>

            {weakerTeamName && (
              <p className="text-xs text-muted-foreground">
                Start points go to <strong>{weakerTeamName}</strong> (the
                weaker team by rating total).
              </p>
            )}
            {teamsEvenlyMatched && (
              <p className="text-xs text-muted-foreground">
                Teams are evenly rated — no start points apply.
              </p>
            )}

            {!computedMatchesCurrent && computedDefault !== null && (
              <p className="text-xs text-warning">
                Note: current proposal differs from the computed default (
                {computedDefault}).
              </p>
            )}

            {editing ? (
              <div className="space-y-2">
                <Label htmlFor="startPointsDraft" className="text-sm">
                  New start-points value
                </Label>
                <Input
                  id="startPointsDraft"
                  type="number"
                  min={0}
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                />
                <div className="flex gap-2">
                  <Button
                    onClick={handleSubmitEdit}
                    disabled={saving || draft.trim() === ''}
                    loadingText="Saving..."
                  >
                    Submit value
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setEditing(false);
                      setDraft(String(currentValue));
                    }}
                    disabled={saving}
                    loadingText="none"
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <>
                {status === 'awaiting_opponent_confirm' && (
                  <div className="rounded-md bg-card p-3 text-sm">
                    <p className="font-medium">
                      You confirmed <strong>{currentValue}</strong>.
                    </p>
                    <p className="text-muted-foreground mt-1">
                      Waiting for {opponentLabel} to confirm.
                    </p>
                  </div>
                )}

                {status === 'awaiting_my_confirm' && (
                  <div className="rounded-md bg-card p-3 text-sm">
                    <p className="font-medium">
                      {opponentLabel} proposed <strong>{currentValue}</strong>.
                    </p>
                    <p className="text-muted-foreground mt-1">
                      Confirm this value or edit it to match your FargoRate
                      app, then {opponentLabel} will re-confirm.
                    </p>
                  </div>
                )}

                <div className="flex gap-2">
                  {status === 'awaiting_my_confirm' && (
                    <Button
                      onClick={handleConfirm}
                      disabled={saving}
                      loadingText="Confirming..."
                    >
                      Confirm {currentValue}
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    onClick={() => setEditing(true)}
                    disabled={saving}
                    loadingText="none"
                  >
                    Edit value
                  </Button>
                </div>

                <p className="text-xs text-muted-foreground">
                  ({myLabel} is{' '}
                  {negotiation.myConfirmed ? 'confirmed' : 'unconfirmed'};{' '}
                  {opponentLabel} is{' '}
                  {negotiation.opponentConfirmed ? 'confirmed' : 'unconfirmed'}
                  .)
                </p>
              </>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
