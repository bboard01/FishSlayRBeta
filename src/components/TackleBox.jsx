import { useState } from 'react';
import { useData } from '../lib/DataContext.jsx';
import {
  MAX_LOADOUTS,
  ensureLoadouts,
  loadoutIcon,
  loadoutName,
} from '../lib/loadouts.js';
import LoadoutEditor from './LoadoutEditor.jsx';

// Tackle Box — the Quick Rigs / Loadouts manager, ported from renderTackle() +
// loadoutManagerHTML(). Same wording and the same 5-slot grid with Edit/Delete
// and empty "Add a Rig" slots. Confidence-bait profiles and lure/color bars are
// stats panels that come with the River Intelligence port; this screen ships
// the loadouts feature (create, edit, delete, sync via profile).
export default function TackleBox({ onToast }) {
  const { data, updateProfile } = useData();
  const outs = ensureLoadouts(data);
  const [editing, setEditing] = useState(null); // slot index being edited, or null

  const remove = (i) => {
    const l = outs[i];
    if (!l) return;
    if (!window.confirm('Delete “' + (l.name || 'this loadout') + '”?')) return;
    updateProfile((prev) => {
      const arr = (prev.loadouts || []).slice();
      arr.splice(i, 1);
      return { ...prev, loadouts: arr };
    });
    if (onToast) onToast('Loadout removed');
  };

  const slots = [];
  for (let i = 0; i < MAX_LOADOUTS; i++) {
    const l = outs[i];
    if (l) {
      slots.push(
        <div className="loadout-card" key={l.id || i}>
          <div className="loadout-card-head">
            <span className="loadout-chip-icon big">{loadoutIcon(l)}</span>
            <div>
              <strong>{loadoutName(l, i)}</strong>
              {l.rod ? <small className="muted">{l.rod}</small> : null}
            </div>
          </div>
          <div className="loadout-fields">
            <span className="mini-pill">{l.category || '—'}</span>
            <span className="mini-pill">{l.lure || '—'}</span>
            <span className="mini-pill">{l.color || '—'}</span>
            <span className="mini-pill">{l.presentation || '—'}</span>
            <span className="mini-pill">{l.depth || '—'}</span>
          </div>
          <div className="loadout-card-actions">
            <button className="btn small" onClick={() => setEditing(i)}>Edit</button>
            <button className="btn small danger" onClick={() => remove(i)}>Delete</button>
          </div>
        </div>
      );
    } else {
      slots.push(
        <button className="loadout-card empty" key={`empty-${i}`} onClick={() => setEditing(i)}>
          <span className="loadout-empty-icon">➕</span>
          <strong>Add a Rig</strong>
          <small className="muted">Slot {i + 1} of {MAX_LOADOUTS}</small>
        </button>
      );
    }
  }

  return (
    <>
      <div className="grid">
        <div className="glass panel span12 memory-card">
          <span className="eyebrow">Tackle Box</span>
          <h2 className="chapter-title">Every lure has a story.</h2>
          <p className="story">
            Confidence baits, forgotten heroes, Canada spoons, river tubes — your
            gear becomes part of the memory system.
          </p>
        </div>

        <div className="glass panel span12">
          <div className="livewell-toolbar">
            <div>
              <h3>Quick Rigs — Loadouts</h3>
              <p className="muted">
                Set up to 5 rigs. When you land a fish, tap a rig to fill lure,
                color, presentation, and depth in one tap.
              </p>
            </div>
            <span className="chip gold">{outs.length}/5 slots</span>
          </div>
          <div className="loadout-grid">{slots}</div>
        </div>
      </div>

      {editing !== null && (
        <LoadoutEditor index={editing} onClose={() => setEditing(null)} />
      )}
    </>
  );
}
