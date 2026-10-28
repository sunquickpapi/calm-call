import AsyncStorage from '@react-native-async-storage/async-storage';

// ---------- Data model ----------
export type Person = {
  id: string;
  name: string;
  phone: string;
  everyDays: number; // remind me if I haven't called this person in this many days
  emoji: string;
  /** How I usually reach them. WhatsApp opens their chat (tap the call button there). */
  via?: 'phone' | 'whatsapp';
  /** When they're usually free, in minutes after midnight (e.g. 20*60 = 8pm). Missing = any time. */
  window?: { start: number; end: number } | null;
  /** The matching person in your Family Circle, if shared. */
  circlePersonId?: string;
};

export type CallEntry = {
  id: string;
  date: string; // YYYY-MM-DD, local time
  personId: string | null; // null = "they called me" / not sure who
  note?: string;
  /** Time of day the call was logged, in minutes after midnight (used to learn the best time to call). */
  time?: number;
};

/** Something to tell someone. With a dueDate it becomes a follow-up ("ask how the checkup went"). */
export type Topic = {
  id: string;
  personId: string | null; // null = anyone
  text: string;
  done: boolean;
  createdAt: string; // YYYY-MM-DD
  dueDate?: string; // YYYY-MM-DD, for follow-ups
};

export type ImportantDate = {
  id: string;
  title: string; // "Mak's birthday", "Hari Raya"
  personId: string | null;
  date: string; // YYYY-MM-DD (year ignored when yearly)
  yearly: boolean; // birthdays: true. Hari Raya moves each year: false
  remindDaysBefore: number;
};

export type Settings = {
  hour: number;
  minute: number;
  /** Move reminders that land during Maghrib to just after it. */
  avoidMaghrib: boolean;
  /** Which city's prayer times to use (see src/prayer.ts). */
  city: string;
};

export type AppData = {
  version: 2;
  people: Person[];
  calls: CallEntry[];
  topics: Topic[];
  dates: ImportantDate[];
  settings: Settings;
  /** The Family Circle this phone belongs to, if any. */
  family?: { circleId: string; myName: string } | null;
};

const KEY_V2 = 'call-parents-data-v2';
const KEY_V1 = 'call-parents-data-v1';

export const DEFAULT_DATA: AppData = {
  version: 2,
  people: [
    { id: 'mum', name: 'Mum', phone: '', everyDays: 5, emoji: '👩' },
    { id: 'dad', name: 'Dad', phone: '', everyDays: 5, emoji: '👨' },
  ],
  calls: [],
  topics: [],
  dates: [],
  settings: { hour: 20, minute: 30, avoidMaghrib: true, city: 'kuala-lumpur' },
};

export function newId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

// ---------- Loading / saving (with upgrade from version 1) ----------
type V1 = {
  contacts?: { id: string; name: string; phone: string }[];
  calls?: { date: string; who: string }[];
  settings?: { remindAfterDays?: number; hour?: number; minute?: number };
};

export function migrateV1(old: V1): AppData {
  const every = old.settings?.remindAfterDays ?? 5;
  const people: Person[] = (old.contacts ?? DEFAULT_DATA.people).map((c, i) => ({
    id: c.id,
    name: c.name,
    phone: c.phone,
    everyDays: every,
    emoji: i === 0 ? '👩' : i === 1 ? '👨' : '🙂',
  }));
  const calls: CallEntry[] = (old.calls ?? []).map((c) => ({
    id: newId(),
    date: c.date,
    personId: people.find((p) => p.name === c.who)?.id ?? null,
  }));
  return {
    ...DEFAULT_DATA,
    people,
    calls,
    settings: { ...DEFAULT_DATA.settings, hour: old.settings?.hour ?? 20, minute: old.settings?.minute ?? 30 },
  };
}

export async function loadData(): Promise<AppData> {
  try {
    const raw = await AsyncStorage.getItem(KEY_V2);
    if (raw) {
      const p = JSON.parse(raw) as Partial<AppData>;
      return {
        version: 2,
        people: p.people ?? DEFAULT_DATA.people,
        calls: p.calls ?? [],
        topics: p.topics ?? [],
        dates: p.dates ?? [],
        settings: { ...DEFAULT_DATA.settings, ...p.settings },
        family: p.family ?? null,
      };
    }
    const rawV1 = await AsyncStorage.getItem(KEY_V1);
    if (rawV1) return migrateV1(JSON.parse(rawV1) as V1);
  } catch {
    // fall through to defaults
  }
  return DEFAULT_DATA;
}

