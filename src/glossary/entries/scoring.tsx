/**
 * @fileoverview Scoring / points-calculator / win-condition glossary entries.
 *
 * NO DRIFT: no preset names embedded in definitions. The calculators are
 * described by what they DO, not which package they ship in.
 */

import type { GlossaryEntry } from '../types';

export const entries = {
  // DRAFT STUB — created on the Mac branch so win-condition can link here.
  // The Win Calculator is a built module (src/systems/win-calculator/). This is
  // an IMPORTANT entry Ed will expand into the full module explainer later
  // (like scoring-system). Left without reviewedByEd so it shows as unreviewed.
  // Do NOT create a duplicate win-calculator entry on the PC branch.
  'win-calculator': {
    slug: 'win-calculator',
    canonicalName: 'Win Calculator',
    aliases: ['win calc'],
    shortDef:
      'The judge that decides a match’s winner — it checks the win condition first, then any further metrics in order, and falls back to the tiebreaker.',
    longDef: (
      <div className="space-y-2">
        <p>
          The win calculator names the winner of a match. It checks the{' '}
          <a href="#win-condition" className="text-info hover:underline">win condition</a>{' '}
          (the top metric) first; if both sides come out even, it moves to the
          next metric in order, and finally to the{' '}
          <a href="#tiebreaker" className="text-info hover:underline">tiebreaker</a>{' '}
          if nothing separates them.
        </p>
        <p className="text-sm text-muted-foreground">
          Relevant topics:{' '}
          <a href="#win-condition" className="text-info hover:underline">win condition</a>,{' '}
          <a href="#tiebreaker" className="text-info hover:underline">tiebreaker</a>.
        </p>
      </div>
    ),
    l1_anchor: { path: 'docs/league-system/modules/win-calculator.md' },
    related: ['scoring-system'],
  },

  'win-condition': {
    slug: 'win-condition',
    canonicalName: 'Win Condition',
    aliases: ['winning metric'],
    shortDef:
      'The metric a match is decided by first — the league’s most important one (e.g. games or points). If both sides come out even on it, the next metric decides.',
    longDef: (
      <div className="space-y-2">
        <p>
          The win condition is the top metric a match is decided by — the one
          the{' '}
          <a href="#win-calculator" className="text-info hover:underline">
            win calculator
          </a>{' '}
          checks first. A league might decide by games first (more games wins)
          or points first.
        </p>
        <p>
          If both sides come out even on the win condition, the win calculator
          drops to the next metric, and finally to the{' '}
          <a href="#tiebreaker" className="text-info hover:underline">tiebreaker</a>{' '}
          if nothing separates them.
        </p>
        <p className="text-sm text-muted-foreground">
          Relevant topics:{' '}
          <a href="#win-calculator" className="text-info hover:underline">win calculator</a>,{' '}
          <a href="#tiebreaker" className="text-info hover:underline">tiebreaker</a>.
        </p>
      </div>
    ),
    l1_anchor: { path: 'docs/league-system/modules/win-calculator.md' },
    related: ['points-calculator', 'threshold'],
    reviewedByEd: '2026-05-31',
  },

  'points-calculator': {
    slug: 'points-calculator',
    canonicalName: 'Points Calculator',
    aliases: ['scoring formula', 'points formula'],
    shortDef:
      'Any method that decides how many points to give a team or player based on game results.',
    longDef: (
      <p>
        A points calculator turns "who won which games" into a points value
        for each side. Different calculators take different shapes — some
        award points only above a threshold, some accumulate per game, some
        jump to fixed values at milestones. Picking the calculator is how a
        league expresses its scoring rules.
      </p>
    ),
    l1_anchor: { path: 'docs/league-system/modules/points-system/README.md' },
    related: [
      'win-condition',
      'linear-above-threshold',
      'accumulate-with-milestone-jumps',
      'accumulated-per-game',
    ],
    reviewedByEd: '2026-05-31',
  },

  'linear-above-threshold': {
    slug: 'linear-above-threshold',
    canonicalName: 'Linear Above Threshold',
    aliases: [],
    shortDef:
      'A point system that awards points for each game a team wins above its target — and docks points for games below it.',
    longDef: (
      <div className="space-y-2">
        <p>
          Each game a team wins above its{' '}
          <a href="#threshold" className="text-info hover:underline">target</a>{' '}
          adds points; each game below it docks points. How many points per game
          — awarded or docked — depends on the league’s settings.
        </p>
        <p className="text-sm text-muted-foreground">
          Relevant topics:{' '}
          <a href="#threshold" className="text-info hover:underline">threshold</a>.
        </p>
      </div>
    ),
    l1_anchor: {
      path: 'docs/league-system/modules/threshold-charts/race-points.md',
    },
    related: ['points-calculator'],
    reviewedByEd: '2026-05-31',
  },

  // DEFERRED — interim def per Ed. This is a composite scoring *style* (two
  // point mechanisms), really scoring-system-manual material, and Ed is unsure
  // about the name "Accumulate with Milestone Jumps". Left UNSTAMPED; revisit
  // the name + full explanation in the scoring-system manual pass.
  'accumulate-with-milestone-jumps': {
    slug: 'accumulate-with-milestone-jumps',
    canonicalName: 'Accumulate with Milestone Jumps',
    aliases: ['milestone jumps', 'jump scoring'],
    shortDef:
      'A scoring system that gives points per game, then bonus points when a team hits target numbers of games.',
    longDef: (
      <div className="space-y-2">
        <p>
          Points add up per game, and a team earns bonus points when it reaches
          set target numbers of games (
          <a href="#threshold" className="text-info hover:underline">thresholds</a>
          ). The per-game amount, the targets, and the bonuses are all league
          settings.
        </p>
        <p className="text-sm text-muted-foreground">
          Relevant topics:{' '}
          <a href="#threshold" className="text-info hover:underline">threshold</a>.
        </p>
      </div>
    ),
    l1_anchor: {
      path: 'docs/league-system/modules/threshold-charts/race-points.md',
    },
    related: ['points-calculator'],
  },

  'accumulated-per-game': {
    slug: 'accumulated-per-game',
    canonicalName: 'Accumulated per Game',
    aliases: ['per-game scoring'],
    shortDef:
      'A scoring system that awards points per game — to the winning side, the losing side, or both.',
    longDef: (
      <div className="space-y-2">
        <p>
          The points awarded per game can be a preset static number, an amount
          derived from game progress, or entered manually by the{' '}
          <a href="#scorekeeper" className="text-info hover:underline">scorekeeper</a>.
          Points may go to the winning side, the losing side, or both.
        </p>
        <p className="text-sm text-muted-foreground">
          Relevant topics:{' '}
          <a href="#scorekeeper" className="text-info hover:underline">scorekeeper</a>.
        </p>
      </div>
    ),
    l1_anchor: {
      path: 'docs/league-system/modules/threshold-charts/race-points.md',
    },
    related: ['points-calculator'],
    reviewedByEd: '2026-05-31',
  },

  'win-threshold': {
    slug: 'win-threshold',
    canonicalName: 'Win Threshold',
    aliases: ['win target'],
    shortDef:
      'A threshold that wins the match — reach it and the match is yours.',
    longDef: (
      <div className="space-y-2">
        <p>
          A win threshold is a{' '}
          <a href="#threshold" className="text-info hover:underline">threshold</a>{' '}
          whose payoff is the match itself: reach it and you win. If neither
          side reaches its win threshold, the match is a tie — the{' '}
          <a href="#win-calculator" className="text-info hover:underline">win calculator</a>{' '}
          simply names no winner.
        </p>
        <p className="text-sm text-muted-foreground">
          Relevant topics:{' '}
          <a href="#threshold" className="text-info hover:underline">threshold</a>,{' '}
          <a href="#win-calculator" className="text-info hover:underline">win calculator</a>.
        </p>
      </div>
    ),
    l1_anchor: { path: 'docs/league-system/modules/threshold-charts/README.md' },
    related: ['threshold-chart'],
    reviewedByEd: '2026-05-31',
  },

  multiplier: {
    slug: 'multiplier',
    canonicalName: 'Multiplier',
    aliases: ['scoring multiplier'],
    shortDef:
      'A factor that strengthens or weakens a handicap system’s effect — an adjustment to an established system.',
    longDef: (
      <div className="space-y-2">
        <p>
          A multiplier turns a{' '}
          <a href="#handicap" className="text-info hover:underline">handicap</a>{' '}
          system’s effect up or down. It’s an adjustment layered onto an
          established system: higher strengthens the handicap’s impact, lower
          softens it.
        </p>
        <p className="text-sm text-muted-foreground">
          Relevant topics:{' '}
          <a href="#handicap" className="text-info hover:underline">handicap</a>.
        </p>
      </div>
    ),
    l1_anchor: {
      path: 'docs/league-system/modules/threshold-charts/race-points.md',
    },
    related: ['handicap-system'],
    reviewedByEd: '2026-05-31',
  },

  // DRAFT STUB — created on the Mac branch so other entries can link here.
  // "Scoring System" is the umbrella term for the whole modular structure:
  // the top-level Module that composes all component Modules (per
  // docs/league-system/README.md). This is an IMPORTANT entry that Ed will
  // expand with an extensive, educational explanation later. Left without
  // `reviewedByEd` so `pnpm glossary:progress` flags it as needing work.
  // Do NOT create a duplicate `scoring-system` entry on the PC branch.
  'scoring-system': {
    slug: 'scoring-system',
    canonicalName: 'Scoring System',
    aliases: ['scoring', 'scoring setup'],
    shortDef:
      'The complete rule set that decides how a league’s matches are scored and won — assembled from modular parts the operator can customize.',
    longDef: (
      <div className="space-y-2">
        <p>
          A scoring system is the whole configured rule set that scores a
          match. It’s built from modular parts — how handicaps work, how points
          are earned, how a match win is decided, the{' '}
          <a href="#match-format" className="text-info hover:underline">match format</a>,
          and more — that the league operator assembles and can customize. The
          app ships a few tested setups to start from, and others can be built.
        </p>
        <p className="text-sm text-muted-foreground">
          Relevant topics:{' '}
          <a href="#match-format" className="text-info hover:underline">match format</a>.
        </p>
      </div>
    ),
    l1_anchor: {
      path: 'docs/league-system/README.md',
    },
    related: [],
  },
} as const satisfies Record<string, GlossaryEntry>;
