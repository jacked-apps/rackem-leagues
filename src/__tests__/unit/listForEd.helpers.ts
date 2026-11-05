/**
 * @fileoverview Checks that keep `LIST_FOR_ED.md` and the `docs/list/` item
 * files matched. Pure functions over text, so the test can self-test them on
 * samples and then run them on the real files.
 *
 * The list is one line per item under five group headings. Each line's first
 * local link is its target: an item file in `docs/list/`, or an existing doc
 * (plan, brainstorm, audit) that already holds the detail. Every item file
 * must be the target of exactly one line, so a finished item can't leave its
 * line behind (or the reverse). The rules themselves live in CLAUDE.md.
 *
 * @see docs/plans/2026-11-04-001-refactor-list-for-ed-bucket-plan.md
 */

/** The list's group headings, in order. Importance lives only here. */
export const GROUPS = ['Now', 'Next', 'Later', 'Wish list', 'Gated'] as const;

const KINDS = ['task', 'idea'];
const OWNERS = ['ed', 'jack', 'both'];
const DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Reads flat `key: value` frontmatter between the first two `---` lines.
 * Item files keep to flat values on purpose, so no YAML library is needed.
 * @returns the fields, or null when there is no closed frontmatter block
 */
export function parseFrontmatter(text: string): Record<string, string> | null {
  const lines = text.split(/\r?\n/);
  if (lines[0]?.trim() !== '---') return null;
  const end = lines.indexOf('---', 1);
  if (end === -1) return null;
  const fields: Record<string, string> = {};
  for (const line of lines.slice(1, end)) {
    const m = /^(\w+):\s*(.*)$/.exec(line);
    if (m) fields[m[1]] = m[2].trim();
  }
  return fields;
}

/** What's wrong with one item file's frontmatter, or [] when it's fine. */
export function itemProblems(fields: Record<string, string> | null): string[] {
  if (!fields) return ['needs a frontmatter block between two --- lines'];
  const found: string[] = [];
  if (!fields.summary) found.push('summary is missing');
  if (!KINDS.includes(fields.kind)) found.push(`kind must be task or idea (got "${fields.kind ?? ''}")`);
  for (const key of ['added', 'checked']) {
    if (!DATE.test(fields[key] ?? '')) found.push(`${key} must be YYYY-MM-DD`);
  }
  if (fields.owner !== undefined && !OWNERS.includes(fields.owner)) found.push('owner must be ed, jack or both');
  return found;
}

export interface ListLine {
  group: string;
  /** Repo-relative path of the line's first local link. */
  target: string;
}

/** The headings and linked lines of a list. Text above the first heading is the header. */
export function parseList(text: string): { headings: string[]; lines: ListLine[] } {
  const headings: string[] = [];
  const lines: ListLine[] = [];
  for (const raw of text.split(/\r?\n/)) {
    const heading = /^##\s+(.+?)\s*$/.exec(raw);
    if (heading) { headings.push(heading[1]); continue; }
    if (!headings.length || !/^\s*-\s/.test(raw)) continue;
    // First link that points at a file in this repo (skip web links and anchors).
    const link = [...raw.matchAll(/\]\(([^)\s]+)\)/g)].map((m) => m[1]).find((t) => !/^(https?:|#)/.test(t));
    if (link) lines.push({ group: headings[headings.length - 1], target: link.replace(/^\.\//, '') });
  }
  return { headings, lines };
}

/**
 * Where the list and the item folder disagree.
 * @param list - parsed list
 * @param itemFiles - repo-relative paths of every `docs/list/*.md` item
 * @param exists - whether a repo-relative path is a real file
 */
export function listProblems(
  list: { headings: string[]; lines: ListLine[] },
  itemFiles: string[],
  exists: (path: string) => boolean,
): string[] {
  const found: string[] = [];
  for (const h of list.headings) {
    if (!(GROUPS as readonly string[]).includes(h)) found.push(`LIST_FOR_ED.md: "## ${h}" is not a group (use ${GROUPS.join(', ')})`);
  }
  for (const { target } of list.lines) {
    if (!exists(target)) found.push(`LIST_FOR_ED.md links ${target}, which doesn't exist — fix the link or remove the line`);
  }
  for (const file of itemFiles) {
    const count = list.lines.filter((l) => l.target === file).length;
    if (count === 0) found.push(`${file} has no line in LIST_FOR_ED.md — add one under Later, or delete the file if it's done`);
    if (count > 1) found.push(`${file} has ${count} lines in LIST_FOR_ED.md — keep one`);
  }
  return found;
}
