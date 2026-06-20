/**
 * @fileoverview Parse the raw cells of an LMS schedule .xlsx into structured data.
 *
 * Input is the `{ [sheetName]: string[][] }` from `readXlsx`. Output is the
 * number→name team map and the week-by-week matchups (away/home team numbers).
 * This is the inverse of the export's `buildLmsSchedule`/`lmsScheduleToXlsx`.
 *
 * Pure + throws a descriptive Error on malformed input (the import UI surfaces the
 * message). Team-name → our-team reconciliation and DB writes happen downstream;
 * this stage only reads the file's own self-describing structure.
 */

import type { Sheets } from '@/utils/xlsx/readXlsx';

export interface ParsedLmsTeam {
  number: number;
  name: string;
}
/** One match: team numbers as written in the file ("away @ home"). */
export interface ParsedLmsMatch {
  awayNumber: number;
  homeNumber: number;
}
export interface ParsedLmsWeek {
  weekNumber: number;
  matches: ParsedLmsMatch[];
}
export interface ParsedLmsSchedule {
  teams: ParsedLmsTeam[];
  weeks: ParsedLmsWeek[];
}

const SCHEDULE_SHEET = 'Schedule';
const TEAMS_SHEET = 'Teams';
const CELL_RE = /^\s*(\d+)\s*@\s*(\d+)\s*$/;

function nonEmptyRows(rows: string[][] | undefined): string[][] {
  return (rows ?? []).filter((r) => r.some((c) => c != null && c.trim() !== ''));
}

function parseTeams(rows: string[][]): ParsedLmsTeam[] {
  return rows.map((row, i) => {
    const number = Number(row[0]?.trim());
    const name = (row[1] ?? '').trim();
    if (!Number.isInteger(number) || number <= 0) {
      throw new Error(`Teams sheet row ${i + 1}: "${row[0]}" is not a valid team number.`);
    }
    if (!name) {
      throw new Error(`Teams sheet row ${i + 1}: team ${number} has no name.`);
    }
    return { number, name };
  });
}

function parseWeeks(rows: string[][]): ParsedLmsWeek[] {
  return rows.map((row, i) => {
    const weekNumber = Number(row[0]?.trim());
    if (!Number.isInteger(weekNumber) || weekNumber <= 0) {
      throw new Error(`Schedule sheet row ${i + 1}: "${row[0]}" is not a valid week number.`);
    }
    const matches = row
      .slice(1)
      .filter((c) => c != null && c.trim() !== '')
      .map((cell) => {
        const m = CELL_RE.exec(cell);
        if (!m) {
          throw new Error(
            `Schedule week ${weekNumber}: "${cell}" is not a valid matchup (expected "away @ home").`,
          );
        }
        return { awayNumber: Number(m[1]), homeNumber: Number(m[2]) };
      });
    return { weekNumber, matches };
  });
}

/**
 * Parse the Teams + Schedule sheets into structured schedule data.
 *
 * @param sheets - Raw cells from `readXlsx`.
 * @returns The number→name teams and the week-by-week matchups.
 * @throws Error with a human-readable message if a required sheet is missing or a
 *   cell is malformed.
 */
export function parseLmsSchedule(sheets: Sheets): ParsedLmsSchedule {
  if (!sheets[TEAMS_SHEET]) throw new Error('Missing a "Teams" sheet.');
  if (!sheets[SCHEDULE_SHEET]) throw new Error('Missing a "Schedule" sheet.');

  const teams = parseTeams(nonEmptyRows(sheets[TEAMS_SHEET]));
  const weeks = parseWeeks(nonEmptyRows(sheets[SCHEDULE_SHEET]));

  if (teams.length === 0) throw new Error('The Teams sheet is empty.');
  if (weeks.length === 0) throw new Error('The Schedule sheet is empty.');

  // Every number referenced in the grid must exist in the Teams sheet.
  const known = new Set(teams.map((t) => t.number));
  for (const week of weeks) {
    for (const m of week.matches) {
      for (const n of [m.awayNumber, m.homeNumber]) {
        if (!known.has(n)) {
          throw new Error(`Schedule week ${week.weekNumber} references team #${n}, which isn't in the Teams sheet.`);
        }
      }
    }
  }

  return { teams, weeks };
}
