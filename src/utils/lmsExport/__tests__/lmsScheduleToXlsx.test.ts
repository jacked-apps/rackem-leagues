/**
 * @fileoverview Tests for lmsScheduleToXlsx — verifies the generated .xlsx
 * round-trips and matches LMS's two-sheet layout (Schedule + Teams, no headers).
 *
 * We unzip the produced workbook with fflate and assert on the raw sheet XML +
 * workbook.xml, so we're checking the actual file an operator would import.
 */

import { describe, it, expect } from 'vitest';
import { unzipSync, strFromU8 } from 'fflate';
import { lmsScheduleToXlsx } from '../lmsScheduleToXlsx';
import type { LmsScheduleExport } from '../buildLmsSchedule';

const sample: LmsScheduleExport = {
  teams: [
    { number: 1, teamId: 'a', name: 'Ace Crew', isBye: false },
    { number: 2, teamId: 'b', name: 'Bye Team', isBye: true },
    { number: 3, teamId: 'c', name: "The Kid's Crew", isBye: false },
  ],
  weeks: [
    { weekNumber: 1, weekName: 'Week 1', date: '2026-01-05', cells: ['3 @ 1', '2 @ 1'] },
    { weekNumber: 2, weekName: 'Week 2', date: '2026-01-12', cells: ['1 @ 3'] },
  ],
  stats: [],
};

function sheets(bytes: Uint8Array): Record<string, string> {
  const files = unzipSync(bytes);
  const out: Record<string, string> = {};
  for (const [path, data] of Object.entries(files)) out[path] = strFromU8(data);
  return out;
}

describe('lmsScheduleToXlsx', () => {
  it('produces a valid two-sheet workbook named Schedule then Teams', () => {
    const files = sheets(lmsScheduleToXlsx(sample));
    expect(files['xl/workbook.xml']).toContain('<sheet name="Schedule" sheetId="1"');
    expect(files['xl/workbook.xml']).toContain('<sheet name="Teams" sheetId="2"');
    expect(files['[Content_Types].xml']).toContain('/xl/worksheets/sheet1.xml');
    expect(files['xl/worksheets/sheet1.xml']).toBeDefined();
    expect(files['xl/worksheets/sheet2.xml']).toBeDefined();
  });

  it('Schedule sheet: row per week, col A = week number, cells = away @ home', () => {
    const schedule = sheets(lmsScheduleToXlsx(sample))['xl/worksheets/sheet1.xml'];
    expect(schedule).toContain('<c r="A1"><v>1</v></c>'); // week 1, numeric
    expect(schedule).toContain('3 @ 1');
    expect(schedule).toContain('2 @ 1');
    expect(schedule).toContain('<c r="A2"><v>2</v></c>'); // week 2
    expect(schedule).toContain('1 @ 3');
  });

  it('Teams sheet: col A = number, col B = name (no header row)', () => {
    const teams = sheets(lmsScheduleToXlsx(sample))['xl/worksheets/sheet2.xml'];
    expect(teams).toContain('<c r="A1"><v>1</v></c>');
    expect(teams).toContain('Ace Crew');
    expect(teams).toContain('Bye Team');
    expect(teams).toContain("The Kid's Crew"); // apostrophe survives
    // first row is data, not a header
    expect(teams).not.toContain('Number');
  });
});
