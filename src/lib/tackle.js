// Tackle Box analysis helpers — ported 1:1 from the single-file app's
// tackleProfileCards() and bars(). Pure functions over season catches; return
// plain data the TackleBox component maps to cards/bars.

function groupCount(arr, fn) {
  return arr.reduce((a, x) => { const k = fn(x) || 'Unknown'; a[k] = (a[k] || 0) + 1; return a; }, {});
}
function topEntries(o, n = 6) {
  return Object.entries(o).sort((a, b) => b[1] - a[1]).slice(0, n);
}
function topValue(arr, fn) {
  return topEntries(groupCount(arr, fn), 1)[0]?.[0] || '—';
}
function biggest(c) {
  return c.slice().sort((a, b) => (+b.length || 0) - (+a.length || 0))[0];
}
function sessionFor(data, id) { return data.sessions.find((s) => s.id === id) || {}; }

// tackleProfileCards(): top 12 lures, each with a confidence %, fish count, PB,
// top color and top water. Returns an array of card data.
export function tackleProfiles(data, catches) {
  const lures = topEntries(groupCount(catches, (x) => x.lure), 12);
  return lures.map(([lure, count]) => {
    const lc = catches.filter((x) => x.lure === lure);
    const best = biggest(lc) || {};
    const color = topValue(lc, (x) => x.color);
    const water = topValue(lc, (x) => sessionFor(data, x.sessionId).water);
    const confidence = Math.min(98, Math.round((count / Math.max(1, catches.length)) * 100 + 45));
    return { lure, count, confidence, pb: best.length || 0, color, water };
  });
}

// bars(o): top 6 entries + a percentage width for each, relative to the max.
// Returns { rows: [{ key, value, pct }] }.
export function barsData(counts) {
  const e = topEntries(counts, 6);
  const max = Math.max(1, ...e.map((x) => x[1]));
  return e.map(([key, value]) => ({ key, value, pct: Math.round((value / max) * 100) }));
}

// Convenience: group season catches by a field, for barsData.
export function countBy(catches, fn) {
  return groupCount(catches, fn);
}
