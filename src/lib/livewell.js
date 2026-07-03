// Livewell secondary-panel helpers — ported 1:1 from the single-file app:
// filterLivewellCatches, livewellFilters options, timeline bucketing,
// tripPattern, tripStatsChips data, and firstSpeciesCatch. Pure functions over
// the journal + a filter/sort selection.

import { esc } from './fishDisplay.js';

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

// filterLivewellCatches(list): apply the active filter + sort. Verbatim rules.
export function filterLivewellCatches(list, livewellFilter, livewellSort) {
  let c = list.slice();
  const b = biggest(c) || {};
  if (livewellFilter === 'biggest') c = c.filter((x) => x.id === b.id || (+x.length || 0) >= ((+b.length || 0) - 2));
  else if (livewellFilter === 'pbs') c = c.filter((x) => x.id === b.id || (+x.length || 0) >= 24 || String(x.notes || '').toLowerCase().includes('pb'));
  else if (livewellFilter === 'favorites') c = c.filter((x) => String(x.notes || '').toLowerCase().includes('favorite') || (+x.rating || 0) >= 5);
  else if (livewellFilter && livewellFilter !== 'all') c = c.filter((x) => x.species === livewellFilter);
  if (livewellSort === 'size') c.sort((a, z) => (+z.length || 0) - (+a.length || 0));
  else if (livewellSort === 'species') c.sort((a, z) => String(a.species || '').localeCompare(String(z.species || '')) || String(a.time || '').localeCompare(String(z.time || '')));
  else if (livewellSort === 'lure') c.sort((a, z) => String(a.lure || '').localeCompare(String(z.lure || '')) || String(a.time || '').localeCompare(String(z.time || '')));
  else c.sort((a, z) => String(a.time || '').localeCompare(String(z.time || '')));
  return c;
}

// The filter-chip options for a set of catches: fixed set + up to 6 species.
export function livewellFilterOptions(catches) {
  const species = Object.keys(groupCount(catches, (x) => x.species)).slice(0, 6);
  return [['all', 'All'], ['biggest', 'Biggest'], ['favorites', 'Favorites'], ['pbs', 'Legends'], ...species.map((s) => [s, s])];
}

// timeline(c): Morning/Afternoon/Evening buckets of catches.
export function timelineBuckets(c) {
  const buckets = { Morning: [], Afternoon: [], Evening: [] };
  c.forEach((x) => {
    const h = parseInt((x.time || '12').split(':')[0], 10);
    (h < 12 ? buckets.Morning : h < 17 ? buckets.Afternoon : buckets.Evening).push(x);
  });
  return buckets;
}

// tripPattern(id): the "leaning toward X around Y" sentence (returns HTML).
export function tripPatternText(catches) {
  if (!catches.length) return 'Land a few fish and the day will start revealing itself.';
  const lure = topEntries(groupCount(catches, (x) => x.lure), 1)[0]?.[0];
  const structure = topEntries(groupCount(catches, (x) => x.structure), 1)[0]?.[0];
  return `This trip is leaning toward <strong>${esc(lure)}</strong> around <strong>${esc(structure)}</strong>. FishSlayR isn't just saving the catch — it's learning the shape of the day.`;
}

// tripStatsChips(s) data: fish / best / species / top lure.
export function tripStats(catches) {
  const b = biggest(catches) || {};
  return {
    fish: catches.length,
    best: b.length || 0,
    species: Object.keys(groupCount(catches, (x) => x.species)).length,
    topLure: topValue(catches, (x) => x.lure),
  };
}

// firstSpeciesCatch(c, seasonCatches): true if this is the only catch of its
// species in the season (drives the FIRST ribbon).
export function firstSpeciesCatch(c, seasonCatches) {
  return !seasonCatches.some((x) => x.id !== c.id && x.species === c.species);
}

export function topColorOf(catches) {
  return topValue(catches, (x) => x.color);
}

// ---------------------------------------------------------------------------
// Living Livewell (tank) geometry + colors — ported verbatim from the
// single-file app's livewellSpeciesKey / livewellFishColors / livewellSize /
// livewellPosition. These place, size, and tint each swimming fish. Pure
// functions, no DOM. Used by the LivingLivewell tank component (Phase B).
// ---------------------------------------------------------------------------

export function livewellSpeciesKey(species) {
  const s = String(species || '').toLowerCase();
  if (s.includes('pike') || s.includes('musk') || s.includes('pickerel')) return 'pike';
  if (s.includes('walleye') || s.includes('sauger')) return 'walleye';
  if (s.includes('trout') || s.includes('salmon')) return 'trout';
  if (s.includes('cat')) return 'catfish';
  if (s.includes('bluegill') || s.includes('crappie') || s.includes('perch') || s.includes('sunfish') || s.includes('rock bass')) return 'panfish';
  if (s.includes('bass') || s.includes('smallmouth') || s.includes('largemouth')) return 'bass';
  return 'bass';
}

export function livewellFishColors(species) {
  const k = livewellSpeciesKey(species);
  return ({
    bass: ['#8bd6a6', '#9b784a'],
    walleye: ['#ffd36b', '#827347'],
    pike: ['#b7e7d4', '#4f7f68'],
    trout: ['#9fd7ff', '#8056b3'],
    catfish: ['#7f9ab0', '#2c526c'],
    panfish: ['#ffb06b', '#4fb3c8'],
  })[k] || ['#7de7ff', '#0c6c9c'];
}

export function livewellSize(c) {
  const len = +c.length || 12;
  const key = livewellSpeciesKey(c.species);
  const base = key === 'pike' ? 120 : key === 'catfish' ? 105 : key === 'walleye' ? 98 : key === 'trout' ? 92 : key === 'panfish' ? 70 : 88;
  return Math.max(62, Math.min(155, base + (len - 14) * 3.2));
}

export function livewellPosition(i, total, c) {
  const golden = (i * 137.508) % 360;
  const radius = Math.min(38, 18 + (i % 9) * 3.4);
  let x = 50 + Math.cos((golden * Math.PI) / 180) * radius;
  let y = 50 + Math.sin((golden * Math.PI) / 180) * Math.min(30, radius * 0.72);
  if (total < 4) { x = [35, 62, 48, 72][i] || x; y = [42, 50, 62, 37][i] || y; }
  if ((+c.length || 0) > 24) { x = 50 + (i % 2 ? 9 : -7); y = 44 + (i % 3) * 7; }
  return [Math.max(10, Math.min(90, x)), Math.max(14, Math.min(86, y))];
}
