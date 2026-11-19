/**
 * @fileoverview Fetch the one completed production season and write the
 * anonymised season-replay fixture. READ-ONLY against production: SELECTs
 * only, through the same secret key `scripts/clone-prod-to-local.mjs` uses.
 *
 * Why: the season replay test (src/__tests__/unit/seasonReplay.test.ts)
 * re-scores every real match and must reproduce what the league accepted.
 * Ed (2026-11-17): the season is finished, players are satisfied, and its
 * records are effectively final — the answer key that doesn't come from an
 * AI writing expected values.
 *
 * Usage:  node scripts/fetch-season-fixture.mjs [season-id]
 *   Needs PROD_SERVICE_ROLE_KEY in .env.local (gitignored). With no season id
 *   it picks the only season that has completed matches, and refuses if
 *   there's more than one. Writes src/__tests__/fixtures/season-2026-sunday-9ball.json.
 *
 * @see scripts/season-fixture/buildFixture.mjs — the allow-list + anonymiser
 * @see docs/plans/2026-11-17-001-feat-trustworthy-tests-plan.md (U3)
 */

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import { buildFixture } from './season-fixture/buildFixture.mjs';

const PROD_URL = 'https://cibboozjixxyypzchtvr.supabase.co';
const OUT = 'src/__tests__/fixtures/season-2026-sunday-9ball.json';

const env = readFileSync('.env.local', 'utf8').match(/^PROD_SERVICE_ROLE_KEY=(.*)$/m);
if (!env) {
  console.error('PROD_SERVICE_ROLE_KEY is missing from .env.local');
  process.exit(2);
}
const key = env[1].trim().replace(/^["']|["']$/g, '');
const prod = createClient(PROD_URL, key, { auth: { persistSession: false } });

/** Page through a select — PostgREST silently caps unbounded selects at 1000. */
async function all(table, columns, filter) {
  const rows = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await filter(prod.from(table).select(columns)).order('id').range(from, from + 999);
    if (error) throw new Error(`${table}: ${error.message}`);
    rows.push(...data);
    if (data.length < 1000) return rows;
  }
}

const completed = await all('matches', '*', (q) => q.eq('status', 'completed'));
const seasons = [...new Set(completed.map((m) => m.season_id))];
const seasonId = process.argv[2] ?? (seasons.length === 1 ? seasons[0] : null);
if (!seasonId) {
  console.error(`Expected one season with completed matches, found ${seasons.length}. Pass a season id.`);
  process.exit(2);
}

const matches = completed.filter((m) => m.season_id === seasonId);
const ids = matches.map((m) => m.id);
const teamIds = [...new Set(matches.flatMap((m) => [m.home_team_id, m.away_team_id]))];
const raw = {
  matches,
  weeks: await all('season_weeks', 'id, scheduled_date, week_type', (q) => q.eq('season_id', seasonId)),
  teams: await all('teams', 'id, status', (q) => q.in('id', teamIds)),
  lineups: await all('match_lineups', '*', (q) => q.in('match_id', ids)),
  games: await all('match_games', '*', (q) => q.in('match_id', ids)),
};

const { matches: fixtureMatches, skipped } = buildFixture(raw);
const fixture = {
  about:
    'One real, completed league season (Sunday 9-ball, points handicap), anonymised: ' +
    'no names, real ids or dates. Built by scripts/fetch-season-fixture.mjs. ' +
    'The stored results are the answer key for src/__tests__/unit/seasonReplay.test.ts.',
  matches: fixtureMatches,
};
mkdirSync('src/__tests__/fixtures', { recursive: true });
writeFileSync(OUT, `${JSON.stringify(fixture, null, 1)}\n`);
console.log(`Wrote ${fixtureMatches.length} matches to ${OUT} (skipped ${skipped.byes} bye matches).`);
