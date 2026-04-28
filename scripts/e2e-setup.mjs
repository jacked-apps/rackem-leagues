#!/usr/bin/env node
/**
 * @fileoverview pnpm e2e:setup runner.
 *
 * Rebuilds the local-only E2E test foundation (1 org, 1 venue, 5 users)
 * by piping database/e2e_seed.sql through a Node-native `pg` client to
 * local Supabase on port 54322. No psql install required.
 *
 * Safety
 *   1. Reads E2E_LOCAL_OK from .env.local. Refuses to run unless it is
 *      exactly 'true'. The seed SQL re-asserts the same condition via a
 *      DO block — two layers of defense.
 *   2. Wraps the seed in BEGIN/COMMIT so partial failures roll back
 *      cleanly.
 *
 * Prerequisites
 *   - Local Supabase running (pnpm db:start; uses port 54322).
 *   - .env.local contains E2E_LOCAL_OK=true and E2E_PW=<value matching
 *     the bcrypt hash committed in database/e2e_seed.sql>.
 */

import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { readFile } from 'node:fs/promises';
import dotenv from 'dotenv';
import pg from 'pg';

const { Client } = pg;
const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..');

dotenv.config({ path: resolve(repoRoot, '.env.local'), quiet: true });

if (process.env.E2E_LOCAL_OK !== 'true') {
  console.error('');
  console.error('Refusing to run: E2E_LOCAL_OK must be exactly "true".');
  console.error('');
  console.error('Set it in .env.local (gitignored):');
  console.error('  E2E_LOCAL_OK=true');
  console.error('');
  console.error('NEVER set E2E_LOCAL_OK against any database other than your local');
  console.error('Supabase instance. See .env.example for full guidance.');
  console.error('');
  process.exit(1);
}

const seedPath = resolve(repoRoot, 'database/e2e_seed.sql');
const seedSql = await readFile(seedPath, 'utf8');

console.log('Rebuilding E2E foundation against local Supabase (port 54322)...');

const client = new Client({
  host: 'localhost',
  port: 54322,
  user: 'postgres',
  password: process.env.PGPASSWORD || 'postgres',
  database: 'postgres',
});

// Surface RAISE NOTICE / WARNING / INFO from the SQL so the developer sees
// the seed's "E2E foundation rebuilt..." messages and any guard-raise text.
client.on('notice', (msg) => {
  console.log(msg.message);
});

try {
  await client.connect();
} catch (err) {
  console.error('');
  console.error('Could not connect to local Supabase Postgres on port 54322.');
  console.error('Is local Supabase running? Try:');
  console.error('  pnpm db:start');
  console.error('');
  console.error(`Underlying error: ${err.message}`);
  process.exit(1);
}

try {
  // Set the session-level GUC the seed's DO block reads. Plain SET (NOT
  // SET LOCAL) so the value persists across the BEGIN/COMMIT below.
  await client.query("SET e2e.local_ok = 'true'");

  await client.query('BEGIN');
  try {
    await client.query(seedSql);
    await client.query('COMMIT');
  } catch (innerErr) {
    try {
      await client.query('ROLLBACK');
    } catch {
      // Ignore rollback errors; the original error is the one we care about.
    }
    throw innerErr;
  }

  console.log('');
  console.log('E2E foundation rebuilt. Run "pnpm e2e:verify-auth" to check the');
  console.log('bcrypt hash actually authenticates.');
  await client.end();
  process.exit(0);
} catch (err) {
  console.error('');
  console.error('Seed failed:');
  console.error(`  ${err.message}`);
  if (err.where) {
    console.error(`  Where: ${err.where}`);
  }
  if (err.detail) {
    console.error(`  Detail: ${err.detail}`);
  }
  if (err.hint) {
    console.error(`  Hint: ${err.hint}`);
  }
  await client.end().catch(() => {});
  process.exit(1);
}
