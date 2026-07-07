// River Intelligence engine — ported 1:1 from the single-file app's
// trip-weighted intelligence (renderIntelligence + its helpers). Pure functions
// over the `data` journal plus an `intelState` filter object, so the React
// screen can hold intelState in component state and call these on each render.
//
// The single-file app kept `data` and `intelState` as globals; here they're
// passed in explicitly. Everything else (bucketing, enrichment, trip-weighted
// confidence, pattern stats) is carried over verbatim.

import { esc } from './fishDisplay.js';

// ---- small shared utils (mirror the originals) ----
function groupCount(arr, fn) {
  return arr.reduce((a, x) => { const k = fn(x) || 'Unknown'; a[k] = (a[k] || 0) + 1; return a; }, {});
}
function topEntries(o, n = 6) {
  return Object.entries(o).sort((a, b) => b[1] - a[1]).slice(0, n);
}
function biggest(c) {
  return c.slice().sort((a, b) => (+b.length || 0) - (+a.length || 0))[0];
}
function avgFor(items) {
  return items.length ? (items.reduce((a, x) => a + (+x.length || 0), 0) / items.length).toFixed(1) : '0.0';
}
export function bestGroup(items, fn) {
  const top = topEntries(groupCount(items, fn), 1)[0];
  return top ? { label: top[0], count: top[1] } : { label: 'Learning', count: 0 };
}
function uniq(arr) { return Array.from(new Set(arr.filter(Boolean))); }
export function uniqSorted(arr) {
  return uniq(arr).sort((a, b) => String(a).localeCompare(String(b)));
}

// ---- bucketing helpers (verbatim) ----
export function waterTypeForSession(s = {}) {
  const explicit = s.waterType || s.water_type || s.type; if (explicit) return explicit;
  const w = String(s.water || '').toLowerCase();
  if (w.includes('creek') || w.includes('breeches') || w.includes('conodoguinet') || w.includes('swatara') || w.includes('shermans')) return 'Creek';
  if (w.includes('river') || w.includes('susquehanna') || w.includes('juniata') || w.includes('st. lawrence') || w.includes('french river')) return 'River';
  if (w.includes('reservoir')) return 'Reservoir';
  if (w.includes('pond')) return 'Pond';
  if (w.includes('lake') || w.includes('lac ') || w.includes('georgian bay') || w.includes('woods') || w.includes('simcoe') || w.includes('nipissing')) return 'Lake';
  return 'Other Water';
}
function timeWindowForCatch(x) {
  const h = parseInt(String(x.time || '12').split(':')[0], 10);
  if (h < 6) return 'Pre-dawn';
  if (h < 9) return 'Sunrise';
  if (h < 12) return 'Morning';
  if (h < 15) return 'Midday';
  if (h < 18) return 'Afternoon';
  if (h < 21) return 'Evening';
  return 'Night';
}
function tempBucket(v) {
  const n = parseFloat(v);
  if (!isFinite(n)) return 'Temp Not Logged';
  if (n < 45) return 'Cold <45°';
  if (n < 55) return 'Cool 45–54°';
  if (n < 65) return 'Prime Cool 55–64°';
  if (n < 75) return 'Prime Warm 65–74°';
  if (n < 82) return 'Warm 75–81°';
  return 'Hot 82°+';
}
function monthLabel(dateStr) {
  const m = parseInt(String(dateStr || '').slice(5, 7), 10);
  return ['Unknown', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][m] || 'Unknown';
}
function calendarSeasonFromDate(dateStr) {
  const m = parseInt(String(dateStr || '').slice(5, 7), 10);
  if (!m) return 'Unknown Season';
  if ([3, 4, 5].includes(m)) return 'Spring';
  if ([6, 7, 8].includes(m)) return 'Summer';
  if ([9, 10, 11].includes(m)) return 'Fall';
  return 'Winter';
}

const minutesFromTime = (t) => {
  const m = String(t || '').match(/^(\d{1,2}):(\d{2})/);
  return m ? parseInt(m[1], 10) * 60 + parseInt(m[2], 10) : null;
};
function sessionHours(s) {
  const start = minutesFromTime(s?.start), end = minutesFromTime(s?.end);
  if (start == null || end == null) return 0;
  let mins = end - start; if (mins < 0) mins += 1440;
  return Math.max(0.25, mins / 60);
}

// ---- data access bound to a given journal ----
function sessionFor(data, id) { return data.sessions.find((s) => s.id === id) || {}; }
function activeSession(data) {
  const inSeason = data.sessions.filter((s) => s.season === data.activeSeason);
  return data.sessions.find((s) => s.active && s.season === data.activeSeason) || inSeason[0];
}
function uniqueSessionsFromCatches(data, c) {
  return uniq(c.map((x) => x.sessionId)).map((id) => sessionFor(data, id)).filter((s) => s && s.id);
}

