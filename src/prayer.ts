/**
 * Prayer times, worked out on the phone with the `adhan` library (no internet needed).
 * The "Singapore" method uses the same angles as JAKIM (Fajr 20°, Isha 18°), so times
 * match the Malaysian timetable to within a couple of minutes. We add a safety buffer.
 */
import { CalculationMethod, Coordinates, PrayerTimes } from 'adhan';

export const CITIES: { key: string; name: string; lat: number; lng: number }[] = [
  { key: 'kuala-lumpur', name: 'Kuala Lumpur', lat: 3.139, lng: 101.687 },
  { key: 'putrajaya', name: 'Putrajaya', lat: 2.926, lng: 101.696 },
  { key: 'shah-alam', name: 'Shah Alam', lat: 3.073, lng: 101.518 },
  { key: 'sungai-petani', name: 'Sungai Petani', lat: 5.647, lng: 100.488 },
  { key: 'alor-setar', name: 'Alor Setar', lat: 6.121, lng: 100.367 },
  { key: 'kangar', name: 'Kangar', lat: 6.441, lng: 100.198 },
  { key: 'george-town', name: 'George Town', lat: 5.414, lng: 100.329 },
  { key: 'ipoh', name: 'Ipoh', lat: 4.598, lng: 101.09 },
  { key: 'seremban', name: 'Seremban', lat: 2.726, lng: 101.938 },
  { key: 'melaka', name: 'Melaka', lat: 2.189, lng: 102.25 },
  { key: 'johor-bahru', name: 'Johor Bahru', lat: 1.492, lng: 103.741 },
  { key: 'kuantan', name: 'Kuantan', lat: 3.807, lng: 103.326 },
  { key: 'kuala-terengganu', name: 'Kuala Terengganu', lat: 5.33, lng: 103.137 },
  { key: 'kota-bharu', name: 'Kota Bharu', lat: 6.125, lng: 102.238 },
  { key: 'kuching', name: 'Kuching', lat: 1.553, lng: 110.359 },
  { key: 'kota-kinabalu', name: 'Kota Kinabalu', lat: 5.98, lng: 116.073 },
];

const IHTIYATI_MIN = 2; // JAKIM's safety margin added to the astronomical time
const BEFORE_MIN = 10; // start avoiding 10 minutes before Maghrib
const AFTER_MIN = 30; // ...until 30 minutes after it starts

export function cityOf(key: string) {
  return CITIES.find((c) => c.key === key) ?? CITIES[0];
}

export function maghribAt(day: Date, cityKey: string): Date {
  const c = cityOf(cityKey);
  const params = CalculationMethod.Singapore();
  const date = new Date(day.getFullYear(), day.getMonth(), day.getDate(), 12);
  const raw = new PrayerTimes(new Coordinates(c.lat, c.lng), date, params).maghrib;
  return new Date(raw.getTime() + IHTIYATI_MIN * 60_000);
}

/** The busy window around Maghrib on that day. */
export function maghribWindow(day: Date, cityKey: string): { start: Date; end: Date } {
  const m = maghribAt(day, cityKey).getTime();
  return { start: new Date(m - BEFORE_MIN * 60_000), end: new Date(m + AFTER_MIN * 60_000) };
}

/** If `when` falls during Maghrib, move it to just after; otherwise leave it. */
export function avoidMaghrib(when: Date, cityKey: string): Date {
  const w = maghribWindow(when, cityKey);
  if (when >= w.start && when < w.end) {
    // round up to the next 5 minutes so it reads nicely
    const t = new Date(w.end);
    t.setSeconds(0, 0);
    t.setMinutes(Math.ceil(t.getMinutes() / 5) * 5);
    return t;
  }
  return when;
}

export function isMaghribNow(now: Date, cityKey: string): boolean {
  const w = maghribWindow(now, cityKey);
  return now >= w.start && now < w.end;
}
