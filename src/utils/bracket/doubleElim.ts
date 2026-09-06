/**
 * @fileoverview Double-elimination generation (Unit 2b).
 *
 * A winners bracket (WB) plus a losers bracket (LB): every WB match's loser
 * drops into a specific LB round (WB round r → LB round 2r-2 for r>=2, WB
 * round 1 → LB round 1), cross-seeded to the opposite side to reduce immediate
 * rematches. The LB alternates "major" rounds (LB survivors meet fresh WB
 * droppers) with "minor" rounds (LB survivors play each other), ending in the
 * LB final; its winner meets the WB champion in the grand final, with an
 * optional conditional reset match.
 *
 * Byes (non-power-of-two fields) are handled by a PRODUCER MODEL: each match
 * slot is fed by a "producer" (a seed, or another match's winner/loser). A
 * `resolve()` pass contracts byes — a half-bye match passes its one real player
 * straight through; a fully-phantom match yields a bye downstream. A match is
 * kept only when BOTH its resolved producers are real, so bye "matches" never
 * appear in the output. This yields exactly 2N-2 matches (+1 for the reset).
 *
 * Pure + deterministic (seed positions only). "Works, not perfect": the tree is
 * always valid; cross-seeding reduces but does not provably eliminate every
 * deep-LB rematch.
 */

import type { GeneratedBracket, GeneratedMatch, MatchSlot } from '@/types/bracket';
import { nextPow2, seedSlots } from './seeding';

/** A slot's feed. `seed` may be a phantom (> N) representing a bye. */
type Producer =
  | { t: 'seed'; s: number }
  | { t: 'wbwin'; k: string }
  | { t: 'wblose'; k: string }
  | { t: 'lbwin'; k: string };

/** A resolved producer, or the phantom sentinel (a bye). */
type Resolved = Producer | { t: 'phantom' };
const PHANTOM: Resolved = { t: 'phantom' };

interface MatchDef {
  key: string;
  round: number;
  side: GeneratedMatch['side'];
  slot: number;
  home: Producer;
  away: Producer;
  isResetMatch: boolean;
}

function log2(size: number): number {
  return Math.round(Math.log2(size));
}

