/**
 * @fileoverview MemberNavSections — the body of the signed-in menu, shared by
 * the desktop sidebar (`AppSidebar`) and the phone drawer (`AppDrawer`).
 *
 * Top to bottom, the same on both (the name / avatar row above this comes
 * from `NavIdentityHeader` and opens Profile):
 * 1. **Core** — My Teams, Messages, then any doorbells (`CoreNavSection`).
 *    Fixed, so it never moves under the player's thumb. No stars.
 * 2. **My Match** — chips panel (`MyMatchPanel`): open on a live/today match,
 *    closed when there are only makeups. Below Core so a match appearing or
 *    ending doesn't push My Teams / Messages around.
 * 3. **Favorites** — entries the player starred (saved to their account via
 *    `useNavFavorites`); hidden until there's at least one.
 * 4. **Extras** fold — Tournaments, Stats.
 * 5. **Info** fold — Home, Rules, Learn, What's New, About. Its heading reads
 *    "Info (New)" when What's New is unseen AND still in the fold, so the
 *    marker isn't hidden (if What's New is a favorite, its own row says it).
 * 6. **Operator** — per org (`OperatorSection`) for operators; everyone else
 *    gets one "Become a League Operator" row there (`BecomeOperatorSection`).
 *
 * Extras and Info start closed, only one can be open at a time, and both
 * close again on the next page (`NavFolds`).
 *
 * Every Extras / Info row carries a star; starring moves it into Favorites.
 * Entries come from the ONE list in `navEntries.ts`, so a menu change is
 * made once and the two menus can't drift.
 */

import { useUserProfile } from '@/api/hooks/useUserProfile';
import { useOrganizations } from '@/api/hooks/useOrganizations';
import { useMyMatchSurfaces } from '@/api/hooks/useMyMatchSurfaces';
import { useNavFavorites } from '@/api/hooks/useNavFavorites';
import { MyMatchPanel } from './MyMatchPanel';
import { CoreNavSection } from './CoreNavSection';
import { FavoritesSection } from './FavoritesSection';
import { OperatorSection } from './OperatorSection';
import { BecomeOperatorSection } from './BecomeOperatorSection';
import { NavFold, NavFolds } from './NavFold';
import { StarredNavRow } from './StarredNavRow';
import { splitNavEntries, type NavEntry } from './navEntries';
import { useNavLabel } from './useNavLabel';
import { resolveJoinRequestsTo, type OperatorOrg } from './navHelpers';

/** @param inSheet True in the drawer, so every link tap closes it. */
export function MemberNavSections({ inSheet }: { inSheet?: boolean }) {
  const { member, canAccessLeagueOperatorFeatures } = useUserProfile();
  const isOperator = canAccessLeagueOperatorFeatures();
  const { organizations } = useOrganizations(member?.id);
  const orgs = organizations as OperatorOrg[];
  const { drawerItems, isHydrating } = useMyMatchSurfaces(member?.id);
  const { labelFor, hasUnseenWhatsNew } = useNavLabel();
  const { favoriteIds, toggleFavorite } = useNavFavorites();

  const { core, favorites, extras, info } = splitNavEntries(favoriteIds);
  const infoHasNew = hasUnseenWhatsNew && info.some((e) => e.id === 'whats-new');

  /** A fold row: outline star, tap to move it into Favorites. */
  const foldRow = (e: NavEntry) => (
    <StarredNavRow
      key={e.id}
      to={e.path}
      label={labelFor(e)}
      name={e.label}
      starred={false}
      onToggleStar={() => toggleFavorite(e.id)}
      inSheet={inSheet}
    />
  );

  return (
    <>
      <CoreNavSection
        entries={core}
        labelFor={labelFor}
        joinRequestsTo={resolveJoinRequestsTo(isOperator, orgs)}
        inSheet={inSheet}
      />
      <MyMatchPanel items={drawerItems} isHydrating={isHydrating} inSheet={inSheet} />
      <FavoritesSection entries={favorites} labelFor={labelFor} onToggleStar={toggleFavorite} inSheet={inSheet} />
      {/* One fold open at a time; both close again on the next page. */}
      <NavFolds>
        {extras.length > 0 && (
          <NavFold id="extras" title="Extras">
            {extras.map(foldRow)}
          </NavFold>
        )}
        {info.length > 0 && (
          <NavFold id="info" title={infoHasNew ? 'Info (New)' : 'Info'}>
            {info.map(foldRow)}
          </NavFold>
        )}
      </NavFolds>
      {isOperator ? (
        <OperatorSection orgs={orgs} inSheet={inSheet} />
      ) : (
        <BecomeOperatorSection inSheet={inSheet} />
      )}
    </>
  );
}
