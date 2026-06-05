/**
 * @fileoverview Unit 7 — glossary drift audit, exposed as a vitest test so
 * it runs on every `pnpm test:run`. Imports the live registry (the same
 * registry the UI consumes) and runs the audit. Fails the build when any
 * entry's l1_anchor doesn't resolve to a real L1 file (or anchor, when set).
 *
 * @see scripts/audit-glossary.ts — the verifier.
 * @see scripts/audit-glossary-cli.ts — the pnpm glossary:verify CLI.
 */

import { describe, it, expect } from 'vitest';

import { getAllGlossaryEntries } from '@/glossary';
import { auditGlossary } from '../../../scripts/audit-glossary';

describe('glossary drift audit', () => {
  it('every entry\'s l1_anchor resolves to a real file', () => {
    const entries = getAllGlossaryEntries();
    const result = auditGlossary(entries);

    if (!result.ok) {
      // Surface the actual violations in the failure output so the
      // implementer can see WHICH entries are broken without re-running.
      // eslint-disable-next-line no-console
      console.error(
        'Glossary drift audit failed:',
        JSON.stringify(result.violations, null, 2),
      );
    }

    expect(result.ok).toBe(true);
  });
});
