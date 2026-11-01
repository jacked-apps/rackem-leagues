/**
 * @fileoverview MemberNavSections — the body of the signed-in menu, shared by
 * the desktop sidebar (`AppSidebar`) and the phone drawer (`AppDrawer`).
 *
 * Top to bottom, the same on both (the name / avatar row above this comes
 * from `NavIdentityHeader` and opens Profile):
 * 1. **Core** — My Teams, Messages, then any doorbells (`CoreNavSection`).
 *    Fixed, so it never moves under the player's thumb.
 * 2. **My Match** — chips panel (`MyMatchPanel`): open on a live/today match,
 *    closed when there are only makeups. Below Core so a match appearing or
 *    ending doesn't push My Teams / Messages around.
 * 3. **Favorites** — starred entries; hidden until there's at least one.
 * 4. **Extras** fold — Tournaments, Stats.
 * 5. **Info** fold — Home, Rules, Learn, What's New, About. Its heading reads
 *    "Info (New)" when What's New has unseen notes, so the marker isn't hidden
 *    inside a closed fold.
 * 6. **Operator** — per org (`OperatorSection`), operators only.
 *
 * Entries come from the ONE list in `navEntries.ts`. Because both menus render
 * this component, a menu change is made once and can't drift.
 */

import { useUserProfile } from '@/api/hooks/useUserProfile';
import { useOrganizations } from '@/api/hooks/useOrganizations';
import { useMyMatchSurfaces } from '@/api/hooks/useMyMatchSurfaces';
import { MyMatchPanel } from './MyMatchPanel';
import { CoreNavSection } from './CoreNavSection';
import { FavoritesSection } from './FavoritesSection';
import { OperatorSection } from './OperatorSection';
import { NavFold } from './NavFold';
import { NavRow } from './NavRow';
import { splitNavEntries } from './navEntries';
import { useNavLabel } from './useNavLabel';
import { resolveJoinRequestsTo, type OperatorOrg } from './navHelpers';

/** @param inSheet True in the drawer, so every tap closes it. */
export function MemberNavSections({ inSheet }: { inSheet?: boolean }) {
  const { member, canAccessLeagueOperatorFeatures } = useUserProfile();
  const isOperator = canAccessLeagueOperatorFeatures();
  const { organizations } = useOrganizations(member?.id);
  const orgs = organizations as OperatorOrg[];
  const { drawerItems, isHydrating } = useMyMatchSurfaces(member?.id);
  const { labelFor, hasUnseenWhatsNew } = useNavLabel();

  // No favorites until Unit 3 lets a player star entries.
  const { core, favorites, extras, info } = splitNavEntries();

  return (
    <>
      <CoreNavSection
        entries={core}
        labelFor={labelFor}
        joinRequestsTo={resolveJoinRequestsTo(isOperator, orgs)}
        inSheet={inSheet}
      />
      <MyMatchPanel items={drawerItems} isHydrating={isHydrating} inSheet={inSheet} />
      <FavoritesSection entries={favorites} labelFor={labelFor} inSheet={inSheet} />
      {extras.length > 0 && (
        <NavFold id="extras" title="Extras">
          {extras.map((e) => (
            <NavRow key={e.id} to={e.path} label={labelFor(e)} inSheet={inSheet} />
          ))}
        </NavFold>
      )}
      {info.length > 0 && (
        <NavFold id="info" title={hasUnseenWhatsNew ? 'Info (New)' : 'Info'}>
          {info.map((e) => (
            <NavRow key={e.id} to={e.path} label={labelFor(e)} inSheet={inSheet} />
          ))}
        </NavFold>
      )}
      {isOperator ? <OperatorSection orgs={orgs} /> : null}
    </>
  );
}
