/**
 * @fileoverview "This is new, please tell us if it's wrong" banner.
 *
 * On the page itself rather than only in What's New, because most people never
 * read release notes and this is the page where being believed is a risk. A
 * screen full of numbers reads as authoritative — more so than a new feature has
 * earned — so a wrong figure would be taken as fact rather than reported.
 *
 * Deliberately not dismissible. It is one line, it stops mattering the moment
 * the page is trusted, and a "don't show again" would silence it for exactly
 * the people who use the page most and would spot problems first.
 *
 * Remove this once the numbers have been checked against real seasons.
 */

import { Card, CardContent } from '@/components/ui/card';

/**
 * Beta banner for My Stats.
 *
 * States the status, says what could be wrong, and asks for the specific thing
 * that is useful — a number that looks off, or a question the page can't answer.
 * "Send feedback" without saying what kind mostly produces silence.
 */
export function BetaNotice() {
  return (
    <Card className="border-2">
      <CardContent className="space-y-1 py-4">
        <p className="text-sm font-semibold text-foreground">
          Beta — brand new, and not yet checked against real seasons
        </p>
        <p className="text-sm text-muted-foreground">
          These numbers come from games already recorded, but nobody has verified
          them against a real season yet. If something looks wrong, or you want
          this page to answer a question it can&apos;t, please tell your league
          operator — that&apos;s exactly the feedback we&apos;re after.
        </p>
      </CardContent>
    </Card>
  );
}
