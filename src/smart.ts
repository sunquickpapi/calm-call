/**
 * "Smart" helpers that need no AI: talking points before a call, the time you
 * usually reach someone, and the reason behind a reminder.
 * Pure functions, no phone APIs, so they can be tested anywhere.
 */
import {
  AppData,
  CallEntry,
  Topic,
  addDays,
  daysBetween,
  formatRange,
  keyToDate,
  openTopics,
  todayKey,
  upcomingDates,
} from './storage';

export type TalkingPoint = {
  kind: 'followup' | 'tell' | 'date' | 'lastnote' | 'gap';
  text: string;
  icon: 'help-circle-outline' | 'chatbubble-ellipses-outline' | 'gift-outline' | 'document-text-outline' | 'time-outline';
};

const MAX_POINTS = 4;

/** Up to 4 things worth bringing up on the next call with this person, most useful first. */
export function talkingPoints(data: AppData, personId: string, now = new Date()): TalkingPoint[] {
  const today = todayKey(now);
  const out: TalkingPoint[] = [];
  const topics = openTopics(data.topics, personId);

  // 1. Follow-ups that are due (or overdue) come first
  const due = topics
    .filter((t) => t.dueDate && t.dueDate <= addDays(today, 1))
    .sort((a, b) => (a.dueDate ?? '').localeCompare(b.dueDate ?? ''));
  for (const t of due) out.push({ kind: 'followup', text: `Ask: ${stripAsk(t.text)}`, icon: 'help-circle-outline' });

  // 2. News you saved to tell them (their own first, then "everyone")
  const tell = topics
    .filter((t) => !t.dueDate)
    .sort((a, b) => Number(a.personId === null) - Number(b.personId === null) || a.createdAt.localeCompare(b.createdAt));
  for (const t of tell) out.push({ kind: 'tell', text: `Tell them: ${t.text}`, icon: 'chatbubble-ellipses-outline' });

  // 3. Their dates (or family-wide ones) in the next 2 weeks
  for (const d of upcomingDates(data.dates, now)) {
    if (d.inDays > 14) break;
    if (d.item.personId !== null && d.item.personId !== personId) continue;
    const when = d.inDays === 0 ? 'today' : d.inDays === 1 ? 'tomorrow' : `in ${d.inDays} days`;
    out.push({ kind: 'date', text: `${d.item.title} is ${when}`, icon: 'gift-outline' });
  }

  // 4. What you talked about last time (if it was recent)
  const last = lastNote(data.calls, personId);
  if (last && daysBetween(keyToDate(last.date), now) <= 30) {
    out.push({ kind: 'lastnote', text: `Last time: ${last.note}`, icon: 'document-text-outline' });
  }

  return out.slice(0, MAX_POINTS);
}

/** "Ask how it went: X" → "how it went: X" so it reads well after "Ask:". */
function stripAsk(text: string): string {
  return text.replace(/^ask( them)?:?\s+/i, '');
}

function lastNote(calls: CallEntry[], personId: string): CallEntry | null {
  let best: CallEntry | null = null;
  for (const c of calls) if (c.personId === personId && c.note && (!best || c.date > best.date)) best = c;
  return best;
}

export type LearnedTime = { start: number; end: number; hits: number; total: number; label: string };

/**
 * Looks at when your calls with this person actually happened (last 90 days)
 * and finds the 2-hour slot that holds most of them.
 * Needs at least 3 timed calls, and the slot must hold at least half of them.
 */
export function learnedTime(calls: CallEntry[], personId: string, now = new Date()): LearnedTime | null {
  const since = addDays(todayKey(now), -90);
  const times = calls
    .filter((c) => c.personId === personId && typeof c.time === 'number' && c.date >= since)
    .map((c) => c.time as number);
  if (times.length < 3) return null;

  let best = { start: 0, hits: 0 };
  // try every half-hour start, 2-hour window, wrapping past midnight
  for (let start = 0; start < 1440; start += 30) {
    const hits = times.filter((m) => (m - start + 1440) % 1440 < 120).length;
    if (hits > best.hits) best = { start, hits };
  }
  if (best.hits < 3 || best.hits / times.length < 0.5) return null;
  const end = (best.start + 120) % 1440;
  return { start: best.start, end, hits: best.hits, total: times.length, label: formatRange(best.start, end) };
}

/** Typical number of days between calls (median), or null with too little history. */
export function usualGap(calls: CallEntry[], personId: string): number | null {
  const days = [...new Set(calls.filter((c) => c.personId === personId).map((c) => c.date))].sort();
  if (days.length < 4) return null;
  const gaps: number[] = [];
  for (let i = 1; i < days.length; i++) gaps.push(daysBetween(keyToDate(days[i - 1]), keyToDate(days[i])));
  gaps.sort((a, b) => a - b);
  return gaps[Math.floor(gaps.length / 2)];
}

/**
 * The one reason to put in a reminder, so it says *why* to call:
 * a due follow-up, then news to share, then "longer than usual".
 */
export function reminderReason(data: AppData, personId: string, daysSinceCall: number): string | null {
  const topics: Topic[] = openTopics(data.topics, personId);
  const followUp = topics.find((t) => t.dueDate);
  if (followUp) return `Ask: ${stripAsk(followUp.text)}`;
  const own = topics.find((t) => !t.dueDate && t.personId === personId) ?? topics.find((t) => !t.dueDate);
  if (own) return `You haven't told them yet: ${own.text}`;
  const gap = usualGap(data.calls, personId);
  if (gap !== null && daysSinceCall > gap + 2) return `Longer than usual. You normally call every ${gap} day${gap > 1 ? 's' : ''}.`;
  return null;
}
