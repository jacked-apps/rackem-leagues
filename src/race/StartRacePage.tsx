/**
 * @fileoverview A stand-in way to start a race, so a race can be played before
 * the game room exists to launch one.
 *
 * DISPOSABLE. The real entrance is the game room: two people are already
 * together in it, one of them picks Race, and it calls the same `create_race`
 * this page calls. When that lands, this page can go and nothing else moves —
 * which is the point of `create_race` being the seam rather than this form.
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/supabaseClient';
import { queryKeys } from '@/api/queryKeys';
import { useCurrentMember } from '@/api/hooks/useCurrentMember';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { NumberInput } from '@/components/ui/number-input';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { useCreateRace, type NewRace } from './useRaceActions';

function useOpponents(meId: string | undefined) {
  return useQuery({
    queryKey: [...queryKeys.members.all, 'race-opponents', meId ?? ''],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('members')
        .select('id, nickname, first_name, last_name')
        .neq('id', meId!)
        .order('first_name')
        .limit(50);
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!meId,
  });
}

export function StartRacePage() {
  const navigate = useNavigate();
  const { data: me } = useCurrentMember();
  const { data: opponents, isLoading } = useOpponents(me?.id);
  const createRace = useCreateRace();

  const [opponentId, setOpponentId] = useState('');
  const [goalMine, setGoalMine] = useState(5);
  const [goalTheirs, setGoalTheirs] = useState(5);
  const [breakRule, setBreakRule] = useState<NewRace['breakRule']>('alternate');
  const [gameType, setGameType] = useState<NewRace['gameType']>('eight_ball');

  if (isLoading || !me) return <LoadingSpinner />;

  const start = async () => {
    const result = await createRace.mutateAsync({
      homeMemberId: me.id,
      awayMemberId: opponentId,
      goalHome: goalMine,
      goalAway: goalTheirs,
      breakRule,
      gameType,
    });
    if (result.ok && typeof result.race_id === 'string') {
      navigate(`/race/${result.race_id}`);
    }
  };

  return (
    <div className="mx-auto w-full max-w-lg space-y-4 p-4">
      <Card>
        <CardHeader>
          <CardTitle>Start a race</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="opponent">Playing against</Label>
            <Select value={opponentId} onValueChange={setOpponentId}>
              <SelectTrigger id="opponent">
                <SelectValue placeholder="Pick your opponent" />
              </SelectTrigger>
              <SelectContent>
                {(opponents ?? []).map((o) => (
                  <SelectItem key={o.id} value={o.id}>
                    {o.nickname || [o.first_name, o.last_name].filter(Boolean).join(' ')}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Two targets, not one. Equal is the ordinary race; unequal is a
              handicap, where the stronger player has further to go. */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="goal-mine">You race to</Label>
              <NumberInput id="goal-mine" min={1} value={goalMine} onChange={setGoalMine} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="goal-theirs">They race to</Label>
              <NumberInput id="goal-theirs" min={1} value={goalTheirs} onChange={setGoalTheirs} />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="break-rule">Break</Label>
            <Select
              value={breakRule}
              onValueChange={(v) => setBreakRule(v as NewRace['breakRule'])}
            >
              <SelectTrigger id="break-rule">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="alternate">Alternate break</SelectItem>
                <SelectItem value="winner_breaks">Winner breaks</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="game-type">Game</Label>
            <Select value={gameType} onValueChange={(v) => setGameType(v as NewRace['gameType'])}>
              <SelectTrigger id="game-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="eight_ball">8-ball</SelectItem>
                <SelectItem value="nine_ball">9-ball</SelectItem>
                <SelectItem value="ten_ball">10-ball</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Button handles the pending state itself from the thenable onClick,
              which is why loadingText is required rather than optional. */}
          <Button className="w-full" loadingText="Starting…" disabled={!opponentId} onClick={start}>
            Start race
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
