/**
 * @fileoverview Minimal .xlsx (Excel/OpenXML) reader.
 *
 * Parses a workbook `Uint8Array` into `{ [sheetName]: string[][] }` — every cell
 * as a string, indexed by row then column. Just enough OpenXML to read the
 * schedules CSI/FargoRate LMS exports (and the ones we write): it resolves the
 * **shared-strings** table (LMS uses it) AND inline strings (we write those), so
 * either source round-trips. No styles/formulas/dates — values only.
 *
 * Counterpart to `writeXlsx.ts`. Uses `fflate` to unzip; the sheet XML is simple
 * and fixed-shape enough to parse with targeted regex (no XML-parser dependency).
 */

import { unzipSync, strFromU8 } from 'fflate';

export type Sheets = Record<string, string[][]>;

const XML_ENTITIES: Record<string, string> = {
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&apos;': "'",
};

function decodeXml(text: string): string {
  return text.replace(/&(?:amp|lt|gt|quot|apos);/g, (m) => XML_ENTITIES[m] ?? m);
}

/** 0-based column index from a cell ref like "A1" / "AB12" → 0 / 27. */
function colIndex(ref: string): number {
  const letters = ref.replace(/[0-9]+$/, '');
  let n = 0;
  for (const ch of letters) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
}

/** 1-based row number from a cell ref like "A12" → 12. */
function rowNumber(ref: string): number {
  return parseInt(ref.replace(/^[A-Z]+/, ''), 10);
}

/** All <t>…</t> text inside a chunk, concatenated + entity-decoded (handles rich runs). */
function concatText(chunk: string): string {
  const parts = chunk.match(/<t[^>]*>([\s\S]*?)<\/t>/g) ?? [];
  return parts.map((p) => decodeXml(p.replace(/<t[^>]*>/, '').replace(/<\/t>$/, ''))).join('');
}

/** Parse sharedStrings.xml → ordered array of string values. */
function parseSharedStrings(xml: string | undefined): string[] {
  if (!xml) return [];
  const items = xml.match(/<si>([\s\S]*?)<\/si>/g) ?? [];
  return items.map((si) => concatText(si));
}

/** Parse one worksheet's XML into a dense row/col string matrix. */
function parseSheet(xml: string, shared: string[]): string[][] {
  const rows: string[][] = [];
  const cells = xml.match(/<c\b[^>]*?(?:\/>|>[\s\S]*?<\/c>)/g) ?? [];
  for (const cell of cells) {
    const ref = /\br="([A-Z]+[0-9]+)"/.exec(cell)?.[1];
    if (!ref) continue;
    const type = /\bt="([^"]+)"/.exec(cell)?.[1];
    let value = '';
    if (type === 's') {
      const idx = /<v>([\s\S]*?)<\/v>/.exec(cell)?.[1];
      value = idx != null ? (shared[parseInt(idx, 10)] ?? '') : '';
    } else if (type === 'inlineStr') {
      value = concatText(cell);
    } else {
      const v = /<v>([\s\S]*?)<\/v>/.exec(cell)?.[1];
      value = v != null ? decodeXml(v) : '';
    }
    const r = rowNumber(ref) - 1;
    const c = colIndex(ref);
    (rows[r] ??= [])[c] = value;
  }
  // Normalize holes to '' so callers can index safely.
  return rows.map((row) => Array.from(row, (v) => v ?? ''));
}

/**
 * Read an .xlsx file's cells, keyed by sheet name.
 *
 * @param bytes - The .xlsx file bytes.
 * @returns `{ [sheetName]: rows }`, each row an array of string cell values.
 */
export function readXlsx(bytes: Uint8Array): Sheets {
  const files = unzipSync(bytes);
  const text = (path: string): string | undefined =>
    files[path] ? strFromU8(files[path]) : undefined;

  const shared = parseSharedStrings(text('xl/sharedStrings.xml'));

  // Map sheet display name → its worksheet part, via workbook.xml + its rels.
  const workbook = text('xl/workbook.xml') ?? '';
  const rels = text('xl/_rels/workbook.xml.rels') ?? '';
  const relTarget = new Map<string, string>();
  for (const rel of rels.match(/<Relationship\b[^>]*\/>/g) ?? []) {
    const id = /\bId="([^"]+)"/.exec(rel)?.[1];
    const target = /\bTarget="([^"]+)"/.exec(rel)?.[1];
    if (id && target) relTarget.set(id, target.replace(/^\/?xl\//, '').replace(/^\.\//, ''));
  }

  const sheets: Sheets = {};
  for (const sheet of workbook.match(/<sheet\b[^>]*\/>/g) ?? []) {
    const name = decodeXml(/\bname="([^"]*)"/.exec(sheet)?.[1] ?? '');
    const rid = /\br:id="([^"]+)"/.exec(sheet)?.[1];
    const target = rid ? relTarget.get(rid) : undefined;
    const xml = target ? text(`xl/${target}`) : undefined;
    if (name && xml) sheets[name] = parseSheet(xml, shared);
  }
  return sheets;
}
