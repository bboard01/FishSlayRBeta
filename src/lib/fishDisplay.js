// Display helpers ported 1:1 from the single-file app's index.html so the React
// build renders fish cards and catch cards with the exact same look and wording.
// Keep these in sync with the originals if the legacy app ever changes them.

// esc() — original escapes user text before it goes into innerHTML. In React,
// JSX already escapes interpolated values, so components don't need esc() for
// rendering. It's exported only for any string-building that still needs it.
export function esc(s) {
  return String(s ?? '').replace(/[&<>'"]/g, (m) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[m]
  ));
}

export function ratingStars(n = 0) {
  n = Math.max(0, Math.min(5, Math.round(+n || 0)));
  return '★★★★★'.slice(0, n) + '☆☆☆☆☆'.slice(0, 5 - n);
}

export function fishEmoji(species = '') {
  const x = String(species).toLowerCase();
  if (x.includes('pike') || x.includes('musk')) return '🐊';
  if (x.includes('trout')) return '🐟';
  if (x.includes('walleye')) return '👁️';
  if (x.includes('catfish')) return '🐈';
  return '🐟';
}

export function speciesClass(species = '') {
  const x = String(species).toLowerCase();
  if (x.includes('walleye') || x.includes('sauger')) return 'species-walleye';
  if (x.includes('pike') || x.includes('musk') || x.includes('pickerel')) return 'species-pike';
  if (x.includes('trout') || x.includes('salmon')) return 'species-trout';
  if (x.includes('bass')) return 'species-bass';
  if (x.includes('perch') || x.includes('bluegill') || x.includes('crappie') || x.includes('sunfish')) return 'species-panfish';
  if (x.includes('catfish') || x.includes('bullhead')) return 'species-catfish';
  return '';
}
