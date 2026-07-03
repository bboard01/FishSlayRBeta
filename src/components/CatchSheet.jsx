import { useEffect, useRef } from 'react';
import { useData } from '../lib/DataContext.jsx';
import { deleteCloudPhoto } from '../lib/sync.js';
import { photoGet, photoDelete } from '../lib/photos.js';
import { ratingStars, fishEmoji, speciesClass } from '../lib/fishDisplay.js';

// The catch card detail view — ported from the single-file app's openFishCard().
// Same sheet chrome, same fish-detail-grid layout, same wording. Opens when a
// FishCard is tapped. Close / Edit Catch / Trip Story / Delete mirror the
// original action row; Edit and Trip Story are stubbed until those flows land
// (they're disabled rather than hidden so the layout matches the original).
export default function CatchSheet({ catchId, onClose }) {
  const { data, update, sessionFor, biggest, catchesForSession } = useData();

  const c = data.catches.find((x) => x.id === catchId);
  // If the catch vanished (e.g. just deleted), render nothing.
  if (!c) return null;

  const s = sessionFor(c.sessionId);
  const isBest = (biggest(catchesForSession(c.sessionId)) || {}).id === c.id;

  // Show the full-res photo from IndexedDB in the card, swapping in over the
  // thumbnail once it loads — ported from showCatchPhoto(). Falls back to the
  // thumbnail (already the img src) if the blob isn't stored locally.
  const imgRef = useRef(null);
  useEffect(() => {
    if (!c.photoThumb) return;
    let url = null;
    let cancelled = false;
    photoGet(c.id).then((blob) => {
      if (blob && imgRef.current && !cancelled) {
        url = URL.createObjectURL(blob);
        imgRef.current.src = url;
      }
    });
    return () => { cancelled = true; if (url) URL.revokeObjectURL(url); };
  }, [c.id, c.photoThumb]);

  // Ported verbatim from deleteCatch(): same confirm copy, soft-delete + dirty
  // flag so the tombstone propagates on the next push sync rather than being
  // hard-removed locally (which would just re-sync back down from Supabase).
  const handleDelete = () => {
    const label = `${c.length || ''}" ${c.species || 'fish'}`.trim();
    const ok = window.confirm(
      `Delete this catch (${label})?\n\n` +
      `This removes it from every device the next time you sync, and its photo ` +
      `will be deleted from the cloud. This can't be undone.`
    );
    if (!ok) return;

    update((prev) => ({
      ...prev,
      catches: prev.catches.map((x) =>
        x.id === c.id
          ? { ...x, deleted: true, updated_at: new Date().toISOString(), _dirty: true }
          : x
      ),
    }));
    // Photo cleanup: remove the local IndexedDB blob and the cloud copy via the
    // Storage API (the supported path). The tombstone above + the scheduled push
    // (triggered by update) carry the delete across devices.
    if (c.hasPhoto) { photoDelete(c.id); deleteCloudPhoto(c.id); }
    onClose();
  };

  const notes = c.notes ||
    `Caught on ${c.color || 'a'} ${c.lure || 'bait'} around ${c.structure || 'fishy water'}.`;

  return (
    <div className="sheet-backdrop active" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-head">
          <div>
            <h2>Catch Card</h2>
            <div className="muted">
              {(s.title || s.name || 'Trip') + ' • ' + (s.water || 'Unknown water')}
            </div>
          </div>
          <button className="btn small" onClick={onClose}>Close</button>
        </div>

        <div className="sheet-body">
          <div className="fish-detail-grid">
            <div className={`fish-detail-hero ${speciesClass(c.species)}`}>
              {c.photoThumb ? (
                <div className="catch-photo-full">
                  <img ref={imgRef} src={c.photoThumb} alt={c.species} />
                </div>
              ) : (
                <div className="big-fish">{fishEmoji(c.species)}</div>
              )}
              <span className="eyebrow">
                {isBest ? 'Biggest of the Trip' : 'FishSlayR Catch Card'}
              </span>
              <h2>{c.length}"</h2>
              <p className="story">
                <strong>{c.species}</strong>
                <br />
                {(c.color || '') + ' ' + (c.lure || '')} • {c.time || '--:--'}
              </p>
              <div className="chips">
                <span className="chip gold">{ratingStars(c.rating || 3)}</span>
                <span className="chip">{c.disposition || 'Released'}</span>
                <span className="chip">{c.depth || 'Depth n/a'}</span>
              </div>
            </div>

            <div className="fish-detail-notes">
              <span className="eyebrow">The River Remembers</span>
              <p>{notes}</p>
              <div className="chips">
                <span className="chip">🌊 {s.water || ''}</span>
                <span className="chip">🎣 {s.method || ''}</span>
                <span className="chip">🌤 {s.weather || ''}</span>
                <span className="chip">📍 {c.structure || ''}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="sheet-actions">
          <button className="btn" onClick={onClose}>Close</button>
          <button className="btn" disabled title="Coming soon in the new build">
            Edit Catch
          </button>
          <button className="btn gold" disabled title="Coming soon in the new build">
            Trip Story
          </button>
          <button className="btn danger" onClick={handleDelete}>Delete</button>
        </div>
      </div>
    </div>
  );
}
