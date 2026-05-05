/**
 * @fileoverview Tests for `deriveReasonFromError` — the route guard's
 * mapping from a Supabase / network error onto a `RecoveryReason`.
 *
 * This mapping decides what copy a captain sees on a mid-prep failure
 * during league night. A misclassification means the wrong copy: a
 * captain whose session expired might see "Connection Lost" and
 * fruitlessly tap Try Again; a captain on a plane might see "Session
 * Expired" and waste effort signing in. Worth pinning.
 */

import { describe, it, expect } from 'vitest';
import { deriveReasonFromError } from '../MatchPhaseGuard';

describe('deriveReasonFromError', () => {
  describe('happy paths — known error shapes map to specific reasons', () => {
    it('maps PGRST116 (no rows from .single()) to match_not_found', () => {
      expect(deriveReasonFromError({ code: 'PGRST116' })).toBe('match_not_found');
    });

    it('maps numeric status 401 to auth_expired', () => {
      expect(deriveReasonFromError({ status: 401 })).toBe('auth_expired');
    });

    it('maps string code "401" to auth_expired', () => {
      expect(deriveReasonFromError({ code: '401' })).toBe('auth_expired');
    });

    it('matches "JWT expired" message (case-insensitive) to auth_expired', () => {
      expect(deriveReasonFromError({ message: 'JWT expired' })).toBe('auth_expired');
      expect(deriveReasonFromError({ message: 'jwt expired at iat' })).toBe('auth_expired');
      expect(deriveReasonFromError({ message: 'JWT EXPIRED' })).toBe('auth_expired');
    });

    it('maps numeric status >= 500 to server_error', () => {
      expect(deriveReasonFromError({ status: 500 })).toBe('server_error');
      expect(deriveReasonFromError({ status: 503 })).toBe('server_error');
      expect(deriveReasonFromError({ status: 599 })).toBe('server_error');
    });
  });

  describe('default — unknown / generic errors fall back to connection', () => {
    it('plain Error instance falls back to connection', () => {
      expect(deriveReasonFromError(new Error('Network request failed'))).toBe('connection');
    });

    it('null falls back to connection', () => {
      expect(deriveReasonFromError(null)).toBe('connection');
    });

    it('undefined falls back to connection', () => {
      expect(deriveReasonFromError(undefined)).toBe('connection');
    });

    it('a string error value falls back to connection', () => {
      expect(deriveReasonFromError('Something broke')).toBe('connection');
    });

    it('a number falls back to connection', () => {
      expect(deriveReasonFromError(42)).toBe('connection');
    });

    it('an object with no recognized fields falls back to connection', () => {
      expect(deriveReasonFromError({ unrelated: true })).toBe('connection');
    });

    it('numeric status < 500 (and not 401) falls back to connection', () => {
      expect(deriveReasonFromError({ status: 404 })).toBe('connection');
      expect(deriveReasonFromError({ status: 429 })).toBe('connection');
    });
  });

  describe('runtime narrowing safety — non-string/non-number fields are ignored', () => {
    it('non-string code is ignored (does not crash, falls back)', () => {
      expect(deriveReasonFromError({ code: 401 })).toBe('connection');
      expect(deriveReasonFromError({ code: { weird: true } })).toBe('connection');
    });

    it('non-number status is ignored', () => {
      expect(deriveReasonFromError({ status: '500' })).toBe('connection');
    });

    it('non-string message is ignored (no regex on non-string)', () => {
      expect(deriveReasonFromError({ message: 12345 })).toBe('connection');
    });
  });

  describe('precedence — first match wins when multiple fields are present', () => {
    it('PGRST116 wins over 401 status', () => {
      expect(deriveReasonFromError({ code: 'PGRST116', status: 401 })).toBe('match_not_found');
    });

    it('401 status wins over 500', () => {
      // Real APIs don't combine these, but the order is documented behavior.
      expect(deriveReasonFromError({ status: 401, message: 'server fail' })).toBe('auth_expired');
    });

    it('JWT-message wins regardless of status (status undefined)', () => {
      expect(deriveReasonFromError({ message: 'JWT expired and other things' })).toBe('auth_expired');
    });
  });
});
