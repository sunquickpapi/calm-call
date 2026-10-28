/** Checks what the AI sent back. Pure: no phone or network APIs, so it can be tested anywhere. */
import { addDays } from './storage';

export type AiFollowUp = { text: string; date: string };
export type AiDate = { title: string; date: string; yearly: boolean };
export type AiSuggestion = { note: string; followUps: AiFollowUp[]; dates: AiDate[] };

const DATE = /^\d{4}-\d{2}-\d{2}$/;

function validDate(s: unknown, today: string): s is string {
  if (typeof s !== 'string' || !DATE.test(s)) return false;
  const [y, m, d] = s.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  if (dt.getFullYear() !== y || dt.getMonth() !== m - 1 || dt.getDate() !== d) return false;
  return s >= today && s <= addDays(today, 730); // today … two years ahead
}

function text(s: unknown, max: number): string {
  return typeof s === 'string' ? s.replace(/\s+/g, ' ').trim().slice(0, max) : '';
}

/** Never trust what comes back from an AI: keep only well-formed, sensible items. */
export function sanitizeSuggestion(raw: unknown, today: string): AiSuggestion | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const note = text(r.note, 600);
  if (!note) return null;
  const followUps: AiFollowUp[] = [];
  for (const f of Array.isArray(r.followUps) ? r.followUps : []) {
    const t = text((f as any)?.text, 140);
    const date = (f as any)?.date;
    if (t && followUps.length < 3) followUps.push({ text: t, date: validDate(date, today) ? date : addDays(today, 3) });
  }
  const dates: AiDate[] = [];
  for (const x of Array.isArray(r.dates) ? r.dates : []) {
    const title = text((x as any)?.title, 80);
    const date = (x as any)?.date;
    if (title && validDate(date, today) && dates.length < 3) dates.push({ title, date, yearly: (x as any)?.yearly === true });
  }
  return { note, followUps, dates };
}
