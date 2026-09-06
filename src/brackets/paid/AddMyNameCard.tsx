/**
 * @fileoverview "Add my name" for a player with no account (Unit C3).
 *
 * The two doors on the tournament page for someone not signed in, in the order
 * that serves them: sign in if they already have an account, otherwise a short
 * case for making one, and only then carry on as a guest.
 *
 * Guest entry is last but never buried — the walk-in who is never going to
 * install an app must still get on the list from a code on the wall. The pitch
 * sits between the two because this is the moment someone is most likely to
 * register: they came here to play, not to be sold to, so it says what they
 * get and how little it costs them, once, and then gets out of the way.
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
        <CardTitle className="text-base">You're not signed in</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 pb-4">
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">
            Already have an account? Sign in and you'll be added under your own
            name.
          </p>
          <Button asChild loadingText="none">
            <Link to={`/login?redirect=${encodeURIComponent(redirectPath)}`}>Sign in</Link>
          </Button>
        </div>

        <div className="rounded-md border bg-muted/40 p-3">
          <p className="text-sm font-medium">New here?</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Creating an account takes a minute and needs almost nothing from you
            — after that your name, your record and your entry-fee status follow
            you to every tournament you play. Scan the code again once you're
            set up, or just add your name below for tonight.
          </p>
          {/*
            No ?redirect here, unlike Sign in: Register doesn't navigate on
            success (it shows a confirmation state, and its OAuth handoff returns
            to the app root), so promising a trip straight back would be a lie.
            Wording sets that expectation instead. Giving Register the same
            redirect support Login has is a separate piece of work.
          */}
          <Button asChild variant="outline" size="sm" className="mt-2" loadingText="none">
            <Link to="/register">Create an account</Link>
          </Button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-2 border-t pt-3">
          <Label htmlFor="walkup-name">Or play as a guest</Label>
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
            Just for tonight; nothing is saved to an account.
          </p>
          {problem && <p className="text-sm text-destructive">{problem}</p>}
        </form>
      </CardContent>
    </Card>
  );
}
