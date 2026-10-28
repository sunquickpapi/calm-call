import { CallEntry, daysBetween, keyToDate, lastCallKey } from '../storage';
import { laterDay, PersonFamilyInfo } from './turns';

/** Days since anyone (you or a sibling) last called this person. */
export function effectiveDays(
  calls: CallEntry[],
  personId: string,
  info: PersonFamilyInfo | null,
  now = new Date(),
): number | null {
  const last = laterDay(lastCallKey(calls, personId), info?.lastDay);
  return last ? daysBetween(keyToDate(last), now) : null;
}
