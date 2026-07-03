import { useState } from 'react';
import { useData, uid } from '../lib/DataContext.jsx';
import { ensureLoadouts } from '../lib/loadouts.js';

// New/Edit Loadout sheet — ported from openLoadoutEditor + renderLoadoutEditor +
// saveLoadout. Same "Quick rigs fill the catch card in one tap." framing and the
// same field set (name, rod, category, lure, color, presentation, depth).
// Loadouts sync via the profile, so saving goes through updateProfile.
export default function LoadoutEditor({ index, onClose }) {
  const { data, updateProfile } = useData();
  const refs = data.refs || {};
  const outs = ensureLoadouts(data);
  const existing = index >= 0 ? outs[index] : null;

  const [d, setD] = useState(() => ({
    name: '', rod: '',
    category: refs.lureCategories?.[0],
    lure: refs.lures?.[0],
    color: refs.colors?.[0],
    presentation: refs.presentation?.[0],
    depth: refs.depth?.[0],
    ...(existing || {}),
  }));

  const set = (key, value) => setD((prev) => ({ ...prev, [key]: value }));

  const Sel = ({ label, field, options }) => (
    <label>
      {label}
      <select value={d[field]} onChange={(e) => set(field, e.target.value)}>
        {(options || []).map((x) => <option key={x}>{x}</option>)}
      </select>
    </label>
  );

  const save = () => {
    const rec = { ...d };
    if (!rec.name) rec.name = (rec.color ? rec.color + ' ' : '') + (rec.lure || 'Rig');
    rec.name = rec.name.slice(0, 28);
    if (!rec.id) rec.id = uid();

    updateProfile((prev) => {
      const arr = Array.isArray(prev.loadouts) ? prev.loadouts.slice() : [];
      if (index >= 0 && arr[index]) arr[index] = rec;
      else arr.push(rec);
      return { ...prev, loadouts: arr };
    });
    onClose();
  };

  return (
    <div className="sheet-backdrop active" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-head">
          <div>
            <h2>{existing ? 'Edit Loadout' : 'New Loadout'}</h2>
            <div className="muted">Quick rigs fill the catch card in one tap.</div>
          </div>
          <button className="btn small" onClick={onClose}>Close</button>
        </div>

        <div className="sheet-body">
          <div className="details">
            <label>
              Loadout Name
              <input
                value={d.name || ''}
                placeholder="e.g. Ned Rig Finesse"
                onChange={(e) => set('name', e.target.value)}
              />
            </label>
            <label>
              Rod / Reel / Line (optional)
              <input
                value={d.rod || ''}
                placeholder="e.g. 7' ML spinning, 10lb braid"
                onChange={(e) => set('rod', e.target.value)}
              />
            </label>
            <Sel label="Bait Category" field="category" options={refs.lureCategories} />
            <Sel label="Lure" field="lure" options={refs.lures} />
            <Sel label="Color" field="color" options={refs.colors} />
            <Sel label="Presentation" field="presentation" options={refs.presentation} />
            <Sel label="Depth" field="depth" options={refs.depth} />
          </div>
        </div>

        <div className="sheet-actions">
          <button className="btn" onClick={onClose}>Cancel</button>
          <button className="btn primary" onClick={save}>Save Loadout</button>
        </div>
      </div>
    </div>
  );
}
