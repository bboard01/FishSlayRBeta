import { useState } from 'react';
import { useData } from '../lib/DataContext.jsx';
import { esc } from '../lib/fishDisplay.js';
import {
  DEFAULT_WATER_STATE, selectedWaterStats, allWaterStats, waterTypeOptions,
  waterIconForType, waterCoverClass, waterPersona, waterMemoryLine,
  waterSpeciesEntries, sampleLabel, tripChapterInfo,
} from '../lib/waters.js';

// Waters "Passport" — ported from the single-file app's renderWaters(). Each
// water becomes a passport page: a persona hero, a console (book/type/sort/open
// water), postcards, a stylized memory map with pins, a field journal, a species
// shelf, and chapter cards that jump into that trip's Livewell. Read-only; no
// mutations, so nothing here touches sync. Markup/wording preserved; the
// water-* CSS is already in app.css.
//
// waterMemoryLine builds bolded HTML → dangerouslySetInnerHTML (matches original).
const H = (html) => ({ __html: html });

export default function Waters({ onOpenLivewell, onPlanTrip, onAskIntelligence, onOpenStories, onToast }) {
  const { data } = useData();
  const [waterState, setWaterState] = useState(DEFAULT_WATER_STATE);

  const { stats, selected } = selectedWaterStats(data, waterState);
  const all = allWaterStats(data, waterState);
  const cover = waterCoverClass(selected?.type);
  const types = waterTypeOptions(data);

  // setWaterAtlas: changing scope/type clears the selection (re-defaults).
  const setWater = (key, val) =>
    setWaterState((prev) => ({ ...prev, [key]: val, ...(key === 'scope' || key === 'type' ? { selected: null } : {}) }));
  const selectWater = (name) => setWaterState((prev) => ({ ...prev, selected: name }));

  const species = waterSpeciesEntries(selected);
  const chapters = selected
    ? selected.sessions.slice().sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')))
    : [];

  return (
    <div className="grid">
      {/* Passport hero */}
      <div className="glass panel span12 water-passport-hero">
        <div className="water-passport-grid">
          <div>
            <span className="eyebrow">Waters • Passport</span>
            <span className="water-persona">{waterPersona(selected)}</span>
            <h2 className="water-title">{selected?.name || 'Your Waters'}</h2>
            <p className="water-storyline" dangerouslySetInnerHTML={H(waterMemoryLine(selected))} />
            <div className="water-passport-actions">
              {selected && (
                <>
                  <button className="btn primary" onClick={() => onPlanTrip && onPlanTrip(selected.name)}>Plan a Trip Here</button>
                  <button className="btn" onClick={() => onAskIntelligence && onAskIntelligence(selected.name)}>Ask River Intelligence</button>
                </>
              )}
              <button className="btn gold" onClick={() => onOpenStories && onOpenStories()}>Open Season Stories</button>
            </div>
            {selected && (
              <div className="water-stamp-row">
                <div className="water-stamp gold"><span>Passport Stamp</span><strong>{waterPersona(selected)}</strong></div>
                <div className="water-stamp"><span>Trips</span><strong>{selected.trips}</strong></div>
                <div className="water-stamp"><span>Fish</span><strong>{selected.fish}</strong></div>
                <div className="water-stamp"><span>Best</span><strong>{selected.best.length || 0}"</strong></div>
                <div className="water-stamp"><span>Success</span><strong>{selected.success}%</strong></div>
              </div>
            )}
          </div>
          <div className={`water-cover-panel ${cover}`}>
            <span className="water-cover-icon">{waterIconForType(selected?.type)}</span>
            <span className="eyebrow">Water Cover</span>
            <h3>{selected?.name || 'Uncharted Water'}</h3>
            <p>
              {selected
                ? `${selected.type} • ${selected.fish} fish remembered • ${selected.trips} trip${selected.trips === 1 ? '' : 's'} in the book`
                : 'Every water gets its own cover once you fish it.'}
            </p>
          </div>
        </div>

        {/* Console */}
        <div className="water-passport-console">
          <label>Book
            <select value={waterState.scope} onChange={(e) => setWater('scope', e.target.value)}>
              <option value="currentSeason">This Season</option>
              <option value="all">All Waters / All Time</option>
            </select>
          </label>
          <label>Water Type
            <select value={waterState.type} onChange={(e) => setWater('type', e.target.value)}>
              {['All', ...types].map((v) => <option key={v} value={v}>{v}</option>)}
            </select>
          </label>
          <label>Sort Postcards
            <select value={waterState.sort} onChange={(e) => setWater('sort', e.target.value)}>
              <option value="efficiency">Best Time Invested</option>
              <option value="fish">Most Fish</option>
              <option value="best">Biggest Fish</option>
              <option value="recent">Most Recent</option>
            </select>
          </label>
          <label>Open Water
            <select value={selected?.name || ''} onChange={(e) => selectWater(e.target.value)}>
              {all.map((s) => <option key={s.name} value={s.name}>{s.name}</option>)}
            </select>
          </label>
        </div>
      </div>

      {/* Postcards */}
      <div className="glass panel span12">
        <h3>Choose a Water</h3>
        <p className="muted">This is less of a dashboard and more of a passport. Each water becomes a place you can reopen, remember, and plan around.</p>
        {all.length ? (
          <div className="water-dock">
            {all.map((s) => (
              <button
                key={s.name}
                className={`water-postcard ${waterCoverClass(s.type)} ${s.name === selected?.name ? 'active' : ''}`}
                onClick={() => selectWater(s.name)}
              >
                <span className="postcard-label">{waterPersona(s)}</span>
                <span className="postcard-icon">{waterIconForType(s.type)}</span>
                <h4>{s.name}</h4>
                <strong>{s.fish}</strong>
                <small>{s.trips} trips • {s.fpt.toFixed(1)} fish/trip • best {s.best.length || 0}"</small>
                <div className="water-chips">
                  <span className="water-chip gold">{s.topColor.label} {s.topLure.label}</span>
                  <span className="water-chip green">{s.topSpecies.label}</span>
                  <span className="water-chip">{s.topMonth.label}</span>
                </div>
              </button>
            ))}
          </div>
        ) : (
          <div className="intel-empty">No waters yet. Start a trip and this becomes your passport.</div>
        )}
      </div>

      {/* Memory map */}
      <div className="glass panel span7 water-memory-map">
        <h3>Water Memory Map</h3>
        <p className="muted">A stylized map of your fishing places. Big markers mean waters with bigger stories.</p>
        {stats.slice(0, 24).map((s, i) => (
          <button
            key={s.name}
            className={`water-memory-pin ${s.fish >= 25 ? 'big' : ''} ${s.name === selected?.name ? 'active' : ''}`}
            style={{ left: `${13 + (i * 13) % 76}%`, top: `${23 + (i * 19) % 58}%` }}
            onClick={() => selectWater(s.name)}
            title={s.name}
          >
            {waterIconForType(s.type)}
          </button>
        ))}
      </div>

      {/* Field journal */}
      <div className="glass panel span5">
        <h3>{selected?.name || 'Water'} Field Journal</h3>
        {selected && (
          <div className="water-field-journal">
            <div className="field-note gold">
              <span>Water Read</span><strong>{waterPersona(selected)}</strong>
              <small>{sampleLabel(selected.productiveTrips, selected.fish)[0]} confidence based on {selected.productiveTrips} productive trip{selected.productiveTrips === 1 ? '' : 's'}.</small>
            </div>
            <div className="field-note">
              <span>Best Bait</span><strong>{selected.topColor.label} {selected.topLure.label}</strong>
              <small>{selected.topLure.count} fish tied to this lure signal.</small>
            </div>
            <div className="field-note">
              <span>Best Window</span><strong>{selected.topMonth.label}</strong>
              <small>The strongest time-of-year mark in the book.</small>
            </div>
            <div className="field-note">
              <span>Conditions</span><strong>{selected.topWeather.label}</strong>
              <small>{selected.topClarity.label} water • {selected.topTemp.label} temp band.</small>
            </div>
            <div className="field-note">
              <span>Method</span><strong>{selected.topMethod.label}</strong>
              <small>The way you most often unlocked this water.</small>
            </div>
            <div className="field-note">
              <span>Efficiency</span><strong>{selected.fpt.toFixed(1)} fish/trip</strong>
              <small>{selected.hours ? selected.fph.toFixed(1) + ' fish/hour with logged time' : 'Add trip end times for fish/hour.'}</small>
            </div>
          </div>
        )}
      </div>

      {/* Species shelf */}
      <div className="glass panel span12">
        <h3>Species Discovered Here</h3>
        {selected && species.length ? (
          <div className="species-shelf">
            {species.map(([k, v]) => (
              <span key={k} className="species-badge"><strong>{v}</strong>{k}</span>
            ))}
          </div>
        ) : (
          <p className="muted">No species discovered here yet.</p>
        )}
      </div>

      {/* Chapters on this water */}
      <div className="glass panel span12">
        <h3>Chapters on This Water</h3>
        <p className="muted">Open a chapter to jump straight into that trip's Livewell.</p>
        {chapters.length ? (
          <div className="trip-chapter-grid">
            {chapters.map((trip) => {
              const info = tripChapterInfo(data, trip);
              return (
                <button key={trip.id} className="water-chapter" onClick={() => onOpenLivewell && onOpenLivewell(trip.id)}>
                  <div>
                    <span className="eyebrow">{trip.date || 'Trip'}</span>
                    <h4>{trip.title || trip.name || 'Water Chapter'}</h4>
                    <small>{trip.area || 'Area not logged'} • {trip.weather || 'weather pending'} • {trip.method || 'method pending'}</small>
                  </div>
                  <div className="chapter-bottom">
                    <span>{info.count} fish</span>
                    <span>Best {info.best}"</span>
                    <span>{info.hours ? info.hours.toFixed(1) + ' hrs' : 'hours --'}</span>
                  </div>
                </button>
              );
            })}
          </div>
        ) : (
          <p className="muted">No trips logged here yet.</p>
        )}
      </div>
    </div>
  );
}
