// FishSlayR — Tournament publish path (step 2 of 6)
// Offline-first, same discipline as sync.js: localStorage is truth, this mirrors
// a MINIMAL projection of a catch up to the tournament tables when signal allows.
//
// A catch published to a tournament carries only: species, length, caught_at, a
// thumbnail, and its local id. No notes, GPS, loadout, or journal text — those
// never leave the private `catches` table (the firewall).
//
// LIFECYCLE (per catch, tracked by the `tournStatus` field on the catch object):
//   undefined/absent  — not in a tournament (logged with no active tournament,
//                        or the per-catch toggle was turned off)
//   'pending'         — meant for the active tournament, not yet published
//                        (offline, or no team picked yet)
//   'published'       — projection row exists on the server; counts (if valid)
//   'invalidated'     — server rejected it (bass w/o photo, out of window, upload
//                        failed) OR owner voided it. The PERSONAL catch is kept
//                        untouched; only the tournament entry is dead.
//
// The active tournament lives on the profile object as:
//   data.activeTournament = { tournamentId, teamId } | null
// (rides the existing profiles-row sync, so it's consistent across devices.)

import { sb } from './supabase.js';

const TOURN_BUCKET = 'tournament-photos';

// The two species that score. Everything else (incl. the other five "bass"
// species) is Other-bucket — published but never scored (scoring lives in the
// leaderboard RPC; this set is only used for the client-side photo guard).
const SCORING_BASS = new Set(['Smallmouth Bass', 'Largemouth Bass']);
export function isScoringBass(species) { return SCORING_BASS.has(species); }

// base64 data URL -> Blob (the catch's photoThumb is a base64 JPEG data URL).
function dataURLtoBlob(dataURL) {
  const [head, body] = String(dataURL).split(',');
  const mime = (head.match(/:(.*?);/) || [])[1] || 'image/jpeg';
  const bin = atob(body || '');
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return new Blob([arr], { type: mime });
}

// A catch's caught_at: prefer the catch's own timestamp fields, fall back to
// updated_at. Sessions carry the trip date; the catch carries time. We use the
// most specific stamp available so the leaderboard's in-window check is right.
function caughtAtISO(c, session) {
  // photoMeta.ts (capture ms) is the most precise if present
  if (c.photoMeta && c.photoMeta.ts) return new Date(c.photoMeta.ts).toISOString();
  // else compose from the session date + catch time if both exist
  if (session && session.date && c.time) {
    const iso = new Date(`${session.date}T${c.time}:00`);
    if (!isNaN(iso)) return iso.toISOString();
  }
  return c.updated_at || new Date().toISOString();
}

// Does this catch want to be in the active tournament right now?
// Auto-publish is the default; the per-catch toggle sets tournOptOut = true to
// skip. A catch already published or invalidated is not re-queued.
export function shouldPublish(c, activeTournament) {
  if (!activeTournament || !activeTournament.tournamentId) return false;
  if (c.deleted) return false;
  if (c.tournOptOut) return false;               // user toggled it off
  if (c.tournStatus === 'published') return false;
  if (c.tournStatus === 'invalidated') return false;
  return true; // 'pending' or freshly logged with an active tournament
}

