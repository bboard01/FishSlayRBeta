import { useState } from 'react';
import { useData } from '../lib/DataContext.jsx';
import {
  MAX_LOADOUTS,
  ensureLoadouts,
  loadoutIcon,
  loadoutName,
} from '../lib/loadouts.js';
import LoadoutEditor from './LoadoutEditor.jsx';
import { tackleProfiles, barsData, countBy } from '../lib/tackle.js';

// Small bar-list, ported from bars(): top-6 entries with a proportional fill.
function Bars({ counts }) {
  const rows = barsData(counts);
  if (!rows.length) return <p className="muted">No data yet.</p>;
  return (
    <div className="bars">
      {rows.map((r) => (
        <div className="bar" key={r.key}>
          <b>{r.key}</b>
          <div className="bar-track"><div className="bar-fill" style={{ width: r.pct + '%' }} /></div>
          <span>{r.value}</span>
        </div>
      ))}
    </div>
  );
}

// Tackle Box — the Quick Rigs / Loadouts manager, ported from renderTackle() +
// loadoutManagerHTML(). Same wording and the same 5-slot grid with Edit/Delete
// and empty "Add a Rig" slots. Confidence-bait profiles and lure/color bars are
// stats panels that come with the River Intelligence port; this screen ships
// the loadouts feature (create, edit, delete, sync via profile).
export default function TackleBox({ onToast }) {
  const { data, updateProfile, seasonCatches } = useData();
  const outs = ensureLoadouts(data);
  const [editing, setEditing] = useState(null); // slot index being edited, or null
  const c = seasonCatches();
  const profiles = tackleProfiles(data, c);

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

        <div className="glass panel span12">
          <h3>Confidence Bait Profiles</h3>
          <div className="profile-grid">
            {profiles.map((p) => (
              <div className="profile-card" key={p.lure}>
                <span className="eyebrow">Confidence Bait</span>
                <h4>{p.lure}</h4>
                <strong>{p.confidence}%</strong>
                <small>{p.count} fish • PB {p.pb}"</small>
                <div className="chips">
                  <span className="chip">{p.color}</span>
                  <span className="chip green">{p.water}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="glass panel span6">
          <h3>Lures</h3>
          <Bars counts={countBy(c, (x) => x.lure)} />
        </div>
        <div className="glass panel span6">
          <h3>Colors</h3>
          <Bars counts={countBy(c, (x) => x.color)} />
        </div>
      </div>

      {editing !== null && (
        <LoadoutEditor index={editing} onClose={() => setEditing(null)} />
      )}
    </>
  );
}
