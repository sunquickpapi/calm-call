import { CallEntry, addDays, keyToDate, todayKey } from './storage';

/** Monday-based week key, e.g. "2026-10-05" for any day in that week. */
export function weekKey(dateKey: string): string {
  const d = keyToDate(dateKey);
  const offset = (d.getDay() + 6) % 7; // Mon=0 … Sun=6
  return addDays(dateKey, -offset);
}

/**
 * Number of consecutive weeks (ending this week) with at least one call.
 * If this week has no call yet, the streak is still alive and counts from last week.
 */
export function weeklyStreak(calls: CallEntry[], now = new Date()): number {
  const weeks = new Set(calls.map((c) => weekKey(c.date)));
  let cursor = weekKey(todayKey(now));
  if (!weeks.has(cursor)) cursor = addDays(cursor, -7);
  let streak = 0;
  while (weeks.has(cursor)) {
    streak++;
    cursor = addDays(cursor, -7);
  }
  return streak;
}

export function bestWeeklyStreak(calls: CallEntry[]): number {
  const weeks = [...new Set(calls.map((c) => weekKey(c.date)))].sort();
  let best = 0;
  let run = 0;
  for (let i = 0; i < weeks.length; i++) {
    run = i > 0 && addDays(weeks[i - 1], 7) === weeks[i] ? run + 1 : 1;
    best = Math.max(best, run);
  }
  return best;
}

export function callsInMonth(calls: CallEntry[], year: number, month: number): CallEntry[] {
  const prefix = `${year}-${String(month + 1).padStart(2, '0')}`;
  return calls.filter((c) => c.date.startsWith(prefix));
}

/** Grid of weeks for a month calendar, Monday first. null = padding cell. */
export function monthGrid(year: number, month: number): (string | null)[][] {
  const first = new Date(year, month, 1);
  const lead = (first.getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (string | null)[] = Array(lead).fill(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(todayKey(new Date(year, month, d)));
  while (cells.length % 7 !== 0) cells.push(null);
  const rows: (string | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) rows.push(cells.slice(i, i + 7));
  return rows;
}
