/**
 * @fileoverview The two-phone coin flip's `Play` screen.
 *
 * Reads the room's latest flip row and renders it through `CoinFlip`'s
 * controlled path: my phone is the viewer, the row's caller/flipper phones
 * are the participants, the row's `call` and `face` are the record. Taps go
 * to the RPCs; the room's channel brings the row back to both phones. The
 * face is the database's — this screen never tosses anything.
 *
 * No row yet → `CoinFlipSetup` (pick the other phone, who calls). "Flip
 * again" shows that panel over the finished flip until the new row arrives;
 * the old rows stay until the room dies.
 *
 * A phone that has left the room is still on its old flips by name — the
 * row points at its phone row, which lives as long as the room does.
 */
import { useState } from 'react';
import { toast } from 'sonner';
import { CoinFlip } from '@/components/coinflip/CoinFlip';
import type { Call, Participant } from '@/components/coinflip/types';
import type { GamePlayProps } from '../types';
import { CoinFlipSetup } from './CoinFlipSetup';
import { coinFlipRefusalCopy } from './coinFlipRefusalCopy';
import { useCallRoomCoin, useLatestRoomFlip, useStartRoomCoinFlip, useThrowRoomCoin } from './useRoomCoinFlip';

export function RoomCoinFlip({ roomId, myPhone, phones }: GamePlayProps) {
  const { data: flip, isLoading } = useLatestRoomFlip(roomId);
  const start = useStartRoomCoinFlip(roomId);
  const callSide = useCallRoomCoin(roomId);
  const throwCoin = useThrowRoomCoin(roomId);

  // "Flip again" is remembered against the flip it was tapped on, so the
  // moment a NEW row arrives the panel gives way to it with no effect needed.
  const [setupFor, setSetupFor] = useState<string | null>(null);
  const showSetup = !flip || setupFor === flip.id;

  const startFlip = async (otherPhoneId: string, iCall: boolean) => {
    const r = await start.mutateAsync({
      callerPhoneId: iCall ? myPhone.id : otherPhoneId,
      flipperPhoneId: iCall ? otherPhoneId : myPhone.id,
    });
    if (!r.ok) toast.error(coinFlipRefusalCopy(r.reason));
  };

  if (isLoading) return <p className="text-sm text-muted-foreground">Loading the flip…</p>;

  if (showSetup) {
    return <CoinFlipSetup myPhone={myPhone} phones={phones} onStart={startFlip} />;
  }

  const participant = (phoneId: string): Participant => ({
    id: phoneId,
    name: phones.find((p) => p.id === phoneId)?.display_name ?? 'Someone',
  });

  const onCall = async (side: Call) => {
    const r = await callSide.mutateAsync({ flipId: flip.id, side });
    if (!r.ok) toast.error(coinFlipRefusalCopy(r.reason));
  };
  const onThrow = async () => {
    const r = await throwCoin.mutateAsync(flip.id);
    if (!r.ok) toast.error(coinFlipRefusalCopy(r.reason));
  };

  return (
    <div className="flex justify-center">
      <CoinFlip
        // A new row is a new flip; remount so the spin/result state starts clean.
        key={flip.id}
        participantA={participant(flip.flipper_phone_id)}
        participantB={participant(flip.caller_phone_id)}
        callerId={flip.caller_phone_id}
        flipperId={flip.flipper_phone_id}
        viewerId={myPhone.id}
        controlled={{
          call: flip.call,
          face: flip.face,
          onCall,
          onThrow,
          onFlipAgain: () => setSetupFor(flip.id),
        }}
      />
    </div>
  );
}
