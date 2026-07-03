import { useState } from 'react';
import { useData, uid } from '../lib/DataContext.jsx';
import {
  ensureTemplates, templateFromForm, applyTemplateToForm,
  templateIcon, templateSummary, templateName, MAX_TEMPLATES,
} from '../lib/templates.js';

// The New Trip sheet — ported from the single-file app's openSessionSheet() +
// saveSession(). Same "Where are we headed?" framing, the same full context
// form (title, water, crew, conditions…), the same defaults, and "Launch Trip"
// which starts an active session in the current season. Trip Templates let a
// recurring trip's context be saved and re-applied in one tap; they sync via
// the profile (data.tripTemplates → profiles.trip_templates), the same pattern
// as tackle loadouts.

// Field defaults, mirroring openSessionSheet().
const DEFAULTS = {
  title: 'Morning Mist',
  country: 'United States',
  state: 'PA',
  waterType: '',
  water: '',
  launch: '',
  area: 'Harrisburg islands',
  partners: 'Brian',
  boat: '',
  method: '',
  techniqueFocus: '',
  target: '',
  weather: 'Partly cloudy',
  clarity: '',
  flow: 'Moderate current',
  spawnPhase: '',
  temp: 68,
  air: 74,
  sky: '',
  moon: '',
  notes: 'A new chapter begins.',
};

function Select({ label, value, onChange, options }) {
  return (
    <label>
      {label}
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        {(options || []).map((x) => <option key={x}>{x}</option>)}
      </select>
    </label>
  );
}