// Enrich every (non-deleted) catch with its session context, mirroring
// allCatchesEnriched().
export function allCatchesEnriched(data) {
  // Tournament-only catches (tournId) are excluded from personal intelligence.
  return data.catches.filter((c) => !c.deleted && !c.tournId).map((c) => {
    const s = sessionFor(data, c.sessionId);
    return {
      ...c, _session: s, _water: s.water, _weather: s.weather, _clarity: s.clarity, _flow: s.flow,
      _seasonPhase: s.spawnPhase || calendarSeasonFromDate(s.date), _waterType: waterTypeForSession(s),
      _timeWindow: timeWindowForCatch(c), _tempBucket: tempBucket(s.waterTemp), _month: monthLabel(s.date),
      _season: s.season, _method: s.method,
      _partners: Array.isArray(s.partners) ? s.partners : (s.partners ? [s.partners] : []), _date: s.date,
    };
  });
}

export const DEFAULT_INTEL_STATE = { scope: 'currentSeason', water: 'All', species: 'All', partner: 'All', method: 'All', waterType: 'All' };

export function intelligenceScopeLabel(data, intelState) {
  if (intelState.scope === 'all') return 'All Time';
  if (intelState.scope === 'currentTrip') { const a = activeSession(data); return a?.title || a?.name || 'Current Trip'; }
  if (intelState.scope === 'currentSeason') return data.seasons.find((s) => s.id === data.activeSeason)?.name || 'Current Season';
  const season = data.seasons.find((s) => s.id === intelState.scope);
  return season ? season.name : 'Current Season';
}

export function baseIntelCatches(data, intelState) {
  let c = allCatchesEnriched(data);
  if (intelState.scope === 'currentTrip') c = c.filter((x) => x.sessionId === activeSession(data)?.id);
  else if (intelState.scope === 'currentSeason') c = c.filter((x) => x._season === data.activeSeason);
  else if (intelState.scope === 'all') { /* all */ }
  else c = c.filter((x) => x._season === intelState.scope);
  return c;
}

export function filteredIntelCatches(data, intelState) {
  let c = baseIntelCatches(data, intelState);
  if (intelState.water !== 'All') c = c.filter((x) => x._water === intelState.water);
  if (intelState.species !== 'All') c = c.filter((x) => x.species === intelState.species);
  if (intelState.method !== 'All') c = c.filter((x) => x._method === intelState.method);
  if (intelState.waterType !== 'All') c = c.filter((x) => x._waterType === intelState.waterType);
  if (intelState.partner !== 'All') c = c.filter((x) => x._partners.includes(intelState.partner));
  return c;
}

// Sessions matching the current scope+filters (for skunk/success math).
function scopeSessions(data, intelState) {
  let sessions = data.sessions.slice();
  if (intelState.scope === 'currentTrip') sessions = sessions.filter((s) => s.id === activeSession(data)?.id);
  else if (intelState.scope === 'currentSeason') sessions = sessions.filter((s) => s.season === data.activeSeason);
  else if (intelState.scope === 'all') { /* all */ }
  else sessions = sessions.filter((s) => s.season === intelState.scope);
  if (intelState.water !== 'All') sessions = sessions.filter((s) => s.water === intelState.water);
  if (intelState.method !== 'All') sessions = sessions.filter((s) => s.method === intelState.method);
  if (intelState.waterType !== 'All') sessions = sessions.filter((s) => waterTypeForSession(s) === intelState.waterType);
  if (intelState.partner !== 'All') sessions = sessions.filter((s) => (Array.isArray(s.partners) ? s.partners : (s.partners ? [s.partners] : [])).includes(intelState.partner));
  return sessions;
}

export function intelSummary(data, intelState, c) {
  const matched = uniqueSessionsFromCatches(data, c);
  const scoped = scopeSessions(data, intelState);
  const hours = matched.reduce((a, s) => a + sessionHours(s), 0);
  const tripCount = matched.length;
  const scopedTrips = scoped.length;
  const skunks = Math.max(0, scopedTrips - tripCount);
  const success = scopedTrips ? Math.round((tripCount / scopedTrips) * 100) : 0;
  const fpt = tripCount ? (c.length / tripCount) : 0;
  const fph = hours ? (c.length / hours) : 0;
  return { matched, scoped, hours, tripCount, scopedTrips, skunks, success, fpt, fph, big: biggest(c) || {}, avg: avgFor(c) };
}

export function sampleLabel(trips, fish) {
  if (trips >= 6 && fish >= 25) return ['Very High', ''];
  if (trips >= 3 && fish >= 12) return ['High', ''];
  if (trips >= 2 && fish >= 6) return ['Medium', 'medium'];
  return ['Low Sample', 'low'];
}
export function tripWeightedConfidence(fish, total, trips, allTrips) {
  if (!fish || !total) return 0;
  const share = fish / total;
  const sample = Math.min(1, fish / 25);
  const repeat = Math.min(1, trips / 5);
  const coverage = allTrips ? Math.min(1, trips / allTrips) : 0;
  return Math.max(8, Math.min(96, Math.round((share * 0.32 + sample * 0.24 + repeat * 0.32 + coverage * 0.12) * 100)));
}

