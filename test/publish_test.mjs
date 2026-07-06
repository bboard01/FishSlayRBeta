/**
 * FishSlayR — Tournament publish-path test (step 2)
 *
 * Exercises the real publish lifecycle against your live Supabase project,
 * proving:
 *   1) bass WITH photo         -> published, scores on the leaderboard
 *   2) bass WITHOUT photo      -> invalidated locally, never hits server
 *   3) non-bass (Walleye)      -> published to the Other bucket (no photo needed)
 *   4) owner invalidates a row -> reconcile flips local status to invalidated
 *   5) re-publish is idempotent (no duplicate rows / no double count)
 *
 * This imports the ACTUAL src/lib/tournament.js so the tested code is the
 * shipped code. Run from the repo root after step-1 SQL is applied.
 *
 * Usage (PowerShell): set the same env vars as the firewall test, then:
 *   node test/publish_test.mjs
 *
 * Requires: A_EMAIL/A_PASS (publisher), B_EMAIL/B_PASS (owner+rival),
 *           SUPABASE_URL, SUPABASE_ANON_KEY.
 */
import { createClient } from '@supabase/supabase-js';
import { flushTournament, reconcileTournament, isScoringBass } from '../src/lib/tournament.js';

const URL = process.env.SUPABASE_URL;
const KEY = process.env.SUPABASE_ANON_KEY;
const A = { email: process.env.A_EMAIL, password: process.env.A_PASS };
const B = { email: process.env.B_EMAIL, password: process.env.B_PASS };
if (!URL || !KEY || !A.email || !B.email) { console.error('Missing env (see header).'); process.exit(1); }

// tournament.js imports the shared client from ./supabase.js, which reads these.
// We log that same shared client in as user A (the publisher).
const { sb } = await import('../src/lib/supabase.js');

const pass = (m) => console.log('  \x1b[32mPASS\x1b[0m ' + m);
const fail = (m) => { console.log('  \x1b[31mFAIL\x1b[0m ' + m); process.exitCode = 1; };

// tiny 1x1 base64 JPEG data URL to stand in for a real photoThumb
const TINY_JPEG = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=';

console.log('\n=== Tournament publish-path test (step 2) ===\n');

// --- log in as A (publisher) on the SHARED client tournament.js uses ---
{ const { error } = await sb.auth.signInWithPassword(A); if (error) { fail('A login: ' + error.message); process.exit(1); } }
const aId = (await sb.auth.getUser()).data.user.id;

// --- owner (B) sets up a tournament on a SEPARATE client ---
const owner = createClient(URL, KEY, { auth: { persistSession: false } });
{ const { error } = await owner.auth.signInWithPassword(B); if (error) { fail('B login: ' + error.message); process.exit(1); } }
const bId = (await owner.auth.getUser()).data.user.id;

const code = 'PUB-' + Math.random().toString(36).slice(2, 7).toUpperCase();
const now = new Date();
const { data: tourn, error: te } = await owner.from('tournaments').insert({
  name: 'Publish Test', owner_id: bId,
  starts_at: new Date(now.getTime() - 3600e3).toISOString(),
  ends_at: new Date(now.getTime() + 7 * 864e5).toISOString(),
  join_code: code,
}).select().single();
if (te) { fail('owner create tournament: ' + te.message); process.exit(1); }
const T = tourn.id;

// A joins + makes a team (via the shared client, as the app would)
await sb.from('team_members').insert({ tournament_id: T, user_id: aId, angler_name: 'A' });
const { data: teamA } = await sb.from('teams')
  .insert({ tournament_id: T, name: 'Team A', captain_id: aId }).select().single();
await sb.from('team_members').update({ team_id: teamA.id }).eq('tournament_id', T).eq('user_id', aId);
pass('setup: tournament + Team A ready');

// helper: build a fake local `data` object like the app's
function makeData(catches) {
  return {
    activeTournament: { tournamentId: T, teamId: teamA.id },
    sessions: [{ id: 'sess1', date: now.toISOString().slice(0, 10) }],
    catches,
  };
}

// sanity: the scoring set
(isScoringBass('Largemouth Bass') && isScoringBass('Smallmouth Bass')
  && !isScoringBass('Rock Bass') && !isScoringBass('Walleye'))
  ? pass('scoring-bass set is exactly Small/Largemouth')
  : fail('scoring-bass set wrong');

