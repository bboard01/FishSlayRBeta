import { sb } from './supabase.js';

const LAST_PULL_KEY = 'fishslayr.lastPull';

// Re-attach sync columns onto the stored jsonb payload.
function rowToLocal(row) {
  return Object.assign({}, row.data, { updated_at: row.updated_at, deleted: row.deleted });
}

// Merge incoming rows into a local array by id, last-write-wins on updated_at.
// Remote tombstones (deleted:true) drop the local row.
function mergeArray(localArr, rows, keyField) {
  const arr = localArr.slice();
  for (const row of rows || []) {
    const incoming = rowToLocal(row);
    const idx = arr.findIndex((x) => x[keyField] === incoming[keyField]);
    if (incoming.deleted) {
      if (idx >= 0) arr.splice(idx, 1);
    } else if (idx < 0) {
      arr.push(incoming);
    } else if ((incoming.updated_at || '') > (arr[idx].updated_at || '')) {
      arr[idx] = incoming;
    }
  }
  return arr;
}

// Pull newer records from cloud and hand back a merged data object.
// Offline-first: this is called only when online + signed in, and it merges
// into whatever is already local rather than replacing it.
export async function pullFromCloud(currentData) {
  const { data: auth } = await sb.auth.getUser();
  if (!auth || !auth.user) return null; // not signed in — nothing to pull

  const since = localStorage.getItem(LAST_PULL_KEY) || '1970-01-01T00:00:00.000Z';
  const next = { ...currentData };

  // seasons
  {
    const { data: rows, error } = await sb.from('seasons').select('*').gt('updated_at', since);
    if (!error && rows) next.seasons = mergeArray(next.seasons || [], rows, 'id');
  }
  // sessions
  {
    const { data: rows, error } = await sb.from('sessions').select('*').gt('updated_at', since);
    if (!error && rows) next.sessions = mergeArray(next.sessions || [], rows, 'id');
  }
  // catches
  {
    const { data: rows, error } = await sb.from('catches').select('*').gt('updated_at', since);
    if (!error && rows) next.catches = mergeArray(next.catches || [], rows, 'id');
  }
  // profile (refs, sound, mode, active season, loadouts, templates)
  {
    const { data: rows, error } = await sb.from('profiles').select('*').limit(1);
    if (!error && rows && rows.length) {
      const p = rows[0];
      if ((p.updated_at || '') > since) {
        if (p.refs) next.refs = p.refs;
        if (p.sound) next.sound = p.sound;
        if (p.active_season) next.activeSeason = p.active_season;
        if (p.mode) next.mode = p.mode;
        if (p.loadouts) next.loadouts = p.loadouts;
        if (p.trip_templates) next.tripTemplates = p.trip_templates;
      }
    }
  }

  localStorage.setItem(LAST_PULL_KEY, new Date().toISOString());
  return next;
}
