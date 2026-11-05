-- Remember which menu entries a member starred into Favorites.
--
-- The signed-in menu (sidebar + phone drawer) has a Favorites block: a member
-- taps the star on an entry in the Extras or Info fold and it moves up into
-- Favorites. This column holds the ids of the starred entries.
--
-- On the member rather than in browser storage on purpose: players use a
-- phone on match night and a computer at home, and favorites that vanish on
-- the other device feel broken. (Which folds are open/closed is the opposite
-- — a per-device habit — so that one IS browser storage.) Same reasoning and
-- shape as `last_seen_whats_new` and `profanity_filter_enabled`.
--
-- Values are entry ids from src/components/layout/navEntries.ts (e.g.
-- 'rules', 'stats'). The app ignores ids it doesn't know, so removing a page
-- from the menu can't break anyone's saved list — no cleanup needed here.
--
-- NULL means "never customised", which is every existing member and today
-- means no favorites. No backfill: if default favorites are ever added, they
-- reach everyone who never customised. An empty array means "customised, and
-- un-starred everything" — kept distinct from NULL for that reason.
--
-- Order is NOT meaningful: the menu shows favorites in its own order
-- (reordering was deliberately left out).
--
-- Run locally: `supabase migration up` (does not reset any data).

ALTER TABLE members
  ADD COLUMN IF NOT EXISTS nav_favorites text[];

COMMENT ON COLUMN members.nav_favorites IS
  'Menu entry ids (src/components/layout/navEntries.ts) this member starred into Favorites. NULL = never customised (no favorites today). Unknown ids are ignored by the app. Order is not meaningful.';
