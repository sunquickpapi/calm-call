/** Pure reminder planning: no phone APIs here, so it can be tested anywhere. */
import {
  AppData,
  Person,
  addDays,
  keyToDate,
  lastCallKey,
  nextOccurrence,
  openTopics,
  todayKey,
} from './storage';
import { avoidMaghrib } from './prayer';
import { reminderReason } from './smart';
import { BACKUP_GRACE_DAYS, laterDay, PersonFamilyInfo } from './family/turns';

export const MAX_PENDING = 60; // iOS keeps at most 64 pending local notifications
const NUDGE_DAYS = 21; // how many evenings of nudges to plan per person

export type PlannedReminder = { at: Date; title: string; body: string; kind: string };

export function nudgeMessage(person: Person, days: number, topicCount: number, reason?: string | null) {
  const extra = reason
    ? ` ${reason}`
    : topicCount > 0
      ? ` You have ${topicCount} thing${topicCount > 1 ? 's' : ''} to tell them.`
      : '';
  const late = days - person.everyDays;
  if (late < 2)
    return {
      title: /^[A-Za-z0-9 .]*$/.test(person.emoji) ? `Call ${person.name}` : `Call ${person.name} ${person.emoji}`,
      body: `It's been ${days} days since you last called. Maybe tonight?${extra}`,
    };
  if (late < 5)
    return {
      title: `${person.name} misses you 💛`,
      body: `${days} days without a call. Give them a ring today.${extra}`,
    };
  return {
    title: `🚨 ${days} days since you called ${person.name}`,
    body: `Okay, seriously, call tonight. Even 5 minutes counts.${extra}`,
  };
}

/** Pure function: works out every reminder that should exist. Easy to test. */
export function planReminders(
  data: AppData,
  now = new Date(),
  family?: Map<string, PersonFamilyInfo> | null,
): PlannedReminder[] {
  const { hour, minute, city } = data.settings;
  const shift = (d: Date) => (data.settings.avoidMaghrib ? avoidMaghrib(d, city) : d);
  const at = (dateKey: string, h = hour, m = minute) => {
    const d = keyToDate(dateKey);
    return shift(new Date(d.getFullYear(), d.getMonth(), d.getDate(), h, m));
  };
  const today = todayKey(now);
  const plan: PlannedReminder[] = [];

  // 1. "You haven't called X" nudges, one per evening once overdue
  for (const p of data.people) {
    const fam = family?.get(p.id) ?? null;
    // a call by ANY sibling counts, so you're not nagged right after Along called
    const from = laterDay(lastCallKey(data.calls, p.id), fam?.lastDay) ?? today; // never called → from today
    // whoever's turn it is gets reminded first; everyone else a few days later as backup
    const grace = fam && !fam.myTurn ? BACKUP_GRACE_DAYS : 0;
    const topics = openTopics(data.topics, p.id).length;
    for (let i = 0; i < NUDGE_DAYS; i++) {
      const days = p.everyDays + grace + i;
      const msg = nudgeMessage(p, days, topics, reminderReason(data, p.id, days));
      const title = msg.title;
      const body =
        fam && fam.memberCount > 1
          ? fam.myTurn
            ? `${msg.body} It's your turn${fam.lastBy && !fam.lastByMe ? ` (${fam.lastBy} called last)` : ''}.`
            : `${msg.body} It was ${fam.turnName}'s turn, but no one has called yet.`
          : msg.body;
      // remind at the start of their free window, or the usual evening time
      const h = p.window ? Math.floor(p.window.start / 60) : hour;
      const m = p.window ? p.window.start % 60 : minute;
      plan.push({ at: at(addDays(from, days), h, m), title, body, kind: `nudge:${p.id}` });
    }
  }

  // 2. Important dates: a heads-up before, and a morning nudge on the day
  for (const d of data.dates) {
    const on = nextOccurrence(d, now);
    if (!on) continue;
    const who = data.people.find((p) => p.id === d.personId);
    if (d.remindDaysBefore > 0) {
      const n = d.remindDaysBefore;
      plan.push({
        at: at(addDays(on, -n)),
        title: `📅 ${d.title} in ${n} day${n > 1 ? 's' : ''}`,
        body: who ? `Plan something for ${who.name}?` : 'Time to plan ahead.',
        kind: `date:${d.id}`,
      });
    }
    plan.push({
      at: at(on, 9, 0),
      title: `🎉 Today: ${d.title}`,
      body: who ? `Don't forget to call ${who.name} today!` : "Don't forget to give them a call today!",
      kind: `date:${d.id}`,
    });
  }

  // 3. Follow-ups ("ask how the checkup went")
  for (const t of data.topics) {
    if (t.done || !t.dueDate) continue;
    const who = data.people.find((p) => p.id === t.personId);
    plan.push({
      at: at(t.dueDate),
      title: who ? `Follow up with ${who.name}` : 'Follow up',
      body: t.text,
      kind: `topic:${t.id}`,
    });
  }

  return mergeSameTime(
    plan.filter((r) => r.at.getTime() > now.getTime()).sort((a, b) => a.at.getTime() - b.at.getTime()),
  ).slice(0, MAX_PENDING);
}

/** Several reminders at the same minute become one notification instead of a pile. */
function mergeSameTime(sorted: PlannedReminder[]): PlannedReminder[] {
  const out: PlannedReminder[] = [];
  for (const r of sorted) {
    const prev = out[out.length - 1];
    if (prev && prev.at.getTime() === r.at.getTime()) {
      const parts = prev.kind.includes('+') ? prev.body.split('\n') : [`${prev.title}: ${prev.body}`];
      out[out.length - 1] = {
        at: prev.at,
        title: `You have ${parts.length + 1} reminders`,
        body: [...parts, `${r.title}: ${r.body}`].join('\n'),
        kind: `${prev.kind}+${r.kind}`,
      };
    } else out.push(r);
  }
  return out;
}

