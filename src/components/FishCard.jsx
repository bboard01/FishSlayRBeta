// A single catch card — ported from the single-file app's fishCardHTML.
// Photo handling (IndexedDB thumbnails) comes when we port the photo layer;
// for now it shows the thumbnail if the catch object carries one.

function ratingStars(n) {
  const r = Math.max(0, Math.min(5, +n || 0));
  return '★'.repeat(r) + '☆'.repeat(5 - r);
}

const FISH_EMOJI = { default: '🐟' };
function fishEmoji(species) {
  const s = String(species || '').toLowerCase();
  if (s.includes('bass')) return '🎣';
  if (s.includes('trout') || s.includes('salmon')) return '🐟';
  if (s.includes('pike') || s.includes('musk')) return '🐊';
  if (s.includes('cat')) return '🐱';
  return FISH_EMOJI.default;
}

export default function FishCard({ c, isBig, onOpen }) {
  const rating = +c.rating || 3;
  return (
    <button
      className={`fish-card ${isBig ? 'pb' : ''}`}
      onClick={() => onOpen(c.id)}
    >
      {c.photoThumb && (
        <div className="fish-photo">
          <img src={c.photoThumb} alt={c.species} loading="lazy" />
        </div>
      )}
      <div className="photo-tag">
        {c.photoThumb ? (c.photoTag || '📸 Photo') : '📸 No Photo Yet'}
      </div>
      {isBig && <span className="fish-ribbon">BIGGEST</span>}
      <div className="fish-head">
        <div className="icon">{fishEmoji(c.species)}</div>
        <span className={`chip ${isBig ? 'gold' : ''}`} style={{ padding: '4px 8px' }}>
          {ratingStars(rating)}
        </span>
      </div>
      <strong className="length-main">{c.length}"</strong>
      <small className="species-name">{c.species}</small>
      <div className="fish-meta">
        <span className="mini-pill">{c.time || '--:--'}</span>
        {c.color && <span className="mini-pill">{c.color}</span>}
        {c.lure && <span className="mini-pill">{c.lure}</span>}
        {c.depth && <span className="mini-pill">{c.depth}</span>}
      </div>
      <span className="story-cue">Open catch card →</span>
    </button>
  );
}
