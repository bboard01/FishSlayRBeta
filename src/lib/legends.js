// Legends (Trophy Room) helpers — ported 1:1 from the single-file app's
// bestBySpecies() and trophyWall(). Pure functions over the journal; return
// plain data the Legends component maps to plaques/cards.

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

// bestBySpecies(): map of species -> the biggest catch of that species.
export function bestBySpecies(catches) {
  const map = {};
  catches.forEach((c) => {
    if (!map[c.species] || (+c.length || 0) > (+map[c.species].length || 0)) map[c.species] = c;
  });
  return map;
}

// trophyWall(): the six legend plaques. Each is
// { medal, title, value, sub, unlocked }.
export function trophyPlaques(data, seasonCatches, seasonSessions) {
  const c = seasonCatches;
  const big = biggest(c) || {};
  const most = seasonSessions
    .map((s) => [s, c.filter((x) => x.sessionId === s.id).length])
    .sort((a, b) => b[1] - a[1])[0] || [];
  const unlockedSpecies = Object.keys(groupCount(c, (x) => x.species)).length;
  const waters = Object.keys(groupCount(c, (x) => sessionFor(data, x.sessionId).water)).length;

  return [
    { medal: '🏆', title: 'Legend Fish', value: `${big.length || 0}"`, sub: `${big.species || 'No fish yet'} • ${sessionFor(data, big.sessionId).water || ''}`, unlocked: !!big.id },
    { medal: '🐟', title: 'Species Collector', value: unlockedSpecies, sub: `${unlockedSpecies} species remembered`, unlocked: unlockedSpecies >= 3 },
    { medal: '🔥', title: 'Numbers Day', value: most[1] || 0, sub: `${most[0]?.title || most[0]?.name || 'No trip'} had the biggest livewell`, unlocked: (most[1] || 0) >= 10 },
    { medal: '🇨🇦', title: 'Canada Slam', value: 'Dave', sub: 'Walleye, Pike, Trout, Perch in one chapter', unlocked: c.some((x) => sessionFor(data, x.sessionId).water?.includes('Ontario')) },
    { medal: '🎯', title: 'Pattern Master', value: topValue(c, (x) => x.lure), sub: 'Most trusted lure this season', unlocked: c.length >= 5 },
    { medal: '🌊', title: 'Water Explorer', value: waters, sub: 'different waters fished', unlocked: c.length >= 5 },
  ];
}
