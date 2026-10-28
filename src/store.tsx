import { createContext, ReactNode, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { AppData, DEFAULT_DATA, loadData, saveData } from './storage';
import { ensurePermission, rescheduleAll } from './reminders';

type Store = {
  data: AppData;
  loaded: boolean;
  /** Change the data. Saves to the phone and re-plans reminders automatically. */
  update: (fn: (d: AppData) => AppData) => void;
};

const Ctx = createContext<Store | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<AppData>(DEFAULT_DATA);
  const [loaded, setLoaded] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    loadData().then((d) => {
      setData(d);
      setLoaded(true);
      saveData(d); // persists an upgraded v1 file in the new format
      ensurePermission().then(() => rescheduleAll(d).catch(() => {}));
    });
  }, []);

  const update = useCallback((fn: (d: AppData) => AppData) => {
    setData((prev) => {
      const next = fn(prev);
      saveData(next);
      // small delay so several quick changes only re-plan once
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => rescheduleAll(next).catch(() => {}), 400);
      return next;
    });
  }, []);

  return <Ctx.Provider value={{ data, loaded, update }}>{children}</Ctx.Provider>;
}

export function useStore(): Store {
  const s = useContext(Ctx);
  if (!s) throw new Error('useStore must be used inside StoreProvider');
  return s;
}