// --- run the real flush over three catches ---
// caught_at is taken from photoMeta.ts first (see caughtAtISO), so we stamp each
// at "now" to keep them unambiguously inside the tournament window regardless of
// timezone or what hour the test runs.
const T_NOW = Date.now();
const catches = [
  { id: 'c-bass-photo',   sessionId: 'sess1', species: 'Largemouth Bass', length: 20.5, photoMeta: { ts: T_NOW }, photoThumb: TINY_JPEG, tournId: T },
  { id: 'c-bass-nophoto', sessionId: 'sess1', species: 'Smallmouth Bass', length: 18.0, photoMeta: { ts: T_NOW }, tournId: T /* no photo */ },
  { id: 'c-walleye',      sessionId: 'sess1', species: 'Walleye',        length: 24.0, photoMeta: { ts: T_NOW }, tournId: T /* Other */ },
  // A pre-existing journal catch with NO tournId stamp must NOT publish, even
  // though a tournament is active. This is the water-mode "whole journal swept
  // onto the board" regression guard.
  { id: 'c-unstamped',    sessionId: 'sess1', species: 'Largemouth Bass', length: 19.0, photoMeta: { ts: T_NOW }, photoThumb: TINY_JPEG /* no tournId */ },
];
const data = makeData(catches);
const summary = await flushTournament(data, aId);
console.log('    flush summary ->', JSON.stringify(summary));

const byId = Object.fromEntries(data.catches.map((c) => [c.id, c]));
(byId['c-bass-photo'].tournStatus === 'published')
  ? pass('(1) bass WITH photo -> published') : fail('(1) bass+photo status: ' + byId['c-bass-photo'].tournStatus);
(byId['c-bass-nophoto'].tournStatus === 'invalidated' && /photo/i.test(byId['c-bass-nophoto'].tournReason || ''))
  ? pass('(2) bass WITHOUT photo -> invalidated locally') : fail('(2) bass-nophoto status: ' + byId['c-bass-nophoto'].tournStatus);
(byId['c-walleye'].tournStatus === 'published')
  ? pass('(3) non-bass Walleye -> published (Other bucket)') : fail('(3) walleye status: ' + byId['c-walleye'].tournStatus);
(byId['c-unstamped'].tournStatus === undefined)
  ? pass('(3b) un-stamped journal catch -> skipped (not swept onto board)')
  : fail('(3b) unstamped catch should be skipped, got: ' + byId['c-unstamped'].tournStatus);

// leaderboard: only the 20.5 bass should score (walleye is Other)
const { data: lb } = await owner.rpc('tournament_leaderboard', { t: T });
(lb && lb[0] && Number(lb[0].score) === 20.5)
  ? pass('(1b) leaderboard scores only the bass (20.5)') : fail('(1b) leaderboard: ' + JSON.stringify(lb));

// --- (5) idempotent re-publish: flush again, no new rows, still published ---
data.catches.forEach((c) => { if (c.tournStatus === 'published') c.tournStatus = 'pending'; }); // force re-attempt
await flushTournament(data, aId);
const { count } = await owner.from('tournament_catches')
  .select('*', { count: 'exact', head: true }).eq('tournament_id', T);
(count === 2) // the published bass + the walleye; the no-photo bass never landed
  ? pass('(5) re-publish idempotent (still 2 server rows)') : fail('(5) row count after re-publish: ' + count);

// --- (4) owner invalidates the bass; reconcile flips local status ---
await owner.from('tournament_catches')
  .update({ invalidated: true, invalidated_reason: 'Mismeasured — host voided.' })
  .eq('tournament_id', T).eq('client_catch_id', 'c-bass-photo');
byId['c-bass-photo'].tournStatus = 'published'; // pretend we didn't know yet
await reconcileTournament(data);
(byId['c-bass-photo'].tournStatus === 'invalidated' && /void/i.test(byId['c-bass-photo'].tournReason || ''))
  ? pass('(4) owner invalidation -> reconciled to invalidated locally')
  : fail('(4) after reconcile: ' + byId['c-bass-photo'].tournStatus + ' / ' + byId['c-bass-photo'].tournReason);

// leaderboard now excludes the voided bass -> score 0
const { data: lb2 } = await owner.rpc('tournament_leaderboard', { t: T });
(lb2 && lb2[0] && Number(lb2[0].score) === 0)
  ? pass('(4b) voided bass no longer scores (0)') : fail('(4b) leaderboard after void: ' + JSON.stringify(lb2));

// --- cleanup ---
await owner.from('tournaments').delete().eq('id', T);
console.log('\n(cleaned up test tournament)\n');
console.log(process.exitCode ? '\x1b[31mSOME CHECKS FAILED\x1b[0m\n' : '\x1b[32mALL CHECKS PASSED\x1b[0m\n');
process.exit(process.exitCode || 0);
