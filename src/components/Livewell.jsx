import { useState } from 'react';
import { useData } from '../lib/DataContext.jsx';
import { esc } from '../lib/fishDisplay.js';
import FishCard from './FishCard.jsx';
import {
  filterLivewellCatches, livewellFilterOptions, timelineBuckets,
  tripPatternText, tripStats, firstSpeciesCatch, topColorOf,
} from '../lib/livewell.js';
import { tripCoverClass, tripCoverIcon } from '../lib/seasons.js';

// Livewell — the full memory-wall screen, ported from renderLivewell(). Trip
// header + stat chips, the filter/sort bar, the fish-card wall (with the
// FIRST-of-species ribbon), a catch timeline, this-trip pattern analysis, and
// the past-livewell archive that opens any trip in the season fish-by-fish.
//
// New (additive, not a redesign): a Memory Wall / Living Livewell view toggle in
// the toolbar. The wall is fully ported here; the animated "Living Livewell"
// tank is Phase B, so that option shows as coming soon for now. The chosen view
// persists via the profile (data.livewellView), synced like sound/mode.
//
// Which trip is shown is lifted to App (viewedSessionId / onSelectSession) so
// Journal and Waters can open a specific past trip's livewell.
const H = (html) => ({ __html: html });

export default function Livewell({ viewedSessionId, onSelectSession, onOpenCatch }) {
  const { data, updateProfile, activeSession, catchesForSession, seasonSessions, seasonCatches, biggest, avg } = useData();

  const [filter, setFilter] = useState('all');
  const [sort, setSort] = useState('time');

  const active = activeSession() || {};
  const seasonList = seasonSessions();
  // The trip currently being viewed: the lifted id, else the active trip.
  const viewed =
    seasonList.find((s) => s.id === viewedSessionId) || active || seasonList[0] || {};
  const isCurrent = viewed.id === active.id;

  const catches = catchesForSession(viewed.id);
  const big = biggest(catches) || {};
  const allSeason = seasonCatches();
  const stats = tripStats(catches);

  // The persisted view mode; default to the memory wall.
  const view = data.livewellView === 'tank' ? 'tank' : 'wall';
  const setView = (v) => {
    if (v === 'tank') return; // Phase B — not yet available
    updateProfile((prev) => ({ ...prev, livewellView: v }));
  };

  const filtered = filterLivewellCatches(catches, filter, sort);
  const filterOptions = livewellFilterOptions(catches);
  const buckets = timelineBuckets(catches);

  return (
    <div className="grid">
      {/* Trip header */}
      <div className={`glass panel span12 story-cover ${tripCoverClass(viewed)}`}>
        <span className="eyebrow">{isCurrent ? "Today's Livewell" : 'Past Livewell'} • {viewed.date || ''}</span>
        <span className="cover-mark">{tripCoverIcon(viewed)}</span>
        <h2 className="chapter-title">{viewed.title || viewed.name || 'Trip Livewell'}</h2>
        <p className="story">{viewed.water || 'Unknown water'}{viewed.area ? ' • ' + viewed.area : ''}</p>
        <div className="chips">
          <span className="chip green">{stats.fish} fish</span>
          <span className="chip gold">Best {stats.best}"</span>
          <span className="chip">{stats.species} species</span>
          <span className="chip">{stats.topLure}</span>
        </div>
        <div className="actions" style={{ marginTop: 14 }}>
          {!isCurrent && (
            <button className="btn primary" onClick={() => onSelectSession && onSelectSession(active.id)}>
              Open Today's Livewell
            </button>
          )}
          {isCurrent && (
            <button className="btn primary" onClick={() => onOpenCatch && onOpenCatch(null)}>
              Land Another
            </button>
          )}
        </div>
      </div>

      {/* Memory wall / toolbar */}
      <div className="glass panel span12">
        <div className="livewell-toolbar">
          <div>
            <h3>Fish-by-Fish Memory Wall</h3>
            <p className="muted">Filter, sort, and open any fish as a catch card. The Livewell is the memory wall now.</p>
          </div>
          <div className="livewell-summary">
            <span className="chip">Avg {avg(catches)}"</span>
            <span className="chip">Top {topColorOf(catches)}</span>
            <span className="chip gold">{big.species ? big.species : 'No legend yet'}</span>
          </div>
        </div>

        {/* View toggle (additive): Memory Wall | Living Livewell */}
        <div className="livewell-view-toggle">
          <button
            className={`view-toggle-btn ${view === 'wall' ? 'active' : ''}`}
            onClick={() => setView('wall')}
          >
            🧱 Memory Wall
          </button>
          <button
            className={`view-toggle-btn ${view === 'tank' ? 'active' : ''}`}
            onClick={() => setView('tank')}
            disabled
            title="Living Livewell — coming in the next update"
          >
            🐟 Living Livewell
          </button>
        </div>

        {/* Filter/sort bar (bound to the wall) */}
        <div className="filter-strip">
          {filterOptions.map(([id, label]) => (
            <button
              key={id}
              className={`filter-chip ${filter === id ? 'active' : ''}`}
              onClick={() => setFilter(id)}
            >
              {label}
            </button>
          ))}
          <select
            className="select"
            style={{ maxWidth: 190 }}
            value={sort}
            onChange={(e) => setSort(e.target.value)}
          >
            <option value="time">Sort by Time</option>
            <option value="size">Sort by Size</option>
            <option value="species">Sort by Species</option>
            <option value="lure">Sort by Lure</option>
          </select>
        </div>

        <div className="livewell polished">
          {filtered.length ? (
            filtered.map((c) => (
              <FishCard
                key={c.id}
                c={c}
                isBig={big && c.id === big.id}
                isFirst={firstSpeciesCatch(c, allSeason)}
                onOpen={(id) => onOpenCatch && onOpenCatch(id)}
              />
            ))
          ) : (
            <div className="livewell-empty">
              <strong>No fish match this view.</strong>
              <br />
              <span>Clear the filter or land another fish.</span>
            </div>
          )}
        </div>
      </div>

      {/* Catch timeline */}
      <div className="glass panel span7">
        <h3>Catch Timeline</h3>
        <div className="timeline">
          {Object.entries(buckets).map(([band, list]) => (
            <div key={band} style={{ display: 'contents' }}>
              <div className="time-band">{band}</div>
              <div className="time-stream">
                {list.length ? (
                  list.map((x) => (
                    <button key={x.id} className="fish-token" onClick={() => onOpenCatch && onOpenCatch(x.id)}>
                      🐟 {x.time} • {x.length}" • {x.lure}
                    </button>
                  ))
                ) : (
                  <span className="muted">No fish logged</span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* This trip's pattern */}
      <div className="glass panel span5">
        <h3>{isCurrent ? "This Trip's Pattern" : 'Past Pattern'}</h3>
        <p className="story" dangerouslySetInnerHTML={H(tripPatternText(catches))} />
      </div>

      {/* Past-livewell archive */}
      <div className="glass panel span12">
        <h3>Open a Past Livewell</h3>
        <p className="muted">Every trip has its own livewell. Open any old chapter and relive the day fish by fish.</p>
        <div className="archive-grid">
          {seasonList.slice().sort((a, b) => String(b.date || '').localeCompare(String(a.date || ''))).map((s) => {
            const c = catchesForSession(s.id);
            const b = biggest(c) || {};
            const isOpen = viewed.id === s.id;
            return (
              <button
                key={s.id}
                className={`archive-card ${isOpen ? 'active' : ''}`}
                onClick={() => onSelectSession && onSelectSession(s.id)}
              >
                <span>{s.active ? 'Current Trip' : 'Past Livewell'}</span>
                <strong>{s.title || s.name || 'Untitled Trip'}</strong>
                <small>{s.date || ''} • {s.water || 'Unknown water'}</small>
                <div><em>{c.length} fish</em><em>Best {b.length || 0}"</em></div>
                <small className="open-livewell-label">Open fish-by-fish →</small>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
