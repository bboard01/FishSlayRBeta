import { sb } from './supabase.js';

// "Spin a Fish Tale" — the client side of the AI story feature.
//
// The Groq API key is NOT here (and never in the bundle). This module builds a
// compact, already-summarized trip brief and hands it to the `fish-tale`
// Supabase Edge Function, which holds the key server-side and calls Groq. The
// returned tale is stored on the session record (session.fishTale) so it syncs
// across devices like any other trip field — no schema change needed, since the
// whole session object rides in the jsonb `data` column.

// Non-deleted catches for a session.
function catchesForSession(data, id) {
  return (data.catches || []).filter((c) => c.sessionId === id && !c.deleted);
}
function biggest(c) {
  return c.slice().sort((a, b) => (+b.length || 0) - (+a.length || 0))[0];
}
function topLure(c) {
  const counts = c.reduce((a, x) => {
    const k = x.lure || 'Unknown';
    a[k] = (a[k] || 0) + 1;
    return a;
  }, {});
  const top = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
  return top ? top[0] : null;
}

// Build the trip brief sent to the edge function. Only summarized facts — no raw
// catch tables. Partner names are whatever the user typed on the trip.
export function tripBrief(data, session) {
  const c = catchesForSession(data, session.id);
  const b = biggest(c) || {};
  const partners = Array.isArray(session.partners)
    ? session.partners.filter(Boolean).join(', ')
    : (session.partners || '');
  const species = Array.from(new Set(c.map((x) => x.species).filter(Boolean)));

  return {
    title: session.title || session.name || '',
    water: session.water || '',
    state: session.state || '',
    date: session.date || '',
    weather: session.weather || '',
    waterTemp: session.waterTemp || '',
    flow: session.flow || '',
    partners,
    count: c.length,
    species,
    best: b.id ? { species: b.species || 'fish', length: b.length || 0 } : null,
    topLure: topLure(c),
    notes: session.notes || '',
  };
}

// Ask the edge function for a tale. Resolves to the tale string, or throws with
// a friendly message the UI can show. Requires the caller to be online + signed
// in (the function enforces auth; this just surfaces a clear error).
export async function generateFishTale(data, session) {
  if (!navigator.onLine) throw new Error('You need to be online to spin a fish tale.');

  const brief = tripBrief(data, session);
  const { data: resp, error } = await sb.functions.invoke('fish-tale', {
    body: { trip: brief },
  });

  if (error) {
    // Supabase wraps non-2xx responses in error.context; try to read the
    // function's own message so the user sees something meaningful.
    let msg = 'The storyteller could not be reached. Try again.';
    try {
      const body = await error.context?.json?.();
      if (body?.error) msg = body.error;
    } catch (_e) { /* keep the default */ }
    throw new Error(msg);
  }

  const tale = (resp && resp.tale ? String(resp.tale) : '').trim();
  if (!tale) throw new Error('The storyteller came back empty. Try again.');
  return tale;
}
