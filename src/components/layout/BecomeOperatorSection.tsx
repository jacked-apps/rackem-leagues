/**
 * @fileoverview BecomeOperatorSection — the "Operator" block at the bottom of
 * the signed-in menu for members who are NOT operators yet.
 *
 * Operators see their organizations in that spot (`OperatorSection`); everyone
 * else sees one row that opens the "Become a League Operator" page. Growing
 * the number of league operators is a business goal, so the way in sits in
 * the menu on every page instead of only on Profile (Ed, 2026-11-10). Shared
 * by the desktop sidebar and the phone drawer via `MemberNavSections`, and it
 * goes away by itself once the member becomes an operator.
 *
 * @example What a player sees:
 *   OPERATOR
 *   Become a League Operator
 */

import { NavRow } from './NavRow';
import { NavSectionHeading } from './NavSectionHeading';

/** @param inSheet True in the drawer, so a tap closes it. */
export function BecomeOperatorSection({ inSheet }: { inSheet?: boolean }) {
  return (
    <div className="mt-4 border-t pt-4">
      <NavSectionHeading>Operator</NavSectionHeading>
      <ul className="space-y-1">
        <NavRow to="/become-league-operator" label="Become a League Operator" inSheet={inSheet} />
      </ul>
    </div>
  );
}