export async function saveData(data: AppData): Promise<void> {
  await AsyncStorage.setItem(KEY_V2, JSON.stringify(data));
}

// ---------- Date helpers (always local time) ----------
export function todayKey(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function keyToDate(key: string): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(key: string, n: number): string {
  const d = keyToDate(key);
  return todayKey(new Date(d.getFullYear(), d.getMonth(), d.getDate() + n));
}

export function daysBetween(a: Date, b: Date): number {
  const start = new Date(a.getFullYear(), a.getMonth(), a.getDate()).getTime();
  const end = new Date(b.getFullYear(), b.getMonth(), b.getDate()).getTime();
  return Math.round((end - start) / 86_400_000);
}

export function formatDay(key: string, withYear = false): string {
  return keyToDate(key).toLocaleDateString(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    ...(withYear ? { year: 'numeric' } : {}),
  });
}

// ---------- Per-person helpers ----------
export function lastCallKey(calls: CallEntry[], personId: string): string | null {
  let latest: string | null = null;
  for (const c of calls) if (c.personId === personId && (!latest || c.date > latest)) latest = c.date;
  return latest;
}

export function daysSince(calls: CallEntry[], personId: string, now = new Date()): number | null {
  const last = lastCallKey(calls, personId);
  return last ? daysBetween(keyToDate(last), now) : null;
}

export type Status = 'good' | 'soon' | 'overdue' | 'none';

export function personStatus(days: number | null, everyDays: number): Status {
  if (days === null) return 'none';
  if (days < everyDays - 1) return 'good';
  if (days < everyDays) return 'soon';
  return 'overdue';
}

/** "👩 Mak" for emoji avatars, just "Pak Long" when the avatar is initials. */
export function personLabel(p: Person): string {
  return /^[A-Za-z0-9 .]*$/.test(p.emoji) ? p.name : `${p.emoji} ${p.name}`;
}

/** "8:00 PM" from minutes after midnight. */
export function formatMinutes(mins: number): string {
  const m = ((mins % 1440) + 1440) % 1440;
  return new Date(2000, 0, 1, Math.floor(m / 60), m % 60).toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  });
}

/** Short range like "8–10 PM" or "11:30 AM–1 PM". */
export function formatRange(start: number, end: number): string {
  const part = (mins: number) => {
    const m = ((mins % 1440) + 1440) % 1440;
    const h = Math.floor(m / 60);
    const mm = m % 60;
    return { text: `${h % 12 || 12}${mm ? ':' + String(mm).padStart(2, '0') : ''}`, ampm: h < 12 ? 'AM' : 'PM' };
  };
  const a = part(start);
  const b = part(end);
  return a.ampm === b.ampm ? `${a.text}–${b.text} ${b.ampm}` : `${a.text} ${a.ampm}–${b.text} ${b.ampm}`;
}

/** Is this time inside the person's free window? (Handles windows that cross midnight.) */
export function inWindow(p: Person, d: Date): boolean {
  if (!p.window) return true;
  const m = d.getHours() * 60 + d.getMinutes();
  const { start, end } = p.window;
  return start <= end ? m >= start && m < end : m >= start || m < end;
}

export function openTopics(topics: Topic[], personId: string): Topic[] {
  return topics.filter((t) => !t.done && (t.personId === personId || t.personId === null));
}

// ---------- Important dates ----------
/** Next date (today or later) this event happens, or null if a one-off date has passed. */
export function nextOccurrence(d: ImportantDate, now = new Date()): string | null {
  const today = todayKey(now);
  if (!d.yearly) return d.date >= today ? d.date : null;
  const [, m, day] = d.date.split('-').map(Number);
  for (const year of [now.getFullYear(), now.getFullYear() + 1]) {
    // Feb 29 birthdays fall back to Feb 28 in non-leap years
    const lastDay = new Date(year, m, 0).getDate();
    const key = todayKey(new Date(year, m - 1, Math.min(day, lastDay)));
    if (key >= today) return key;
  }
  return null;
}

export function upcomingDates(
  dates: ImportantDate[],
  now = new Date(),
): { item: ImportantDate; on: string; inDays: number }[] {
  return dates
    .map((item) => ({ item, on: nextOccurrence(item, now) }))
    .filter((x): x is { item: ImportantDate; on: string } => x.on !== null)
    .map((x) => ({ ...x, inDays: daysBetween(now, keyToDate(x.on)) }))
    .sort((a, b) => a.on.localeCompare(b.on));
}
