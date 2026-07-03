// Season helpers ported 1:1 from the single-file app (chapterStats, chapterIcon,
// sessionHours, suggestedSeasonId, seasonMoodName, seasonDisplayName). These
// power the Rig Box Season Manager. Pure functions over the `data` journal — no
// module-level state, so they're safe to call from React render.

function minutesFromTime(t) {
  const m = String(t || '').match(/^(\d{1,2}):(\d{2})/);
  return m ? parseInt(m[1], 10) * 60 + parseInt(m[2], 10) : null;
}

export function sessionHours(s) {
  const start = minutesFromTime(s?.start);
  const end = minutesFromTime(s?.end);
  if (start == null || end == null) return 0;
  let mins = end - start;
  if (mins < 0) mins += 1440;
  return Math.max(0.25, mins / 60);
}

function groupCount(arr, fn) {
  return arr.reduce((a, x) => {
    const k = fn(x) || 'Unknown';
    a[k] = (a[k] || 0) + 1;
    return a;
  }, {});
}

function topEntries(o, n = 6) {
  return Object.entries(o).sort((a, b) => b[1] - a[1]).slice(0, n);
}

function topValue(arr, fn) {
  return topEntries(groupCount(arr, fn), 1)[0]?.[0] || '—';
}

export function chapterSeasonType(s) {
  const n = String(s?.name || s?.id || '').toLowerCase();
  if (n.includes('spring')) return 'spring';
  if (n.includes('summer')) return 'summer';
  if (n.includes('fall') || n.includes('autumn')) return 'fall';
  if (n.includes('winter') || n.includes('ice')) return 'winter';
  if (n.includes('canada') || n.includes('expedition') || n.includes('trip')) return 'expedition';
  return 'summer';
}

export function chapterIcon(s) {
  const t = chapterSeasonType(s);
  return t === 'spring' ? '🌱' : t === 'summer' ? '☀️' : t === 'fall' ? '🍂' : t === 'winter' ? '❄️' : '🧭';
}

// Per-season rollup — mirrors chapterStats(id) in the original. Non-deleted
// catches only, so tombstoned records don't inflate counts.
export function chapterStats(data, id) {
  const sessions = data.sessions.filter((s) => s.season === id);
  const ids = new Set(sessions.map((s) => s.id));
  const catches = data.catches.filter((c) => ids.has(c.sessionId) && !c.deleted);
  const biggest = catches.slice().sort((a, b) => (+b.length || 0) - (+a.length || 0))[0];
  const hours = sessions.reduce((sum, s) => sum + sessionHours(s), 0);
  return {
    sessions,
    catches,
    biggest,
    hours,
    waters: Object.keys(groupCount(sessions, (x) => x.water)).length,
    species: Object.keys(groupCount(catches, (x) => x.species)).length,
    topLure: topValue(catches, (x) => x.lure),
    topWater: topValue(sessions, (x) => x.water),
  };
}

export function seasonDisplayName(s) {
  return (s?.name || s?.id || 'Season') + (s?.archived ? ' ✓ Archived' : '');
}

// Suggest an unused season ID (current year, then year-2, year-3…).
export function suggestedSeasonId(data) {
  const y = new Date().getFullYear();
  const id = String(y);
  if (!data.seasons.some((s) => s.id === id)) return id;
  let n = 2;
  while (data.seasons.some((s) => s.id === id + '-' + n)) n++;
  return id + '-' + n;
}

export function seasonMoodName() {
  const m = new Date().getMonth() + 1;
  if (m >= 3 && m <= 5) return 'Spring';
  if (m >= 6 && m <= 8) return 'Summer';
  if (m >= 9 && m <= 11) return 'Fall';
  return 'Winter';
}
