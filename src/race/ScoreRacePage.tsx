/**
 * @fileoverview Route wrapper for the race room.
 *
 * Its whole job is to turn a URL into a race id and hand it over. The room
 * itself takes the id as a prop, so it can equally be dropped inside a game
 * room, a tournament page, or a league night without a route existing at all.
 * Keeping the URL-reading here is what makes that true.
 */

import { useParams } from 'react-router-dom';
import { ScoreRace } from './ScoreRace';

export function ScoreRacePage() {
  const { raceId } = useParams<{ raceId: string }>();

  if (!raceId) {
    return (
      <p className="p-6 text-center text-sm text-muted-foreground">No race was specified.</p>
    );
  }

  return <ScoreRace raceId={raceId} />;
}
