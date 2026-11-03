/**
 * @fileoverview The race game's Play screen: the room's race, scored on both
 * phones, then Run it back.
 *
 * Flow:
 * 1. Only the host's member in the room (one device, or the host's own two) →
 *    the "invite someone in" message; nothing is created against nobody.
 * 2. An opponent is on the guest list → `open_room_race` returns the room's
 *    latest race (the first call creates race 1, host home vs the earliest
 *    other member away) and `ScoreRace` renders it, winner-only (no extras).
 * 3. That race finished → `RunItBack` under the scoreboard, and every earlier
 *    race in the room stays listed with its final score.
 *
 * A viewer who isn't one of the two players sees the race read-only —
 * `ScoreRace` already handles a viewer with no side.
 */
import { ScoreRace } from '@/race/ScoreRace';
import { useRace } from '@/race/useRaceData';
import type { GamePlayProps } from '../types';
import { EarlierRaces } from './EarlierRaces';
import { RunItBack } from './RunItBack';
import { roomRaceRefusalCopy } from './roomRaceRefusalCopy';
import { useOpenRoomRace, useRoomRaceLinks } from './useRoomRace';

const panel = 'rounded-md border border-dashed px-3 py-8 text-center text-sm text-muted-foreground';

export function RoomRace({ roomId, myPhone, phones }: GamePlayProps) {
  // The host is home; anyone else on the guest list can be the opponent. A
  // host's second device is still the host, so it does not count.
  const hostMemberId = phones.find((p) => p.is_host)?.member_id;
  const hasOpponent = !!hostMemberId && phones.some((p) => p.member_id !== hostMemberId);

  const open = useOpenRoomRace(roomId, hasOpponent);
  const links = useRoomRaceLinks(roomId);
  const opened = open.data?.ok ? open.data : null;
  // Same cache entry ScoreRace reads, so this costs nothing extra; it tells
  // us who is home/away (for names) and when the race is finished.
  const { data: race } = useRace(opened?.race_id);

  if (!hasOpponent) {
    return <p className={panel}>A race takes two players. Invite someone in and it starts here.</p>;
  }
  if (open.isLoading) return <p className="text-sm text-muted-foreground">Opening the race…</p>;
  if (open.error) return <p className={panel}>The race could not be opened. Check your connection and try again.</p>;
  if (open.data && !open.data.ok) return <p className={panel}>{roomRaceRefusalCopy(open.data.reason)}</p>;
  if (!opened) return null;

  const nameOf = (memberId: string | undefined) => phones.find((p) => p.member_id === memberId)?.display_name;
  const names = race ? { home: nameOf(race.home_member_id), away: nameOf(race.away_member_id) } : undefined;
  const all = links.data ?? [];
  const latest = all.find((l) => l.race_id === opened.race_id);
  const earlier = all.filter((l) => l.seq < opened.seq);

  return (
    <div className="space-y-4">
      {/* A new race id is a new race: remount so no dialog state carries over. */}
      <ScoreRace key={opened.race_id} raceId={opened.race_id} names={names} extras={false} />
      {race?.status === 'finished' && (
        <RunItBack
          roomId={roomId}
          myMemberId={myPhone.member_id}
          homeMemberId={race.home_member_id}
          awayMemberId={race.away_member_id}
          requestedBy={latest?.rematch_requested_by ?? null}
          nameOf={nameOf}
        />
      )}
      <EarlierRaces links={earlier} nameOf={nameOf} />
    </div>
  );
}
