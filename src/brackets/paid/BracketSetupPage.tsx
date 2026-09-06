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
 *
 * Two guards sit in front of all that, in order:
 *
 *   1. If people are still waiting and the organizer hasn't asked for them to
 *      be swept in, ask. Leaving someone out is not recoverable — the bracket
 *      is drawn and they simply aren't in it.
 *   2. A final confirm showing the FINAL player count and the exact charge.
 *      One tap draws the bracket AND charges a card, so the last tap is a
 *      deliberate one.
 *
 * The order matters: the waiting decision changes the player count, so the
 * confirm has to come second to show a number that is actually true.
 */

import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
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
import { ConfirmStartDialog } from './ConfirmStartDialog';
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
  const [confirmingWaiting, setConfirmingWaiting] = useState(false);
  /**
   * The sweep decision, carried between the two dialogs. Null means the confirm
   * isn't open; a boolean is the answer the first dialog produced (or the
   * standing checkbox, when the first dialog never had to appear).
   */
  const [pendingSweep, setPendingSweep] = useState<boolean | null>(null);

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

  /**
   * Start, sweeping in the waiting list or not.
   *
   * Takes the choice as an argument rather than reading state: the warning
   * dialog decides it at the moment of the tap, and a setState wouldn't have
   * landed before this ran.
   */
  const runStart = async (sweepInWaiting: boolean) => {
    if (!bracketId) return;
    setPendingSweep(null);
    setStarting(true);
    try {
      // 1. Official list → seeded participants (optionally sweeping in the
      //    waiting room first). Returns the count the generator needs.
      const participantCount = await finalize.mutateAsync(sweepInWaiting);

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

  /**
   * The Start button. Anyone left in the waiting room may not get another way
   * in — late entry is a future feature and will have its own limits — so if the
   * organizer hasn't already said to include them, ask before going any further.
   */
  const handleStart = () => {
    if (!includeWaiting && waitingCount > 0) {
      setConfirmingWaiting(true);
      return;
    }
    setPendingSweep(includeWaiting);
  };

  /** The waiting dialog's answer hands off to the final confirm. */
  const answerWaiting = (sweepInWaiting: boolean) => {
    setConfirmingWaiting(false);
    setPendingSweep(sweepInWaiting);
  };

  // What the bracket will actually contain, once the sweep answer is known.
  const finalPlayerCount =
    officialCount + (pendingSweep ? waitingCount : 0);

  return (
    <div className="mx-auto w-full max-w-2xl space-y-3 px-3 py-4">
      <Link
        to="/brackets"
        className="inline-block text-sm text-muted-foreground hover:text-foreground"
      >
        ← Tournaments
      </Link>

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

      {/*
        The setup card. Its tabs live at ITS bottom, not pinned to the screen —
        they belong to this card, and the page is free to carry other things.
        Nearly every premium feature configures BEFORE the bracket is drawn
        (venue, tables, alerts, handicaps, payouts), so this tab set is where
        the crowding will land: keep it to 4-5 and combine as features arrive.
      */}
      <Card>
        <Tabs defaultValue="players">
          <CardContent className="pt-4">
            <TabsContent value="players" className="mt-0">
              <HopperView
                bracketId={bracket.id}
                trackEntryFees={trackEntryFees}
                includeWaiting={includeWaiting}
                onIncludeWaitingChange={setIncludeWaiting}
              />
            </TabsContent>

            <TabsContent value="info" className="mt-0">
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
            </TabsContent>
          </CardContent>

          <TabsList className="grid w-full grid-cols-2 rounded-none rounded-b-xl border-t">
            <TabsTrigger value="info">Info</TabsTrigger>
            <TabsTrigger value="players">Players</TabsTrigger>
          </TabsList>
        </Tabs>
      </Card>

      {/*
        Starting is its own card, outside the tabs, so it is reachable from
        whichever tab the organizer happens to be on — it is the one action that
        ends setup, not a place to navigate to.
      */}
      <Card>
        <CardContent className="pt-4">
          <StartTournamentPanel
            officialCount={officialCount}
            waitingCount={waitingCount}
            includeWaiting={includeWaiting}
            onStart={handleStart}
            starting={starting}
            priceLabel={chargeCents > 0 ? formatPrice(chargeCents) : null}
            featureKeys={bracket.premium_features ?? []}
          />
        </CardContent>
      </Card>

      <AlertDialog open={confirmingWaiting} onOpenChange={setConfirmingWaiting}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {waitingCount} {waitingCount === 1 ? 'player is' : 'players are'} still
              waiting
            </AlertDialogTitle>
            <AlertDialogDescription>
              They aren't in the tournament yet. Once you start, you may not be
              able to add them.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col gap-2 sm:flex-col sm:space-x-0">
            {/*
              The two real choices share a row at equal width, so neither reads
              as the afterthought. "Start without them" is `warning`, not
              `destructive` — it is allowed, and it is the one with a
              consequence; "add them" is the ordinary, safe path and gets the
              primary colour.
            */}
            <div className="grid grid-cols-2 gap-2">
              <Button
                variant="warning"
                className="w-full"
                loadingText="none"
                onClick={() => answerWaiting(false)}
              >
                Start without them
              </Button>
              <AlertDialogAction className="w-full" onClick={() => answerWaiting(true)}>
                Add {waitingCount === 1 ? 'them' : 'all ' + waitingCount}
              </AlertDialogAction>
            </div>
            {/* Backing out is the quiet option, so it is smaller and plainer. */}
            <AlertDialogCancel className="mt-0 h-8 self-center border-0 px-4 shadow-none">
              Go back
            </AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <ConfirmStartDialog
        open={pendingSweep !== null}
        onOpenChange={(open) => !open && setPendingSweep(null)}
        playerCount={finalPlayerCount}
        featureKeys={bracket.premium_features ?? []}
        priceLabel={chargeCents > 0 ? formatPrice(chargeCents) : null}
        onConfirm={() => void runStart(pendingSweep === true)}
      />
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
