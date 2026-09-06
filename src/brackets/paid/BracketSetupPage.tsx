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
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  useBracket,
  useBracketHopper,
  useFinalizeHopper,
  useStartBracket,
  useChargeForStart,
  useUpdateBracketSettings,
} from '@/api/hooks/useBrackets';
import type { BracketFormat } from '@/types/bracket';
import { queryKeys } from '@/api/queryKeys';
import { useBracketRealtime } from '../useBracketRealtime';
import { BracketInfoTab } from './BracketInfoTab';
import { HopperView } from './HopperView';
import { StartTournamentPanel } from './StartTournamentPanel';
import { formatPrice, hasPremiumFeature, totalPriceCents } from './premiumFeatures';
import { joinUrl } from './joinUrl';
import { copyText } from '@/utils/clipboard';

export function BracketSetupPage() {
  const { bracketId } = useParams<{ bracketId: string }>();
  const navigate = useNavigate();

  const { data, isLoading, isError } = useBracket(bracketId);
  const hopper = useBracketHopper(bracketId);
  const finalize = useFinalizeHopper(bracketId ?? '');
  const startBracket = useStartBracket();
  const chargeForStart = useChargeForStart();
  const updateSettings = useUpdateBracketSettings(bracketId ?? '');

  // Watch the hopper live: players scan in while the organizer is looking at
  // this screen, and a list that only refreshes on reload is worse than useless
  // when someone is standing there asking if they're on it.
  useBracketRealtime(bracketId, queryKeys.brackets.hopper(bracketId ?? ''), true);

  const [includeWaiting, setIncludeWaiting] = useState(false);
  const [starting, setStarting] = useState(false);

  if (isLoading) return <Centered>Loading tournament…</Centered>;
  if (isError || !data) return <Centered>Tournament not found.</Centered>;

  const { bracket } = data;

  // No sign-up feature = no hopper. The free tier and paid tournaments without
  // it type their players in during creation and start immediately, so there is
  // nothing for this screen to show even if someone reaches the URL directly.
  if (!hasPremiumFeature(bracket.premium_features, 'real_players')) {
    return (
      <Centered>
        <p>This tournament doesn't use player sign-up.</p>
        <Link to={`/brackets/${bracket.id}`} className="underline">
          Go to the bracket
        </Link>
      </Centered>
    );
  }

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
    <div className="mx-auto w-full max-w-2xl px-3 py-4">
      <Link
        to="/brackets"
        className="mb-3 inline-block text-sm text-muted-foreground hover:text-foreground"
      >
        ← Tournaments
      </Link>

      <Tabs defaultValue="players" className="space-y-3">
        <header className="flex flex-wrap items-center justify-between gap-2">
          <h1 className="text-xl font-bold leading-tight">{bracket.name}</h1>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              loadingText="none"
              onClick={() => copyJoinLink(bracket.join_token)}
            >
              Copy join link
            </Button>
            {/* Signs for the wall / the big screen behind the bar. */}
            <Button size="sm" variant="outline" asChild>
              <Link to={`/brackets/${bracket.id}/qr`}>QR code</Link>
            </Button>
          </div>
        </header>

        {/* pb clears the fixed tab bar so the last row isn't hidden under it. */}
        <TabsContent value="players" className="space-y-3 pb-24">
          {/* The player lists end here; starting is its own decision below. */}
          <Card>
            <CardContent className="pt-4">
              <HopperView bracketId={bracket.id} trackEntryFees={trackEntryFees} />
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-4">
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
        </TabsContent>

        <TabsContent value="info" className="pb-24">
          <Card>
            <CardContent className="pt-4">
              <BracketInfoTab
                settings={{
                  name: bracket.name,
                  format: bracket.format as BracketFormat,
                  grandFinalReset: bracket.grand_final_reset ?? true,
                  gameType: bracket.game_type,
                }}
                saving={updateSettings.isPending}
                onSave={async (settings) => {
                  try {
                    await updateSettings.mutateAsync(settings);
                    toast.success('Tournament updated.');
                  } catch (err) {
                    toast.error(
                      err instanceof Error ? err.message : 'Could not save the tournament.'
                    );
                  }
                }}
              />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Fixed to the bottom, matching the player's view of the same tournament. */}
        <TabsList className="fixed inset-x-0 bottom-0 z-10 grid h-14 w-full grid-cols-2 rounded-none border-t">
          <TabsTrigger value="info">Info</TabsTrigger>
          <TabsTrigger value="players">Players</TabsTrigger>
        </TabsList>
      </Tabs>
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
  if (await copyText(joinUrl(joinToken))) {
    toast.success('Join link copied — players who open it are added to the waiting room.');
    return;
  }
  // Every copy route failed. A URL in a toast can't be selected, so send them
  // to the QR page, which prints the link as text they can read out or type.
  toast.error('Could not copy — open the QR code page to read the link.');
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div className="container mx-auto max-w-2xl space-y-2 px-4 py-16 text-center text-muted-foreground">
      {children}
    </div>
  );
}
