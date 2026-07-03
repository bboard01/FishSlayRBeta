import { useState } from 'react';
import { useData } from '../lib/DataContext.jsx';
import { suggestedSeasonId, seasonMoodName } from '../lib/seasons.js';

// Start-a-new-season and rename-a-season sheet. Ported from the single-file
// app's openStartSeasonSheet()/saveNewSeason() and openRenameSeasonSheet()/
// saveSeasonRename(). Same wording, same fields, same behavior. Seasons sync as
// part of the journal (each season record is touched dirty; the active-season
// pointer rides on the profile), so both cases flag things for the next push.
//
// Props:
//   mode: 'start' | 'rename'
//   season: the season object to rename (rename mode only)
//   onClose(): dismiss
//   onDone(msg): called after save with a toast message
export default function SeasonSheet({ mode, season, onClose, onDone }) {
  const { data, update } = useData();
  const isRename = mode === 'rename';

  const [f, setF] = useState(() => {
    if (isRename) {
      const s = season || {};
      return {
        id: s.id || '',
        name: s.name || s.id || '',
        status: s.archived ? 'archived' : 'open',
        notes: s.notes || '',
      };
    }
    return {
      id: suggestedSeasonId(data),
      name: seasonMoodName() + ' ' + new Date().getFullYear() + ' — New Water',
      status: 'open',
      notes: 'A new chapter begins.',
    };
  });

  const set = (k, v) => setF((prev) => ({ ...prev, [k]: v }));

  // Ported from saveNewSeason(): reject blank/dupe IDs, append the season, make
  // it active, deactivate every trip so the new season starts clean, and mark
  // the season + profile dirty for sync.
  const saveNew = () => {
    const id = (f.id || suggestedSeasonId(data)).trim();
    if (!id) { onDone && onDone('Season needs an ID'); return; }
    if (data.seasons.some((s) => s.id === id)) { onDone && onDone('That season ID already exists'); return; }

    const created = new Date().toISOString().slice(0, 10);
    const nowISO = new Date().toISOString();
    const season = {
      id,
      name: f.name || id,
      archived: f.status === 'archived',
      notes: f.notes || '',
      created,
      updated_at: nowISO,
      _dirty: true,
    };

    update((prev) => ({
      ...prev,
      seasons: [...prev.seasons, season],
      activeSeason: id,
      sessions: prev.sessions.map((s) => ({ ...s, active: false })),
      _profileDirty: true,
      _profileUpdatedAt: nowISO,
    }));
    onClose();
    onDone && onDone('🌅 A new season begins');
  };

  // Ported from saveSeasonRename(): update name/status/notes in place, touch the
  // season dirty. ID stays fixed (disabled input).
  const saveRename = () => {
    const nowISO = new Date().toISOString();
    update((prev) => ({
      ...prev,
      seasons: prev.seasons.map((s) =>
        s.id === f.id
          ? {
              ...s,
              name: f.name || s.name || s.id,
              archived: f.status === 'archived',
              notes: f.notes || '',
              updated_at: nowISO,
              _dirty: true,
            }
          : s
      ),
    }));
    onClose();
    onDone && onDone('Season updated');
  };

  return (
    <div className="sheet-backdrop active" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-head">
          <div>
            <h2>{isRename ? 'Rename Season' : 'Start a New Season'}</h2>
            <div className="muted">
              {isRename
                ? 'Give this chapter a name worth remembering.'
                : 'A new chapter begins. Old seasons stay in Campfire and Intelligence.'}
            </div>
          </div>
          <button className="btn small" onClick={onClose}>Close</button>
        </div>

        <div className="sheet-body">
          <div className="details">
            <label>
              Season ID
              <input value={f.id} disabled={isRename} onChange={(e) => set('id', e.target.value)} />
            </label>
            <label>
              Season Name
              <input value={f.name} onChange={(e) => set('name', e.target.value)} />
            </label>
            <label>
              {isRename ? 'Status' : 'Season Status'}
              <select value={f.status} onChange={(e) => set('status', e.target.value)}>
                <option value="open">{isRename ? 'Open' : 'Open / Active'}</option>
                <option value="archived">Archived</option>
              </select>
            </label>
            <textarea value={f.notes} onChange={(e) => set('notes', e.target.value)} />
          </div>
        </div>

        <div className="sheet-actions">
          <button className="btn" onClick={onClose}>Cancel</button>
          <button className="btn primary" onClick={isRename ? saveRename : saveNew}>
            {isRename ? 'Save Season' : 'Start Season'}
          </button>
        </div>
      </div>
    </div>
  );
}
