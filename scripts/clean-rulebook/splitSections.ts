/**
 * @fileoverview Slice the scrubbed rulebook text into per-section blobs.
 *
 * The source PDF opens each game/rules section with a `RULES SECTION N  NAME`
 * heading in uppercase. We use that marker to divide the document into the
 * nine sections listed in `games.ts`. Text that appears before the first
 * `RULES SECTION 1` marker is front-matter (cover, TOC, equipment, definitions)
 * and is dropped. Text after the last wanted section (e.g., Applied Rulings
 * appendix) is also dropped.
 *
 * Output is keyed by the section's GameMeta slug so downstream stages don't
 * need to re-match the game name.
 */

import { GAMES, type GameMeta } from './games';

export type SectionSlice = {
  /** The GameMeta whose `sectionNumber` this text came from. */
  game: GameMeta;
  /** Raw scrubbed text for the section, starting just after the section header. */
  text: string;
};

// Anchor on `RULES SECTION N` followed by spaces. The uppercase name that
// follows varies (e.g., "9-BALL", "14.1 CONTINUOUS", "ONE POCKET") so we
// don't bind it here; instead we rely on the section number to identify which
// game this slice belongs to.
const SECTION_MARKER = /RULES\s+SECTION\s+(\d+)\b/g;

/**
 * Split `fullText` at every `RULES SECTION N` marker and keep only the
 * sections declared in `GAMES` (i.e., sections 1 through 9, excluding 10+).
 */
export function splitIntoSections(fullText: string): SectionSlice[] {
  // Collect every marker position with its section number.
  const markers: { index: number; sectionNumber: number; endOfMarker: number }[] = [];
  for (const match of fullText.matchAll(SECTION_MARKER)) {
    markers.push({
      index: match.index ?? 0,
      sectionNumber: Number.parseInt(match[1], 10),
      endOfMarker: (match.index ?? 0) + match[0].length,
    });
  }

  const slices: SectionSlice[] = [];
  for (let i = 0; i < markers.length; i++) {
    const current = markers[i];
    const next = markers[i + 1];
    const game = GAMES.find((g) => g.sectionNumber === current.sectionNumber);
    if (!game) continue; // section 10+ or other — drop
    // Text between the end of this marker and the start of the next marker.
    const rawBody = fullText.slice(current.endOfMarker, next?.index ?? fullText.length);
    // Strip the uppercase name that follows the marker by cutting everything
    // before the first rule-ID pattern (e.g., "3-1 ", "14.1 "). We locate the
    // first match explicitly rather than anchoring at `^` so leading digits
    // in the section name (e.g., "9-BALL", "10-BALL") don't block the skip.
    const firstRule = rawBody.match(/\d+[-.]\d+\s/);
    const afterName = firstRule ? rawBody.slice(firstRule.index ?? 0) : rawBody;
    slices.push({ game, text: afterName.trim() });
  }
  return slices;
}
