/**
 * @fileoverview Scoreboard Color Constants
 *
 * Single source of truth for team colors used across scoreboard components:
 * - UnifiedScoreboard (live-match team cards — all formats)
 * - TiebreakerScoreboard (tiebreaker score panels)
 * - GameButtonRow / GamesList (game scoring buttons)
 * - MatchEndVerification (match result rows)
 *
 * Every class here is a THEME token defined in src/index.css (`--home-team`,
 * `--game-pending`, …), with a light value and a dark value. To recolour the
 * scoreboard, change the token there, not the class names here.
 *
 * Rule these exist to enforce: text on a coloured panel uses that panel's own
 * text token (`text`), never the page's `text-foreground`. The page colour
 * flips to white in dark mode; before the tokens, the panels stayed light, so
 * scores turned white-on-light-blue and were near unreadable.
 *
 * `button` repeats the background under `dark:` on purpose: the shadcn
 * outline Button sets its own dark-mode background (`dark:bg-input/30`),
 * which would otherwise win and hide the team colour in dark mode.
 *
 * Pre-Unit-7-of-unified-scoreboard-plan, this file also fed TeamStatsCard /
 * ThreeVThreeScoreboard / FiveVFiveScoreboard / TenSevenScoreboard. Those
 * components were deleted when UnifiedScoreboard absorbed their roles.
 */

/**
 * Home team colors (blue theme)
 */
export const HOME_TEAM_COLORS = {
  /** Background color for cards and buttons */
  bg: 'bg-home-team',
  /** Hover state for buttons */
  bgHover: 'hover:bg-home-team-hover',
  /** Border color for cards */
  border: 'border-home-team-border',
  /** Darker border for inner elements */
  borderDark: 'border-home-team-border-strong',
  /** Body text (scores, player rows) on the team background */
  text: 'text-home-team-foreground',
  /** Secondary labels ("Wins", column headers). Standard: the page's muted
   *  text, as always; under a custom scheme: the panel's own text, faded. */
  mutedText: 'text-muted-foreground [[data-palette]_&]:text-home-team-foreground/70',
  /** Tappable names on the panel — custom schemes only (standard keeps the
   *  links' own colours). Underlined so "pressable" never rests on colour alone. */
  link: '[[data-palette]_&]:text-home-team-link [[data-palette]_&]:hover:text-home-team-link [[data-palette]_&]:underline [[data-palette]_&]:underline-offset-2',
  /** Header/title text color */
  headerText: 'text-home-team-heading',
  /** Threshold/accent text color — also the team's colour on a plain background */
  accentText: 'text-home-team-accent',
  /** A whole outline Button in the team colour (see file header for `dark:`) */
  button:
    'bg-home-team hover:bg-home-team-hover text-home-team-foreground hover:text-home-team-foreground dark:bg-home-team dark:hover:bg-home-team-hover',
} as const;

/**
 * Away team colors (orange theme)
 */
export const AWAY_TEAM_COLORS = {
  /** Background color for cards and buttons */
  bg: 'bg-away-team',
  /** Hover state for buttons */
  bgHover: 'hover:bg-away-team-hover',
  /** Border color for cards */
  border: 'border-away-team-border',
  /** Darker border for inner elements */
  borderDark: 'border-away-team-border-strong',
  /** Body text (scores, player rows) on the team background */
  text: 'text-away-team-foreground',
  /** Secondary labels ("Wins", column headers). Standard: the page's muted
   *  text, as always; under a custom scheme: the panel's own text, faded. */
  mutedText: 'text-muted-foreground [[data-palette]_&]:text-away-team-foreground/70',
  /** Tappable names on the panel — custom schemes only (standard keeps the
   *  links' own colours). Underlined so "pressable" never rests on colour alone. */
  link: '[[data-palette]_&]:text-away-team-link [[data-palette]_&]:hover:text-away-team-link [[data-palette]_&]:underline [[data-palette]_&]:underline-offset-2',
  /** Header/title text color */
  headerText: 'text-away-team-heading',
  /** Threshold/accent text color — also the team's colour on a plain background */
  accentText: 'text-away-team-accent',
  /** A whole outline Button in the team colour (see file header for `dark:`) */
  button:
    'bg-away-team hover:bg-away-team-hover text-away-team-foreground hover:text-away-team-foreground dark:bg-away-team dark:hover:bg-away-team-hover',
} as const;

/**
 * Helper to get team colors based on isHome flag
 */
export function getTeamColors(isHome: boolean) {
  return isHome ? HOME_TEAM_COLORS : AWAY_TEAM_COLORS;
}

/**
 * Scored-game highlight colors on the scoring screen, each a background with
 * its own text. `pending` and `vacate` are shown on outline Buttons, so they
 * carry the same `dark:` repeat as the team `button` classes. Position, the
 * 🏆 and the Confirm / Vacate controls carry the meaning too, so a state never
 * depends on telling the colours apart.
 */
export const GAME_STATE_COLORS = {
  /** A winner picked, waiting for the other side to confirm */
  pending:
    'bg-game-pending text-game-pending-foreground hover:bg-game-pending hover:text-game-pending-foreground dark:bg-game-pending dark:hover:bg-game-pending',
  /** Both sides agreed on the winner */
  confirmed: 'bg-game-confirmed text-game-confirmed-foreground',
  /** The winner of a game with an open vacate request */
  vacate:
    'bg-game-vacate text-game-vacate-foreground hover:bg-game-vacate hover:text-game-vacate-foreground dark:bg-game-vacate dark:hover:bg-game-vacate',
} as const;
