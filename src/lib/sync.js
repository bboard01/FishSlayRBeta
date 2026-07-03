import { sb } from './supabase.js';
import { photoGet, photoPut } from './photos.js';

// Cloud sync engine — ported from the single-file app's FishSync IIFE.
// Offline-first: localStorage is the source of truth; this pushes local dirty
// records up and pulls newer remote records down, last-write-wins by updated_at.
// Soft-deletes propagate as `deleted:true` tombstones (never hard-delete locally,
// or the row just re-syncs back down from the server).

const LAST_PULL_KEY = 'fishslayr.lastPull';
const PHOTO_BUCKET = 'catch-photos';

function nowISO() { return new Date().toISOString(); }

// ---------------------------------------------------------------------------
// DIRTY TRACKING
// Call touch(record) whenever a record is created/edited/deleted. It stamps
// updated_at and marks the record dirty so the next push sends it. These mutate
// in place, matching the original; the React data layer persists the change.
// ---------------------------------------------------------------------------
export function touch(rec) {
  if (!rec) return rec;
  rec.updated_at = nowISO();
  rec._dirty = true;
  return rec;
}

// Mark the singleton profile (refs/sound/mode/activeSeason/loadouts/templates)
// dirty on the data object.
export function touchProfile(data) {
  if (!data) return;
  data._profileDirty = true;
  data._profileUpdatedAt = nowISO();
}

export function markPhotoDirty(rec) {
  if (rec) rec._photoDirty = true;
}

// ---------------------------------------------------------------------------
// MAPPERS  (local record -> table row)
// The whole record goes into `data` (jsonb); a few columns are promoted for
// queries. Local-only sync flags are stripped from the payload.
// ---------------------------------------------------------------------------
function stripMeta(rec) {
  const { _dirty, _photoDirty, ...rest } = rec;
  return rest;
}
function seasonRow(s) {
  return { id: s.id, name: s.name ?? null, archived: !!s.archived,
           deleted: !!s.deleted, updated_at: s.updated_at || nowISO(), data: stripMeta(s) };
}
function sessionRow(s) {
  return { id: s.id, season: s.season ?? null, active: !!s.active,
           deleted: !!s.deleted, updated_at: s.updated_at || nowISO(), data: stripMeta(s) };
}
function catchRow(c) {
  return { id: c.id, session_id: c.sessionId ?? null, has_photo: !!c.hasPhoto,
           deleted: !!c.deleted, updated_at: c.updated_at || nowISO(), data: stripMeta(c) };
}

// ---------------------------------------------------------------------------
// PUSH
// Sends dirty records up. On success the dirty flag is cleared (mutated in
// place); on error it's kept so the next sync retries. Cleared flags are
// reported back so the React layer can persist the cleaned records.
// ---------------------------------------------------------------------------
async function pushTable(tableName, arr, mapFn) {
  const dirty = (arr || []).filter((r) => r._dirty);
  if (!dirty.length) return { pushed: 0 };
  const rows = dirty.map(mapFn);
  const { error } = await sb.from(tableName).upsert(rows);
  if (error) { console.warn(`[sync] push ${tableName} failed`, error); return { pushed: 0, error }; }
  dirty.forEach((r) => { delete r._dirty; });
  return { pushed: dirty.length };
}

async function pushProfile(data) {
  if (!data._profileDirty) return { pushed: 0 };
  const row = {
    version: data.version ?? null,
    mode: data.mode ?? null,
    active_season: data.activeSeason ?? null,
    sound: data.sound ?? null,
    refs: data.refs ?? null,
    journal: data.journal ?? null,
    loadouts: data.loadouts ?? null,
    trip_templates: data.tripTemplates ?? null,
    updated_at: data._profileUpdatedAt || nowISO(),
  };
  const { error } = await sb.from('profiles').upsert(row, { onConflict: 'user_id' });
  if (error) { console.warn('[sync] push profile failed', error); return { pushed: 0, error }; }
  delete data._profileDirty;
  return { pushed: 1 };
}

// Upload any dirty catch photos from IndexedDB -> Supabase Storage. On success
// the _photoDirty flag is cleared (mutated in place). Path: {userId}/{catchId}.jpg
async function pushPhotos(userId, catches) {
  const withPhotos = (catches || []).filter((c) => c.hasPhoto && c._photoDirty);
  for (const c of withPhotos) {
    try {
      const blob = await photoGet(c.id);
      if (!blob) { delete c._photoDirty; continue; }
      const path = `${userId}/${c.id}.jpg`;
      const { error } = await sb.storage.from(PHOTO_BUCKET)
        .upload(path, blob, { upsert: true, contentType: blob.type || 'image/jpeg' });
      if (error) { console.warn('[sync] photo upload failed', c.id, error); continue; }
      delete c._photoDirty; // confirmed
    } catch (e) { console.warn('[sync] photo push error', c.id, e); }
  }
}

