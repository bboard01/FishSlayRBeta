import { useState } from 'react';
import { useData, uid } from '../lib/DataContext.jsx';
import { photoPut, photoDelete, processCatchPhoto, getLiveLocation } from '../lib/photos.js';
import {
  uniq,
  popularSpecies,
  popularLures,
  popularColors,
  prioritizeOptions,
  formatInches,
} from '../lib/refs.js';
import {
  MAX_LOADOUTS,
  LOADOUT_FIELDS,
  ensureLoadouts,
  loadoutIcon,
  loadoutSummary,
  loadoutName,
} from '../lib/loadouts.js';

// The multi-step "Land the Fish" flow — ported from the single-file app's
// catch sheet (Phase 2.1: speciesStep, lengthStep, lureStep, detailsStep) and
// landFish(). Same steps, same wording, same quick-pick + dropdown layout.
// Photo capture is intentionally deferred to the photo-layer port; the rest of
// the flow (species, length, lure/color/category/structure, details, notes)
// is complete and writes a real catch to local storage (offline-first), marked
// dirty so push sync sends it up when that lands.

const STEP_COUNT = 4;

// selectOptions() from the original prepends 'All' — preserved verbatim so the
// dropdowns read exactly like the single-file app.
function SelectOptions({ list, current }) {
  return ['All', ...list].map((v) => (
    <option key={v} value={v}>{v}</option>
  ));
}

