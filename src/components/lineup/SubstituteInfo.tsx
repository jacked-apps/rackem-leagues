/**
 * @fileoverview SubstituteInfo — info buttons explaining anonymous sub vs double duty
 */

import { InfoButton } from '@/components/InfoButton';

interface SubstituteInfoProps {
  isSubstitute: boolean;
  isDoubleDuty: boolean;
}

export function SubstituteInfo({ isSubstitute, isDoubleDuty }: SubstituteInfoProps) {
  if (isSubstitute && !isDoubleDuty) {
    return (
      <InfoButton title="Anonymous Substitute" size="sm">
        <div className="space-y-2">
          <p>
            An anonymous substitute is an established league player with a
            known handicap who fills in for a missing teammate. They play
            under an anonymous identity so these games do not count toward
            their personal handicap record.
          </p>
          <p>
            This protects against sandbagging &mdash; the sub has no incentive
            to lose on purpose since the result won&apos;t follow them.
          </p>
          <p className="text-xs text-muted-foreground">
            If anonymous substitutes are not allowed in your league, contact
            your league operator to update this rule in league settings.
          </p>
        </div>
      </InfoButton>
    );
  }

  if (isDoubleDuty) {
    return (
      <InfoButton title="Double Duty" size="sm">
        <div className="space-y-2">
          <p>
            When your team is short a player, one of your existing lineup
            members plays two positions. The opposing team chooses which of
            your players gets double duty &mdash; they&apos;ll typically pick
            your weakest player to face twice.
          </p>
          <p>
            All games played during double duty count toward that
            player&apos;s handicap, since they&apos;re an invested team
            member with every reason to compete.
          </p>
          <p className="text-xs text-muted-foreground">
            If double duty is not allowed in your league, contact your league
            operator to update this rule in league settings.
          </p>
        </div>
      </InfoButton>
    );
  }

  return null;
}
