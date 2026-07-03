import { ratingStars, fishEmoji, speciesClass } from '../lib/fishDisplay.js';

// A single catch card — ported from the single-file app's fishCardHTML.
// Photo handling (IndexedDB thumbnails) comes when we port the photo layer;
// for now it shows the thumbnail if the catch object carries one.
export default function FishCard({ c, isBig, isFirst, onOpen }) {
  const rating = +c.rating || 3;
  return (
    <button
      className={`fish-card ${speciesClass(c.species)} ${isBig ? 'pb' : ''}`}
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
      {isBig ? (
        <span className="fish-ribbon">BIGGEST</span>
      ) : isFirst ? (
        <span className="fish-ribbon green">FIRST</span>
      ) : null}
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