export function patternStats(data, intelState, c, fn, label) {
  const subset = c.filter((x) => String(fn(x) || 'Unknown') === String(label));
  const trips = uniqueSessionsFromCatches(data, subset).length;
  const conf = tripWeightedConfidence(subset.length, c.length, trips, uniqueSessionsFromCatches(data, c).length);
  const quality = sampleLabel(trips, subset.length);
  return { label, subset, trips, fish: subset.length, avg: avgFor(subset), big: biggest(subset) || {}, fpt: trips ? (subset.length / trips) : 0, conf, quality };
}

function topCombo(catches) {
  if (!catches.length) return null;
  const counts = {};
  catches.forEach((c) => {
    const key = [c.species, c.color, c.lure, c._clarity, c._waterType, c._seasonPhase].map((x) => x || 'Unknown').join('|||');
    counts[key] = (counts[key] || 0) + 1;
  });
  const best = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
  if (!best) return null;
  const [species, color, lure, clarity, waterType, seasonPhase] = best[0].split('|||');
  return { species, color, lure, clarity, waterType, seasonPhase, count: best[1] };
}

// The headline "what worked" sentence — returns HTML (bolded phrases), rendered
// via dangerouslySetInnerHTML in the component (matches the original markup).
export function tripWeightedWhatWorked(data, intelState, c) {
  if (!c.length) return 'No fish match this intelligence view yet. Loosen the filters or land a few more fish.';
  const combo = topCombo(c), time = bestGroup(c, (x) => x._timeWindow), weather = bestGroup(c, (x) => x._weather),
    clarity = bestGroup(c, (x) => x._clarity), waterType = bestGroup(c, (x) => x._waterType),
    month = bestGroup(c, (x) => x._month), method = bestGroup(c, (x) => x._method);
  const sum = intelSummary(data, intelState, c);
  const bait = combo ? `${combo.color} ${combo.lure}` : bestGroup(c, (x) => x.lure).label;
  return `<strong>${esc(bait)}</strong> is the strongest signal across <strong>${sum.tripCount}</strong> productive trip${sum.tripCount === 1 ? '' : 's'}, averaging <strong>${sum.fpt.toFixed(1)} fish/trip</strong>. The best pattern is <strong>${esc(combo?.species || bestGroup(c, (x) => x.species).label)}</strong> during <strong>${esc(month.label)}</strong> in <strong>${esc(clarity.label)}</strong> water on <strong>${esc(waterType.label)}</strong>, especially while fishing <strong>${esc(method.label)}</strong> in the <strong>${esc(time.label)}</strong> under <strong>${esc(weather.label)}</strong> conditions.`;
}

// Ordered dimension list for the "What Worked Board" (verbatim ordering).
export const RANKED_DIMENSIONS = [
  ['Best Bait', (x) => `${x.color || 'Unknown'} ${x.lure || 'Unknown'}`],
  ['Best Water', (x) => x._water],
  ['Time of Year', (x) => x._month],
  ['Season Pattern', (x) => x._seasonPhase],
  ['Body of Water', (x) => x._waterType],
  ['Weather', (x) => x._weather],
  ['Clarity', (x) => x._clarity],
  ['Time of Day', (x) => x._timeWindow],
  ['Method', (x) => x._method],
  ['Partner', (x) => (x._partners && x._partners[0]) || 'Solo'],
];

// Rows for a leaderboard panel (Confidence Baits, Best Waters, etc.).
export function leaderboardRows(data, intelState, c, fn, limit = 7) {
  const counts = groupCount(c, fn);
  const rows = topEntries(counts, limit);
  return rows.map(([k]) => patternStats(data, intelState, c, fn, k));
}

export function speciesEntries(c, limit = 6) {
  return topEntries(groupCount(c, (x) => x.species), limit).map(([sp, count]) => {
    const subset = c.filter((x) => x.species === sp);
    return {
      species: sp, count, subset,
      lure: bestGroup(subset, (x) => x.lure), color: bestGroup(subset, (x) => x.color),
      waterType: bestGroup(subset, (x) => x._waterType), time: bestGroup(subset, (x) => x._timeWindow),
      cond: bestGroup(subset, (x) => x._weather), big: biggest(subset) || {}, avg: avgFor(subset),
    };
  });
}

// Per-season efficiency rollup for the Season Efficiency panel.
export function seasonEfficiencyRows(data, intelState) {
  return data.seasons.map((season) => {
    const c = allCatchesEnriched(data).filter((x) => x._season === season.id);
    const sum = intelSummary(data, intelState, c);
    const bait = bestGroup(c, (x) => `${x.color || ''} ${x.lure || ''}`).label;
    return { season, c, sum, bait };
  });
}
