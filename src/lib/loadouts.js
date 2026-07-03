// Loadout (quick-rig) helpers — ported from the single-file app's Tackle Box.
// Up to 5 saved rigs; tapping one when landing a fish fills the rig fields.
// Loadouts live on the profile and sync via the profiles table.

export const MAX_LOADOUTS = 5;
export const LOADOUT_FIELDS = ['category', 'lure', 'color', 'presentation', 'depth'];

export function ensureLoadouts(data) {
  return Array.isArray(data.loadouts) ? data.loadouts : [];
}

export function loadoutIcon(l) {
  const cat = String(l.category || '').toLowerCase();
  if (cat.includes('top') || cat.includes('popper') || cat.includes('walk') || cat.includes('buzz')) return '🌊';
  if (cat.includes('jig') || cat.includes('ned') || cat.includes('tube') || cat.includes('drop') || cat.includes('soft')) return '🪱';
  if (cat.includes('crank') || cat.includes('jerk') || cat.includes('lipless') || cat.includes('square')) return '🎣';
  if (cat.includes('spinner') || cat.includes('chatter') || cat.includes('blade') || cat.includes('spoon')) return '✨';
  if (cat.includes('fly') || cat.includes('nymph') || cat.includes('streamer')) return '🪶';
  return '🧰';
}

export function loadoutSummary(l) {
  return [l.color, l.lure].filter(Boolean).join(' ') || 'Empty rig';
}

export function loadoutName(l, i) {
  return l.name || ('Loadout ' + (i + 1));
}
