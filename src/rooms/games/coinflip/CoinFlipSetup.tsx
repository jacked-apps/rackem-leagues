/**
 * @fileoverview Start a flip: pick the other phone, decide who calls.
 *
 * Shown inside the coin flip's `Play` whenever there is no flip yet (and
 * after "Flip again", which makes a new one). Default: the phone that is NOT
 * me calls, I throw — the side that did not start the flip should call it,
 * the same default the standalone `CoinFlip` uses.
 *
 * A flip takes two phones. With only one in the room the panel says so and
 * points at the door; it never offers a flip against nobody.
 */
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Switch } from '@/components/ui/switch';
import type { RoomPhone } from '@/api/queries/rooms';

interface CoinFlipSetupProps {
  myPhone: RoomPhone;
  phones: RoomPhone[];
  /** Start a flip between me and `otherPhoneId`; `iCall` swaps the roles. */
  onStart: (otherPhoneId: string, iCall: boolean) => Promise<void>;
}

export function CoinFlipSetup({ myPhone, phones, onStart }: CoinFlipSetupProps) {
  const others = phones.filter((p) => p.id !== myPhone.id);
  const [otherId, setOtherId] = useState(others[0]?.id ?? '');
  const [iCall, setICall] = useState(false);
  const other = others.find((p) => p.id === otherId);

  if (others.length === 0) {
    return (
      <p className="rounded-md border border-dashed px-3 py-8 text-center text-sm text-muted-foreground">
        A flip takes two phones. Invite someone in and it starts here.
      </p>
    );
  }

  return (
    <div className="space-y-4 rounded-md border p-4">
      <p className="text-sm font-medium">Flip against</p>
      <RadioGroup value={otherId} onValueChange={setOtherId} className="space-y-2">
        {others.map((p) => (
          <Label key={p.id} htmlFor={`flip-vs-${p.id}`} className="flex cursor-pointer items-center gap-3 rounded-md border p-3">
            <RadioGroupItem value={p.id} id={`flip-vs-${p.id}`} />
            <span>{p.display_name}</span>
            {!p.is_present && <span className="text-xs text-muted-foreground">away</span>}
          </Label>
        ))}
      </RadioGroup>

      <div className="flex items-center justify-between gap-4 rounded-md border p-3">
        <div className="space-y-1">
          <Label htmlFor="i-call">I call, they throw</Label>
          <p className="text-sm text-muted-foreground">
            {iCall
              ? `You call heads or tails; ${other?.display_name ?? 'they'} throw the coin.`
              : `${other?.display_name ?? 'They'} call heads or tails; you throw the coin.`}
          </p>
        </div>
        <Switch id="i-call" checked={iCall} onCheckedChange={setICall} />
      </div>

      <Button className="w-full" loadingText="Starting…" disabled={!other} onClick={() => onStart(otherId, iCall)}>
        Flip for it
      </Button>
    </div>
  );
}