// Publish ONE catch's projection. Returns a verdict the caller applies to the
// local catch object. Never throws — always resolves to a verdict.
//   { status:'published' } | { status:'pending' } | { status:'invalidated', reason }
async function publishOne(c, activeTournament, session, userId) {
  const { tournamentId, teamId } = activeTournament;

  // No team chosen yet (teamless join state) — keep it pending, try again later.
  if (!teamId) return { status: 'pending' };

  const scoringBass = isScoringBass(c.species);

  // Client-side bass-photo guard (mirrors the server trigger). A scored bass with
  // no thumbnail can never satisfy the server, so invalidate it up front with a
  // clear reason rather than round-tripping to a guaranteed rejection.
  if (scoringBass && !c.photoThumb) {
    return { status: 'invalidated', reason: 'Bass entry needs a photo — not counted.' };
  }

  // Upload the thumbnail (reusing the existing 640px photoThumb) if present.
  let photoPath = null;
  if (c.photoThumb) {
    try {
      const blob = dataURLtoBlob(c.photoThumb);
      photoPath = `${tournamentId}/${c.id}.jpg`;
      const { error: upErr } = await sb.storage.from(TOURN_BUCKET)
        .upload(photoPath, blob, { upsert: true, contentType: 'image/jpeg' });
      if (upErr) {
        // Upload failed. For a scored bass, a missing photo = invalid entry.
        // For non-bass (Other bucket), publish without a photo rather than lose
        // the entry.
        if (scoringBass) {
          return { status: 'invalidated', reason: 'Photo upload failed — bass not counted.' };
        }
        photoPath = null;
      }
    } catch (e) {
      if (scoringBass) return { status: 'invalidated', reason: 'Photo error — bass not counted.' };
      photoPath = null;
    }
  }

  // Insert the projection row. The unique (tournament_id, client_catch_id) makes
  // re-publishing idempotent; on a duplicate we treat it as already published.
  const row = {
    tournament_id: tournamentId,
    team_id: teamId,
    user_id: userId,
    species: c.species,
    length: +c.length || 0,
    caught_at: caughtAtISO(c, session),
    photo_url: photoPath,
    client_catch_id: c.id,
  };
  const { error } = await sb.from('tournament_catches').insert(row);

  if (!error) return { status: 'published' };

  // Duplicate key = it's already up there. Treat as published (idempotent).
  if (error.code === '23505' || /duplicate key/i.test(error.message || '')) {
    return { status: 'published' };
  }
  // The server bass-photo trigger rejected it.
  if (/BASS_PHOTO_REQUIRED/.test(error.message || '')) {
    return { status: 'invalidated', reason: 'Bass entry needs a photo — not counted.' };
  }
  // RLS / not-a-member / other. Keep pending and retry next cycle (could be a
  // transient membership-not-synced-yet race). We DON'T invalidate on unknown
  // errors, so a blip never silently kills a legit entry.
  console.warn('[tournament] publish failed, will retry', c.id, error);
  return { status: 'pending' };
}

// Flush all publishable catches for the active tournament. Mutates each catch's
// tournStatus/tournReason in place (matching sync.js's dirty-flag pattern) and
// returns a summary. The caller (syncNow) persists the mutated catches.
export async function flushTournament(data, userId) {
  const active = data.activeTournament;
  if (!active || !active.tournamentId) return { published: 0, pending: 0, invalidated: 0 };

  const sessionById = new Map((data.sessions || []).map((s) => [s.id, s]));
  let published = 0, pending = 0, invalidated = 0;

  for (const c of data.catches || []) {
    if (!shouldPublish(c, active)) continue;
    const session = sessionById.get(c.sessionId) || {};
    const verdict = await publishOne(c, active, session, userId);
    c.tournStatus = verdict.status;
    if (verdict.reason) c.tournReason = verdict.reason; else delete c.tournReason;
    if (verdict.status === 'published') published++;
    else if (verdict.status === 'invalidated') invalidated++;
    else pending++;
  }
  return { published, pending, invalidated };
}

// ===========================================================================
// DOCK-MODE OPERATIONS (host / join / teams) — used by Tournament.jsx (step 3a).
// All read the current user via getSession() (a local read, no network hang).
// ===========================================================================

async function currentUserId() {
  const { data } = await sb.auth.getSession();
  return data.session?.user?.id || null;
}

// A friendly display name from the signed-in identity (Google full_name, else the
// email local-part, else 'Angler'). Stored on the membership row for the roster
// and leaderboard "by" labels.
async function currentAnglerName() {
  const { data } = await sb.auth.getSession();
  const u = data.session?.user;
  if (!u) return '';
  return (u.user_metadata && (u.user_metadata.full_name || u.user_metadata.name))
    || (u.email ? u.email.split('@')[0] : '') || 'Angler';
}

// A short, unambiguous join code (no confusable chars).
function makeJoinCode() {
  const alphabet = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // no I,L,O,0,1
  let s = '';
  for (let i = 0; i < 6; i++) s += alphabet[Math.floor(Math.random() * alphabet.length)];
  return s;
}

// HOST: create a tournament; the caller becomes owner and is auto-joined (so a
// host who also fishes is a member; a host who doesn't can still view via
// owner rights). Returns { tournament } or { error }.
export async function hostTournament({ name, startsAt, endsAt }) {
  const uid = await currentUserId();
  if (!uid) return { error: 'You need to sign in first.' };
  // retry a couple of times on the (rare) join_code collision
  for (let attempt = 0; attempt < 4; attempt++) {
    const code = makeJoinCode();
    const { data: t, error } = await sb.from('tournaments').insert({
      name: name.trim(), owner_id: uid,
      starts_at: startsAt, ends_at: endsAt, join_code: code, status: 'live',
    }).select().single();
    if (!error) {
      // auto-join the host into their own tournament (teamless)
      const anglerName = await currentAnglerName();
      await sb.from('team_members').insert({ tournament_id: t.id, user_id: uid, angler_name: anglerName });
      return { tournament: t };
    }
    if (!/join_code/.test(error.message || '')) return { error: error.message };
  }
  return { error: 'Could not generate a unique join code — try again.' };
}

