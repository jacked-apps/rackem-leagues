/**
 * @fileoverview RLS Tests for Members Table
 *
 * Tests member/user profile operations:
 * - Players viewing other profiles
 * - Players updating their own profile
 * - Registration/signup flows
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createTestClient, executeSql } from '@/test/dbTestUtils';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database.types';

describe('Members Table - RLS Tests', () => {
  let client: SupabaseClient<Database>;
  let testMemberId: string;

  beforeAll(async () => {
    client = createTestClient();

    // A member this file OWNS, rather than whichever row came back first.
    //
    // The update cases below rewrite contact details, and doing that to a
    // seeded member has lasting consequences: changing a placeholder's email
    // fires `ensure_placeholder_invite_token`, which cancels the old pending
    // invite and issues a new one. Changing it back leaves a CANCELLED row for
    // the original address, so the next run's cancel collides with it and the
    // update dies on `unique_pending_invite` (23505). One run poisoned that
    // member permanently, and the failure surfaced in whatever file touched it
    // next — not here.
    const rows = await executeSql(
      `INSERT INTO public.members
         (first_name, last_name, phone, email, address, city, state, zip_code, date_of_birth)
       VALUES ('Rls', 'Fixture', '5550000000',
               'rls-members-' || gen_random_uuid() || '@example.test',
               '1 Test St', 'Testville', 'TX', '00000', '1990-01-01')
       RETURNING id`
    );
    testMemberId = rows[0].id;
  });

  afterAll(async () => {
    if (!testMemberId) return;
    // Invites first — the trigger above issues one for any placeholder with an
    // email, and they hold a foreign key to the member.
    await executeSql(`DELETE FROM public.invite_tokens WHERE member_id = $1`, [testMemberId]);
    await executeSql(`DELETE FROM public.members WHERE id = $1`, [testMemberId]);
  });

  describe('SELECT Operations', () => {
    it('should allow viewing all members', async () => {
      const { data, error } = await client
        .from('members')
        .select('*')
        .limit(10);

      expect(error).toBeNull();
      expect(data).toBeDefined();
      expect(Array.isArray(data)).toBe(true);
    });

    it('should allow viewing member by id', async () => {
      if (!testMemberId) {
        console.warn('⚠️ No test member found, skipping test');
        return;
      }

      const { data, error } = await client
        .from('members')
        .select('*')
        .eq('id', testMemberId)
        .single();

      expect(error).toBeNull();
      expect(data).toBeDefined();
      expect(data?.id).toBe(testMemberId);
    });

    it('should allow searching members by name', async () => {
      const { data, error } = await client
        .from('members')
        .select('first_name, last_name, email')
        .ilike('first_name', '%a%')
        .limit(5);

      expect(error).toBeNull();
      expect(data).toBeDefined();
    });

    it('should allow viewing member with system player number', async () => {
      const { data, error } = await client
        .from('members')
        .select('system_player_number, first_name, last_name')
        .limit(5);

      expect(error).toBeNull();
      expect(data).toBeDefined();
    });

    it('should allow filtering by BCA membership status', async () => {
      const { data, error } = await client
        .from('members')
        .select('*')
        .not('bca_member_number', 'is', null)
        .limit(5);

      expect(error).toBeNull();
      expect(data).toBeDefined();
    });
  });

  describe('UPDATE Operations - Profile Management', () => {
    it('should allow updating contact information', async () => {
      if (!testMemberId) {
        console.warn('⚠️ No test member found, skipping test');
        return;
      }

      const { data: before } = await client
        .from('members')
        .select('phone, email')
        .eq('id', testMemberId)
        .single();

      const { error } = await client
        .from('members')
        .update({
          phone: '555-0199',
          email: 'updated@test.com',
        })
        .eq('id', testMemberId);

      expect(error).toBeNull();

      // Restore original
      if (before) {
        await client
          .from('members')
          .update({
            phone: before.phone,
            email: before.email,
          })
          .eq('id', testMemberId);
      }
    });

    it('should allow updating address', async () => {
      if (!testMemberId) {
        console.warn('⚠️ No test member found, skipping test');
        return;
      }

      const { data: before } = await client
        .from('members')
        .select('address, city, state, zip_code')
        .eq('id', testMemberId)
        .single();

      const { error } = await client
        .from('members')
        .update({
          address: '456 New St',
          city: 'New City',
          state: 'CA',
          zip_code: '90210',
        })
        .eq('id', testMemberId);

      expect(error).toBeNull();

      // Restore
      if (before) {
        await client
          .from('members')
          .update(before)
          .eq('id', testMemberId);
      }
    });

    it('should allow updating nickname', async () => {
      if (!testMemberId) {
        console.warn('⚠️ No test member found, skipping test');
        return;
      }

      const { data: before } = await client
        .from('members')
        .select('nickname')
        .eq('id', testMemberId)
        .single();

      const { error } = await client
        .from('members')
        .update({ nickname: 'TestNick' })
        .eq('id', testMemberId);

      expect(error).toBeNull();

      // Restore
      if (before) {
        await client
          .from('members')
          .update({ nickname: before.nickname })
          .eq('id', testMemberId);
      }
    });

    it('should allow updating profanity filter setting', async () => {
      if (!testMemberId) {
        console.warn('⚠️ No test member found, skipping test');
        return;
      }

      const { data: before } = await client
        .from('members')
        .select('profanity_filter_enabled')
        .eq('id', testMemberId)
        .single();

      const newValue = !before?.profanity_filter_enabled;
      const { error } = await client
        .from('members')
        .update({ profanity_filter_enabled: newValue })
        .eq('id', testMemberId);

      expect(error).toBeNull();

      // Restore
      if (before) {
        await client
          .from('members')
          .update({ profanity_filter_enabled: before.profanity_filter_enabled })
          .eq('id', testMemberId);
      }
    });

    it('should allow updating BCA membership info', async () => {
      if (!testMemberId) {
        console.warn('⚠️ No test member found, skipping test');
        return;
      }

      const { data: before } = await client
        .from('members')
        .select('bca_member_number, membership_paid_date')
        .eq('id', testMemberId)
        .single();

      const { error } = await client
        .from('members')
        .update({
          bca_member_number: 'TEST123456',
          membership_paid_date: '2025-01-01',
        })
        .eq('id', testMemberId);

      expect(error).toBeNull();

      // Restore
      if (before) {
        await client
          .from('members')
          .update({
            bca_member_number: before.bca_member_number,
            membership_paid_date: before.membership_paid_date,
          })
          .eq('id', testMemberId);
      }
    });
  });

  // INSERT Operations removed due to PGRST102 bug
  // See: https://github.com/PostgREST/postgrest/issues
  // INSERT tests will be added when RLS policies are implemented
  // and can be tested through the actual application UI
});
