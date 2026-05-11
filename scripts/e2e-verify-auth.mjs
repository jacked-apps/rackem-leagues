#!/usr/bin/env node
/**
 * @fileoverview pnpm e2e:verify-auth — verify the bcrypt hash gate.
 *
 * Reads E2E_PW from .env.local, then for each foundation user runs
 * Postgres's native `crypt(password, stored_hash) = stored_hash` check.
 * That's the same bcrypt verification GoTrue performs internally — if
 * the hash matches the password here, it will authenticate via the
 * login UI.
 *
 * This is the Success Criteria gate for Unit 1: if the bcrypt hash
 * committed in database/e2e_seed.sql doesn't match E2E_PW, the seed
 * is broken and Unit 1 is not done — even if the SQL inserts succeeded.
 *
 * Run AFTER pnpm e2e:setup. Exits 0 if all 5 users verify, 1 if any fail.
 */

import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import dotenv from 'dotenv';
import pg from 'pg';

const { Client } = pg;
const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..');

dotenv.config({ path: resolve(repoRoot, '.env.local'), quiet: true });

const E2E_PW = process.env.E2E_PW;
if (!E2E_PW) {
  console.error('Error: E2E_PW not set in .env.local. See .env.example.');
  process.exit(1);
}

const client = new Client({
  host: 'localhost',
  port: 54322,
  user: 'postgres',
  password: process.env.PGPASSWORD || 'postgres',
  database: 'postgres',
});

try {
  await client.connect();
} catch (err) {
  console.error('');
  console.error('Could not connect to local Supabase Postgres on port 54322.');
  console.error('Is local Supabase running? Try: pnpm db:start');
  console.error('');
  process.exit(1);
}

console.log('Verifying bcrypt hash gate via Postgres crypt() (same algorithm GoTrue uses)...');
console.log('');

try {
  const { rows } = await client.query(
    `SELECT email,
            (encrypted_password = crypt($1, encrypted_password)) AS authenticates
     FROM auth.users
     WHERE email LIKE 'e2e-%@test.test'
     ORDER BY email`,
    [E2E_PW]
  );

  if (rows.length === 0) {
    console.error('No foundation users found. Did you run pnpm e2e:setup?');
    process.exit(1);
  }

  let passed = 0;
  let failed = 0;
  for (const row of rows) {
    if (row.authenticates) {
      console.log(`  pass  ${row.email}`);
      passed += 1;
    } else {
      console.log(`  FAIL  ${row.email}`);
      failed += 1;
    }
  }

  console.log('');
  console.log(`Result: ${passed} passed, ${failed} failed.`);

  if (failed > 0) {
    console.error('');
    console.error('Bcrypt hash gate FAILED. The hash in database/e2e_seed.sql does');
    console.error('not match E2E_PW in .env.local. Either:');
    console.error('  - Set E2E_PW to the password the hash was generated for, OR');
    console.error('  - Regenerate the hash for your chosen E2E_PW:');
    console.error('      pnpm dlx bcrypt-cli "$E2E_PW" 10');
    console.error('    Then replace the hash literal in database/e2e_seed.sql and');
    console.error('    re-run pnpm e2e:setup.');
    console.error('');
    process.exit(1);
  }

  console.log('All 5 foundation users authenticate. Unit 1 / R5 verification PASS.');
  process.exit(0);
} finally {
  await client.end();
}
