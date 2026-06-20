/**
 * @fileoverview Minimal .xlsx (Excel/OpenXML) writer.
 *
 * Produces a multi-sheet workbook as a `Uint8Array` from plain cell matrices —
 * just enough OpenXML to open cleanly in Excel and to match a tool's import
 * template (the first caller is the LMS schedule export). Numbers are written as
 * numeric cells; everything else as inline strings (so no shared-strings table
 * is needed). No styles, formulas, or merges — by design.
 *
 * We hand-write the (tiny, fixed-shape) XML parts and let `fflate` zip them,
 * which keeps the bundle cost to a few KB versus a full spreadsheet library.
 */

import { zipSync, strToU8 } from 'fflate';

/** A single cell value. Numbers become numeric cells; strings become text. */
export type XlsxCell = string | number;

/** One worksheet: a tab `name` and its rows of cells (row 1 = first row). */
export interface XlsxSheet {
  name: string;
  rows: XlsxCell[][];
}

/** 0 → "A", 25 → "Z", 26 → "AA" … Excel column letters. */
function columnRef(index: number): string {
  let n = index;
  let ref = '';
  do {
    ref = String.fromCharCode(65 + (n % 26)) + ref;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return ref;
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function cellXml(ref: string, value: XlsxCell): string {
  if (typeof value === 'number') {
    return `<c r="${ref}"><v>${value}</v></c>`;
  }
  return `<c r="${ref}" t="inlineStr"><is><t xml:space="preserve">${escapeXml(value)}</t></is></c>`;
}

function sheetXml(rows: XlsxCell[][]): string {
  const body = rows
    .map((cells, r) => {
      const rowNumber = r + 1;
      const inner = cells.map((value, c) => cellXml(columnRef(c) + rowNumber, value)).join('');
      return `<row r="${rowNumber}">${inner}</row>`;
    })
    .join('');
  return (
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
    `<sheetData>${body}</sheetData></worksheet>`
  );
}

/**
 * Build a workbook from the given sheets (in tab order) and return the .xlsx
 * file bytes, ready to download.
 */
export function writeXlsx(sheets: XlsxSheet[]): Uint8Array {
  const contentTypes =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
    '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
    '<Default Extension="xml" ContentType="application/xml"/>' +
    '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
    sheets
      .map(
        (_, i) =>
          `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`,
      )
      .join('') +
    '</Types>';

  const rootRels =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
    '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>' +
    '</Relationships>';

  const workbook =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" ' +
    'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>' +
    sheets
      .map((s, i) => `<sheet name="${escapeXml(s.name)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`)
      .join('') +
    '</sheets></workbook>';

  const workbookRels =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
    sheets
      .map(
        (_, i) =>
          `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`,
      )
      .join('') +
    '</Relationships>';

  const files: Record<string, Uint8Array> = {
    '[Content_Types].xml': strToU8(contentTypes),
    '_rels/.rels': strToU8(rootRels),
    'xl/workbook.xml': strToU8(workbook),
    'xl/_rels/workbook.xml.rels': strToU8(workbookRels),
  };
  sheets.forEach((s, i) => {
    files[`xl/worksheets/sheet${i + 1}.xml`] = strToU8(sheetXml(s.rows));
  });

  return zipSync(files);
}
