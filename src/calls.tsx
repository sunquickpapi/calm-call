import { createContext, ReactNode, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { Alert, AppState, Linking } from 'react-native';
import * as ExpoLinking from 'expo-linking';
import { contactUrl } from './contact';
import { useFamily } from './family/family';
import { AfterCallSheet } from './sheets/AfterCallSheet';
import { CallEntry, newId, personLabel, todayKey } from './storage';
import { useStore } from './store';

type Calls = {
  /** Logs today's call, opens the dialer, and asks "How was the call?" when you come back. */
  startCall: (personId: string) => void;
  /** Logs a call without dialing. askAfter=true opens the "How was the call?" sheet. */
  logCall: (personId: string | null, askAfter?: boolean) => void;
  /** Asks who called you, then logs it. */
  logIncoming: () => void;
};

const Ctx = createContext<Calls | null>(null);

export function CallsProvider({ children }: { children: ReactNode }) {
  const { data, update } = useStore();
  const family = useFamily();
  const [afterCallId, setAfterCallId] = useState<string | null>(null);
  const pending = useRef<{ callId: string; leftAt: number } | null>(null);

  /** One entry per person per day; returns the id of today's entry. */
  const record = useCallback(
    (personId: string | null): string => {
      const date = todayKey();
      const existing = data.calls.find((c) => c.date === date && c.personId === personId);
      family.postCall(personId, date); // shares it with the Family Circle (if this person is shared)
      if (existing) return existing.id;
      const now = new Date();
      const entry: CallEntry = { id: newId(), date, personId, time: now.getHours() * 60 + now.getMinutes() };
      update((d) => ({ ...d, calls: [...d.calls, entry] }));
      return entry.id;
    },
    [data.calls, update, family],
  );

  // When you come back from the Phone app, show the after-call sheet
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state !== 'active' || !pending.current) return;
      const { callId, leftAt } = pending.current;
      pending.current = null;
      if (Date.now() - leftAt > 3000) setAfterCallId(callId); // skip if they cancelled the dial prompt
    });
    return () => sub.remove();
  }, []);

  const startCall = useCallback(
    (personId: string) => {
      const person = data.people.find((p) => p.id === personId);
      if (!person?.phone) return;
      const callId = record(personId);
      pending.current = { callId, leftAt: Date.now() };
      Linking.openURL(contactUrl(person)).catch(() => {
        pending.current = null;
        Alert.alert(
          person.via === 'whatsapp' ? "Couldn't open WhatsApp" : "Couldn't open the dialer",
          'Check the phone number in Settings.',
        );
      });
    },
    [data.people, record],
  );

  const logCall = useCallback(
    (personId: string | null, askAfter = false) => {
      const id = record(personId);
      // small delay lets any closing sheet finish its animation first
      if (askAfter) setTimeout(() => setAfterCallId(id), 600);
    },
    [record],
  );

  const logIncoming = useCallback(() => {
    Alert.alert('Who did you talk to?', undefined, [
      ...data.people.map((p) => ({ text: personLabel(p), onPress: () => logCall(p.id, true) })),
      { text: 'Cancel', style: 'cancel' as const },
    ]);
  }, [data.people, logCall]);

  // ---- Links from Siri / Shortcuts: .../log?who=Mak or .../call?who=Mak ----
  const latest = useRef({ people: data.people, startCall, logCall });
  latest.current = { people: data.people, startCall, logCall };

  useEffect(() => {
    const handle = (url: string | null) => {
      if (!url) return;
      const action = linkAction(url);
      if (!action) return;
      const { people, startCall: call, logCall: log } = latest.current;
      const person = people.find((p) => p.name.trim().toLowerCase() === action.who.trim().toLowerCase());
      if (!person) {
        Alert.alert(`No one called "${action.who}"`, 'Check the name in the shortcut matches the app.');
        return;
      }
      if (action.kind === 'call') call(person.id);
      else {
        log(person.id);
        Alert.alert('Logged', `Call with ${person.name} saved for today.`);
      }
    };
    ExpoLinking.getInitialURL().then(handle);
    const sub = ExpoLinking.addEventListener('url', (e) => handle(e.url));
    return () => sub.remove();
  }, []);

  return (
    <Ctx.Provider value={{ startCall, logCall, logIncoming }}>
      {children}
      <AfterCallSheet callId={afterCallId} onClose={() => setAfterCallId(null)} />
    </Ctx.Provider>
  );
}

export function useCalls(): Calls {
  const c = useContext(Ctx);
  if (!c) throw new Error('useCalls must be used inside CallsProvider');
  return c;
}

/** Reads "log"/"call" and the person's name from a Calm Call link. */
export function linkAction(url: string): { kind: 'log' | 'call'; who: string } | null {
  const parsed = ExpoLinking.parse(url);
  const path = (parsed.path ?? '').replace(/^\/+|\/+$/g, '').split('/').pop() ?? '';
  const who = parsed.queryParams?.who;
  if ((path === 'log' || path === 'call') && typeof who === 'string' && who.trim()) {
    return { kind: path, who };
  }
  return null;
}

/** The link a Shortcut opens to log (or start) a call with this person. */
export function shortcutLink(kind: 'log' | 'call', name: string): string {
  return ExpoLinking.createURL(kind, { queryParams: { who: name } });
}
