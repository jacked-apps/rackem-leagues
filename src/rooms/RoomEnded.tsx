/**
 * @fileoverview "This room has ended." — the one screen for a room that is
 * gone, whatever took it: the host closed it, the idle sweep removed it, or
 * the link never pointed at a live room.
 *
 * Data-derived: the page shows this when the room query resolves to null OR
 * the realtime hook's `roomGone` fires (the fast path). The reader does not
 * need to know which — the room is over either way, and the door back is the
 * same.
 */
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface RoomEndedProps {
  /** Override the default sentence — e.g. the join page's "link isn't valid". */
  detail?: string;
}

export function RoomEnded({ detail }: RoomEndedProps) {
  return (
    <div className="container mx-auto max-w-md px-4 py-12">
      <Card>
        <CardHeader>
          <CardTitle>This room has ended</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            {detail ??
              'Rooms are for the night — the host closed it, or it sat idle long enough to be cleaned up. Nothing from it counts toward stats.'}
          </p>
          <Button asChild loadingText="none">
            <Link to="/rooms">Back to rooms</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
