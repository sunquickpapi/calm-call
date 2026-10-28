/**
 * Family Circle: shared call log, whose-turn and shared news, synced through Supabase.
 * Everything personal (phone numbers, private notes, reminders) still lives on the phone;
 * only what you choose to share goes to the circle.
 */
import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { setFamilyInfo } from '../reminders';
import { newId, Person } from '../storage';
import { useStore } from '../store';
import { ensureSignedIn, familyConfigured, supabase } from './supabase';
import { CircleCall, CirclePerson, familyInfo, Member, PersonFamilyInfo } from './turns';

export type Circle = { id: string; name: string; code: string };
export type News = {
  id: string;
  person_id: string | null;
  user_id: string;
  text: string;
  done: boolean;
  due: string | null;
  created_at: string;
};

type Family = {
  configured: boolean;
  status: 'off' | 'loading' | 'ready' | 'error';
  error: string | null;
  me: string | null;
  circle: Circle | null;
  members: Member[];
  people: CirclePerson[];
  calls: CircleCall[];
  news: News[];
  /** Family view of one of YOUR people (by local id), if they're shared. */
  infoFor: (localPersonId: string) => PersonFamilyInfo | null;
  nameOf: (userId: string) => string;
  /** shareIds: which of your people to share into the new circle (others stay private). */
  create: (circleName: string, myName: string, shareIds: string[]) => Promise<void>;
  join: (code: string, myName: string) => Promise<void>;
  leave: () => Promise<void>;
  refresh: () => Promise<void>;
  shareLocalPerson: (localId: string) => Promise<void>;
  addCirclePersonLocally: (circlePersonId: string) => void;
  updateSharedPerson: (p: Person) => void;
  postCall: (localPersonId: string | null, day: string) => void;
  setCallNote: (localPersonId: string | null, day: string, note: string) => void;
  removeCall: (localPersonId: string | null, day: string) => void;
  addNews: (text: string, circlePersonId: string | null) => Promise<void>;
  toggleNews: (id: string, done: boolean) => Promise<void>;
};

const Ctx = createContext<Family | null>(null);
const CALL_HISTORY_DAYS = 180;

