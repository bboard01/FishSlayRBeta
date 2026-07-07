// Waters "Passport" engine — ported 1:1 from the single-file app's Waters Atlas
// (waterScopeSessions / waterStatsFor / allWaterStats / selectedWaterStats and
// the passport copy helpers). Pure functions over the journal + a `waterState`
// filter object, so the React screen holds waterState in component state.
//
// Shared enrichment/bucketing/confidence come from intelligence.js; a few small
// internals (avgFor, biggest, grouping, session helpers) are defined locally to
// match the originals exactly.

import { esc } from './fishDisplay.js';
import { sessionHours } from './seasons.js';
import {
  allCatchesEnriched, waterTypeForSession, tripWeightedConfidence, bestGroup,
  uniqSorted, sampleLabel,
} from './intelligence.js';

function groupCount(arr, fn) {
  return arr.reduce((a, x) => { const k = fn(x) || 'Unknown'; a[k] = (a[k] || 0) + 1; return a; }, {});
}
function topEntries(o, n = 6) {
  return Object.entries(o).sort((a, b) => b[1] - a[1]).slice(0, n);
}
function avgFor(items) {
  return items.length ? (items.reduce((a, x) => a + (+x.length || 0), 0) / items.length).toFixed(1) : '0.0';
}
function biggest(c) {
  return c.slice().sort((a, b) => (+b.length || 0) - (+a.length || 0))[0];
}
function sessionFor(data, id) { return data.sessions.find((s) => s.id === id) || {}; }
function uniqueSessionsFromCatches(data, c) {
  return Array.from(new Set(c.map((x) => x.sessionId).filter(Boolean)))
    .map((id) => sessionFor(data, id)).filter((s) => s && s.id);
}

export const DEFAULT_WATER_STATE = { scope: 'currentSeason', type: 'All', sort: 'efficiency', selected: null };

export function waterIconForType(type) {
  type = String(type || '').toLowerCase();
  if (type.includes('lake')) return '🏞️';
  if (type.includes('creek') || type.includes('stream')) return '🌿';
  if (type.includes('reservoir') || type.includes('pond')) return '💧';
  return '🌊';
}

export function waterCoverClass(type) {
  type = String(type || '').toLowerCase();
  if (type.includes('lake')) return 'lake';
  if (type.includes('creek') || type.includes('stream')) return 'creek';
  return 'river';
}

// --- scope selection (waterScopeSessions / waterScopeCatches) ---
function waterScopeSessions(data, waterState) {
  let sessions = data.sessions.slice();
  if (waterState.scope !== 'all') sessions = sessions.filter((s) => s.season === data.activeSeason);
  if (waterState.type !== 'All') sessions = sessions.filter((s) => waterTypeForSession(s) === waterState.type);
  return sessions;
}
function waterScopeCatches(data, waterState) {
  const ids = new Set(waterScopeSessions(data, waterState).map((s) => s.id));
  return allCatchesEnriched(data).filter((c) => ids.has(c.sessionId));
}
function waterNamesInScope(data, waterState) {
  const names = new Set();
  waterScopeSessions(data, waterState).forEach((s) => { if (s.water) names.add(s.water); });
  waterScopeCatches(data, waterState).forEach((c) => { if (c._water) names.add(c._water); });
  return Array.from(names);
}