export default function NewTrip({ onClose, onLaunched }) {
  const { data, update, updateProfile, currentSeason } = useData();
  const refs = data.refs || {};
  const templates = ensureTemplates(data);

  // Seed each field with its default, falling back to the first ref option so a
  // select is never empty (matches how the original's <option> lists render).
  const [f, setF] = useState(() => ({
    ...DEFAULTS,
    waterType: refs.waterTypes?.[0] || '',
    water: refs.waters?.[0] || '',
    launch: refs.launches?.[0] || '',
    boat: refs.boats?.[0] || '',
    method: refs.methods?.[0] || '',
    techniqueFocus: refs.techniqueFocus?.[0] || '',
    target: refs.species?.[0] || '',
    clarity: refs.clarity?.[0] || '',
    spawnPhase: refs.spawnPhase?.[0] || '',
    sky: refs.sky?.[0] || '',
    moon: refs.moon?.[0] || '',
  }));

  const set = (key, value) => setF((prev) => ({ ...prev, [key]: value }));

  // Save the current form as a reusable template (profile-synced). Names it
  // after the trip title by default; if a template with that label exists,
  // overwrite it so re-saving a tweaked "Morning Mist" doesn't pile up dupes.
  const saveAsTemplate = () => {
    const label = (window.prompt('Name this trip template', f.title || 'Trip Template') || '').trim();
    if (!label) return;
    updateProfile((prev) => {
      const arr = ensureTemplates(prev).slice();
      const existing = arr.findIndex((t) => (t.label || '').toLowerCase() === label.toLowerCase());
      const rec = templateFromForm(existing >= 0 ? arr[existing].id : uid(), f, label);
      if (existing >= 0) arr[existing] = rec;
      else {
        arr.unshift(rec);
        if (arr.length > MAX_TEMPLATES) arr.length = MAX_TEMPLATES; // keep the newest
      }
      return { ...prev, tripTemplates: arr };
    });
  };

  // Apply a saved template into the form (does not launch — the user can still
  // tweak conditions, then hit Launch Trip).
  const applyTemplate = (t) => setF((prev) => applyTemplateToForm(prev, t));

  // Remove a template.
  const deleteTemplate = (id) => {
    updateProfile((prev) => ({
      ...prev,
      tripTemplates: ensureTemplates(prev).filter((t) => t.id !== id),
    }));
  };

  // Ported from saveSession(): deactivate other trips in this season, push the
  // new active session, mark it dirty for sync, and drop into it.
  const launch = () => {
    const cs = currentSeason();
    if (cs?.archived &&
        !window.confirm('This season is archived. Start a trip here anyway?\n\nUsually you should start a new season first from Rig Box.')) {
      return;
    }

    const session = {
      id: uid(),
      season: data.activeSeason,
      active: true,
      title: f.title,
      name: f.title,
      date: new Date().toISOString().slice(0, 10),
      start: new Date().toTimeString().slice(0, 5),
      end: '',
      country: f.country,
      state: f.state || 'PA',
      waterType: f.waterType,
      water: f.water,
      launch: f.launch,
      area: f.area,
      partners: String(f.partners).split(',').map((x) => x.trim()).filter(Boolean),
      boat: f.boat,
      method: f.method,
      techniqueFocus: f.techniqueFocus,
      weather: f.weather,
      clarity: f.clarity,
      waterTemp: +f.temp || '',
      airTemp: +f.air || '',
      flow: f.flow,
      wind: '',
      sky: f.sky,
      target: f.target,
      spawnPhase: f.spawnPhase,
      moon: f.moon,
      notes: f.notes,
      updated_at: new Date().toISOString(),
      _dirty: true,
    };

    update((prev) => ({
      ...prev,
      sessions: [
        ...prev.sessions.map((s) =>
          s.season === prev.activeSeason ? { ...s, active: false } : s
        ),
        session,
      ],
    }));
    onClose();
    if (onLaunched) onLaunched(session);
  };

  return (
    <div className="sheet-backdrop active" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-head">
          <div>
            <h2>Where are we headed?</h2>
            <div className="muted">Trip context makes on-water logging effortless.</div>
          </div>
          <button className="btn small" onClick={onClose}>Close</button>
        </div>

        <div className="sheet-body">
          {templates.length > 0 && (
            <div className="trip-template-picker">
              <span className="label">Start from a template</span>
              <div className="trip-template-row">
                {templates.map((t, i) => (
                  <button
                    key={t.id}
                    type="button"
                    className="trip-template-chip"
                    onClick={() => applyTemplate(t)}
                    title="Apply this template to the form"
                  >
                    <span className="tt-icon">{templateIcon(t)}</span>{' '}
                    <strong>{templateName(t, i)}</strong>
                    <small style={{ display: 'block', color: 'var(--muted)', fontWeight: 850 }}>
                      {templateSummary(t)}
                    </small>
                    <span
                      role="button"
                      tabIndex={0}
                      onClick={(e) => { e.stopPropagation(); deleteTemplate(t.id); }}
                      onKeyDown={(e) => { if (e.key === 'Enter') { e.stopPropagation(); deleteTemplate(t.id); } }}
                      style={{ float: 'right', color: '#ffb3c0', cursor: 'pointer', fontWeight: 950 }}
                      title="Delete template"
                    >
                      ✕
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="details">
            <label>
              Trip Title
              <input value={f.title} onChange={(e) => set('title', e.target.value)} />
            </label>
            <Select label="Country" value={f.country} onChange={(v) => set('country', v)} options={refs.countries} />
            <label>
              State / Province
              <input value={f.state} onChange={(e) => set('state', e.target.value)} />
            </label>
            <Select label="Water Type" value={f.waterType} onChange={(v) => set('waterType', v)} options={refs.waterTypes} />
            <Select label="Water" value={f.water} onChange={(v) => set('water', v)} options={refs.waters} />
            <Select label="Launch / Ramp" value={f.launch} onChange={(v) => set('launch', v)} options={refs.launches} />
            <label>
              Area
              <input value={f.area} onChange={(e) => set('area', e.target.value)} />
            </label>
            <label>
              Partner / Crew
              <input
                value={f.partners}
                onChange={(e) => set('partners', e.target.value)}
                list="partnerList"
              />
              <datalist id="partnerList">
                {(refs.partners || []).map((x) => <option key={x} value={x} />)}
              </datalist>
            </label>
            <Select label="Boat / Method" value={f.boat} onChange={(v) => set('boat', v)} options={refs.boats} />
            <Select label="Fishing Method" value={f.method} onChange={(v) => set('method', v)} options={refs.methods} />
            <Select label="Technique Focus" value={f.techniqueFocus} onChange={(v) => set('techniqueFocus', v)} options={refs.techniqueFocus} />
            <Select label="Target Species" value={f.target} onChange={(v) => set('target', v)} options={refs.species} />
            <Select label="Weather" value={f.weather} onChange={(v) => set('weather', v)} options={refs.weather} />
            <Select label="Water Clarity" value={f.clarity} onChange={(v) => set('clarity', v)} options={refs.clarity} />
            <Select label="Flow / Current" value={f.flow} onChange={(v) => set('flow', v)} options={refs.flow} />
            <Select label="Spawn / Seasonal Phase" value={f.spawnPhase} onChange={(v) => set('spawnPhase', v)} options={refs.spawnPhase} />
            <label>
              Water Temp
              <input type="number" value={f.temp} onChange={(e) => set('temp', e.target.value)} />
            </label>
            <label>
              Air Temp
              <input type="number" value={f.air} onChange={(e) => set('air', e.target.value)} />
            </label>
            <Select label="Sky" value={f.sky} onChange={(v) => set('sky', v)} options={refs.sky} />
            <Select label="Moon" value={f.moon} onChange={(v) => set('moon', v)} options={refs.moon} />
            <textarea value={f.notes} onChange={(e) => set('notes', e.target.value)} />
          </div>
        </div>

        <div className="sheet-actions">
          <button className="btn" onClick={onClose}>Cancel</button>
          <button className="btn" onClick={saveAsTemplate} title="Save this trip's context as a reusable template">
            📋 Save as Template
          </button>
          <button className="btn primary" onClick={launch}>Launch Trip</button>
        </div>
      </div>
    </div>
  );
}
