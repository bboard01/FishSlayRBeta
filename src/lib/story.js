// Narrative helpers for the Journal (Campfire) screen and the River Remembers
// recap modal. Ported 1:1 from the single-file app's storyFor(), storyBeats(),
// and memoryText(). Pure functions over the journal + a session; they return
// plain strings (storyFor/memoryText) or HTML (storyBeats) rendered via
// dangerouslySetInnerHTML to preserve the original markup.

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

// Non-deleted catches for a session.
function catchesForSession(data, id) {
  return data.catches.filter((c) => c.sessionId === id && !c.deleted);
}
function sessionFor(data, id) {
  return data.sessions.find((s) => s.id === id) || {};
}

// storyFor(s): the one-paragraph trip story shown on Campfire trip covers.
export function storyFor(data, s) {
  const c = catchesForSession(data, s.id);
  const b = biggest(c) || {};
  if (!c.length) return `A chapter waiting to be written at ${esc(s.water)}.`;
  const lure = topEntries(groupCount(c, (x) => x.lure), 1)[0]?.[0];
  return `The ${esc(s.water)} gave up ${c.length} fish. The best went ${esc(b.length || 0)} inches, and the story kept circling back to the ${esc(lure)}. ${esc(s.notes || 'Another day worth remembering.')}`;
}

// storyBeats(s): the Morning/Midday/Moment recap grid (returns HTML).
export function storyBeats(data, s) {
  const c = catchesForSession(data, s.id);
  const morning = c.filter((x) => parseInt((x.time || '12').split(':')[0], 10) < 12);
  const afternoon = c.filter((x) => { const h = parseInt((x.time || '12').split(':')[0], 10); return h >= 12 && h < 17; });
  const b = biggest(c) || {};
  return `<div class="story-beats"><div class="beat"><strong>Morning</strong><span>${morning.length ? `${morning.length} fish before lunch. ${esc(topValue(morning, (x) => x.lure))} showed up early.` : 'The morning is still waiting for its first fish.'}</span></div><div class="beat"><strong>Midday</strong><span>${afternoon.length ? `${afternoon.length} fish kept the chapter moving. Best midday bait: ${esc(topValue(afternoon, (x) => x.lure))}.` : 'No midday fish logged yet.'}</span></div><div class="beat"><strong>Moment</strong><span>${b.id ? `${esc(b.species)} at ${esc(b.length)} inches became the fish this trip will remember.` : 'The legend fish is still out there.'}</span></div></div>`;
}

// memoryText(): the Boathouse "River Memories" blurb (returns HTML). Exported
// here so the Boathouse below-hero grid can reuse it when that port lands.
export function memoryText(data, seasonCatches) {
  const c = seasonCatches;
  const older = c.find((x) => sessionFor(data, x.sessionId).season !== String(new Date().getFullYear())) || c[3] || c[0];
  if (!older) return 'The first memory is waiting to be written.';
  const s = sessionFor(data, older.sessionId);
  return `A past chapter: <strong>${esc(s.title || s.name)}</strong>. ${esc(older.length)} inches on a ${esc(older.color)} ${esc(older.lure)} at ${esc(s.water)}. The kind of detail you'd forget if the river didn't remember.`;
}

// Recap fields for the River Remembers modal header (fish/best/pattern/crew).
export function recapFor(data, s) {
  const c = catchesForSession(data, s.id);
  const b = biggest(c) || {};
  const lure = topEntries(groupCount(c, (x) => x.lure), 1)[0]?.[0] || '—';
  const crew = (Array.isArray(s.partners) ? s.partners : (s.partners ? [s.partners] : [])).join(', ') || 'Solo';
  return { count: c.length, best: b.length || 0, lure, crew };
}

// Plain-text export of a trip story (exportTripStory), for the modal's Export.
export function tripStoryText(data, s) {
  const plain = storyFor(data, s).replace(/<[^>]+>/g, '');
  return `The River Remembers\n\n${s.title || s.name}\n${s.water} • ${s.date}\n\n${plain}`;
}

// patternText(data, seasonCatches): the Boathouse "Season Memory" paragraph —
// the most-common species / color+lure / strongest water, as HTML. Ported 1:1
// from the single-file app's patternText(). Returns markup (rendered via
// dangerouslySetInnerHTML) to preserve the original's <strong> emphasis.
export function patternText(data, seasonCatches) {
  const c = seasonCatches;
  if (!c.length) {
    return 'No pattern yet. Log a few fish and River Intelligence will start turning memories into useful clues.';
  }
  const lure = topEntries(groupCount(c, (x) => x.lure), 1)[0]?.[0];
  const color = topEntries(groupCount(c, (x) => x.color), 1)[0]?.[0];
  const species = topEntries(groupCount(c, (x) => x.species), 1)[0]?.[0];
  const water = topEntries(groupCount(c, (x) => sessionFor(data, x.sessionId).water), 1)[0]?.[0];
  return `<strong>${esc(species)}</strong> are showing up most often on <strong>${esc(color)} ${esc(lure)}</strong>. Your strongest water right now is <strong>${esc(water)}</strong>. The river is starting to remember.`;
}
