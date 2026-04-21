/**
 * @fileoverview Shared types for the house-rules feature (Branch 2).
 *
 * Mirrors the shape of Branch 1's `Rule` so a single `RuleView` component
 * can render both CSI rules and house rules (see R4 in the origin doc).
 * Additional fields carry the scope, origin label, and CSI-link metadata
 * that make house rules distinctly different at the UI level.
 */

export type HouseRuleEffectType = 'override' | 'enhance' | 'standalone';

export type HouseRuleScopeType = 'organization' | 'league';

/**
 * A scope selector used by the reader's House-rules filter + the LO
 * authoring surfaces. Exactly one of `organizationId` / `leagueId` is
 * populated, mirroring the DB's mutual-exclusion constraint.
 */
export type HouseRuleScope =
  | { type: 'organization'; organizationId: string }
  | { type: 'league'; leagueId: string };

/**
 * A single house rule as returned from the `house_rules_with_scope_name`
 * view. Fields `scope_type`, `scope_name`, and `parent_org_name` come from
 * the view; everything else is the base row.
 */
export type HouseRule = {
  id: string;
  organization_id: string | null;
  league_id: string | null;
  scope_type: HouseRuleScopeType;
  scope_name: string;
  parent_org_name: string | null;
  game: string;
  effect_type: HouseRuleEffectType;
  /** idMap key from Branch 1's cleaned data, e.g., "8-ball:2-2". Null for standalone. */
  related_rule_id: string | null;
  title: string;
  body: string[];
  created_at: string;
  updated_at: string;
  updated_by: string | null;
};

/** Minimal shape for add/edit form submission. Parent scope is passed separately. */
export type HouseRuleFormValues = {
  game: string;
  effect_type: HouseRuleEffectType;
  related_rule_id: string | null;
  title: string;
  body: string[];
};

/** Derived memberships a user belongs to — used by the scope picker + active-league defaulting. */
export type MyMemberships = {
  organizations: Array<{ id: string; name: string }>;
  leagues: Array<{ id: string; displayName: string; organizationId: string; organizationName: string }>;
};

/** Active-league selection persisted per-device in localStorage. */
export type ActiveLeague = {
  id: string;
  displayName: string;
  organizationName: string;
} | null;