export function generateDoubleElim(
  participantCount: number,
  grandFinalReset: boolean
): GeneratedBracket {
  const N = participantCount;
  const size = nextPow2(N);
  const d = log2(size);
  const slots = seedSlots(size);

  const defs = new Map<string, MatchDef>();
  const order: string[] = [];
  const add = (def: MatchDef) => {
    defs.set(def.key, def);
    order.push(def.key);
  };

  // ── Winners bracket ──────────────────────────────────────────────────────
  for (let r = 1; r <= d; r++) {
    const count = size / 2 ** r;
    for (let i = 0; i < count; i++) {
      add({
        key: `W${r}-${i}`,
        round: r,
        side: 'winners',
        slot: i,
        home:
          r === 1
            ? { t: 'seed', s: slots[2 * i] }
            : { t: 'wbwin', k: `W${r - 1}-${2 * i}` },
        away:
          r === 1
            ? { t: 'seed', s: slots[2 * i + 1] }
            : { t: 'wbwin', k: `W${r - 1}-${2 * i + 1}` },
        isResetMatch: false,
      });
    }
  }

  // ── Losers bracket ───────────────────────────────────────────────────────
  // Round match counts: c[1] = size/4; even rounds hold (major, meet WB drops),
  // odd rounds >=3 halve (minor, LB survivors only).
  const lbRounds = 2 * d - 2;
  const c: number[] = [];
  c[1] = size / 4;
  for (let m = 2; m <= lbRounds; m++) c[m] = m % 2 === 0 ? c[m - 1] : c[m - 1] / 2;

  for (let m = 1; m <= lbRounds; m++) {
    for (let j = 0; j < c[m]; j++) {
      let home: Producer;
      let away: Producer;
      if (m === 1) {
        // WB round-1 losers meet each other.
        home = { t: 'wblose', k: `W1-${2 * j}` };
        away = { t: 'wblose', k: `W1-${2 * j + 1}` };
      } else if (m % 2 === 0) {
        // Major: LB survivor (home) vs cross-seeded WB round (m/2+1) dropper.
        const wbRound = m / 2 + 1;
        home = { t: 'lbwin', k: `L${m - 1}-${j}` };
        away = { t: 'wblose', k: `W${wbRound}-${c[m] - 1 - j}` };
      } else {
        // Minor: two LB survivors.
        home = { t: 'lbwin', k: `L${m - 1}-${2 * j}` };
        away = { t: 'lbwin', k: `L${m - 1}-${2 * j + 1}` };
      }
      add({ key: `L${m}-${j}`, round: m, side: 'losers', slot: j, home, away, isResetMatch: false });
    }
  }

  // ── Grand final (+ conditional reset) ────────────────────────────────────
  add({
    key: 'GF',
    round: 1,
    side: 'grand_final',
    slot: 0,
    home: { t: 'wbwin', k: `W${d}-0` }, // WB champion
    away:
      d >= 2
        ? { t: 'lbwin', k: `L${lbRounds}-0` } // LB champion
        : { t: 'wblose', k: 'W1-0' }, // 2-player degenerate: the one loser
    isResetMatch: false,
  });
  if (grandFinalReset) {
    // Conditional decider — no incoming producers; Unit 3 activates it at
    // runtime only if the LB champion wins game 1.
    add({
      key: 'GFR',
      round: 2,
      side: 'grand_final',
      slot: 0,
      home: { t: 'seed', s: size + 1 }, // phantom placeholders (runtime-filled)
      away: { t: 'seed', s: size + 1 },
      isResetMatch: true,
    });
  }

  // ── Resolve producers (contract byes) ────────────────────────────────────
  const memo = new Map<string, Resolved>();
  const pid = (p: Producer): string => `${p.t}:${'s' in p ? p.s : p.k}`;

  function kept(key: string): boolean {
    const def = defs.get(key)!;
    return resolve(def.home).t !== 'phantom' && resolve(def.away).t !== 'phantom';
  }

  function resolve(p: Producer): Resolved {
    const id = pid(p);
    const cached = memo.get(id);
    if (cached) return cached;
    let out: Resolved;
    if (p.t === 'seed') {
      out = p.s <= N ? p : PHANTOM;
    } else if (p.t === 'wblose') {
      // A loser exists only if the match is a real (kept) game.
      out = kept(p.k) ? p : PHANTOM;
    } else {
      // wbwin / lbwin: contract through a half-bye (one real, one phantom).
      const def = defs.get(p.k)!;
      const rh = resolve(def.home);
      const ra = resolve(def.away);
      if (rh.t === 'phantom' && ra.t === 'phantom') out = PHANTOM;
      else if (rh.t === 'phantom') out = ra;
      else if (ra.t === 'phantom') out = rh;
      else out = p; // both real → this match's winner is a real producer
    }
    memo.set(id, out);
    return out;
  }

  // ── Build output (kept matches only) + forward-wire pointers ─────────────
  const out: GeneratedMatch[] = [];
  const outByKey = new Map<string, GeneratedMatch>();
  for (const key of order) {
    const def = defs.get(key)!;
    const isGrandFinal = def.side === 'grand_final';
    if (!isGrandFinal && !kept(key)) continue; // elide bye matches
    const m: GeneratedMatch = {
      key: def.key,
      round: def.round,
      side: def.side,
      slot: def.slot,
      homeSeed: null,
      awaySeed: null,
      winnerSeed: null,
      status: 'pending',
      nextMatchKey: null,
      nextMatchSlot: null,
      loserNextMatchKey: null,
      loserNextMatchSlot: null,
      isResetMatch: def.isResetMatch,
    };
    out.push(m);
    outByKey.set(m.key, m);
  }

  /** Point a resolved producer's forward pointer at a consumer slot, or set a
   *  seed directly into that slot. */
  function wire(consumerKey: string, slot: MatchSlot, raw: Producer): void {
    const rp = resolve(raw);
    const consumer = outByKey.get(consumerKey)!;
    if (rp.t === 'phantom') return;
    if (rp.t === 'seed') {
      if (slot === 'home') consumer.homeSeed = rp.s;
      else consumer.awaySeed = rp.s;
      return;
    }
    const producer = outByKey.get(rp.k)!;
    if (rp.t === 'wblose') {
      producer.loserNextMatchKey = consumerKey;
      producer.loserNextMatchSlot = slot;
    } else {
      // wbwin / lbwin → winner pointer
      producer.nextMatchKey = consumerKey;
      producer.nextMatchSlot = slot;
    }
  }

  for (const m of out) {
    if (m.isResetMatch) continue; // reset has no incoming producers
    const def = defs.get(m.key)!;
    wire(m.key, 'home', def.home);
    wire(m.key, 'away', def.away);
  }

  // ── Statuses: both seeds present (a real round-1 pairing) → ready ─────────
  for (const m of out) {
    m.status = m.homeSeed !== null && m.awaySeed !== null ? 'ready' : 'pending';
  }

  return out;
}