export default function LogCatch({ onClose, onLanded, onToast, editCatch }) {
  const { data, activeSession, seasonCatches, biggest, update, updateProfile } = useData();
  const refs = data.refs || {};
  const session = activeSession();
  const isEdit = !!editCatch;

  // The working draft. New catches start from the openCatchSheet() defaults;
  // edits start as a copy of the existing catch (editCatch({...c})).
  const [draft, setDraft] = useState(() =>
    isEdit
      ? { ...editCatch }
      : {
          sessionId: session?.id,
          species: refs.species?.[0],
          length: 16,
          category: refs.lureCategories?.[0],
          lure: refs.lures?.[0],
          color: refs.colors?.[0],
          structure: refs.structure?.[0],
          presentation: refs.presentation?.[0],
          depth: refs.depth?.[0],
          disposition: refs.disposition?.[0],
          time: new Date().toTimeString().slice(0, 5),
          notes: '',
        }
  );
  const [step, setStep] = useState(0);
  const [photoStatus, setPhotoStatus] = useState('');

  const set = (key, value) => setDraft((d) => ({ ...d, [key]: value }));

  const loadouts = ensureLoadouts(data);

  // Apply a saved loadout to the draft and jump to the length step — ported from
  // applyLoadout(idx, true). Fills the rig fields and tags the active loadout.
  const applyLoadout = (i) => {
    const l = loadouts[i];
    if (!l) return;
    setDraft((d) => {
      const n = { ...d };
      LOADOUT_FIELDS.forEach((f) => { if (l[f]) n[f] = l[f]; });
      n._loadoutName = loadoutName(l, i);
      return n;
    });
    setStep(1);
    if (onToast) onToast('🧰 ' + (l.name || 'Loadout') + ' rigged');
  };

  // Save the current rig as a new loadout — ported from saveCurrentAsLoadout().
  const saveAsLoadout = () => {
    const outs = ensureLoadouts(data);
    if (outs.length >= MAX_LOADOUTS) {
      if (onToast) onToast('All 5 loadout slots are full — free one in the Tackle Box');
      return;
    }
    const name = ((draft.color ? draft.color + ' ' : '') + (draft.lure || 'Rig')).slice(0, 28);
    const l = { id: uid(), name, rod: '' };
    LOADOUT_FIELDS.forEach((f) => { l[f] = draft[f] || ''; });
    updateProfile((prev) => ({ ...prev, loadouts: [...(prev.loadouts || []), l] }));
    if (onToast) onToast('🧰 Saved “' + l.name + '” to your Tackle Box');
  };

  // Photo capture — ported from handleCatchPhoto(). Reads EXIF/GPS, builds a
  // thumbnail + display blob, and autofills time/location. The display blob is
  // held on the draft and written to IndexedDB at land time (needs the final id).
  const onPhoto = async (input) => {
    const file = input.files && input.files[0];
    if (!file) return;
    setPhotoStatus('Reading photo…');
    try {
      const { patch, status } = await processCatchPhoto(file, session || {});
      setDraft((d) => ({ ...d, ...patch }));
      setPhotoStatus(status);
    } catch (e) {
      console.warn('photo capture failed', e);
      setPhotoStatus('Could not read that photo. You can still log the fish.');
    }
  };

  const useLiveLocation = async () => {
    setPhotoStatus('Getting your location…');
    const loc = await getLiveLocation();
    if (loc) {
      setDraft((d) => ({ ...d, photoLat: loc.lat, photoLon: loc.lon, photoGeoSource: 'live' }));
      setPhotoStatus(`✓ Location captured (±${Math.round(loc.acc)}m)`);
    } else {
      setPhotoStatus('Location unavailable or denied.');
    }
  };

  const removePhoto = () => {
    setDraft((d) => {
      const n = { ...d };
      delete n._photoDispBlob; delete n.photoThumb; delete n.photoMeta;
      delete n.photoLat; delete n.photoLon; delete n.photoGeoSource; delete n._photoDateNote;
      n._photoRemoved = true; // signal save to delete any stored blob on edit
      return n;
    });
    setPhotoStatus('');
  };

  const nudgeLength = (delta) => {
    const v = Math.max(4, Math.min(30, (parseFloat(draft.length) || 16) + delta));
    set('length', Math.round(v * 4) / 4);
  };

  // Ported from landFish(): builds the catch object and saves it — a new catch
  // is appended, an edit replaces the existing record by id. Photo handling
  // mirrors the original (carry new photo, delete on removal, otherwise preserve
  // the prior photo untouched). New personal bests only count for new catches.
  const landFish = () => {
    const existing = isEdit ? draft.id : null;
    const s = session;
    // A new catch needs an active trip; an edit keeps its own sessionId.
    if (!existing && !s) return;

    const prevBig = biggest(seasonCatches())?.length || 0;
    const obj = {
      id: existing || uid(),
      sessionId: draft.sessionId || s?.id,
      species: draft.species,
      length: +draft.length || 0,
      weight: +draft.weight || 0,
      time: draft.time || new Date().toTimeString().slice(0, 5),
      category: draft.category || '',
      lure: draft.lure,
      color: draft.color,
      structure: draft.structure,
      presentation: draft.presentation || '',
      depth: draft.depth || '',
      disposition: draft.disposition || 'Released',
      rating: +draft.rating || 4,
      photoTag: draft.photoTag || '',
      notes: draft.notes || '',
      updated_at: new Date().toISOString(),
      _dirty: true,
    };

    // Photo handling, ported from landFish():
    // - new/changed photo: carry thumb+geo, write the display blob, flag dirty
    // - removed on edit: clear the flag and delete the stored blob
    // - untouched on edit: preserve the previously-saved photo fields
    if (draft.photoThumb) {
      obj.photoThumb = draft.photoThumb;
      obj.hasPhoto = true;
      obj._photoDirty = true;
      if (draft.photoMeta) obj.photoMeta = draft.photoMeta;
      if (draft.photoLat != null) {
        obj.photoLat = draft.photoLat;
        obj.photoLon = draft.photoLon;
        obj.photoGeoSource = draft.photoGeoSource || '';
      }
      if (draft._photoDispBlob) photoPut(obj.id, draft._photoDispBlob);
    } else if (existing && draft._photoRemoved) {
      obj.hasPhoto = false;
      photoDelete(obj.id);
    } else if (existing) {
      const prev = data.catches.find((x) => x.id === existing) || {};
      if (prev.photoThumb) {
        obj.photoThumb = prev.photoThumb;
        obj.hasPhoto = true;
        obj.photoMeta = prev.photoMeta;
        obj.photoLat = prev.photoLat;
        obj.photoLon = prev.photoLon;
        obj.photoGeoSource = prev.photoGeoSource;
      }
    }

    const isPB = !existing && (+obj.length || 0) > prevBig;

    update((prev) => ({
      ...prev,
      catches: existing
        ? prev.catches.map((x) => (x.id === existing ? obj : x))
        : [...prev.catches, obj],
    }));
    onClose();
    // On a new catch, jump to the livewell with the PB/regular toast. On an
    // edit, just confirm the save without moving the user.
    if (isEdit) {
      if (onToast) onToast('Catch updated');
    } else if (onLanded) {
      onLanded(obj, isPB);
    }
  };

  const next = () => (step === STEP_COUNT - 1 ? landFish() : setStep(step + 1));
  const back = () => (step === 0 ? onClose() : setStep(step - 1));

  const sub = session
    ? `Attached to ${session.title || session.name}`
    : 'Start a trip first';

  return (
    <div className="sheet-backdrop active" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-head">
          <div>
            <h2>{isEdit ? 'Edit Catch' : 'Land the Fish'}</h2>
            <div className="muted">{sub}</div>
          </div>
          <button className="btn small" onClick={onClose}>Close</button>
        </div>

        <div className="sheet-body">
          {step === 0 && (
            <>
              <h3 className="catch-step-title">What did you catch?</h3>
              <p className="catch-step-help">
                Tap a common target, or use the full species list. No duplicate
                mega-list, no fishing through dropdown chaos.
              </p>
              <div className="quick-grid">
                {uniq(popularSpecies(refs, session || {})).map((x) => (
                  <button
                    key={x}
                    type="button"
                    className={`quick-choice ${draft.species === x ? 'active' : ''}`}
                    onClick={() => set('species', x)}
                  >
                    <span>🐟</span>{x}
                  </button>
                ))}
              </div>
              <div className="quick-select-row single">
                <label>
                  Full Species List
                  <select value={draft.species} onChange={(e) => set('species', e.target.value)}>
                    <SelectOptions list={refs.species || []} current={draft.species} />
                  </select>
                </label>
              </div>
              {loadouts.length ? (
                <div className="loadout-quick">
                  <span className="eyebrow">Quick Rigs — tap to load</span>
                  <div className="loadout-chip-row">
                    {loadouts.map((l, i) => (
                      <button
                        key={l.id || i}
                        className={`loadout-chip ${draft._loadoutName === loadoutName(l, i) ? 'active' : ''}`}
                        onClick={() => applyLoadout(i)}
                      >
                        <span className="loadout-chip-icon">{loadoutIcon(l)}</span>
                        <strong>{loadoutName(l, i)}</strong>
                        <small>{loadoutSummary(l)}</small>
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="loadout-hint muted">
                  Tip: set up quick rigs in the Tackle Box to fill lure, color,
                  and depth in one tap.
                </div>
              )}
            </>
          )}

          {step === 1 && (
            <>
              <h3 className="catch-step-title">About how big?</h3>
              <div className="length-box">
                <div className="length-display">{formatInches(draft.length || 16)}</div>
                <input
                  className="range"
                  type="range"
                  min="4"
                  max="30"
                  step=".25"
                  value={draft.length || 16}
                  onChange={(e) => set('length', parseFloat(e.target.value) || 0)}
                />
                <div className="length-nudge">
                  <button className="btn" onClick={() => nudgeLength(-0.25)}>- ¼″</button>
                  <button className="btn" onClick={() => nudgeLength(0.25)}>+ ¼″</button>
                </div>
              </div>
            </>
          )}

          {step === 2 && (
            <div className="lure-stack">
              <div>
                <h3 className="catch-step-title">What caught it?</h3>
                <p className="catch-step-help">
                  Fast-pick the bait, then fine-tune color and category if you want.
                </p>
                <div className="quick-grid">
                  {uniq(popularLures(refs, session || {})).map((x) => (
                    <button
                      key={x}
                      type="button"
                      className={`quick-choice ${draft.lure === x ? 'active' : ''}`}
                      onClick={() => set('lure', x)}
                    >
                      <span>🪝</span>{x}
                    </button>
                  ))}
                </div>
              </div>
              <div className="quick-select-row">
                <label>
                  Specific Lure
                  <select value={draft.lure} onChange={(e) => set('lure', e.target.value)}>
                    <SelectOptions list={refs.lures || []} current={draft.lure} />
                  </select>
                </label>
                <label>
                  Color
                  <select value={draft.color} onChange={(e) => set('color', e.target.value)}>
                    <SelectOptions
                      list={prioritizeOptions(refs.colors || [], popularColors(refs, session || {}))}
                      current={draft.color}
                    />
                  </select>
                </label>
                <label>
                  Category
                  <select value={draft.category} onChange={(e) => set('category', e.target.value)}>
                    <SelectOptions list={refs.lureCategories || []} current={draft.category} />
                  </select>
                </label>
                <label>
                  Structure
                  <select value={draft.structure} onChange={(e) => set('structure', e.target.value)}>
                    <SelectOptions list={refs.structure || []} current={draft.structure} />
                  </select>
                </label>
              </div>
            </div>
          )}

          {step === 3 && (
            <>
              <h3>Photo &amp; last details — optional</h3>
              <div className="photo-capture">
                {draft.photoThumb ? (
                  <div className="photo-preview">
                    <img src={draft.photoThumb} alt="catch photo" />
                    <div className="photo-preview-actions">
                      <button className="btn small danger" onClick={removePhoto}>Remove Photo</button>
                    </div>
                  </div>
                ) : (
                  <label className="photo-drop">
                    <input
                      type="file"
                      accept="image/*"
                      capture="environment"
                      style={{ display: 'none' }}
                      onChange={(e) => onPhoto(e.target)}
                    />
                    <span className="photo-drop-icon">📷</span>
                    <strong>Take or choose a photo</strong>
                    <small>
                      Snaps the camera on your phone. Time and location fill in
                      automatically when the photo has them.
                    </small>
                  </label>
                )}
                <div className="photo-status">
                  {photoStatus || (draft._photoDateNote ? '⚠ ' + draft._photoDateNote : '')}
                </div>
                {draft.photoThumb && draft.photoLat == null && (
                  <button className="btn small" onClick={useLiveLocation}>
                    📍 Use my current location
                  </button>
                )}
                {draft.photoLat != null && (
                  <div className="photo-geo">
                    📍 {draft.photoLat.toFixed(4)}, {draft.photoLon.toFixed(4)} (
                    {draft.photoGeoSource === 'photo' ? 'from photo' : 'live'})
                  </div>
                )}
              </div>
              <div className="details">
                <label>
                  Time
                  <input
                    value={draft.time}
                    type="time"
                    onChange={(e) => set('time', e.target.value)}
                  />
                </label>
                <label>
                  Presentation
                  <select value={draft.presentation} onChange={(e) => set('presentation', e.target.value)}>
                    {(refs.presentation || []).map((x) => <option key={x}>{x}</option>)}
                  </select>
                </label>
                <label>
                  Depth
                  <select value={draft.depth} onChange={(e) => set('depth', e.target.value)}>
                    {(refs.depth || []).map((x) => <option key={x}>{x}</option>)}
                  </select>
                </label>
                <label>
                  Disposition
                  <select value={draft.disposition} onChange={(e) => set('disposition', e.target.value)}>
                    {(refs.disposition || []).map((x) => <option key={x}>{x}</option>)}
                  </select>
                </label>
                <label>
                  Weight
                  <input
                    value={draft.weight || ''}
                    type="number"
                    step=".1"
                    onChange={(e) => set('weight', e.target.value)}
                  />
                </label>
                <label>
                  Photo Tag
                  <select value={draft.photoTag || ''} onChange={(e) => set('photoTag', e.target.value)}>
                    {(refs.photoTags || []).map((x) => <option key={x}>{x}</option>)}
                  </select>
                </label>
                <label>
                  Fight Rating
                  <input
                    value={draft.rating || 4}
                    type="number"
                    min="1"
                    max="5"
                    onChange={(e) => set('rating', e.target.value)}
                  />
                </label>
                <textarea
                  placeholder="Notes"
                  value={draft.notes || ''}
                  onChange={(e) => set('notes', e.target.value)}
                />
              </div>
              <div className="save-loadout-row">
                <button className="btn small" onClick={saveAsLoadout}>
                  🧰 Save this rig as a Loadout
                </button>
              </div>
            </>
          )}
        </div>

        <div className="sheet-actions">
          <button className="btn" onClick={back}>{step === 0 ? 'Cancel' : 'Back'}</button>
          <div className="muted" style={{ fontWeight: 900, fontSize: '.82rem' }}>
            Step {step + 1} of {STEP_COUNT}
          </div>
          <button className="btn primary" onClick={next}>
            {step === STEP_COUNT - 1 ? (isEdit ? 'SAVE' : 'LAND IT') : 'Continue'}
          </button>
        </div>
      </div>
    </div>
  );
}
