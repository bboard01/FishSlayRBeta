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
