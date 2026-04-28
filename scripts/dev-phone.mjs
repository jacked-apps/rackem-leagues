#!/usr/bin/env node
/**
 * @fileoverview Dev server starter for phone testing.
 *
 * Detects the current LAN IP at run time and sets VITE_SUPABASE_URL to
 * use that IP instead of `localhost`. This lets a phone on the same
 * WiFi reach both the Vite dev server (port 5173) AND the local
 * Supabase API (port 54321) via the host machine's network IP.
 *
 * Without this, the phone's browser interprets `localhost`/`127.0.0.1`
 * as the phone itself, so API calls fail with "Failed to fetch."
 *
 * Usage: pnpm run dev-phone
 *
 * No editing required when switching networks — the script re-detects
 * the active IP every time it runs.
 */
import { networkInterfaces } from 'node:os';
import { spawn } from 'node:child_process';

/**
 * Find the first non-internal IPv4 address. Walks all network interfaces
 * (Wi-Fi, Ethernet, etc.) and returns the first usable LAN address.
 *
 * @returns {string | null} The detected IP, or null if none is available.
 */
function findLanIp() {
  const interfaces = networkInterfaces();
  for (const list of Object.values(interfaces)) {
    for (const addr of list ?? []) {
      if (addr.family === 'IPv4' && !addr.internal) {
        return addr.address;
      }
    }
  }
  return null;
}

const ip = findLanIp();
if (!ip) {
  console.error(
    'Error: could not detect a local network IP.\n' +
      'Is your WiFi connected? If using ethernet only and no LAN, this script cannot work.',
  );
  process.exit(1);
}

const supabaseUrl = `http://${ip}:54321`;
console.log('--- dev-phone mode ---');
console.log(`VITE_SUPABASE_URL = ${supabaseUrl}`);
console.log('On your phone, open the Network URL Vite prints below.');
console.log(`(Should be: http://${ip}:5173)`);
console.log('-----------------------');

const isWindows = process.platform === 'win32';
const cmd = isWindows ? 'pnpm.cmd' : 'pnpm';
const child = spawn(cmd, ['exec', 'vite'], {
  stdio: 'inherit',
  env: { ...process.env, VITE_SUPABASE_URL: supabaseUrl },
});

child.on('exit', (code) => process.exit(code ?? 0));
