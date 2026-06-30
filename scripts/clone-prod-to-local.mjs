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
 * Scope: PUBLIC schema only. Prod auth users / OAuth are intentionally NOT
 * copied. Because the copy overwrites `members.user_id` with prod's login ids,
 * the script finishes by RE-LINKING each member to the LOCAL auth login that
 * owns the same email (your local login survives the clone), so you can keep
 * acting as yourself (LO/admin) immediately. Members with no local login by
 * email stay unlinked until you sign up + re-run (or run
 * database/dev_relink_lo_login.sql).
 *
 * Requires:
 *   1. Local Supabase running:  pnpm db:start
 *   2. Your prod secret key (Supabase dashboard → Settings → API keys → the
 *      "secret key", formerly `service_role`) supplied as PROD_SERVICE_ROLE_KEY.
 *      It's a full-access key (bypasses RLS) — never commit or share it.
 *
 * Supply the key either way:
 *   - Persistent: add a line to .env.local (gitignored), then `pnpm clone-prod`:
 *       PROD_SERVICE_ROLE_KEY=<secret key>
 *     Keep it UN-prefixed (no VITE_) so Vite never bundles it into the app.
 *   - One-off (PowerShell): $env:PROD_SERVICE_ROLE_KEY = "<secret key>"; pnpm clone-prod
 *   - One-off (bash):       PROD_SERVICE_ROLE_KEY="<secret key>" pnpm clone-prod
 */

import { existsSync } from 'node:fs';
import pg from 'pg';
import { createClient } from '@supabase/supabase-js';

// Convenience: load .env.local so you can keep PROD_SERVICE_ROLE_KEY there and
// just run `pnpm clone-prod`. .env.local is gitignored; keep the var UN-prefixed
// (no VITE_) so Vite never bundles this full-access key into the app.
// Shell-set vars still win over the file.
if (existsSync('.env.local') && typeof process.loadEnvFile === 'function') {
  const fromShell = process.env.PROD_SERVICE_ROLE_KEY;
  try {
    process.loadEnvFile('.env.local');
  } catch {
    /* malformed file — ignore and fall back to the shell env */
  }
  if (fromShell) process.env.PROD_SERVICE_ROLE_KEY = fromShell;
}

const PROD_URL = 'https://cibboozjixxyypzchtvr.supabase.co';
const PAGE = 1000; // service_role read page size

const key = process.env.PROD_SERVICE_ROLE_KEY;
if (!key) {
  console.error(
    '\nPROD_SERVICE_ROLE_KEY is not set.\n' +
      'Get the "secret key" from the Supabase dashboard → Settings → API keys\n' +
      '(formerly the `service_role` key — NOT the publishable/anon one), then either:\n' +
      '  - add to .env.local (gitignored):  PROD_SERVICE_ROLE_KEY=<secret key>\n' +
      '  - or one-off (PowerShell):  $env:PROD_SERVICE_ROLE_KEY = "<secret key>"; pnpm clone-prod\n',
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

/**
 * Re-point each cloned member at the LOCAL auth login that owns the same email.
 *
 * The clone copies the PUBLIC schema only — prod `auth` users are never brought
 * over, and the load just overwrote `members.user_id` with prod's login ids. The
 * app resolves "who am I" by `members.user_id = auth.uid()`, so without this step
 * you can't act as yourself (LO/admin) after a clone. Your LOCAL login survives
 * the clone (the `auth` schema isn't truncated), so this matches by email and
 * repoints. Idempotent. Same logic as database/dev_relink_lo_login.sql.
 *
 * @returns number of member rows repointed.
 */
async function relinkAuth() {
  const res = await local.query(
    `update public.members m
        set user_id = u.id
       from auth.users u
      where lower(m.email) = lower(u.email)
        and m.user_id is distinct from u.id`,
  );
  return res.rowCount;
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
    console.log(`\n✅ Loaded ${total} rows into local.`);

    // Auth isn't cloned, so re-point each member at its matching LOCAL login.
    const relinked = await relinkAuth();
    console.log(
      relinked > 0
        ? `🔗 Relinked ${relinked} member(s) to your local login(s) by email.`
        : '🔗 No members matched a local login by email — sign up locally, then\n' +
            '   re-run, or run database/dev_relink_lo_login.sql once you have.',
    );
    console.log('\nRefresh your browser.');
  } finally {
    await local.query('set session_replication_role = default');
    await local.end();
  }
}

main().catch((e) => {
  console.error(`\nClone failed: ${e.message}`);
  local.end().finally(() => process.exit(1));
});