// Pull any photos we're missing locally (has_photo on server, absent in IDB).
async function pullPhotos(userId, catches) {
  const needing = (catches || []).filter((c) => c.hasPhoto);
  for (const c of needing) {
    try {
      const existing = await photoGet(c.id);
      if (existing) continue;
      const path = `${userId}/${c.id}.jpg`;
      const { data: blob, error } = await sb.storage.from(PHOTO_BUCKET).download(path);
      if (error || !blob) continue;
      await photoPut(c.id, blob);
    } catch (e) { console.warn('[sync] photo pull error', c.id, e); }
  }
}

// ---------------------------------------------------------------------------
// PULL  (table row -> local record) — last-write-wins, tombstone-aware.
// ---------------------------------------------------------------------------
function rowToLocal(row, extra) {
  return Object.assign({}, row.data, { updated_at: row.updated_at, deleted: row.deleted }, extra || {});
}

function mergeArray(localArr, rows, keyField, extraFn) {
  const arr = localArr.slice();
  for (const row of rows || []) {
    const incoming = extraFn ? rowToLocal(row, extraFn(row)) : rowToLocal(row);
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

// ---------------------------------------------------------------------------
// ORCHESTRATION
// One full sync cycle: PUSH local dirty records first (so our edits aren't
// clobbered by an older pull marker), then PULL remote changes. Returns the
// merged data object (or null if signed out / nothing to do). Offline-first:
// the caller only invokes this when online + signed in, and always keeps local
// working if it throws.
// ---------------------------------------------------------------------------
export async function syncNow(currentData) {
  if (!navigator.onLine) return null;
  const { data: auth } = await sb.auth.getUser();
  if (!auth || !auth.user) return null; // signed out → local-only

  const data = { ...currentData };

  // PUSH — mutates the (copied) records to clear dirty flags on success.
  await pushProfile(data);
  await pushTable('seasons', data.seasons, seasonRow);
  await pushTable('sessions', data.sessions, sessionRow);
  await pushTable('catches', data.catches, catchRow);
  // Upload dirty catch photos to Supabase Storage (IndexedDB -> cloud).
  await pushPhotos(auth.user.id, data.catches);

  // PULL — merge newer remote rows since the last successful pull.
  const since = localStorage.getItem(LAST_PULL_KEY) || '1970-01-01T00:00:00.000Z';
  {
    const { data: rows, error } = await sb.from('seasons').select('*').gt('updated_at', since);
    if (!error && rows) data.seasons = mergeArray(data.seasons || [], rows, 'id');
  }
  {
    const { data: rows, error } = await sb.from('sessions').select('*').gt('updated_at', since);
    if (!error && rows) data.sessions = mergeArray(data.sessions || [], rows, 'id');
  }
  {
    const { data: rows, error } = await sb.from('catches').select('*').gt('updated_at', since);
    if (!error && rows) {
      data.catches = mergeArray(data.catches || [], rows, 'id',
        (r) => ({ sessionId: r.session_id, hasPhoto: r.has_photo }));
    }
  }
  // Download any photos present on the server but missing locally.
  await pullPhotos(auth.user.id, data.catches);
  {
    const { data: rows, error } = await sb.from('profiles').select('*').limit(1);
    if (!error && rows && rows.length) {
      const p = rows[0];
      if ((p.updated_at || '') > since) {
        if (p.refs) data.refs = p.refs;
        if (p.sound) data.sound = p.sound;
        if (p.journal) data.journal = p.journal;
        if (p.active_season) data.activeSeason = p.active_season;
        if (p.mode) data.mode = p.mode;
        if (p.loadouts) data.loadouts = p.loadouts;
        if (p.trip_templates) data.tripTemplates = p.trip_templates;
      }
    }
  }

  localStorage.setItem(LAST_PULL_KEY, nowISO());
  return data;
}

// ---------------------------------------------------------------------------
// ONE-TIME MIGRATION: seed the server from an existing local device the first
// time this device ever syncs (has local data but has never pulled before).
// Marks everything dirty so the first syncNow pushes the whole journal up.
// ---------------------------------------------------------------------------
export async function migrateIfNeeded(currentData) {
  if (localStorage.getItem(LAST_PULL_KEY)) return null; // already synced before
  const { data: auth } = await sb.auth.getUser();
  if (!auth || !auth.user) return null;
  const stamp = nowISO();
  const data = { ...currentData };
  (data.seasons || []).forEach((s) => { s.updated_at = stamp; s._dirty = true; });
  (data.sessions || []).forEach((s) => { s.updated_at = stamp; s._dirty = true; });
  (data.catches || []).forEach((c) => { c.updated_at = stamp; c._dirty = true; if (c.hasPhoto) c._photoDirty = true; });
  touchProfile(data);
  return data;
}

// Delete a catch's photo from cloud Storage via the Storage API (the supported
// way — direct SQL deletes from storage.objects are blocked by newer Supabase).
export async function deleteCloudPhoto(catchId) {
  try {
    const { data: auth } = await sb.auth.getUser();
    if (!auth || !auth.user) return;
    const path = `${auth.user.id}/${catchId}.jpg`;
    const { error } = await sb.storage.from(PHOTO_BUCKET).remove([path]);
    if (error) console.warn('[sync] cloud photo delete failed', catchId, error);
  } catch (e) { console.warn('[sync] cloud photo delete error', catchId, e); }
}
