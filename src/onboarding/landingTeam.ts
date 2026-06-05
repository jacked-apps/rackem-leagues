/**
 * @fileoverview Land-on-tonight's-match helper (onboarding cascade Unit 8).
 *
 * After approval the joiner is routed to /my-teams. We want their match
 * front-and-center, but only when there's no ambiguity: a player on exactly one
 * team lands with it expanded (revealing the existing Quick Score card); with
 * several teams we don't guess which to open. Pure + tiny so the rule is
 * testable without mounting MyTeams.
 *
 * See docs/plans/2026-05-29-001-feat-onboarding-cascade-plan.md (Unit 8).
 */

/**
 * The team accordion item to open by default on the My Teams page.
 *
 * @param teamIds - the viewer's team ids, in display order.
 * @returns the single team's id to auto-expand, or undefined when there are
 *   zero or multiple teams (leave the accordion collapsed).
 */
export function defaultOpenTeamId(teamIds: string[]): string | undefined {
  return teamIds.length === 1 ? teamIds[0] : undefined;
}
