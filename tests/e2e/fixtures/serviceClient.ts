/**
 * @fileoverview Local-only Supabase service-role client for E2E factories.
 *
 * Provides a Supabase client wired to the local Supabase instance with
 * service-role privileges (bypasses RLS). Used by tests/e2e/fixtures/
 * factories.ts to insert test data quickly.
 *
 * SECURITY
 *
 *   The JWT below is Supabase's PUBLISHED LOCAL DEMO key — it is the
 *   default service-role key for every local Supabase install and is
 *   not secret. Issuer "supabase-demo", expires 2032. Hardcoded here
 *   because tsconfig.app.json excludes src/test/ from the application
 *   build; importing src/test/dbTestUtils.ts (which has the same JWT)
 *   from tests/ is fragile. Duplication is fine — the value is
 *   public and identical across all local installs.
 *
 *   NEVER replace this with a real service-role key. Use
 *   process.env.SUPABASE_SERVICE_ROLE_KEY (loaded from .env.local,
 *   gitignored) when v2 staging support is added.
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const LOCAL_SUPABASE_URL = 'http://127.0.0.1:54321';

// Local Supabase demo service-role JWT. Public, well-known, local-only.
const LOCAL_SERVICE_ROLE_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU';

let cached: SupabaseClient | null = null;

/**
 * Returns a singleton Supabase client with service-role privileges.
 * Used by factories for test-data setup. Bypasses RLS.
 */
export function getServiceClient(): SupabaseClient {
  if (cached) return cached;
  cached = createClient(LOCAL_SUPABASE_URL, LOCAL_SERVICE_ROLE_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
  return cached;
}
