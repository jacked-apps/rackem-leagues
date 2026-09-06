-- Remember which release notes a member has already read.
--
-- Stores the last version they viewed on the What's New page. The "New" marker
-- in the nav shows while this is behind the newest shipped version.
--
-- On the member rather than in browser storage on purpose: a captain who reads
-- the notes on their laptop shouldn't keep seeing "New" on their phone for a
-- week. It also makes "how many people have actually seen this release" a
-- question the database can answer.
--
-- NULL means never looked — which is every existing member, and is the correct
-- starting state: they haven't seen these notes.
--
-- Text, not a numeric version: semver isn't a number ("1.10.0" sorts before
-- "1.9.0" as text and after it as a version), and we only ever compare this for
-- EQUALITY with the newest release. Ordering is taken from the authored order
-- of the release list, never from parsing this column.

ALTER TABLE members
  ADD COLUMN IF NOT EXISTS last_seen_whats_new text;

COMMENT ON COLUMN members.last_seen_whats_new IS
  'Version of the What''s New page this member last opened. NULL = never. Compared for equality against the newest shipped release to decide whether to show the "New" marker; never parsed or ordered.';
