/**
 * @fileoverview Clone PRODUCTION public-schema data into your LOCAL Supabase DB.
 *
 * Why: production just started taking real users. This pulls a copy of that real
 * data into your local database so you can experiment on realistic data without
 * any risk to production.
 *
 * Direction is ONE-WAY and safe by construction:
 *   - It only READS prod (a `--data-only` dump is read-only).
 *   - It only WRITES to your LOCAL Supabase Docker container (the load target is
 *     discovered from the running `supabase_db_*` container — it can never reach
 *     production).
 *
 * Scope: PUBLIC schema only. There are no `public → auth` foreign keys, so the
 * copy loads cleanly without auth data; you keep logging in locally as usual
 * (e.g. dev@test.com). Prod auth users / OAuth are intentionally NOT copied.
 *
 * Requires:
 *   1. Local Supabase running:  pnpm db:start
 *   2. Your PROD database password in the env var PROD_DB_PASSWORD (get it from
 *      the Supabase dashboard → Settings → Database). Never hardcode/commit it.
 *
 * Run (PowerShell):
 *   $env:PROD_DB_PASSWORD = "<your prod db password>"; pnpm clone-prod
 * Run (bash):
 *   PROD_DB_PASSWORD="<your prod db password>" pnpm clone-prod
 *
 * The dump is written to ./prod_data.sql (gitignored — it holds real user data).
 *
 * NOTE: this links your repo to the PROD project (so the dump can find it). While
 * linked, do NOT run `supabase db push` — that targets production. `supabase db
 * reset` and this script only ever touch LOCAL, so they stay safe.
 */

import { spawnSync, spawn } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';

const PROD_REF = 'cibboozjixxyypzchtvr';
const DUMP_FILE = 'prod_data.sql';

const password = process.env.PROD_DB_PASSWORD;
if (!password) {
  console.error(
    '\nPROD_DB_PASSWORD is not set.\n' +
      'Get your prod DB password from the Supabase dashboard (Settings → Database), then:\n' +
      '  PowerShell:  $env:PROD_DB_PASSWORD = "<password>"; pnpm clone-prod\n' +
      '  bash:        PROD_DB_PASSWORD="<password>" pnpm clone-prod\n',
  );
  process.exit(1);
}

/** Run a command inheriting stdio; abort the script if it fails. */
function run(cmd, args, opts = {}) {
  console.log(`\n$ ${cmd} ${args.join(' ')}`);
  const res = spawnSync(cmd, args, { stdio: 'inherit', ...opts });
  if (res.error) {
    console.error(`\nCould not run "${cmd}". Is it installed and on your PATH?`);
    process.exit(1);
  }
  if (res.status !== 0) {
    console.error(`\nStep failed: ${cmd} ${args.join(' ')}`);
    process.exit(res.status ?? 1);
  }
}

// Supabase CLI reads the DB password from SUPABASE_DB_PASSWORD — pass it through
// so `link` / `db dump` run non-interactively.
const childEnv = { ...process.env, SUPABASE_DB_PASSWORD: password };

// 1. Link to prod so `db dump` can resolve the connection (no host/region to
//    hand-enter). See the footgun note in the header.
run('supabase', ['link', '--project-ref', PROD_REF], { env: childEnv });

// 2. Read-only dump of prod public DATA only.
run('supabase', ['db', 'dump', '--data-only', '-f', DUMP_FILE], { env: childEnv });
if (!existsSync(DUMP_FILE)) {
  console.error(`\nExpected ${DUMP_FILE} but it was not created. Aborting before touching local.`);
  process.exit(1);
}

// 3. Find the running LOCAL Supabase Postgres container — this is the only thing
//    we write to, so the load can never reach production.
const ps = spawnSync(
  'docker',
  ['ps', '--filter', 'name=supabase_db_', '--format', '{{.Names}}'],
  { encoding: 'utf8' },
);
const container = (ps.stdout || '').trim().split(/\r?\n/).filter(Boolean)[0];
if (!container) {
  console.error(
    '\nNo running "supabase_db_*" Docker container found. Start local Supabase first: pnpm db:start',
  );
  process.exit(1);
}
console.log(`\nLoading into LOCAL container: ${container}`);

// 4. One SQL stream into the local container's psql:
//    - session_replication_role=replica turns off FK checks + triggers, so the
//      truncate and the (unordered) data load don't trip on dependency order.
//    - truncate every public table so prod data REPLACES seed data (not stacks).
//    - then the prod dump, then restore normal replication behavior.
const preamble =
  'SET session_replication_role = replica;\n' +
  'DO $$ DECLARE r record; BEGIN\n' +
  "  FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname='public') LOOP\n" +
  "    EXECUTE 'TRUNCATE TABLE public.' || quote_ident(r.tablename) || ' CASCADE';\n" +
  '  END LOOP;\n' +
  'END $$;\n';
const epilogue = '\nSET session_replication_role = default;\n';
const sql = preamble + readFileSync(DUMP_FILE, 'utf8') + epilogue;

const psql = spawn(
  'docker',
  ['exec', '-i', container, 'psql', '-U', 'postgres', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1'],
  { stdio: ['pipe', 'inherit', 'inherit'] },
);
psql.on('error', () => {
  console.error('\nCould not exec into the container. Is Docker running?');
  process.exit(1);
});
psql.stdin.write(sql);
psql.stdin.end();
psql.on('close', (code) => {
  if (code !== 0) {
    console.error(`\nLoad failed (psql exit ${code}). Local DB may be partially loaded — re-run after fixing.`);
    process.exit(code ?? 1);
  }
  console.log('\n✅ Local DB now holds a copy of prod public data. Refresh your browser.');
  console.log(
    '⚠️  Your repo is still LINKED TO PROD. Do NOT run `supabase db push` until you re-link, or it targets production.',
  );
});