// --- per-water rollup (waterStatsFor) ---
export function waterStatsFor(data, waterState, name) {
  const sessions = waterScopeSessions(data, waterState).filter((s) => s.water === name);
  const ids = new Set(sessions.map((s) => s.id));
  const scopeCatches = waterScopeCatches(data, waterState);
  const catches = scopeCatches.filter((c) => c._water === name || ids.has(c.sessionId));
  const productive = uniqueSessionsFromCatches(data, catches);
  const hours = sessions.reduce((a, s) => a + sessionHours(s), 0);
  const trips = sessions.length || productive.length;
  const productiveTrips = productive.length;
  const fish = catches.length;
  const best = biggest(catches) || {};
  const type = waterTypeForSession(sessions[0] || sessionFor(data, best.sessionId) || {});
  const fpt = trips ? fish / trips : 0;
  const fph = hours ? fish / hours : 0;
  const success = trips ? Math.round((productiveTrips / trips) * 100) : 0;
  const confidence = tripWeightedConfidence(fish, Math.max(1, scopeCatches.length), productiveTrips, Math.max(1, waterScopeSessions(data, waterState).length));
  return {
    name, sessions, catches, productive, trips, productiveTrips, hours, fish, best, type,
    fpt, fph, success, confidence, avg: avgFor(catches),
    topSpecies: bestGroup(catches, (x) => x.species),
    topLure: bestGroup(catches, (x) => x.lure),
    topColor: bestGroup(catches, (x) => x.color),
    topWeather: bestGroup(catches, (x) => x._weather),
    topClarity: bestGroup(catches, (x) => x._clarity),
    topMethod: bestGroup(catches, (x) => x._method),
    topMonth: bestGroup(catches, (x) => x._month),
    topTemp: bestGroup(catches, (x) => x._tempBucket),
  };
}

export function allWaterStats(data, waterState) {
  let stats = waterNamesInScope(data, waterState).map((n) => waterStatsFor(data, waterState, n));
  if (waterState.sort === 'fish') stats.sort((a, b) => b.fish - a.fish);
  else if (waterState.sort === 'best') stats.sort((a, b) => (+b.best.length || 0) - (+a.best.length || 0));
  else if (waterState.sort === 'recent') stats.sort((a, b) => String((b.sessions[0] || {}).date || '').localeCompare(String((a.sessions[0] || {}).date || '')));
  else stats.sort((a, b) => (b.fpt - a.fpt) || (b.fish - a.fish));
  return stats;
}

// Resolve the selected water, defaulting to the first. Returns { stats, selected,
// selectedName } — the component uses selectedName to keep waterState in sync.
export function selectedWaterStats(data, waterState) {
  const stats = allWaterStats(data, waterState);
  if (!stats.length) return { stats, selected: null, selectedName: null };
  let selectedName = waterState.selected;
  if (!selectedName || !stats.some((s) => s.name === selectedName)) selectedName = stats[0].name;
  return { stats, selected: stats.find((s) => s.name === selectedName) || stats[0], selectedName };
}

// Water-type options for the console dropdown.
export function waterTypeOptions(data) {
  return uniqSorted(data.sessions.map((x) => waterTypeForSession(x)));
}

// --- passport copy (waterPersona / waterMemoryLine) ---
export function waterPersona(s) {
  if (!s) return 'Uncharted Water';
  const t = String(s.type || '').toLowerCase();
  if (s.trips >= 5 && s.success >= 80) return t.includes('lake') ? 'Confidence Lake' : 'Home Water';
  if (s.fpt >= 15) return 'Numbers Water';
  if ((+s.best.length || 0) >= 30) return 'Big Fish Water';
  if (t.includes('creek') || t.includes('stream')) return 'Pocket Water';
  if (t.includes('lake')) return 'Open Water Chapter';
  return 'Current Classroom';
}

export function waterMemoryLine(s) {
  if (!s) return 'Start logging trips and this place will earn a story of its own.';
  const bait = `${s.topColor.label} ${s.topLure.label}`.trim();
  const sample = s.trips === 1 ? 'one chapter' : `${s.trips} chapters`;
  return `${esc(s.name)} feels like ${esc(waterPersona(s).toLowerCase())}. Across ${sample}, it has given back ${s.fish} fish, a best of ${esc(s.best.length || 0)} inches, and a pattern built around ${esc(bait)} for ${esc(s.topSpecies.label)}.`;
}

// Species discovered on a water (waterSpeciesShelf source data).
export function waterSpeciesEntries(s) {
  if (!s) return [];
  return topEntries(groupCount(s.catches, (x) => x.species), 10);
}

// Confidence label for the field journal (sampleLabel), re-exported for convenience.
export { sampleLabel };

// Non-deleted catches for a trip + its hours, for chapter cards.
export function tripChapterInfo(data, trip) {
  const c = data.catches.filter((x) => x.sessionId === trip.id && !x.deleted && !x.tournId);
  const b = biggest(c) || {};
  return { count: c.length, best: b.length || 0, hours: sessionHours(trip) };
}
