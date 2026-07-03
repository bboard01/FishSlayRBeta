// Trip Templates — reusable trip-context presets, stored on the profile as
// data.tripTemplates and synced via profiles.trip_templates (the same
// profile-collection pattern as loadouts). A template captures the New Trip
// form's context fields so a recurring trip (same water, crew, method…) can be
// launched in one tap. It deliberately omits per-trip identity (id, date,
// active, catches) — those are created fresh each launch.

// The trip-context fields a template carries. These mirror the New Trip form
// (everything except title, which the user usually re-types, is fair game — but
// we keep title too so a named template reads clearly).
export const TEMPLATE_FIELDS = [
  'title', 'country', 'state', 'waterType', 'water', 'launch', 'area',
  'partners', 'boat', 'method', 'techniqueFocus', 'target', 'weather',
  'clarity', 'flow', 'spawnPhase', 'temp', 'air', 'sky', 'moon',
];

export const MAX_TEMPLATES = 8;

// Always work against a real array.
export function ensureTemplates(data) {
  return Array.isArray(data?.tripTemplates) ? data.tripTemplates : [];
}

// Build a template record from the New Trip form state `f`. `id` is supplied so
// the caller controls it (uid()).
export function templateFromForm(id, f, label) {
  const t = { id, label: label || f.title || 'Trip Template' };
  for (const k of TEMPLATE_FIELDS) t[k] = f[k];
  return t;
}

// Apply a template back onto the form defaults: only overwrite keys the
// template actually carries, leaving anything else (and the notes field) as-is.
export function applyTemplateToForm(prevForm, t) {
  const next = { ...prevForm };
  for (const k of TEMPLATE_FIELDS) {
    if (t[k] !== undefined && t[k] !== '') next[k] = t[k];
  }
  return next;
}

// A little icon for the chip, themed by water type / method (best-effort, same
// spirit as loadoutIcon).
export function templateIcon(t) {
  const w = String(t?.waterType || t?.water || '').toLowerCase();
  const m = String(t?.method || '').toLowerCase();
  if (w.includes('lake') || w.includes('pond')) return '🏞️';
  if (w.includes('river') || w.includes('creek') || w.includes('stream')) return '🌊';
  if (m.includes('fly')) return '🎣';
  if (m.includes('troll')) return '🚤';
  return '📋';
}

// One-line summary under the template label.
export function templateSummary(t) {
  const bits = [t?.water, t?.method, Array.isArray(t?.partners) ? t.partners.join(', ') : t?.partners]
    .map((x) => String(x || '').trim())
    .filter(Boolean);
  return bits.slice(0, 2).join(' • ') || 'Saved trip context';
}

// Display name with a sensible fallback.
export function templateName(t, i) {
  return t?.label || t?.title || `Template ${i + 1}`;
}
