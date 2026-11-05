/**
 * @fileoverview Where a scanned room QR lands (`/rooms/join/:joinToken`).
 *
 * A member route. A signed-out scanner never sees this file — `ProtectedRoute`
 * sends them through login/register and back here — so by the time it
 * renders, the viewer is a member and the only question is "take a seat?"
 * One card, one button. Joining navigates INTO the room; the room page is the
 * destination, this is the doorstep.
 *
 * Every refusal is an in-page sentence, never an error: a full room, a
 * private room, a room that has ended. Same device scanning twice is a
 * rejoin, not a second seat — the server upserts by device.
 */
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useJoinRoom, useRoomByToken } from '@/api/hooks/useRooms';
import { getDeviceId } from './deviceId';
import { gameName } from './games/registry';
import { RoomEnded } from './RoomEnded';
import { roomRefusalCopy } from './roomRefusalCopy';
import { seatLine } from './seatCopy';

export function JoinRoomPage() {
  const { joinToken } = useParams<{ joinToken: string }>();
  const navigate = useNavigate();
  const { data: state, isLoading } = useRoomByToken(joinToken);
  const join = useJoinRoom();
  const [problem, setProblem] = useState<string | null>(null);

  const takeSeat = async () => {
    if (!joinToken) return;
    const result = await join.mutateAsync({ joinToken, deviceId: getDeviceId() });
    if (result.ok) navigate(`/rooms/${result.room_id}`, { replace: true });
    else setProblem(roomRefusalCopy(result));
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center gap-3 py-16 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Finding the room…
      </div>
    );
  }

  if (!state) {
    return <RoomEnded detail="This link doesn't point at a live room — it may have ended, or the code is out of date." />;
  }

  const { room, seats, phones } = state;
  const hostName = phones.find((p) => p.is_host)?.display_name;

  return (
    <div className="container mx-auto max-w-md px-4 py-12">
      <Card>
        <CardHeader>
          <CardTitle>{gameName(room.game_key)}</CardTitle>
          <p className="text-sm text-muted-foreground">
            {hostName ? `${hostName}'s room · ` : ''}
            {seatLine(seats, room.shared)}
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          {problem ? (
            <p className="text-sm">{problem}</p>
          ) : (
            <Button className="w-full" loadingText="Joining…" onClick={takeSeat}>
              Join
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
