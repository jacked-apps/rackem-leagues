/**
 * @fileoverview Cleanup pipeline for the CSI official rulebook PDF.
 *
 * This script turns a freshly-downloaded CSI rulebook PDF into structured
 * TypeScript data modules under `src/officalBCARulebook/cleaned/`. It is
 * operator-only (not part of the app bundle) and expects Node via `tsx`.
 *
 * Usage (from the repo root):
 *     pnpm tsx scripts/clean-rulebook.ts --pdf "<absolute path to CSI PDF>"
 *     pnpm tsx scripts/clean-rulebook.ts --pdf "<path>" --peek 55,56,57
 *     pnpm tsx scripts/clean-rulebook.ts --pdf "<path>" --section general
 *
 * The `--peek` flag prints raw extracted text for the listed page numbers
 * (used for developing the extraction layer). The `--section <slug>` flag
 * runs the scrub + section-split stages and prints one section's text so
 * the operator can eyeball-QA the slicing heuristics before we add rule
 * splitting.
 *
 * Future flags (added as the pipeline fills in):
 *     --dry-run   : run the full pipeline without writing output files.
 *     --verify    : load the committed output and re-run verification checks.
 */

import { extractPdfText } from './clean-rulebook/extractPdfText';
import { scrubAndJoin } from './clean-rulebook/scrubText';
import { splitIntoSections } from './clean-rulebook/splitSections';
import { splitRulesInSection } from './clean-rulebook/splitRules';
import { verifyRulebook } from './clean-rulebook/verifyRulebook';
import { writeRulebookModules } from './clean-rulebook/writeModules';
import { GAMES, DEFAULT_GAME_SLUG } from './clean-rulebook/games';

/**
 * ISO-8601 date of the source edition. Read from the PDF text ("Effective June
 * 1, 2023"). Update this when re-running against a newer edition PDF.
 */
const EDITION = '2023-06-01';

/**
 * Publicly-hosted CSI rulebook download page. Attribution links here so we
 * don't redistribute the PDF from our own domain. This is the BCAPL rules
 * page (the official landing page for the current CSI rulebook download).
 */
const SOURCE_PDF_URL = 'https://www.playcsipool.com/bcapl-rules.html';

type Args = {
  pdf: string;
  peek: number[];
  section: string | null;
  rules: string | null;
};

function parseArgs(argv: string[]): Args {
  const pdfIdx = argv.indexOf('--pdf');
  const peekIdx = argv.indexOf('--peek');
  const sectionIdx = argv.indexOf('--section');
  const rulesIdx = argv.indexOf('--rules');
  if (pdfIdx < 0 || !argv[pdfIdx + 1]) {
    throw new Error(
      'Missing --pdf argument. Example: pnpm tsx scripts/clean-rulebook.ts --pdf "/abs/path.pdf"',
    );
  }
  const peek =
    peekIdx >= 0 && argv[peekIdx + 1]
      ? argv[peekIdx + 1]
          .split(',')
          .map((s) => Number.parseInt(s.trim(), 10))
          .filter((n) => Number.isFinite(n) && n > 0)
      : [];
  const section = sectionIdx >= 0 ? (argv[sectionIdx + 1] ?? null) : null;
  const rules = rulesIdx >= 0 ? (argv[rulesIdx + 1] ?? null) : null;
  return { pdf: argv[pdfIdx + 1], peek, section, rules };
}

async function main() {
  const { pdf, peek, section, rules } = parseArgs(process.argv.slice(2));
  console.log(`Extracting text from: ${pdf}`);
  const pages = await extractPdfText(pdf);
  console.log(`Extracted ${pages.length} pages.`);

  if (peek.length > 0) {
    for (const n of peek) {
      const p = pages.find((x) => x.page === n);
      console.log(`\n===== PAGE ${n} =====`);
      console.log(p ? p.text : '(page not found)');
    }
    return;
  }

  const fullText = scrubAndJoin(pages);
  const slices = splitIntoSections(fullText);
  console.log(`\nFound ${slices.length} sections:`);
  for (const s of slices) {
    console.log(`  ${s.game.slug.padEnd(18)} (${s.text.length} chars)`);
  }

  if (section) {
    const slice = slices.find((s) => s.game.slug === section);
    if (!slice) {
      console.error(`\nNo section slug "${section}". Valid slugs listed above.`);
      process.exitCode = 1;
      return;
    }
    console.log(`\n===== SECTION: ${slice.game.name} (${slice.game.slug}) =====`);
    console.log(slice.text);
    return;
  }

  if (rules) {
    const slice = slices.find((s) => s.game.slug === rules);
    if (!slice) {
      console.error(`\nNo section slug "${rules}". Valid slugs listed above.`);
      process.exitCode = 1;
      return;
    }
    const parsed = splitRulesInSection(slice.text, slice.game.slug);
    console.log(`\n===== RULES: ${slice.game.name} (${slice.game.slug}) =====`);
    console.log(`Parsed ${parsed.length} rules:\n`);
    for (const rule of parsed) {
      console.log(`[${rule.id}] ${rule.heading}`);
      for (const para of rule.body) {
        console.log(`  ${para}`);
      }
      console.log('');
    }
    return;
  }

  // Default path: full pipeline → parse, verify, write TypeScript modules.
  const rulesByGame: Record<string, ReturnType<typeof splitRulesInSection>> = {};
  for (const slice of slices) {
    rulesByGame[slice.game.slug] = splitRulesInSection(slice.text, slice.game.slug);
  }

  const verdict = verifyRulebook(rulesByGame);
  console.log('\nVerification:');
  for (const s of verdict.samples) {
    console.log(`  ${s.gameSlug.padEnd(18)} rules=${s.ruleCount}  sample: ${s.firstThreeHeadings[0] ?? '(none)'}`);
  }
  if (!verdict.ok) {
    console.error('\nVerification FAILED:');
    for (const v of verdict.violations) console.error(`  - ${v}`);
    process.exitCode = 1;
    return;
  }

  writeRulebookModules({
    rulesByGame,
    games: GAMES,
    edition: EDITION,
    sourcePdfUrl: SOURCE_PDF_URL,
    defaultGame: DEFAULT_GAME_SLUG,
  });
  const totalRules = Object.values(rulesByGame).reduce((n, arr) => n + arr.length, 0);
  console.log(`\nWrote ${GAMES.length} game modules + index. Total rules: ${totalRules}.`);
}

main().catch((err: unknown) => {
  console.error(err);
  process.exitCode = 1;
});