// JOIN: resolve a code -> membership row (teamless). Returns { tournament } or
// { error }. The angler picks/creates a team next (pickTeam / createTeam).
export async function joinByCode(code) {
  const uid = await currentUserId();
  if (!uid) return { error: 'You need to sign in first.' };
  const clean = String(code || '').trim().toUpperCase();
  if (!clean) return { error: 'Enter a join code.' };
  const { data: rows, error } = await sb.rpc('find_tournament_by_code', { code: clean });
  if (error) return { error: error.message };
  const t = rows && rows[0];
  if (!t) return { error: 'No tournament with that code.' };
  const anglerName = await currentAnglerName();
  const { error: jErr } = await sb.from('team_members')
    .insert({ tournament_id: t.id, user_id: uid, angler_name: anglerName });
  // already a member is fine — just proceed
  if (jErr && !/duplicate key/i.test(jErr.message || '')) return { error: jErr.message };
  return { tournament: t };
}

// List the teams in a tournament (for the "pick your team" screen).
export async function listTeams(tournamentId) {
  const { data, error } = await sb.from('teams')
    .select('id, name, captain_id').eq('tournament_id', tournamentId).order('name');
  if (error) return { error: error.message, teams: [] };
  return { teams: data || [] };
}

// CREATE a team (caller becomes captain) and join it.
export async function createTeam(tournamentId, teamName) {
  const uid = await currentUserId();
  if (!uid) return { error: 'You need to sign in first.' };
  const name = String(teamName || '').trim();
  if (!name) return { error: 'Name your team.' };
  const { data: team, error } = await sb.from('teams')
    .insert({ tournament_id: tournamentId, name, captain_id: uid }).select().single();
  if (error) {
    if (/duplicate key/i.test(error.message || '')) return { error: 'That team name is taken.' };
    return { error: error.message };
  }
  const { error: uErr } = await sb.from('team_members')
    .update({ team_id: team.id }).eq('tournament_id', tournamentId).eq('user_id', uid);
  if (uErr) return { error: uErr.message };
  return { team };
}

// PICK an existing team.
export async function pickTeam(tournamentId, teamId) {
  const uid = await currentUserId();
  if (!uid) return { error: 'You need to sign in first.' };
  const { error } = await sb.from('team_members')
    .update({ team_id: teamId }).eq('tournament_id', tournamentId).eq('user_id', uid);
  if (error) return { error: error.message };
  return { ok: true };
}

// LEAVE a tournament (delete own membership row). Published catches stay on the
// server; the local activeTournament is cleared by the caller.
export async function leaveTournament(tournamentId) {
  const uid = await currentUserId();
  if (!uid) return { error: 'You need to sign in first.' };
  const { error } = await sb.from('team_members')
    .delete().eq('tournament_id', tournamentId).eq('user_id', uid);
  if (error) return { error: error.message };
  return { ok: true };
}

// The tournaments this user belongs to (for the "past / current" list).
export async function myTournaments() {
  const uid = await currentUserId();
  if (!uid) return { tournaments: [] };
  const { data: mems } = await sb.from('team_members')
    .select('tournament_id, team_id').eq('user_id', uid);
  if (!mems || !mems.length) return { tournaments: [] };
  const ids = mems.map((m) => m.tournament_id);
  const { data: ts } = await sb.from('tournaments')
    .select('id, name, status, starts_at, ends_at, owner_id, join_code').in('id', ids);
  const teamByT = Object.fromEntries(mems.map((m) => [m.tournament_id, m.team_id]));
  return { tournaments: (ts || []).map((t) => ({ ...t, myTeamId: teamByT[t.id] || null })) };
}

// ===========================================================================
// LEADERBOARD + HOST ADMIN (step 3b) — used by Tournament.jsx.
// ===========================================================================

const TOURN_BUCKET_NAME = 'tournament-photos';

