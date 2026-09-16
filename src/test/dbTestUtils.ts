/**
 * @fileoverview Database Integration Test Utilities
 *
 * Utilities for testing against the actual local Supabase database.
 * These tests help verify RLS policies don't break existing functionality.
 *
 * IMPORTANT: These tests run against your LOCAL database, not production!
 *
 * Usage:
 * 1. Start local Supabase: `supabase start`
 * 2. Run tests: `pnpm test:run src/__tests__/database`
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database.types';
import { Pool } from 'pg';

/**
 * Test user credentials for different roles
 * These should exist in your seed data
 */
export const TEST_USERS = {
  // Player - no special permissions
  player: {
    email: 'player@test.com',
    password: 'test-password-123',
    role: 'player' as const,
  },
  // Team captain - can manage their team
  captain: {
    email: 'captain@test.com',
    password: 'test-password-123',
    role: 'captain' as const,
  },
  // League operator - can manage their organization
  operator: {
    email: 'operator@test.com',
    password: 'test-password-123',
    role: 'operator' as const,
  },
  // Organization owner - full control
  owner: {
    email: 'owner@test.com',
    password: 'test-password-123',
    role: 'owner' as const,
  },
};

/**
 * Create a Supabase client for testing
 * Uses local Supabase instance with anon key (for RLS testing)
 */
export function createTestClient(storageKey?: string): SupabaseClient<Database> {
  const supabaseUrl = 'http://127.0.0.1:54321';
  const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0';

  // Under jsdom every client persists its session to the same localStorage
  // slot by default, so signing in a SECOND user silently overwrites the
  // first client's session — a test that thinks it holds "operator" is
  // really acting as "player". Isolate each client: no persistence, and a
  // distinct storageKey so nothing is shared even if persistence is on.
  return createClient<Database>(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      storageKey: storageKey ?? `test-${Math.random().toString(36).slice(2)}`,
    },
  });
}

/**
 * Create a Supabase client with service role key
 * BYPASSES RLS - use only for test data setup/teardown
 */
export function createServiceClient(): SupabaseClient<Database> {
  const supabaseUrl = 'http://127.0.0.1:54321';
  const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU';

  return createClient<Database>(supabaseUrl, supabaseServiceKey);
}

/**
 * Create an authenticated test client for a specific user
 */
export async function createAuthenticatedClient(
  userType: keyof typeof TEST_USERS
): Promise<SupabaseClient<Database>> {
  const client = createTestClient(`test-${userType}`);
  const user = TEST_USERS[userType];

  const { error } = await client.auth.signInWithPassword({
    email: user.email,
    password: user.password,
  });

  if (error) {
    throw new Error(`Failed to authenticate test user ${userType}: ${error.message}`);
  }

  return client;
}

/**
 * Sign out from a test client
 */
export async function signOut(client: SupabaseClient<Database>) {
  await client.auth.signOut();
}

/**
 * Get the current authenticated user's member ID
 */
export async function getCurrentMemberId(
  client: SupabaseClient<Database>
): Promise<string | null> {
  const { data: { user } } = await client.auth.getUser();

  if (!user) return null;

  const { data: member } = await client
    .from('members')
    .select('id')
    .eq('user_id', user.id)
    .single();

  return member?.id ?? null;
}

/**
 * Test helper: Expect query to succeed and return data
 */
export async function expectQueryToSucceed<T>(
  queryPromise: Promise<{ data: T | null; error: any }>
): Promise<T> {
  const { data, error } = await queryPromise;

  if (error) {
    throw new Error(`Expected query to succeed but got error: ${error.message} (code: ${error.code})`);
  }

  if (!data) {
    throw new Error('Query succeeded but returned no data');
  }

  return data;
}

/**
 * Test helper: Expect query to fail with optional error code check
 */
export async function expectQueryToFail(
  queryPromise: Promise<{ data: any; error: any }>,
  expectedErrorCode?: string
): Promise<void> {
  const { data, error } = await queryPromise;

  if (!error) {
    throw new Error(`Expected query to fail but it succeeded with data: ${JSON.stringify(data)}`);
  }

  if (expectedErrorCode && error.code !== expectedErrorCode) {
    throw new Error(
      `Expected error code ${expectedErrorCode}, got ${error.code}: ${error.message}`
    );
  }
}

/**
 * Test helper: Expect operation to succeed (insert/update/delete)
 */
export async function expectOperationToSucceed(
  operationPromise: Promise<{ error: any }>
): Promise<void> {
  const { error } = await operationPromise;

  if (error) {
    throw new Error(`Expected operation to succeed but got error: ${error.message} (code: ${error.code})`);
  }
}

/**
 * Test helper: Expect operation to fail
 */
export async function expectOperationToFail(
  operationPromise: Promise<{ error: any }>,
  expectedErrorCode?: string
): Promise<void> {
  const { error } = await operationPromise;

  if (!error) {
    throw new Error('Expected operation to fail but it succeeded');
  }

  if (expectedErrorCode && error.code !== expectedErrorCode) {
    throw new Error(
      `Expected error code ${expectedErrorCode}, got ${error.code}: ${error.message}`
    );
  }
}

/**
 * Test helper: Safely get single result from INSERT operation
 * Works around PGRST102 error when using .single() after .insert()
 *
 * @example
 * const result = await client.from('table').insert({...}).select();
 * const item = getSingleResult(result);
 */
export function getSingleResult<T>(result: { data: T[] | null; error: any }): T | null {
  if (result.error) return null;
  if (!result.data || !Array.isArray(result.data) || result.data.length === 0) {
    return null;
  }
  return result.data[0];
}

/**
 * Create a direct Postgres connection pool for test data setup
 * BYPASSES PostgREST entirely - use for INSERT operations that hit PGRST102
 *
 * This connects directly to Postgres, avoiding all PostgREST bugs.
 * Use this for test data setup, then use Supabase client for RLS testing.
 */
let pgPool: Pool | null = null;

export function getPostgresPool(): Pool {
  if (!pgPool) {
    pgPool = new Pool({
      host: '127.0.0.1',
      port: 54322, // Postgres port (NOT the API port 54321)
      database: 'postgres',
      user: 'postgres',
      password: 'postgres',
    });
  }
  return pgPool;
}

/**
 * Execute raw SQL directly against Postgres
 * BYPASSES PostgREST/RLS - use only for test data setup
 *
 * @example
 * await executeSql('INSERT INTO members (email, first_name) VALUES ($1, $2)', ['test@example.com', 'Test']);
 */
export async function executeSql(sql: string, params: any[] = []): Promise<any> {
  const pool = getPostgresPool();
  const result = await pool.query(sql, params);
  return result.rows;
}

/**
 * Clean up Postgres connection pool (call in test teardown)
 */
export async function closePostgresPool(): Promise<void> {
  if (pgPool) {
    await pgPool.end();
    pgPool = null;
  }
}
