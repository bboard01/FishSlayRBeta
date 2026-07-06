import { createContext, useContext, useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { normalizeRefs } from './refs.js';
import { syncNow, migrateIfNeeded } from './sync.js';

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
    const d = raw ? JSON.parse(raw) : emptyData();
    // Offline-first: guarantee the reference option lists exist (species, lures,
    // colors, etc.) even on a brand-new device, so the catch-flow pickers are
    // never empty before a cloud pull. Mirrors normalizeRefs() in the original.
    d.refs = normalizeRefs(d);
    return d;
  } catch {
    const d = emptyData();
    d.refs = normalizeRefs(d);
    return d;
  }
}

const DataContext = createContext(null);

export function DataProvider({ children }) {
  const [data, setData] = useState(loadLocal);
  // Whether a cloud session exists — set by App once auth resolves. Sync only
  // runs when signed in; offline-first means everything works without it.
  const signedInRef = useRef(false);
  const pushTimer = useRef(null);
  const syncingRef = useRef(false);
  // Always hold the latest data for async sync callbacks without re-binding.
  const dataRef = useRef(data);
  useEffect(() => { dataRef.current = data; }, [data]);

  // Persist to localStorage on every change (offline source of truth).
  useEffect(() => {
    try { localStorage.setItem(KEY, JSON.stringify(data)); } catch { /* quota */ }
  }, [data]);

  // Replace the whole data object (used after a cloud sync hydrates local).
  const replaceData = useCallback((next) => setData(next), []);

  // Run one full push+pull cycle and fold the merged result back into state.
  // Offline-first + safe: never throws into the UI, never blocks; if it fails
  // the local journal keeps working and the dirty flags stay set for retry.
  const runSync = useCallback(async () => {
    if (!signedInRef.current || !navigator.onLine) return false;
    if (syncingRef.current) return false;
    syncingRef.current = true;
    try {
      const merged = await syncNow(dataRef.current);
      if (merged) setData(merged);
      return true;
    } catch {
      /* transient / offline — local still authoritative */
      return false;
    } finally {
      syncingRef.current = false;
    }
  }, []);

  // Debounced push — call after a mutation without hammering the network.
  // Mirrors the original FishSync.scheduleSync().
  const scheduleSync = useCallback((ms = 2000) => {
    if (!signedInRef.current) return;
    clearTimeout(pushTimer.current);
    pushTimer.current = setTimeout(runSync, ms);
  }, [runSync]);

  // Merge a partial update and re-render, then schedule a background push so
  // local edits reach the cloud. Accepts an object or updater fn, like setState.
  const update = useCallback((patch) => {
    setData((prev) => {
      const next = typeof patch === 'function' ? patch(prev) : { ...prev, ...patch };
      dataRef.current = next; // keep async-sync ref fresh in the same tick
      return next;
    });
    scheduleSync();
  }, [scheduleSync]);

  // Update profile-synced fields (loadouts, trip templates, refs, sound, mode,
  // active season) and flag the profile dirty so the next push includes it.
  // Mirrors the original's touchProfile() being called alongside these edits.
  const updateProfile = useCallback((patch) => {
    setData((prev) => {
      const merged = typeof patch === 'function' ? patch(prev) : { ...prev, ...patch };
      const next = { ...merged, _profileDirty: true, _profileUpdatedAt: new Date().toISOString() };
      // Update the async-sync ref SYNCHRONOUSLY here, not only in the deferred
      // effect. Callers (e.g. Tournament pick/join) fire runSync() in the same
      // tick as this update; without this, syncNow reads the pre-update dataRef
      // and pushes a stale profile (e.g. teamId still null), which the next pull
      // then writes back — bouncing the user out of the dashboard.
      dataRef.current = next;
      return next;
    });
    scheduleSync();
  }, [scheduleSync]);

  // Called by App when auth state settles. On first sign-in this seeds the
  // server from an existing local device (migrateIfNeeded) then runs a sync.
  const setSignedIn = useCallback(async (isIn) => {
    signedInRef.current = isIn;
    if (!isIn) return;
    try {
      const seeded = await migrateIfNeeded(dataRef.current);
      if (seeded) setData(seeded); // dirty flags set → next sync pushes it all up
    } catch { /* ignore; a normal sync still runs below */ }
    runSync();
  }, [runSync]);

  // Safety nets that mirror the original: sync when the network returns, and a
  // periodic top-up while the app is open.
  useEffect(() => {
    const onOnline = () => runSync();
    window.addEventListener('online', onOnline);
    const id = setInterval(() => { if (navigator.onLine) runSync(); }, 60000);
    return () => { window.removeEventListener('online', onOnline); clearInterval(id); };
  }, [runSync]);

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

  const value = useMemo(
    () => ({ data, update, updateProfile, replaceData, setSignedIn, scheduleSync, runSync, ...selectors }),
    [data, update, updateProfile, replaceData, setSignedIn, scheduleSync, runSync, selectors]
  );

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export function useData() {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error('useData must be used inside <DataProvider>');
  return ctx;
}
