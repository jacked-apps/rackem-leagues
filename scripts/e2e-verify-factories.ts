/**
 * @fileoverview pnpm e2e:verify-factories — smoke-test the factory layer.
 *
 * Runs each factory once and asserts the returned row exists in the DB
 * with the expected shape. Confirms Unit 5 wired up correctly (schema
 * shapes match, RLS-bypass works, triggers fire as expected) before any
 * spec depends on the factories.
 *
 * Run AFTER `pnpm e2e:setup`. Throwaway leagues this script creates are
 * cleaned up by the next `pnpm e2e:setup` (foundation-org cleanup chain).
 *
 * Run via tsx:  pnpm e2e:verify-factories
 */

import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import dotenv from 'dotenv';
import pg from 'pg';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..');

dotenv.config({ path: resolve(repoRoot, '.env.local'), quiet: true });

// Set E2E_PW to a placeholder if unset — the factories themselves don't
// need it (they use service-role), but importing fixtures/users.ts
// throws if E2E_PW is unset because the auth setup needs it. For this
// smoke check we just need the module to load.
if (!process.env.E2E_PW) process.env.E2E_PW = 'placeholder-not-used-by-factories';

const {
  createLeague,
  createSeason,
  createTeam,
  createMatch,
  createMatchReadyForLineup,
} = await import('../tests/e2e/fixtures/factories');

const pgClient = new pg.Client({
  host: 'localhost',
  port: 54322,
  user: 'postgres',
  password: 'postgres',
  database: 'postgres',
});
await pgClient.connect();

let passed = 0;
let failed = 0;

async function check(name: string, fn: () => Promise<void>): Promise<void> {
  process.stdout.write(`  ${name.padEnd(50)} `);
  try {
    await fn();
    console.log('pass');
    passed += 1;
  } catch (err) {
    console.log(`FAIL  (${(err as Error).message})`);
    failed += 1;
  }
}

console.log('Smoke-testing factories against local Supabase...');
console.log('');

await check('createLeague returns a league row', async () => {
  const league = await createLeague();
  if (!league?.id) throw new Error('no id returned');
  const { rows } = await pgClient.query(
    'SELECT id, organization_id, team_format FROM leagues WHERE id = $1',
    [league.id]
  );
  if (rows.length !== 1) throw new Error('row not found in DB');
  if (rows[0].organization_id !== 'e0e0e0e0-cccc-cccc-cccc-cccccccccccc') {
    throw new Error('wrong org_id');
  }
});

await check('createSeason returns season + 12 weeks', async () => {
  const league = await createLeague();
  const season = await createSeason(league.id);
  if (season.weeks.length !== 12) throw new Error(`expected 12 weeks, got ${season.weeks.length}`);
  const { rows } = await pgClient.query(
    'SELECT count(*) AS n FROM season_weeks WHERE season_id = $1',
    [season.id]
  );
  if (Number(rows[0].n) !== 12) throw new Error(`db has ${rows[0].n} weeks`);
});

await check('createTeam wires captain into team_players', async () => {
  const league = await createLeague();
  const season = await createSeason(league.id);
  const team = await createTeam(league.id, season.id, 'captain-1');
  const { rows } = await pgClient.query(
    'SELECT is_captain, member_id FROM team_players WHERE team_id = $1',
    [team.id]
  );
  if (rows.length !== 1) throw new Error('expected 1 team_players row');
  if (!rows[0].is_captain) throw new Error('captain flag not set');
  if (rows[0].member_id !== 'e0e0e0e0-bbbb-bbbb-bbbb-000000000002') {
    throw new Error('wrong captain member_id');
  }
});

await check('createMatch triggers auto-creation of match_lineups', async () => {
  const league = await createLeague();
  const season = await createSeason(league.id);
  const home = await createTeam(league.id, season.id, 'captain-1');
  const away = await createTeam(league.id, season.id, 'captain-2');
  const match = await createMatch(season.id, season.weeks[0].id, home.id, away.id);
  const { rows } = await pgClient.query(
    'SELECT count(*) AS n FROM match_lineups WHERE match_id = $1',
    [match.id]
  );
  if (Number(rows[0].n) !== 2) {
    throw new Error(`expected 2 match_lineups (from auto-trigger), got ${rows[0].n}`);
  }
});

await check('createMatchReadyForLineup composite returns full chain', async () => {
  const result = await createMatchReadyForLineup({
    homeCaptain: 'captain-1',
    awayCaptain: 'captain-2',
  });
  if (
    !result.league?.id ||
    !result.season?.id ||
    !result.homeTeam?.id ||
    !result.awayTeam?.id ||
    !result.match?.id
  ) {
    throw new Error('missing entity in composite return');
  }
  const { rows } = await pgClient.query('SELECT status FROM matches WHERE id = $1', [result.match.id]);
  if (rows[0]?.status !== 'scheduled') {
    throw new Error(`match status is ${rows[0]?.status}, expected 'scheduled'`);
  }
});

console.log('');
console.log(`Result: ${passed} passed, ${failed} failed.`);
await pgClient.end();

if (failed > 0) {
  process.exit(1);
}
console.log('Unit 5 verification PASS.');
