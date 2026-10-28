/**
 * iPhone apps can't run in the background, so every reminder is scheduled in
 * advance. Whenever anything changes (a call, a new date, a follow-up) the whole
 * plan is rebuilt: all pending reminders are cancelled and the nearest ones
 * re-scheduled. iOS keeps at most 64 pending local notifications, so we keep
 * the soonest MAX_PENDING of them; the rest get scheduled on a later app open.
 */
import * as Notifications from 'expo-notifications';
import { nudgeMessage, planReminders } from './plan';
import { AppData, Person } from './storage';
import { PersonFamilyInfo } from './family/turns';

let familyInfo: Map<string, PersonFamilyInfo> | null = null;
let lastData: AppData | null = null;

/** Called by the Family Circle whenever who-called-when changes. */
export function setFamilyInfo(info: Map<string, PersonFamilyInfo>) {
  familyInfo = info;
  if (lastData) rescheduleAll(lastData).catch(() => {});
}

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export async function ensurePermission(): Promise<boolean> {
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  const asked = await Notifications.requestPermissionsAsync();
  return asked.granted;
}

let running: Promise<void> = Promise.resolve();

/** Cancel everything and schedule the current plan. Calls are queued so they never overlap. */
export function rescheduleAll(data: AppData): Promise<void> {
  lastData = data;
  running = running
    .catch(() => {})
    .then(async () => {
      await Notifications.cancelAllScheduledNotificationsAsync();
      for (const r of planReminders(data, new Date(), familyInfo)) {
        await Notifications.scheduleNotificationAsync({
          content: { title: r.title, body: r.body, sound: true },
          trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: r.at },
        });
      }
    });
  return running;
}

export async function sendTestReminder(person: Person | undefined): Promise<void> {
  const p = person ?? { id: 'x', name: 'Mum', phone: '', everyDays: 5, emoji: '👩' };
  const { title, body } = nudgeMessage(p, p.everyDays, 1);
  await Notifications.scheduleNotificationAsync({
    content: { title, body, sound: true },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: 5 },
  });
}
