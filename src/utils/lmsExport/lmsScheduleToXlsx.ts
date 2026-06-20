/**
 * @fileoverview Serialize an `LmsScheduleExport` into LMS's exact .xlsx shape.
 *
 * Matches a real CSI/FargoRate LMS schedule export (decoded from a sample), so
 * the file round-trips back into LMS's "import schedule":
 *   - Sheet "Schedule": no header row; one row per play week — col A = week
 *     number, cols B+ = each match as `away @ home` (by alphabetical team number).
 *   - Sheet "Teams": no header row; col A = team number, col B = team name.
 * Sheet order + names mirror the export (Schedule first, Teams second).
 *
 * Verification stats are intentionally NOT written here — LMS computes its own
 * "View Statistics", and a third sheet could confuse its importer.
 */

import { writeXlsx } from '@/utils/xlsx/writeXlsx';
import type { LmsScheduleExport } from './buildLmsSchedule';

/** MIME type for a .xlsx download. */
export const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

/**
 * Build the LMS-importable .xlsx bytes for a schedule export.
 *
 * @param data - Structured export from `buildLmsSchedule`.
 * @returns .xlsx file bytes (two sheets, no headers), ready to download.
 */
export function lmsScheduleToXlsx(data: LmsScheduleExport): Uint8Array {
  const scheduleRows = data.weeks.map((w) => [w.weekNumber, ...w.cells]);
  const teamsRows = data.teams.map((t) => [t.number, t.name]);
  return writeXlsx([
    { name: 'Schedule', rows: scheduleRows },
    { name: 'Teams', rows: teamsRows },
  ]);
}
