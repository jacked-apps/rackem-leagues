/**
 * @fileoverview Production Logger Utility
 *
 * Centralized logging system that:
 * - In development: logs to console for immediate feedback
 * - In production: sends errors/warnings to Supabase app_logs table
 *
 * Usage:
 * import { logger } from '@/utils/logger';
 * logger.error('Failed to fetch data', { userId, error: err.message });
 * logger.warn('Deprecated function called', { function: 'oldFunction' });
 *
 * Log levels:
 * - error: Application errors that need attention (always logged)
 * - warn: Warnings about potential issues (always logged)
 * - info: Important state changes (production: logged, dev: console)
 * - debug: Development debugging (dev only, never sent to Supabase)
 */

import { supabase } from '@/supabaseClient';
import type { Json } from '@/types/database.types';

type LogLevel = 'error' | 'warn' | 'info' | 'debug';

interface LogEntry {
  level: LogLevel;
  message: string;
  context?: Record<string, unknown>;
  timestamp: string;
  url?: string;
  user_id?: string;
}

const isDev = import.meta.env.DEV;

/**
 * Send log entry to Supabase app_logs table
 * Fails silently to avoid breaking the app if logging fails
 */
async function sendToSupabase(entry: LogEntry): Promise<void> {
  try {
    // Get current user ID if available
    const { data: { user } } = await supabase.auth.getUser();

    await supabase.from('app_logs').insert({
      level: entry.level,
      message: entry.message,
      // jsonb column; log context is caller-supplied plain data.
      context: (entry.context || {}) as Json,
      url: typeof window !== 'undefined' ? window.location.href : null,
      user_id: user?.id || null,
    });
  } catch {
    // Silently fail - don't let logging break the app
    // In dev, we can still see the console output
    if (isDev) {
      console.warn('[Logger] Failed to send log to Supabase');
    }
  }
}

/**
 * Format context object for console output
 */
function formatContext(context?: Record<string, unknown>): string {
  if (!context || Object.keys(context).length === 0) return '';
  return ' ' + JSON.stringify(context);
}

export const logger = {
  /**
   * Log an error - always sent to Supabase in production
   * Use for: database failures, unexpected exceptions, critical issues
   */
  error(message: string, context?: Record<string, unknown>): void {
    const entry: LogEntry = {
      level: 'error',
      message,
      context,
      timestamp: new Date().toISOString(),
    };

    // Always log to console in dev
    if (isDev) {
      console.error(`[ERROR] ${message}${formatContext(context)}`);
    }

    // Send to Supabase in production (and dev for testing)
    sendToSupabase(entry);
  },

  /**
   * Log a warning - always sent to Supabase in production
   * Use for: deprecated usage, recoverable errors, potential issues
   */
  warn(message: string, context?: Record<string, unknown>): void {
    const entry: LogEntry = {
      level: 'warn',
      message,
      context,
      timestamp: new Date().toISOString(),
    };

    // Always log to console in dev
    if (isDev) {
      console.warn(`[WARN] ${message}${formatContext(context)}`);
    }

    // Send to Supabase in production
    if (!isDev) {
      sendToSupabase(entry);
    }
  },

  /**
   * Log informational message - sent to Supabase in production
   * Use for: important state changes, user actions worth tracking
   */
  info(message: string, context?: Record<string, unknown>): void {
    const entry: LogEntry = {
      level: 'info',
      message,
      context,
      timestamp: new Date().toISOString(),
    };

    // Log to console in dev
    if (isDev) {
      console.log(`[INFO] ${message}${formatContext(context)}`);
    }

    // Send to Supabase in production
    if (!isDev) {
      sendToSupabase(entry);
    }
  },

  /**
   * Debug logging - ONLY in development, never sent to Supabase
   * Use for: temporary debugging during development
   */
  debug(message: string, context?: Record<string, unknown>): void {
    if (isDev) {
      console.log(`[DEBUG] ${message}${formatContext(context)}`);
    }
    // Never sent to Supabase - this is dev-only
  },
};

export default logger;
