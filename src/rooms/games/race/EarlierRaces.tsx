/**
 * @fileoverview The races already played in this room, one line each with the
 * final score — so a Run it back never wipes the result before it.
 *
 * Scores count SETTLED games only (both players agreed), the same rule the
 * race's own scoreboard uses. The winner is named in words, never marked by
 * colour alone.
 */
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { RoomRaceLink } from './roomRaceApi';

interface EarlierRacesProps {
  /** Earlier races, oldest first. Renders nothing when empty. */
  links: RoomRaceLink[];
  /** Display name for a member, from the room's phones. */
  nameOf: (memberId: string | undefined) => string | undefined;
}

/** "Ed 5, Jack 3 — Ed won." for one finished race. */
function summary(race: NonNullable<RoomRaceLink['race']>, nameOf: EarlierRacesProps['nameOf']): string {
  const settled = race.race_games.filter(
    (g) => g.winner_player_id !== null && g.confirmed_by_home !== null && g.confirmed_by_away !== null
  );
  const won = (id: string) => settled.filter((g) => g.winner_player_id === id).length;
  const home = nameOf(race.home_member_id) ?? 'Home';
  const away = nameOf(race.away_member_id) ?? 'Away';
  const score = `${home} ${won(race.home_member_id)}, ${away} ${won(race.away_member_id)}`;
  if (!race.winner_player_id) return `${score} — not finished.`;
  const winner = race.winner_player_id === race.home_member_id ? home : away;
  return `${score} — ${winner} won.`;
}

export function EarlierRaces({ links, nameOf }: EarlierRacesProps) {
  const shown = links.filter((l) => l.race !== null);
  if (shown.length === 0) return null;

  return (
    <Card className="mx-auto w-full max-w-2xl">
      <CardHeader>
        <CardTitle className="text-base">Earlier races</CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="space-y-1 text-sm">
          {shown.map((l) => (
            <li key={l.id}>
              <span className="font-medium">Race {l.seq}:</span> {summary(l.race!, nameOf)}
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
