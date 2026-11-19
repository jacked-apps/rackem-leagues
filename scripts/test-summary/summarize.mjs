/**
 * @fileoverview Turn a vitest JSON report into the plain-language results Ed
 * reads in the Checks run: counts first, then what failed, what was skipped,
 * and any test that exists on main but is gone from this branch. Pure — no
 * I/O (the CLI is scripts/test-summary.mjs).
 *
 * Why counts come from here and not a PR description: a number typed by hand
 * (or by an AI) can be wrong; this reads what actually ran.
 *
 * Vitest's JSON report (Jest-compatible): `testResults[]` per file, each with
 * `assertionResults[]` whose `status` is passed / failed / skipped / pending /
 * todo / disabled. A file that fails to load has `status: 'failed'`, a
 * `message`, and no assertions — counted as a failure, never as zero tests.
 *
 * @see docs/plans/2026-11-17-001-feat-trustworthy-tests-plan.md (U7)
 */

/** Repo-relative path from the absolute one vitest records. */
export function relativePath(file) {
  const normal = file.split('\\').join('/');
  const at = normal.lastIndexOf('/src/');
  return at >= 0 ? normal.slice(at + 1) : normal;
}

/** Every test in a report as `{ id, status, message }`; load failures included. */
export function flatten(report) {
  const tests = [];
  for (const file of report?.testResults ?? []) {
    const path = relativePath(file.name);
    const results = file.assertionResults ?? [];
    if (results.length === 0 && file.status === 'failed') {
      tests.push({ id: `${path} (file failed to load)`, status: 'failed', message: file.message ?? '' });
    }
    for (const t of results) {
      const name = [...(t.ancestorTitles ?? []), t.title].join(' › ');
      const status = t.status === 'pending' || t.status === 'disabled' ? 'skipped' : t.status;
      tests.push({ id: `${path} › ${name}`, status, message: (t.failureMessages ?? []).join('\n') });
    }
  }
  return tests;
}

const firstLine = (s) => (s.split('\n').find((l) => l.trim()) ?? '').trim().slice(0, 200);

/**
 * @param {object} report - this run's vitest JSON report
 * @param {object} opts
 * @param {string} opts.title - e.g. "Unit tests"
 * @param {object|null} [opts.mainReport] - main's last report, to find removed tests
 * @returns {string} markdown for $GITHUB_STEP_SUMMARY
 */
export function summarize(report, { title, mainReport = null }) {
  const tests = flatten(report);
  const by = (status) => tests.filter((t) => t.status === status);
  const failed = by('failed');
  const skipped = by('skipped');
  const todo = by('todo');
  const out = [
    `## ${title}`,
    '',
    `**${by('passed').length} passed, ${failed.length} failed, ${skipped.length} skipped, ${todo.length} todo**`,
  ];
  if (failed.length) {
    out.push('', '### Failed', ...failed.map((t) => `- ${t.id}${t.message ? ` — ${firstLine(t.message)}` : ''}`));
  }
  if (skipped.length || todo.length) {
    out.push('', '### Skipped / todo (each has a `// skip-reason:` in its file)',
      ...skipped.map((t) => `- skipped: ${t.id}`), ...todo.map((t) => `- todo: ${t.id}`));
  }
  out.push('', '### Removed tests (on main, not on this branch)');
  if (!mainReport) {
    out.push("Couldn't compare — no report from main yet.");
  } else {
    const here = new Set(tests.map((t) => t.id));
    const removed = flatten(mainReport).map((t) => t.id).filter((id) => !id.endsWith('(file failed to load)') && !here.has(id));
    // Capped so a big rename can't bury the rest of the summary.
    const shown = removed.slice(0, 50).map((id) => `- ${id}`);
    if (removed.length > 50) shown.push(`- …and ${removed.length - 50} more`);
    out.push(...(removed.length ? shown : ['None.']));
  }
  return `${out.join('\n')}\n`;
}
