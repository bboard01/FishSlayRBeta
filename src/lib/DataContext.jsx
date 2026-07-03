import { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';

// Same storage key as the single-file app, so the React build reads the exact
// same local journal — no data migration needed on the same device.
const KEY = 'fishslayr.genesisII.riverRemembers';

export function uid() {
  return 'id-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
}

// Minimal empty journal for a brand-new device (offline-first: the app works
// immediately with this, and a cloud pull fills in real data when signed in).
function emptyData() {
  const year = String(new Date().getFullYear());
  return {
    version: 'FishSlayR v2',
    mode: 'dock',
    activeSeason: year,
    seasons: [{ id: year, name: year + ' — New Season', archived: false }],
    sessions: [],
    catches: [],
    refs: {},
    sound: { enabled: false, master: 0.68, effects: 0.75, haptics: true }
  };
}

function loadLocal() {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : emptyData();
  } catch {
    return emptyData();
  }
}

const DataContext = createContext(null);

export function DataProvider({ children }) {
  const [data, setData] = useState(loadLocal);

  // Persist to localStorage on every change (offline source of truth).
  useEffect(() => {
    try { localStorage.setItem(KEY, JSON.stringify(data)); } catch { /* quota */ }
  }, [data]);

  // Merge a partial update and re-render. Accepts either an object or an
  // updater function, like setState.
  const update = useCallback((patch) => {
    setData((prev) => {
      const next = typeof patch === 'function' ? patch(prev) : { ...prev, ...patch };
      return next;
    });
  }, []);

  // Replace the whole data object (used after a cloud pull hydrates local).
  const replaceData = useCallback((next) => setData(next), []);

  // ---- selectors (ported 1:1 from the single-file app) ----
  const selectors = useMemo(() => {
    const seasonSessions = () => data.sessions.filter((s) => s.season === data.activeSeason);
    const currentSeason = () => data.seasons.find((s) => s.id === data.activeSeason) || data.seasons[0];
    const activeSession = () =>
      data.sessions.find((s) => s.active && s.season === data.activeSeason) || seasonSessions()[0];
    const catchesForSession = (id) => data.catches.filter((c) => c.sessionId === id && !c.deleted);
    const seasonCatches = () => {
      const ids = new Set(seasonSessions().map((s) => s.id));
      return data.catches.filter((c) => ids.has(c.sessionId) && !c.deleted);
    };
    const sessionFor = (id) => data.sessions.find((s) => s.id === id) || {};
    const biggest = (c = seasonCatches()) =>
      c.slice().sort((a, b) => (+b.length || 0) - (+a.length || 0))[0];
    const avg = (c = seasonCatches()) =>
      c.length ? (c.reduce((a, x) => a + (+x.length || 0), 0) / c.length).toFixed(1) : 0;
    return { seasonSessions, currentSeason, activeSession, catchesForSession, seasonCatches, sessionFor, biggest, avg };
  }, [data]);

  const value = useMemo(() => ({ data, update, replaceData, ...selectors }), [data, update, replaceData, selectors]);

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export function useData() {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error('useData must be used inside <DataProvider>');
  return ctx;
}
