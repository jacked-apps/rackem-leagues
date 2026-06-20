/**
 * @fileoverview Tests for readXlsx, focused on the shared-strings path LMS uses
 * (our own writer uses inline strings, so a round-trip wouldn't exercise it).
 *
 * Builds a minimal shared-strings .xlsx by hand with fflate and asserts readXlsx
 * resolves sheet names, string indices, numbers, and XML entities.
 */

import { describe, it, expect } from 'vitest';
import { zipSync, strToU8 } from 'fflate';
import { readXlsx } from '../readXlsx';
import { writeXlsx } from '../writeXlsx';

/** Hand-build a 1-sheet workbook whose strings live in a shared-strings table. */
function sharedStringWorkbook(): Uint8Array {
  const contentTypes =
    '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
    '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
    '<Default Extension="xml" ContentType="application/xml"/>' +
    '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
    '<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>' +
    '<Override PartName="/xl/sharedStrings.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sharedStrings+xml"/></Types>';
  const rootRels =
    '<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
    '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>';
  const workbook =
    '<?xml version="1.0"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" ' +
    'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>' +
    '<sheet name="Teams" sheetId="1" r:id="rId1"/></sheets></workbook>';
  const workbookRels =
    '<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
    '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>';
  // Two shared strings; the apostrophe one proves entity handling isn't needed but spaces are kept.
  const shared =
    '<?xml version="1.0"?><sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" count="2" uniqueCount="2">' +
    "<si><t>The Kid&apos;s in Stroke</t></si><si><t>Bye Team</t></si></sst>";
  // Row 1: numeric 1 in A1, shared-string idx 0 in B1. Row 2: numeric 2, shared idx 1.
  const sheet =
    '<?xml version="1.0"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>' +
    '<row r="1"><c r="A1"><v>1</v></c><c r="B1" t="s"><v>0</v></c></row>' +
    '<row r="2"><c r="A2"><v>2</v></c><c r="B2" t="s"><v>1</v></c></row>' +
    '</sheetData></worksheet>';
  return zipSync({
    '[Content_Types].xml': strToU8(contentTypes),
    '_rels/.rels': strToU8(rootRels),
    'xl/workbook.xml': strToU8(workbook),
    'xl/_rels/workbook.xml.rels': strToU8(workbookRels),
    'xl/sharedStrings.xml': strToU8(shared),
    'xl/worksheets/sheet1.xml': strToU8(sheet),
  });
}

describe('readXlsx', () => {
  it('resolves shared strings (the LMS path), keyed by sheet name', () => {
    const sheets = readXlsx(sharedStringWorkbook());
    expect(Object.keys(sheets)).toEqual(['Teams']);
    expect(sheets.Teams).toEqual([
      ['1', "The Kid's in Stroke"],
      ['2', 'Bye Team'],
    ]);
  });

  it('round-trips our own writer (inline strings)', () => {
    const bytes = writeXlsx([{ name: 'Schedule', rows: [[1, '4 @ 1'], [2, '3 @ 1']] }]);
    const sheets = readXlsx(bytes);
    expect(sheets.Schedule).toEqual([
      ['1', '4 @ 1'],
      ['2', '3 @ 1'],
    ]);
  });
});
