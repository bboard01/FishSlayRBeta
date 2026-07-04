import { useRef } from 'react';
import { useData } from '../lib/DataContext.jsx';
import { normalizeRefs, DEFAULT_REFS } from '../lib/refs.js';
import { photoClearAll } from '../lib/photos.js';
import { chapterStats, chapterIcon, seasonDisplayName } from '../lib/seasons.js';
import { FishAudio, unlock, setAudioSettings } from '../lib/audio.js';

// Rig Box — the settings / Season Manager screen. Ported from the single-file
// app's renderRigboxV1() + seasonCardsV1(): the same hero, active-season card,
// Season Manager, lineage explainer, backups/demo tools, app preferences
// (Dock/Water + FishAudio), reference library, and the Factory Reset danger
// zone. Wording is preserved verbatim.
//
// Season start/rename open the shared SeasonSheet (handled by App via onSheet).
// Everything that mutates settings flags the profile dirty so it syncs.
//
// Props:
//   onStartSeason(): open the "Start a New Season" sheet
//   onRenameSeason(season): open the rename sheet for a season
//   onStartTrip(): open the New Trip sheet
//   onOpenLivewell(): jump to the active livewell
//   onToast(msg): show a toast
export default function RigBox({ onStartSeason, onRenameSeason, onStartTrip, onOpenLivewell, onToast, onOpenAudioLab }) {
  const { data, update, updateProfile, replaceData, scheduleSync, currentSeason, activeSession } = useData();
  const fileRef = useRef(null);

  const season = currentSeason() || data.seasons[0] || {};
  const stats = chapterStats(data, season.id);
  const trip = activeSession();
  const best = stats.biggest || {};
  const soundOn = !!data.sound?.enabled;

  // --- Season switching (ported from setSeason): change the active pointer,
  // flag the profile dirty (the active season rides on the profile). ---
  const setSeason = (id) => {
    updateProfile((prev) => ({ ...prev, activeSeason: id }));
    const s = data.seasons.find((x) => x.id === id) || { id };
    onToast && onToast('Season changed to ' + seasonDisplayName(s));
  };

  // --- Archive / reopen (ported from toggleArchiveSeason). ---
  const toggleArchive = (id) => {
    const s = data.seasons.find((x) => x.id === id);
    if (!s) { onToast && onToast('No season selected'); return; }
    const nowISO = new Date().toISOString();
    if (!s.archived) {
      if (!window.confirm(
        `Archive "${s.name || s.id}"?\n\nTrips, catches, livewells, and stories stay available. New trips should usually go into a new open season.`
      )) return;
      update((prev) => ({
        ...prev,
        seasons: prev.seasons.map((x) =>
          x.id === id
            ? { ...x, archived: true, archivedOn: nowISO.slice(0, 10), updated_at: nowISO, _dirty: true }
            : x
        ),
        // Close out any active trip in this season, mirroring the original.
        sessions: prev.sessions.map((x) =>
          x.season === id && x.active
            ? { ...x, active: false, end: x.end || new Date().toTimeString().slice(0, 5) }
            : x
        ),
      }));
      onToast && onToast('✓ Season archived. The river remembers.');
    } else {
      update((prev) => ({
        ...prev,
        seasons: prev.seasons.map((x) => {
          if (x.id !== id) return x;
          const { archivedOn, ...rest } = x;
          return { ...rest, archived: false, updated_at: nowISO, _dirty: true };
        }),
      }));
      onToast && onToast('Season reopened');
    }
  };

  // --- Display mode Dock/Water (ported from setMode). Syncs via profile. ---
  const setMode = (m) => {
    updateProfile((prev) => ({ ...prev, mode: m }));
    onToast && onToast(m === 'water' ? 'Water Mode engaged' : 'Dock Mode engaged');
  };

  // --- FishAudio toggle (ported from toggleSound). Syncs via profile. ---
  const toggleSound = () => {
    const willEnable = !soundOn;
    updateProfile((prev) => ({
      ...prev,
      sound: { ...(prev.sound || {}), enabled: !prev.sound?.enabled },
    }));
    // Unlock the AudioContext on this gesture and play the sonar confirmation so
    // enabling sound is audible immediately (matches the original toggleSound).
    if (willEnable) { unlock(); setAudioSettings({ ...(data.sound || {}), enabled: true }); FishAudio.play('sonar'); }
    onToast && onToast(willEnable ? 'FishAudio enabled' : 'Sound muted');
  };

  // Open the hidden FishAudio Lab (the same panel five logo taps unlock).
  const openAudioLab = () => { onOpenAudioLab && onOpenAudioLab(); };

  // --- Export JSON (ported from exportJSON). ---
  const exportJSON = () => {
    const b = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(b);
    a.download = 'FishSlayR_GenesisIII_Journal.json';
    a.click();
    URL.revokeObjectURL(a.href);
  };

  // --- Import JSON (ported from importJSON). Replaces the local journal, then
  // marks everything dirty so the imported data pushes to the cloud. ---
  const importJSON = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const r = new FileReader();
    r.onload = () => {
      try {
        const parsed = JSON.parse(r.result);
        parsed.refs = normalizeRefs(parsed);
        const nowISO = new Date().toISOString();
        parsed.seasons = (parsed.seasons || []).map((s) => ({ ...s, _dirty: true, updated_at: s.updated_at || nowISO }));
        parsed.sessions = (parsed.sessions || []).map((s) => ({ ...s, _dirty: true, updated_at: s.updated_at || nowISO }));
        parsed.catches = (parsed.catches || []).map((c) => ({ ...c, _dirty: true, updated_at: c.updated_at || nowISO }));
        parsed._profileDirty = true;
        parsed._profileUpdatedAt = nowISO;
        replaceData(parsed);
        scheduleSync();
        onToast && onToast('FishSlayR data imported');
      } catch {
        onToast && onToast('Import failed');
      }
    };
    r.readAsText(file);
    e.target.value = '';
  };

  // --- Factory Reset (ported from clearAllTestData). Keeps refs + sound, wipes
  // trips/catches, clears the photo store, starts a fresh current-year season. ---
  const factoryReset = () => {
    if (!window.confirm(
      'Clear all fishing test data?\n\nThis removes trips, catches, livewells, campfire stories, waters visited, trophy progress, and intelligence history.\n\nYour option lists stay available.'
    )) return;
    const year = String(new Date().getFullYear());
    const refs = JSON.parse(JSON.stringify(data.refs || DEFAULT_REFS));
    const sound = JSON.parse(JSON.stringify(data.sound || { enabled: false, master: 0.68, effects: 0.75, haptics: true }));
    photoClearAll();
    const nowISO = new Date().toISOString();
    replaceData({
      version: data.version || 'FishSlayR v2',
      mode: data.mode || 'dock',
      sound,
      activeSeason: year,
      seasons: [{ id: year, name: year + ' — New Season', archived: false, _dirty: true, updated_at: nowISO }],
      refs,
      sessions: [],
      catches: [],
      _profileDirty: true,
      _profileUpdatedAt: nowISO,
    });
    scheduleSync();
    onToast && onToast('🌊 The river is quiet again. Ready for another adventure.');
  };

  // --- Load demo data: parity with the original's "Load Demo Data" button.
  // The single-file app shipped a sample() journal; the React build doesn't yet
  // carry a demo fixture, so this stays disabled with a clear title rather than
  // silently doing nothing. (Port sample() if a demo dataset is wanted.) ---

  // Sorted season list for the manager (newest first), ported from seasonCardsV1.
  const seasons = (data.seasons || []).slice().sort((a, b) =>
    String(b.created || b.id || '').localeCompare(String(a.created || a.id || ''))
  );

  return (
    <div className="grid rigbox-v1">
      {/* Hero + active-season card */}
      <div className="glass panel span12 rigbox-hero-v1">
        <div className="rigbox-hero-layout">
          <div>
            <span className="eyebrow">Rig Box • FishSlayR Setup</span>
            <h2 className="rigbox-title">Keep the season ready.</h2>
            <p className="journal-subtitle">
              Manage Seasons, protect your data, tune the app, and keep the
              on-water workflow clean. Everything stays local in this browser.
            </p>
            <div className="actions" style={{ marginTop: 16 }}>
              <button className="btn primary" onClick={onStartSeason}>Start New Season</button>
              <button className="btn" onClick={onStartTrip}>Start a Trip</button>
              {trip && <button className="btn gold" onClick={onOpenLivewell}>Open Active Livewell</button>}
            </div>
          </div>
          <div className="rigbox-active-season">
            <span>Active Season</span>
            <h3>{season.name || season.id}</h3>
            <small className="muted">{season.archived ? 'Archived Season' : 'Open Season'}</small>
            <div className="rigbox-mini-stats">
              <div className="rigbox-mini-stat"><small>Trips</small><strong>{stats.sessions.length}</strong></div>
              <div className="rigbox-mini-stat"><small>Fish</small><strong>{stats.catches.length}</strong></div>
              <div className="rigbox-mini-stat"><small>Best</small><strong>{best.length ? best.length + '"' : '—'}</strong></div>
            </div>
          </div>
        </div>
      </div>

      {/* Season Manager */}
      <div className="glass panel span8">
        <div className="rigbox-section-head">
          <div>
            <h3>Season Manager</h3>
            <p className="muted">
              Switch Seasons without moving data. Trips remain attached to the
              Season where they were logged.
            </p>
          </div>
          <div className="actions">
            <button className="btn small" onClick={() => onRenameSeason(season)}>Rename Active</button>
            <button className="btn small gold" onClick={() => toggleArchive(season.id)}>
              {season.archived ? 'Reopen Season' : 'Archive Season'}
            </button>
          </div>
        </div>
        {seasons.length ? (
          <div className="rigbox-season-list">
            {seasons.map((s) => {
              const st = chapterStats(data, s.id);
              const active = s.id === data.activeSeason;
              const b = st.biggest || {};
              return (
                <div key={s.id} className={'rigbox-season-card ' + (active ? 'active ' : '') + (s.archived ? 'archived' : '')}>
                  <div className="rigbox-season-card-head">
                    <span className="rigbox-season-status">
                      {active ? 'Active Season' : s.archived ? 'Archived Season' : 'Season'}
                    </span>
                    <span>{chapterIcon(s)}</span>
                  </div>
                  <h4>{s.name || s.id}</h4>
                  <small>Season ID: {s.id}</small>
                  <div className="rigbox-season-metrics">
                    <span>{st.sessions.length} trips</span>
                    <span>{st.catches.length} fish</span>
                    <span>{b.length ? 'Best ' + b.length + '"' : 'No fish yet'}</span>
                  </div>
                  {!active && (
                    <button className="btn small" onClick={() => setSeason(s.id)}>Make Active</button>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="journal-empty">No Seasons yet. Start one to begin.</div>
        )}
      </div>

      {/* Lineage explainer */}
      <div className="glass panel span4">
        <h3>How FishSlayR is organized</h3>
        <p className="muted">The relationship is simple and permanent.</p>
        <div className="rigbox-lineage">
          <div className="rigbox-lineage-node"><i>☀️</i><strong>Season</strong><small className="muted">The active context</small></div>
          <div className="rigbox-lineage-arrow">→</div>
          <div className="rigbox-lineage-node"><i>🛶</i><strong>Trip</strong><small className="muted">A day on the water</small></div>
          <div className="rigbox-lineage-arrow">→</div>
          <div className="rigbox-lineage-node"><i>🐟</i><strong>Fish</strong><small className="muted">A catch in that trip</small></div>
        </div>
      </div>

      {/* Backups & Demo */}
      <div className="glass panel span6">
        <h3>Backups & Demo Data</h3>
        <p className="muted">Export before major changes. Imports replace the current local journal.</p>
        <div className="rigbox-tool-grid">
          <div className="rigbox-tool">
            <strong>Backup</strong>
            <small>Save or restore the complete FishSlayR journal as JSON.</small>
            <div className="actions">
              <button className="btn" onClick={exportJSON}>Export</button>
              <button className="btn" onClick={() => fileRef.current?.click()}>Import</button>
              <input ref={fileRef} type="file" accept="application/json" style={{ display: 'none' }} onChange={importJSON} />
            </div>
          </div>
          <div className="rigbox-tool">
            <strong>Demo</strong>
            <small>Reload the full sample Season for feature testing.</small>
            <button className="btn gold" disabled title="Demo dataset not yet ported to the new build">Load Demo Data</button>
          </div>
        </div>
      </div>

      {/* App Preferences */}
      <div className="glass panel span6">
        <h3>App Preferences</h3>
        <p className="muted">Choose the working view and FishAudio behavior.</p>
        <div className="rigbox-tool-grid">
          <div className="rigbox-tool">
            <strong>Display Mode</strong>
            <small>Dock for the full journal. Water for a focused on-water view.</small>
            <div className="actions">
              <button className={'btn ' + (data.mode === 'dock' ? 'primary' : '')} onClick={() => setMode('dock')}>Dock</button>
              <button className={'btn ' + (data.mode === 'water' ? 'primary' : '')} onClick={() => setMode('water')}>Water</button>
            </div>
          </div>
          <div className="rigbox-tool">
            <strong>FishAudio</strong>
            <small>{soundOn ? 'Sound is enabled.' : 'Sound is muted.'}</small>
            <div className="actions">
              <button className="btn" onClick={toggleSound}>{soundOn ? 'Mute' : 'Enable Sound'}</button>
              <button className="btn" onClick={openAudioLab}>Audio Lab</button>
            </div>
          </div>
        </div>
      </div>

      {/* Reference Library (collapsible) */}
      <details className="glass panel rigbox-library">
        <summary>
          <span>Reference Library <small className="muted">Species, lures, waters, methods, conditions, and other defaults</small></span>
        </summary>
        <div className="rigbox-library-body">
          <p className="muted">
            These bundled choices power trip and catch forms. Export your journal
            before importing customized reference data.
          </p>
          <div className="compact-ref">
            {Object.entries(data.refs || {}).map(([k, v]) => (
              <span key={k} className="chip">{k}: {Array.isArray(v) ? v.length : 0}</span>
            ))}
          </div>
        </div>
      </details>

      {/* Factory Reset danger zone */}
      <div className="glass panel span12 rigbox-danger">
        <div className="rigbox-danger-layout">
          <div>
            <h3>Factory Reset</h3>
            <p className="muted">
              Permanently remove every local Season, trip, fish, preference,
              filter, and custom choice. Export a backup first if anything matters.
            </p>
          </div>
          <div className="actions">
            <button className="btn danger" onClick={factoryReset}>Factory Reset FishSlayR</button>
          </div>
        </div>
      </div>
    </div>
  );
}
