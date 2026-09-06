/**
 * @fileoverview The setup screen for a paid tournament (`/brackets/:id/setup`).
 *
 * Where a "Real players & sign-up" tournament lives between being created and
 * being started. The free flow types names and starts in one submit; this one
 * stays in `setup` while players trickle in by QR, link, or the organizer's own
 * adding — so it needs a page of its own to sit on.
 *
 * It hosts the hopper (see HopperView) and owns Start, which is a three-step
 * hand-off: convert the official list into seeded participants
 * (finalize_bracket_hopper), generate + persist the tree and go live
 * (start_bracket, the same call the free flow makes), then record the checkout
 * charge. The charge runs LAST so a failed start can never leave a
 * charged-but-not-started tournament.
 */

import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  useBracket,
  useBracketHopper,
  useFinalizeHopper,
  useStartBracket,
  useChargeForStart,
} from '@/api/hooks/useBrackets';
import type { BracketFormat } from '@/types/bracket';
import { HopperView } from './HopperView';
import { StartTournamentPanel } from './StartTournamentPanel';
import { formatPrice, hasPremiumFeature, totalPriceCents } from './premiumFeatures';

export function BracketSetupPage() {
  const { bracketId } = useParams<{ bracketId: string }>();
  const navigate = useNavigate();

  const { data, isLoading, isError } = useBracket(bracketId);
  const hopper = useBracketHopper(bracketId);
  const finalize = useFinalizeHopper(bracketId ?? '');
  const startBracket = useStartBracket();
  const chargeForStart = useChargeForStart();

  const [includeWaiting, setIncludeWaiting] = useState(false);
  const [starting, setStarting] = useState(false);

  if (isLoading) return <Centered>Loading tournament…</Centered>;
  if (isError || !data) return <Centered>Tournament not found.</Centered>;

  const { bracket } = data;

  // Already started — the setup screen is meaningless, send them to the bracket.
  if (bracket.status !== 'setup') {
    return (
      <Centered>
        <p>This tournament has already started.</p>
        <Link to={`/brackets/${bracket.id}`} className="underline">
          Go to the bracket
        </Link>
      </Centered>
    );
  }

  const entries = hopper.data ?? [];
  const officialCount = entries.filter((e) => e.status === 'official').length;
  const waitingCount = entries.length - officialCount;

  const chargeCents = totalPriceCents(bracket.premium_features ?? []);
  // Sold separately from sign-up links, so the hopper only talks about money
  // when this tournament actually bought the tracker.
  const trackEntryFees = hasPremiumFeature(bracket.premium_features, 'payment_tracker');

  const handleStart = async () => {
    if (!bracketId) return;
    setStarting(true);
    try {
      // 1. Official list → seeded participants (optionally sweeping in the
      //    waiting room first). Returns the count the generator needs.
      const participantCount = await finalize.mutateAsync(includeWaiting);

      // 2. Same start path as the free tier, now that participants exist.
      await startBracket.mutateAsync({
        bracketId,
        format: bracket.format as BracketFormat,
        grandFinalReset: bracket.grand_final_reset ?? true,
        participantCount,
      });

      // 3. Checkout, only after a successful start (real-money ordering).
      if (chargeCents > 0) {
        await chargeForStart.mutateAsync({ bracketId, amountCents: chargeCents });
      }
      navigate(`/brackets/${bracketId}`);
    } catch (err) {
      // The RPC guards read as organizer-facing sentences ("Add at least 2
      // players before starting"), so show them verbatim. The tournament stays
      // in setup with its hopper intact — the organizer can fix it and retry.
      toast.error(err instanceof Error ? err.message : 'Could not start the tournament.');
      setStarting(false);
    }
  };

  return (
    <div className="container mx-auto max-w-2xl px-4 py-8">
      <Link
        to="/brackets"
        className="mb-4 inline-block text-sm text-muted-foreground hover:text-foreground"
      >
        ← Tournaments
      </Link>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-3">
          <CardTitle>{bracket.name}</CardTitle>
          <Button
            variant="outline"
            loadingText="none"
            onClick={() => copyJoinLink(bracket.join_token)}
          >
            Copy join link
          </Button>
        </CardHeader>
        <CardContent className="space-y-5">
          <HopperView bracketId={bracket.id} trackEntryFees={trackEntryFees} />
          <StartTournamentPanel
            officialCount={officialCount}
            waitingCount={waitingCount}
            includeWaiting={includeWaiting}
            onIncludeWaitingChange={setIncludeWaiting}
            onStart={handleStart}
            starting={starting}
            priceLabel={chargeCents > 0 ? formatPrice(chargeCents) : null}
            trackEntryFees={trackEntryFees}
          />
        </CardContent>
      </Card>
    </div>
  );
}

/**
 * Copy the join link players scan or tap to add themselves. This is the
 * `join_token`, deliberately NOT the view-only `share_token` — anyone holding
 * the spectator link must not be able to put themselves in the tournament.
 */
async function copyJoinLink(joinToken: string | null): Promise<void> {
  if (!joinToken) {
    toast.error('This tournament has no join link.');
    return;
  }
  const url = `${window.location.origin}/brackets/join/${joinToken}`;
  try {
    await navigator.clipboard.writeText(url);
    toast.success('Join link copied — players who open it are added to the waiting room.');
  } catch {
    toast.error('Could not copy — link: ' + url);
  }
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div className="container mx-auto max-w-2xl space-y-2 px-4 py-16 text-center text-muted-foreground">
      {children}
    </div>
  );
}
