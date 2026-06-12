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
 * Interface names that are virtual / VPN / container adapters, NOT the real
 * Wi-Fi or Ethernet a phone can reach. These routinely sort ahead of the real
 * adapter in `networkInterfaces()`, so a naive "first IPv4" pick lands on an
 * address the phone can't reach (e.g. a NordVPN `10.x` or WSL `172.x`).
 */
const VIRTUAL_IFACE = /wsl|hyper-?v|vethernet|virtualbox|vmware|nord|openvpn|\bvpn\b|tailscale|zerotier|tap|tun|loopback|docker|bridge/i;

/**
 * Rank a candidate address so real home/office LAN ranges win. Higher is
 * better. `192.168.x` (typical home Wi-Fi) beats a real `10.x` LAN, and the
 * `172.16–31.x` range (Docker/WSL/Hyper-V) is deprioritized.
 *
 * @param {string} ip
 * @returns {number}
 */
function rankAddress(ip) {
  if (ip.startsWith('192.168.')) return 3;
  if (ip.startsWith('10.')) return 2;
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(ip)) return 1;
  return 0;
}

/**
 * Find the best LAN IPv4 a phone on the same network can actually reach.
 * Skips virtual/VPN/container interfaces by name, then prefers the most
 * "real-LAN-looking" address. A `DEV_PHONE_IP` env var overrides everything.
 *
 * @returns {string | null} The chosen IP, or null if none is available.
 */
function findLanIp() {
  if (process.env.DEV_PHONE_IP) return process.env.DEV_PHONE_IP;

  const interfaces = networkInterfaces();
  const candidates = [];
  for (const [name, list] of Object.entries(interfaces)) {
    for (const addr of list ?? []) {
      if (addr.family !== 'IPv4' || addr.internal) continue;
      candidates.push({ name, address: addr.address, virtual: VIRTUAL_IFACE.test(name) });
    }
  }
  if (candidates.length === 0) return null;

  // Prefer non-virtual interfaces; within each, prefer the best LAN range.
  candidates.sort((a, b) => {
    if (a.virtual !== b.virtual) return a.virtual ? 1 : -1;
    return rankAddress(b.address) - rankAddress(a.address);
  });

  if (candidates[0].virtual) {
    console.warn(
      'Warning: only virtual/VPN interfaces found; your phone may not reach this.\n' +
        'If it fails, pause your VPN or set DEV_PHONE_IP=<your Wi-Fi IP>.',
    );
  }
  return candidates[0].address;
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
