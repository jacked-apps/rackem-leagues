/**
 * @fileoverview Clone PRODUCTION public-schema data into your LOCAL Supabase DB,
 * over the API — no database password required.
 *
 * Why over the API: Supabase's Postgres password is write-only (you'd have to
 * reset it, breaking the deploy + other connections). The `service_role` API key
 * IS viewable in the dashboard and can read every row (it bypasses RLS), so we
 * read prod through it instead of a pg_dump.
 *
 * Direction is ONE-WAY and safe by construction:
 *   - Prod is touched READ-ONLY (SELECTs via the service_role key).
 *   - Writes go ONLY to your LOCAL Supabase Postgres (127.0.0.1:54322) — the
 *     connection is hardcoded to localhost, so it can never reach production.
 *
 * Scope: PUBLIC schema only. There are no `public → auth` foreign keys, so the
 * copy loads cleanly without auth data; keep logging in locally as usual
 * (e.g. dev@test.com). Prod auth users / OAuth are intentionally NOT copied.
 *
 * Requires:
 *   1. Local Supabase running:  pnpm db:start
 *   2. Your prod SERVICE_ROLE key in env PROD_SERVICE_ROLE_KEY (Supabase
 *      dashboard → Settings → API → `service_role`). It's a powerful secret —
 *      never hardcode/commit it; this clears it from your shell after.
 *
 * Run (PowerShell):
 *   $env:PROD_SERVICE_ROLE_KEY = "<service_role key>"; pnpm clone-prod
 * Run (bash):
 *   PROD_SERVICE_ROLE_KEY="<service_role key>" pnpm clone-prod
 */

import pg from 'pg';
import { createClient } from '@supabase/supabase-js';

const PROD_URL = 'https://cibboozjixxyypzchtvr.supabase.co';
const PAGE = 1000; // service_role read page size

const key = process.env.PROD_SERVICE_ROLE_KEY;
if (!key) {
  console.error(
    '\nPROD_SERVICE_ROLE_KEY is not set.\n' +
      'Get it from the Supabase dashboard → Settings → API → `service_role`, then:\n' +
      '  PowerShell:  $env:PROD_SERVICE_ROLE_KEY = "<key>"; pnpm clone-prod\n' +
      '  bash:        PROD_SERVICE_ROLE_KEY="<key>" pnpm clone-prod\n',
  );
  process.exit(1);
}

const prod = createClient(PROD_URL, key, { auth: { persistSession: false } });
// LOCAL ONLY — hardcoded so a write can never reach prod.
const local = new pg.Pool({ host: '127.0.0.1', port: 54322, database: 'postgres', user: 'postgres', password: 'postgres' });

/** Public base tables + each column's type and whether it's generated. */
async function localSchema() {
  const tables = (
    await local.query(
      `select tablename from pg_tables where schemaname='public' order by tablename`,
    )
  ).rows.map((r) => r.tablename);

  const cols = {};
  for (const t of tables) {
    const r = await local.query(
      `select column_name, udt_name, is_generated
         from information_schema.columns
        where table_schema='public' and table_name=$1
        order by ordinal_position`,
      [t],
    );
    // Skip generated columns — Postgres computes them; inserting them errors.
    cols[t] = r.rows.filter((c) => c.is_generated === 'NEVER');
  }
  return { tables, cols };
}

/** Read every row of a prod table via the service_role key (paged). */
async function readProd(table) {
  const rows = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await prod.from(table).select('*').range(from, from + PAGE - 1);
    if (error) {
      // A table that exists locally but not in prod's API (or is empty) — skip.
      if (/relation|not found|does not exist/i.test(error.message)) return rows;
      throw new Error(`prod read ${table}: ${error.message}`);
    }
    rows.push(...data);
    if (data.length < PAGE) break;
  }
  return rows;
}

/** jsonb/json values must be stringified for the pg driver; arrays pass through. */
function coerce(value, udt) {
  if (value === null || value === undefined) return null;
  if (udt === 'json' || udt === 'jsonb') return JSON.stringify(value);
  return value;
}

async function insertRows(table, columns, rows) {
  const names = columns.map((c) => c.column_name);
  const colList = names.map((n) => `"${n}"`).join(', ');
  // Batch so we stay well under the 65535-param cap.
  const perBatch = Math.max(1, Math.floor(60000 / names.length));
  for (let i = 0; i < rows.length; i += perBatch) {
    const batch = rows.slice(i, i + perBatch);
    const params = [];
    const tuples = batch.map((row) => {
      const ph = columns.map((c) => {
        params.push(coerce(row[c.column_name], c.udt_name));
        return `$${params.length}`;
      });
      return `(${ph.join(', ')})`;
    });
    await local.query(
      `insert into public."${table}" (${colList}) values ${tuples.join(', ')}`,
      params,
    );
  }
}

async function main() {
  const { tables, cols } = await localSchema();
  console.log(`Cloning ${tables.length} public tables from prod → local…\n`);

  // FK checks + triggers off so insert order is irrelevant and triggers (e.g.
  // auto-create-lineups) don't fire during the copy. Truncate so prod REPLACES
  // local seed data rather than stacking on it.
  await local.query('set session_replication_role = replica');
  try {
    for (const t of tables) {
      await local.query(`truncate table public."${t}" cascade`);
    }
    let total = 0;
    for (const t of tables) {
      const rows = await readProd(t);
      if (rows.length) await insertRows(t, cols[t], rows);
      total += rows.length;
      console.log(`  ${t}: ${rows.length}`);
    }
    console.log(`\n✅ Loaded ${total} rows into local. Refresh your browser.`);
  } finally {
    await local.query('set session_replication_role = default');
    await local.end();
  }
}

main().catch((e) => {
  console.error(`\nClone failed: ${e.message}`);
  local.end().finally(() => process.exit(1));
});
