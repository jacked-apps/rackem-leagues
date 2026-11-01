/**
 * @fileoverview MemberNavSections — the body of the signed-in menu, shared by
 * the desktop sidebar (`AppSidebar`) and the phone drawer (`AppDrawer`).
 *
 * Top to bottom, the same on both:
 * 1. **My Match** — chips panel (`MyMatchPanel`): open on a live/today match,
 *    closed when there are only makeups.
 * 2. **Favorites** — always visible (`FavoritesSection`).
 * 3. **Extras** fold — Tournaments, Stats, Profile.
 * 4. **Info** fold — Home, Rules, Learn, What's New, About. Its heading reads
 *    "Info (New)" when What's New has unseen notes, so the marker isn't hidden
 *    inside a closed fold.
 * 5. **Operator** — per org (`OperatorSection`), operators only.
 *
 * Entries come from the ONE list in `navEntries.ts`. Because both menus render
 * this component, a menu change is made once and can't drift.
 */

import { useUserProfile } from '@/api/hooks/useUserProfile';
import { useOrganizations } from '@/api/hooks/useOrganizations';
import { useMyMatchSurfaces } from '@/api/hooks/useMyMatchSurfaces';
import { MyMatchPanel } from './MyMatchPanel';
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

  // Favorites are the defaults until Unit 3 saves a player's own choice.
  const { favorites, extras, info } = splitNavEntries();

  return (
    <>
      <MyMatchPanel items={drawerItems} isHydrating={isHydrating} inSheet={inSheet} />
      <FavoritesSection
        entries={favorites}
        labelFor={labelFor}
        joinRequestsTo={resolveJoinRequestsTo(isOperator, orgs)}
        inSheet={inSheet}
      />
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