// Fetch a tournament's meta (name, status, window, owner) — for the board header
// + deciding whether to show host tools.
export async function getTournament(tournamentId) {
  const { data, error } = await sb.from('tournaments')
    .select('id, name, status, starts_at, ends_at, owner_id, join_code')
    .eq('id', tournamentId).maybeSingle();
  if (error) return { error: error.message };
  return { tournament: data };
}

// The ranked board (RPC). Returns [{ team_id, team_name, score, bass_count,
// bass_lengths, rank }] ordered by rank. Members and the owner can call it.
export async function fetchLeaderboard(tournamentId) {
  const { data, error } = await sb.rpc('tournament_leaderboard', { t: tournamentId });
  if (error) return { error: error.message, rows: [] };
  return { rows: data || [] };
}

// All catches in the tournament (for expandable per-team detail + thumbnails).
// RLS lets any member/owner read them. Sorted longest-first.
export async function fetchTournamentCatches(tournamentId) {
  const { data, error } = await sb.from('tournament_catches')
    .select('id, team_id, user_id, species, length, caught_at, photo_url, invalidated, invalidated_reason, client_catch_id')
    .eq('tournament_id', tournamentId)
    .order('length', { ascending: false });
  if (error) return { error: error.message, catches: [] };
  return { catches: data || [] };
}

// The roster (host "remove member" + angler names).
export async function fetchRoster(tournamentId) {
  const { data, error } = await sb.from('team_members')
    .select('user_id, team_id, angler_name').eq('tournament_id', tournamentId);
  if (error) return { error: error.message, members: [] };
  return { members: data || [] };
}

// Short-lived signed URLs for a batch of thumbnail paths (private bucket).
// Returns { path -> url }; failed paths are skipped.
export async function signThumbUrls(paths) {
  const clean = [...new Set((paths || []).filter(Boolean))];
  if (!clean.length) return {};
  const { data, error } = await sb.storage.from(TOURN_BUCKET_NAME).createSignedUrls(clean, 3600);
  if (error || !data) return {};
  const map = {};
  for (const item of data) if (item.signedUrl && !item.error) map[item.path] = item.signedUrl;
  return map;
}

// --- HOST ADMIN (owner only; RLS also enforces server-side) ---

export async function closeTournament(tournamentId) {
  const { error } = await sb.from('tournaments').update({ status: 'closed' }).eq('id', tournamentId);
  return error ? { error: error.message } : { ok: true };
}
export async function invalidateCatch(catchRowId, reason) {
  const { error } = await sb.from('tournament_catches')
    .update({ invalidated: true, invalidated_reason: reason || 'Voided by tournament host — not counted.' })
    .eq('id', catchRowId);
  return error ? { error: error.message } : { ok: true };
}
export async function revalidateCatch(catchRowId) {
  const { error } = await sb.from('tournament_catches')
    .update({ invalidated: false, invalidated_reason: null }).eq('id', catchRowId);
  return error ? { error: error.message } : { ok: true };
}
export async function removeMember(tournamentId, userId) {
  const { error } = await sb.from('team_members')
    .delete().eq('tournament_id', tournamentId).eq('user_id', userId);
  return error ? { error: error.message } : { ok: true };
}
export async function removeTeam(teamId) {
  const { error } = await sb.from('teams').delete().eq('id', teamId);
  return error ? { error: error.message } : { ok: true };
}

export async function reconcileTournament(data) {
  const active = data.activeTournament;
  if (!active || !active.tournamentId) return { reconciled: 0 };

  const { data: rows, error } = await sb
    .from('tournament_catches')
    .select('client_catch_id, invalidated, invalidated_reason')
    .eq('tournament_id', active.tournamentId)
    .eq('user_id', (await sb.auth.getSession()).data.session?.user?.id || '');
  if (error || !rows) return { reconciled: 0 };

  const byLocal = new Map(rows.map((r) => [r.client_catch_id, r]));
  let reconciled = 0;
  for (const c of data.catches || []) {
    const r = byLocal.get(c.id);
    if (!r) continue;
    if (r.invalidated && c.tournStatus !== 'invalidated') {
      c.tournStatus = 'invalidated';
      c.tournReason = r.invalidated_reason || 'Voided by tournament host — not counted.';
      reconciled++;
    } else if (!r.invalidated && c.tournStatus !== 'published') {
      c.tournStatus = 'published';
      delete c.tournReason;
      reconciled++;
    }
  }
  return { reconciled };
}
