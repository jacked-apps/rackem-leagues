/**
 * @fileoverview "Add my name" for a player with no account (Unit C3).
 *
 * The two doors on the tournament page for someone not signed in: sign in, or
 * just type a name. The second is the point of the whole feature — the walk-in
 * who is never going to install an app should still be able to get on the list
 * from a code on the wall.
 *
 * The 12-character limit is mirrored here for feedback, but it is the RPC that
 * enforces it (along with the entry cap and setup-only rule). A typed box is
 * trivially bypassed; the guards that matter live in the database.
 */

import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

/** Kept in step with add_self_as_walkup's own limit. */
export const MAX_WALKUP_NAME = 12;

interface AddMyNameCardProps {
  /** Add this name; returns a message to show, or null when it worked. */
  onAdd: (name: string) => Promise<string | null>;
  /** Where sign-in should return to. */
  redirectPath: string;
}

export function AddMyNameCard({ onAdd, redirectPath }: AddMyNameCardProps) {
  const [name, setName] = useState('');
  const [problem, setProblem] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  const trimmed = name.trim();

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!trimmed || adding) return;
    setAdding(true);
    setProblem(null);
    try {
      // A rejection is answered inline, next to the box they'd retype in —
      // a toast would vanish while they were still reading it.
      setProblem(await onAdd(trimmed));
    } finally {
      setAdding(false);
    }
  };

  return (
    <Card>
      <CardHeader className="py-4">
        <CardTitle className="text-base">Get on the list</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 pb-4">
        <form onSubmit={handleSubmit} className="space-y-2">
          <Label htmlFor="walkup-name">Add my name</Label>
          <div className="flex gap-2">
            <Input
              id="walkup-name"
              value={name}
              maxLength={MAX_WALKUP_NAME}
              placeholder="Your name"
              disabled={adding}
              onChange={(e) => {
                setName(e.target.value);
                setProblem(null);
              }}
            />
            <Button type="submit" loadingText="none" isLoading={adding} disabled={!trimmed}>
              Add
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Up to {MAX_WALKUP_NAME} characters — whatever the room calls you.
          </p>
          {problem && <p className="text-sm text-destructive">{problem}</p>}
        </form>

        <div className="border-t pt-3">
          <p className="mb-2 text-sm text-muted-foreground">
            Have an account? Sign in and your name comes with you.
          </p>
          <Button asChild variant="outline" loadingText="none">
            <Link to={`/login?redirect=${encodeURIComponent(redirectPath)}`}>Sign in</Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
