/**
 * Whose turn is it? Pure logic, no network — easy to test.
 *
 * Rule: for each person (e.g. Mak), the sibling who has gone longest without
 * calling her is "on turn". Someone who has never called counts as longest.
 * Ties go to whoever joined the circle first.
 */

export type Member = { user_id: string; display_name: string; joined_at: string };
export type CirclePerson = { id: string; name: string; emoji: string; every_days: number };
export type CircleCall = { person_id: string; user_id: string; day: string; note: string | null; created_at: string };

export type PersonFamilyInfo = {
  lastDay: string | null; // most recent call by anyone (YYYY-MM-DD)
  lastBy: string | null; // their display name
  lastByMe: boolean;
  turnUserId: string | null;
  turnName: string | null;
  myTurn: boolean;
  memberCount: number;
};

/** Extra days before people who are NOT on turn also get reminded (backup). */
export const BACKUP_GRACE_DAYS = 3;

export function familyInfo(
  personId: string,
  members: Member[],
  calls: CircleCall[],
  me: string,
): PersonFamilyInfo {
  const forPerson = calls.filter((c) => c.person_id === personId);
  const nameOf = (uid: string) => members.find((m) => m.user_id === uid)?.display_name ?? 'Someone';

  let last: CircleCall | null = null;
  for (const c of forPerson) {
    if (!last || c.day > last.day || (c.day === last.day && c.created_at > last.created_at)) last = c;
  }

  // last call per member
  const lastByMember = new Map<string, string>();
  for (const c of forPerson) {
    const prev = lastByMember.get(c.user_id);
    if (!prev || c.day > prev) lastByMember.set(c.user_id, c.day);
  }

  const ordered = [...members].sort((a, b) => {
    const da = lastByMember.get(a.user_id) ?? ''; // '' sorts first = never called
    const db = lastByMember.get(b.user_id) ?? '';
    if (da !== db) return da < db ? -1 : 1;
    return a.joined_at < b.joined_at ? -1 : a.joined_at > b.joined_at ? 1 : 0;
  });
  const turn = ordered[0] ?? null;

  return {
    lastDay: last?.day ?? null,
    lastBy: last ? nameOf(last.user_id) : null,
    lastByMe: last?.user_id === me,
    turnUserId: turn?.user_id ?? null,
    turnName: turn ? (turn.user_id === me ? 'You' : turn.display_name) : null,
    myTurn: !turn || turn.user_id === me,
    memberCount: members.length,
  };
}

/** The later of two YYYY-MM-DD dates (either may be missing). */
export function laterDay(a: string | null | undefined, b: string | null | undefined): string | null {
  if (!a) return b ?? null;
  if (!b) return a;
  return a > b ? a : b;
}
