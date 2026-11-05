/**
 * @fileoverview Keeps `LIST_FOR_ED.md` and `docs/list/` matched: every line
 * links something real, and every item file has exactly one line. A PR that
 * finishes an item deletes both; this catches it when only one goes.
 *
 * The self-tests prove each check catches what it should; the last block runs
 * the same checks on the real files. Rules: "The list" in CLAUDE.md.
 */

import { describe, it, expect } from 'vitest';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { itemProblems, listProblems, parseFrontmatter, parseList } from './listForEd.helpers';

const GOOD_ITEM = ['---', 'summary: Line up the league buttons', 'kind: task', 'added: 2026-11-04', 'checked: 2026-11-04', '---', '', 'Detail.'].join('\n');

const SAMPLE_LIST = [
  '# List for Ed',
  'How this works: see CLAUDE.md. [not a line](docs/list/ignored.md)',
  '## Now',
  '- [Buttons](docs/list/2026-11-04-buttons.md) — line them up, see [PR](https://github.com/x/1)',
  '## Next',
  '- [Race plan](docs/plans/race.md) — already has a plan',
  '## Later',
  '## Wish list',
  '## Gated',
].join('\n');

describe('LIST_FOR_ED item frontmatter', () => {
  it('reads a valid item', () => {
    const fields = parseFrontmatter(GOOD_ITEM);
    expect(fields).toMatchObject({ summary: 'Line up the league buttons', kind: 'task' });
    expect(itemProblems(fields)).toEqual([]);
  });

  it('flags a missing or unclosed block', () => {
    expect(parseFrontmatter('no frontmatter')).toBeNull();
    expect(parseFrontmatter('---\nsummary: x\n')).toBeNull();
    expect(itemProblems(null)).toHaveLength(1);
  });

  it('flags a missing summary, a bad kind, a bad date and a bad owner', () => {
    const problems = itemProblems({ summary: '', kind: 'bug', added: '11/04/2026', checked: '2026-11-04', owner: 'sam' });
    expect(problems).toHaveLength(4);
  });

  it('allows owner to be left off', () => {
    expect(itemProblems({ summary: 'x', kind: 'idea', added: '2026-11-04', checked: '2026-11-04' })).toEqual([]);
  });
});

describe('LIST_FOR_ED list matching', () => {
  const real = new Set(['docs/list/2026-11-04-buttons.md', 'docs/plans/race.md']);
  const exists = (p: string) => real.has(p);

  it('passes when every line resolves and every item has one line', () => {
    const list = parseList(SAMPLE_LIST);
    expect(list.headings).toEqual(['Now', 'Next', 'Later', 'Wish list', 'Gated']);
    expect(list.lines.map((l) => l.target)).toEqual(['docs/list/2026-11-04-buttons.md', 'docs/plans/race.md']);
    expect(listProblems(list, ['docs/list/2026-11-04-buttons.md'], exists)).toEqual([]);
  });

  it('ignores header links, web links and anchors', () => {
    const list = parseList('# H\n[x](docs/a.md)\n## Later\n- see [web](https://x.y) and [top](#now)');
    expect(list.lines).toEqual([]);
  });

  it('flags a dead link, an orphan item, a doubled item and an unknown heading', () => {
    const list = parseList([
      '## Soon',
      '- [Gone](docs/list/gone.md)',
      '## Later',
      '- [Buttons](docs/list/2026-11-04-buttons.md)',
      '- [Buttons again](docs/list/2026-11-04-buttons.md)',
    ].join('\n'));
    const problems = listProblems(list, ['docs/list/2026-11-04-buttons.md', 'docs/list/orphan.md'], exists);
    expect(problems).toHaveLength(4);
    expect(problems.join('\n')).toMatch(/Soon.*not a group/);
    expect(problems.join('\n')).toMatch(/gone\.md, which doesn't exist/);
    expect(problems.join('\n')).toMatch(/orphan\.md has no line/);
    expect(problems.join('\n')).toMatch(/buttons\.md has 2 lines/);
  });
});

describe('the real LIST_FOR_ED.md and docs/list/', () => {
  const root = process.cwd();
  const itemFiles = readdirSync(join(root, 'docs', 'list'))
    .filter((f) => f.endsWith('.md'))
    .map((f) => `docs/list/${f}`);

  it('every item file has valid frontmatter', () => {
    for (const file of itemFiles) {
      const fields = parseFrontmatter(readFileSync(join(root, file), 'utf8'));
      expect(itemProblems(fields), file).toEqual([]);
    }
  });

  it('the list and the item files match', () => {
    const list = parseList(readFileSync(join(root, 'LIST_FOR_ED.md'), 'utf8'));
    expect(listProblems(list, itemFiles, (p) => existsSync(join(root, p)))).toEqual([]);
  });
});
