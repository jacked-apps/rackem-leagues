/**
 * @fileoverview Create-bracket flow — step 2: participants.
 *
 * Add plain-text participant names, remove them, and reorder via up/down
 * controls (mobile-safe — not drag-and-drop). The list order becomes the seed
 * order when seeding mode is "seeded". Duplicate names are allowed (free text)
 * with a soft warning surfaced by the caller.
 */

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ChevronUp, ChevronDown, X } from 'lucide-react';
import { MAX_PARTICIPANTS } from '../useCreateBracketForm';

interface ParticipantsStepProps {
  participants: string[];
  onAdd: (name: string) => void;
  onRemove: (index: number) => void;
  onMove: (index: number, dir: -1 | 1) => void;
}

export function ParticipantsStep({
  participants,
  onAdd,
  onRemove,
  onMove,
}: ParticipantsStepProps) {
  const [draft, setDraft] = useState('');
  const atCap = participants.length >= MAX_PARTICIPANTS;

  const commit = () => {
    onAdd(draft);
    setDraft('');
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="participant-name">Add players</Label>
        <div className="flex gap-2">
          <Input
            id="participant-name"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                commit();
              }
            }}
            placeholder="Player name"
            maxLength={60}
            disabled={atCap}
          />
          <Button
            type="button"
            loadingText="none"
            onClick={commit}
            disabled={atCap || !draft.trim()}
          >
            Add
          </Button>
        </div>
        <p className="text-sm text-muted-foreground">
          {participants.length} added{atCap ? ` (max ${MAX_PARTICIPANTS})` : ''}
        </p>
      </div>

      <ol className="space-y-2">
        {participants.map((name, i) => (
          <li
            key={`${name}-${i}`}
            className="flex items-center gap-2 rounded-md border p-2"
          >
            <span className="w-6 text-sm text-muted-foreground">{i + 1}.</span>
            <span className="flex-1 truncate">{name}</span>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="Move up"
              disabled={i === 0}
              onClick={() => onMove(i, -1)}
            >
              <ChevronUp className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="Move down"
              disabled={i === participants.length - 1}
              onClick={() => onMove(i, 1)}
            >
              <ChevronDown className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="Remove"
              onClick={() => onRemove(i)}
            >
              <X className="h-4 w-4" />
            </Button>
          </li>
        ))}
      </ol>
    </div>
  );
}