export function FamilyProvider({ children }: { children: ReactNode }) {
  const { data, update, loaded } = useStore();
  const circleId = data.family?.circleId ?? null;

  const [status, setStatus] = useState<Family['status']>(familyConfigured ? 'loading' : 'off');
  const [error, setError] = useState<string | null>(null);
  const [me, setMe] = useState<string | null>(null);
  const [circle, setCircle] = useState<Circle | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [people, setPeople] = useState<CirclePerson[]>([]);
  const [calls, setCalls] = useState<CircleCall[]>([]);
  const [news, setNews] = useState<News[]>([]);

  // Always read the latest local data inside async callbacks
  const dataRef = useRef(data);
  dataRef.current = data;

  // ---------- Loading ----------
  const refresh = useCallback(async () => {
    if (!supabase || !circleId) {
      setStatus(familyConfigured ? 'ready' : 'off');
      return;
    }
    try {
      const uid = await ensureSignedIn();
      setMe(uid);
      const since = new Date(Date.now() - CALL_HISTORY_DAYS * 86_400_000).toISOString().slice(0, 10);
      const [c, m, p, k, n] = await Promise.all([
        supabase.from('circles').select('id,name,code').eq('id', circleId).maybeSingle(),
        supabase.from('members').select('user_id,display_name,joined_at').eq('circle_id', circleId),
        supabase.from('people').select('id,name,emoji,every_days').eq('circle_id', circleId).order('created_at'),
        supabase
          .from('calls')
          .select('person_id,user_id,day,note,created_at')
          .eq('circle_id', circleId)
          .gte('day', since)
          .order('day', { ascending: false }),
        supabase
          .from('news')
          .select('id,person_id,user_id,text,done,due,created_at')
          .eq('circle_id', circleId)
          .order('created_at', { ascending: false })
          .limit(100),
      ]);
      const firstError = c.error ?? m.error ?? p.error ?? k.error ?? n.error;
      if (firstError) throw firstError;
      if (!c.data) {
        // We were removed, or the circle was deleted
        update((d) => ({ ...d, family: null }));
        setCircle(null);
        setStatus('ready');
        return;
      }
      setCircle(c.data as Circle);
      setMembers((m.data ?? []) as Member[]);
      setPeople((p.data ?? []) as CirclePerson[]);
      setCalls((k.data ?? []) as CircleCall[]);
      setNews((n.data ?? []) as News[]);
      setError(null);
      setStatus('ready');
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setStatus('error');
    }
  }, [circleId, update]);

  useEffect(() => {
    if (loaded) refresh();
  }, [loaded, refresh]);

  // Refresh when the app comes back to the front
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => s === 'active' && refresh());
    return () => sub.remove();
  }, [refresh]);

  // Live updates while the app is open
  useEffect(() => {
    if (!supabase || !circleId) return;
    const client = supabase;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const soon = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => refresh(), 400);
    };
    const channel = client.channel(`circle-${circleId}`);
    for (const table of ['members', 'people', 'calls', 'news']) {
      channel.on('postgres_changes', { event: '*', schema: 'public', table, filter: `circle_id=eq.${circleId}` }, soon);
    }
    channel.subscribe();
    return () => {
      if (timer) clearTimeout(timer);
      client.removeChannel(channel);
    };
  }, [circleId, refresh]);

  // Auto-link your contacts to circle people with the same name
  useEffect(() => {
    if (!people.length) return;
    const local = dataRef.current.people;
    const updates = local.filter(
      (lp) =>
        (!lp.circlePersonId || !people.some((cp) => cp.id === lp.circlePersonId)) &&
        people.some((cp) => sameName(cp.name, lp.name)),
    );
    if (!updates.length) return;
    update((d) => ({
      ...d,
      people: d.people.map((lp) => {
        if (lp.circlePersonId && people.some((cp) => cp.id === lp.circlePersonId)) return lp;
        const match = people.find((cp) => sameName(cp.name, lp.name));
        return match ? { ...lp, circlePersonId: match.id } : lp;
      }),
    }));
  }, [people, update]);

  // ---------- Derived ----------
  const circlePersonFor = useCallback(
    (localId: string | null) => {
      if (!localId || !circleId) return null;
      const lp = dataRef.current.people.find((p) => p.id === localId);
      if (!lp?.circlePersonId) return null;
      return people.find((cp) => cp.id === lp.circlePersonId) ?? null;
    },
    [circleId, people],
  );

  const infoMap = useMemo(() => {
    const map = new Map<string, PersonFamilyInfo>();
    if (!circle || !me) return map;
    for (const lp of data.people) {
      const cp = lp.circlePersonId ? people.find((x) => x.id === lp.circlePersonId) : null;
      if (cp) map.set(lp.id, familyInfo(cp.id, members, calls, me));
    }
    return map;
  }, [circle, me, data.people, people, members, calls]);

  // Reminders follow whose turn it is
  useEffect(() => {
    setFamilyInfo(infoMap);
  }, [infoMap]);

  const infoFor = useCallback((localId: string) => infoMap.get(localId) ?? null, [infoMap]);
  const nameOf = useCallback(
    (uid: string) => (uid === me ? 'You' : members.find((m) => m.user_id === uid)?.display_name ?? 'Someone'),
    [me, members],
  );

  // ---------- Actions ----------
  const afterJoin = useCallback(
    async (c: Circle, myName: string, shareIds: string[]) => {
      update((d) => ({ ...d, family: { circleId: c.id, myName } }));
      if (shareIds.length && supabase) {
        // Share your current people (names & reminder gaps only, never phone numbers)
        const local = dataRef.current.people.filter((lp) => shareIds.includes(lp.id));
        if (local.length) {
          const { data: rows } = await supabase
            .from('people')
            .insert(local.map((lp) => ({ circle_id: c.id, name: lp.name, emoji: lp.emoji, every_days: lp.everyDays })))
            .select('id,name');
          if (rows) {
            update((d) => ({
              ...d,
              people: d.people.map((lp) => {
                if (!shareIds.includes(lp.id)) return lp;
                const row = rows.find((r) => sameName(r.name, lp.name));
                return row ? { ...lp, circlePersonId: row.id } : lp;
              }),
            }));
          }
        }
      }
    },
    [update],
  );

  const create = useCallback(
    async (circleName: string, myName: string, shareIds: string[]) => {
      if (!supabase) throw new Error('Family sync is not set up yet.');
      await ensureSignedIn();
      const { data: c, error: e } = await supabase.rpc('create_circle', {
        p_name: circleName.trim(),
        p_display_name: myName.trim(),
      });
      if (e) throw new Error(e.message);
      await afterJoin(c as Circle, myName.trim(), shareIds);
    },
    [afterJoin],
  );

  const join = useCallback(
    async (code: string, myName: string) => {
      if (!supabase) throw new Error('Family sync is not set up yet.');
      await ensureSignedIn();
      const { data: c, error: e } = await supabase.rpc('join_circle', {
        p_code: code,
        p_display_name: myName.trim(),
      });
      if (e) throw new Error(e.message.includes('No family circle') ? 'No family circle with that code.' : e.message);
      await afterJoin(c as Circle, myName.trim(), []);
    },
    [afterJoin],
  );

  const leave = useCallback(async () => {
    if (supabase && circleId && me) {
      await supabase.from('members').delete().eq('circle_id', circleId).eq('user_id', me);
    }
    update((d) => ({ ...d, family: null, people: d.people.map((p) => ({ ...p, circlePersonId: undefined })) }));
    setCircle(null);
    setMembers([]);
    setPeople([]);
    setCalls([]);
    setNews([]);
  }, [circleId, me, update]);

  const shareLocalPerson = useCallback(
    async (localId: string) => {
      if (!supabase || !circleId) return;
      const lp = dataRef.current.people.find((p) => p.id === localId);
      if (!lp) return;
      const { data: row, error: e } = await supabase
        .from('people')
        .insert({ circle_id: circleId, name: lp.name, emoji: lp.emoji, every_days: lp.everyDays })
        .select('id')
        .single();
      if (e) throw new Error(e.message);
      update((d) => ({ ...d, people: d.people.map((p) => (p.id === localId ? { ...p, circlePersonId: row.id } : p)) }));
      refresh();
    },
    [circleId, update, refresh],
  );

  const addCirclePersonLocally = useCallback(
    (circlePersonId: string) => {
      const cp = people.find((p) => p.id === circlePersonId);
      if (!cp) return;
      const local: Person = {
        id: newId(),
        name: cp.name,
        phone: '',
        everyDays: cp.every_days,
        emoji: cp.emoji,
        circlePersonId: cp.id,
      };
      update((d) => ({ ...d, people: [...d.people, local] }));
    },
    [people, update],
  );

  const updateSharedPerson = useCallback(
    (p: Person) => {
      if (!supabase || !circleId || !p.circlePersonId) return;
      supabase
        .from('people')
        .update({ name: p.name, emoji: p.emoji, every_days: p.everyDays })
        .eq('id', p.circlePersonId)
        .then(() => refresh());
    },
    [circleId, refresh],
  );

  const postCall = useCallback(
    (localPersonId: string | null, day: string) => {
      const cp = circlePersonFor(localPersonId);
      if (!supabase || !cp || !circleId) return;
      supabase
        .from('calls')
        .upsert({ circle_id: circleId, person_id: cp.id, day }, { onConflict: 'person_id,user_id,day', ignoreDuplicates: true })
        .then(() => refresh());
    },
    [circleId, circlePersonFor, refresh],
  );

  const setCallNote = useCallback(
    (localPersonId: string | null, day: string, note: string) => {
      const cp = circlePersonFor(localPersonId);
      if (!supabase || !cp || !me) return;
      supabase
        .from('calls')
        .update({ note: note.trim() || null })
        .eq('person_id', cp.id)
        .eq('user_id', me)
        .eq('day', day)
        .then(() => refresh());
    },
    [circlePersonFor, me, refresh],
  );

  const removeCall = useCallback(
    (localPersonId: string | null, day: string) => {
      const cp = circlePersonFor(localPersonId);
      if (!supabase || !cp || !me) return;
      supabase
        .from('calls')
        .delete()
        .eq('person_id', cp.id)
        .eq('user_id', me)
        .eq('day', day)
        .then(() => refresh());
    },
    [circlePersonFor, me, refresh],
  );

  const addNews = useCallback(
    async (text: string, circlePersonId: string | null) => {
      if (!supabase || !circleId) return;
      const { error: e } = await supabase.from('news').insert({ circle_id: circleId, person_id: circlePersonId, text: text.trim() });
      if (e) throw new Error(e.message);
      refresh();
    },
    [circleId, refresh],
  );

  const toggleNews = useCallback(
    async (id: string, done: boolean) => {
      if (!supabase) return;
      setNews((list) => list.map((n) => (n.id === id ? { ...n, done } : n))); // feels instant
      await supabase.from('news').update({ done }).eq('id', id);
      refresh();
    },
    [refresh],
  );

  const value: Family = {
    configured: familyConfigured,
    status,
    error,
    me,
    circle: circleId ? circle : null,
    members,
    people,
    calls,
    news,
    infoFor,
    nameOf,
    create,
    join,
    leave,
    refresh,
    shareLocalPerson,
    addCirclePersonLocally,
    updateSharedPerson,
    postCall,
    setCallNote,
    removeCall,
    addNews,
    toggleNews,
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useFamily(): Family {
  const f = useContext(Ctx);
  if (!f) throw new Error('useFamily must be used inside FamilyProvider');
  return f;
}

function sameName(a: string, b: string) {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}
