import { useState } from 'react';
import { useData } from '../lib/DataContext.jsx';
import { esc, speciesClass } from '../lib/fishDisplay.js';
import {
  DEFAULT_INTEL_STATE, baseIntelCatches, filteredIntelCatches, intelSummary,
  intelligenceScopeLabel, tripWeightedWhatWorked, bestGroup, patternStats,
  RANKED_DIMENSIONS, leaderboardRows, speciesEntries, seasonEfficiencyRows, uniqSorted,
} from '../lib/intelligence.js';

// River Intelligence — the trip-weighted "scenario builder". Ported from the
// single-file app's renderIntelligence() and helpers. Read-only (no mutations),
// so nothing here touches sync. Filter state lives in component state; changing
// a filter just re-renders, exactly like setIntelFilter() did.
//
// HTML is preserved verbatim so the existing intel-* CSS (already carried into
// app.css) styles it unchanged. The few helper sentences build bolded HTML
// strings, rendered via dangerouslySetInnerHTML to match the original markup.
const H = (html) => ({ __html: html });

// A trip-weighted leaderboard panel (used for the six efficiency breakdowns).
function LeaderPanel({ title, subtitleBlurb, data, intelState, c, fn, detailFn }) {
  const rows = leaderboardRows(data, intelState, c, fn);
  return (
    <div className="glass panel span6">
      <h3>{title}</h3>
      {subtitleBlurb}
      {rows.length ? (
        <div className="intel-leaderboard">
          {rows.map((st) => (
            <div key={st.label} className="intel-leader-row">
              <div>
                <b>{st.label}</b>
                <small dangerouslySetInnerHTML={H(detailFn(st))} />
              </div>
              <div>
                <div className="pattern-track"><div className="pattern-fill" style={{ width: st.conf + '%' }} /></div>
                <small>{st.quality[0]} confidence</small>
              </div>
              <span className="rank-pill">{st.fish} fish</span>
              <span className="rank-pill">{st.trips} trips</span>
              <span className="rank-pill">{st.fpt.toFixed(1)}/trip</span>
            </div>
          ))}
        </div>
      ) : (
        <p className="muted">No matching data yet.</p>
      )}
    </div>
  );
}

export default function RiverIntelligence() {
  const { data } = useData();
  const [intelState, setIntelState] = useState(DEFAULT_INTEL_STATE);

  const setFilter = (key, val) => setIntelState((prev) => ({ ...prev, [key]: val }));
  const resetFilters = () => setIntelState(DEFAULT_INTEL_STATE);

  const cBase = baseIntelCatches(data, intelState);
  const c = filteredIntelCatches(data, intelState);
  const sum = intelSummary(data, intelState, c);

  // Filter option lists from the scoped (pre-filter) catches, verbatim.
  const waters = uniqSorted(cBase.map((x) => x._water));
  const species = uniqSorted(cBase.map((x) => x.species));
  const partners = uniqSorted(cBase.flatMap((x) => x._partners));
  const methods = uniqSorted(cBase.map((x) => x._method));
  const waterTypes = uniqSorted(cBase.map((x) => x._waterType));

  const scopeOptions = [
    { v: 'currentSeason', label: 'Current Season' },
    { v: 'currentTrip', label: 'Current Trip' },
    { v: 'all', label: 'All Time' },
    ...data.seasons.map((s) => ({ v: s.id, label: s.name })),
  ];
  const opt = (list) => ['All', ...list];

  const activeChips = [
    ['Scope', intelligenceScopeLabel(data, intelState)],
    ['Water', intelState.water],
    ['Species', intelState.species],
    ['Water Type', intelState.waterType],
    ['Partner', intelState.partner],
    ['Method', intelState.method],
  ].filter((x) => x[1] && x[1] !== 'All');

  const lowSample = sum.tripCount < 3 && c.length >= 15;

  return (
    <div className="grid">
      {/* Hero: headline + filters + context + scorecards */}
      <div className="glass panel span12 intel-hero-v2">
        <span className="eyebrow">River Intelligence • Trip-Weighted Scenario Builder</span>
        <div className="intel-answer" dangerouslySetInnerHTML={H(tripWeightedWhatWorked(data, intelState, c))} />
        <p className="intel-subline">
          Fish count tells you what happened. Trip-weighted intelligence tells
          you what is repeatable: trips, fish per trip, fish per hour, success
          rate, quality, and confidence.
        </p>

        {/* Filters */}
        <div className="intel-console">
          <label>Scope
            <select value={intelState.scope} onChange={(e) => setFilter('scope', e.target.value)}>
              {scopeOptions.map((o) => <option key={o.v} value={o.v}>{o.label}</option>)}
            </select>
          </label>
          <label>Water
            <select value={intelState.water} onChange={(e) => setFilter('water', e.target.value)}>
              {opt(waters).map((v) => <option key={v} value={v}>{v}</option>)}
            </select>
          </label>
          <label>Species
            <select value={intelState.species} onChange={(e) => setFilter('species', e.target.value)}>
              {opt(species).map((v) => <option key={v} value={v}>{v}</option>)}
            </select>
          </label>
          <label>Water Type
            <select value={intelState.waterType} onChange={(e) => setFilter('waterType', e.target.value)}>
              {opt(waterTypes).map((v) => <option key={v} value={v}>{v}</option>)}
            </select>
          </label>
          <label>Partner
            <select value={intelState.partner} onChange={(e) => setFilter('partner', e.target.value)}>
              {opt(partners).map((v) => <option key={v} value={v}>{v}</option>)}
            </select>
          </label>
          <label>Method
            <select value={intelState.method} onChange={(e) => setFilter('method', e.target.value)}>
              {opt(methods).map((v) => <option key={v} value={v}>{v}</option>)}
            </select>
          </label>
        </div>
        <div className="actions" style={{ marginTop: 10 }}>
          <button className="btn small filter-reset" onClick={resetFilters}>Reset Intelligence Filters</button>
        </div>

        {/* Active filter chips */}
        <div className="intel-scope-note">
          <span className="chip scope-badge">🧠 Analyzing {c.length} fish</span>
          {activeChips.map(([k, v]) => <span key={k} className="chip">{k}: {v}</span>)}
        </div>

        {/* Trip context strip */}
        <div className="trip-context-strip">
          <span>🎣 {c.length} fish</span>
          <span>🛶 {sum.tripCount} productive trips</span>
          <span>📚 {sum.scopedTrips} trips in scope</span>
          <span>⚡ {sum.fpt.toFixed(1)} fish/trip</span>
          <span>⏱ {sum.hours ? sum.fph.toFixed(1) + ' fish/hour' : 'hours pending'}</span>
          <span>🏆 Best {sum.big.length || 0}"</span>
        </div>

        {/* Efficiency scorecards */}
        <div className="efficiency-grid">
          <div className="eff-card gold"><span>Trips Analyzed</span><strong>{sum.tripCount}</strong><small>{sum.scopedTrips} trips in this scope • {sum.skunks} skunk{sum.skunks === 1 ? '' : 's'}</small></div>
          <div className="eff-card"><span>Fish / Trip</span><strong>{sum.fpt.toFixed(1)}</strong><small>Efficiency, not just volume.</small></div>
          <div className="eff-card"><span>Fish / Hour</span><strong>{sum.hours ? sum.fph.toFixed(1) : '--'}</strong><small>{sum.hours ? sum.hours.toFixed(1) + ' logged hours' : 'Add trip end times to unlock this.'}</small></div>
          <div className="eff-card"><span>Success Rate</span><strong>{sum.success || '--'}%</strong><small>Trips in scope that produced fish.</small></div>
          <div className="eff-card"><span>Quality</span><strong>{sum.big.length || 0}"</strong><small>Biggest • {sum.avg}" average length</small></div>
        </div>
        {lowSample && (
          <div className="sample-warning">⚠ Huge day, low repeatability sample. FishSlayR will treat this as a hot clue, not a forever rule, until more trips support it.</div>
        )}
      </div>

      {/* What Worked Board */}
      <div className="glass panel span12">
        <h3>What Worked Board</h3>
        <p className="muted">Every card now factors in trip count and repeatability so one monster day does not overpower a proven pattern.</p>
        {c.length ? (
          <div className="intel-matrix">
            {RANKED_DIMENSIONS.map(([title, fn], i) => {
              const g = bestGroup(c, fn);
              const st = patternStats(data, intelState, c, fn, g.label);
              return (
                <div key={title} className={'pattern-card ' + (i === 0 ? 'gold' : i === 4 ? 'green' : '')}>
                  <span>{title}</span>
                  <h4>{st.label}</h4>
                  <strong>{st.fish}</strong>
                  <small>{st.trips} trip{st.trips === 1 ? '' : 's'} • {st.fpt.toFixed(1)} fish/trip • avg {st.avg}" • best {st.big.length || 0}"</small>
                  <div className="pattern-track" style={{ marginTop: 10 }}><div className="pattern-fill" style={{ width: st.conf + '%' }} /></div>
                  <div style={{ marginTop: 9 }}><em className={'confidence-label ' + st.quality[1]}>{st.quality[0]} • {st.conf}%</em></div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="intel-empty">No matching catches yet. Try All Time or clear a filter.</div>
        )}
      </div>

      {/* Six trip-weighted breakdown panels */}
      <LeaderPanel title="Confidence Baits" data={data} intelState={intelState} c={c}
        fn={(x) => `${x.color || 'Unknown'} ${x.lure || 'Unknown'}`}
        detailFn={(st) => `Avg ${st.avg}" • best ${esc(st.big.length || 0)}" • ${st.trips} trip sample`} />
      <LeaderPanel title="Best Waters by Efficiency" data={data} intelState={intelState} c={c}
        fn={(x) => x._water}
        detailFn={(st) => `${st.fpt.toFixed(1)} fish/trip • best ${esc(st.big.length || 0)}" • avg ${st.avg}"`} />
      <LeaderPanel title="Time of Year" data={data} intelState={intelState} c={c}
        fn={(x) => x._month}
        detailFn={(st) => `Top bait ${esc(bestGroup(st.subset, (x) => x.lure).label)} • ${st.fpt.toFixed(1)} fish/trip`} />
      <LeaderPanel title="Season Pattern" data={data} intelState={intelState} c={c}
        fn={(x) => x._seasonPhase}
        detailFn={(st) => `Top bait ${esc(bestGroup(st.subset, (x) => x.lure).label)} • avg ${st.avg}"`} />
      <LeaderPanel title="Body of Water Type" data={data} intelState={intelState} c={c}
        fn={(x) => x._waterType}
        detailFn={(st) => `Top species ${esc(bestGroup(st.subset, (x) => x.species).label)} • ${st.fpt.toFixed(1)} fish/trip`} />
      <LeaderPanel title="Conditions" data={data} intelState={intelState} c={c}
        fn={(x) => x._weather}
        detailFn={(st) => `${esc(bestGroup(st.subset, (x) => x.color).label)} ${esc(bestGroup(st.subset, (x) => x.lure).label)} • ${st.trips} trip sample`} />
      <LeaderPanel title="Water Clarity" data={data} intelState={intelState} c={c}
        fn={(x) => x._clarity}
        detailFn={(st) => `Top color ${esc(bestGroup(st.subset, (x) => x.color).label)} • ${st.avg}" avg`} />
      <LeaderPanel title="Time of Day" data={data} intelState={intelState} c={c}
        fn={(x) => x._timeWindow}
        detailFn={(st) => `Top species ${esc(bestGroup(st.subset, (x) => x.species).label)} • ${st.fish} fish`} />
      <LeaderPanel title="Water Temperature" data={data} intelState={intelState} c={c}
        fn={(x) => x._tempBucket}
        detailFn={(st) => `Top water ${esc(bestGroup(st.subset, (x) => x._water).label)} • avg ${st.avg}"`} />

      {/* Season Efficiency panel */}
      <div className="glass panel span6">
        <div className="compare-panel">
          <h3>Season Efficiency</h3>
          <p className="muted">Not just total fish — trips, fish per trip, hours, success, and repeatability.</p>
          <div className="intel-leaderboard">
            {seasonEfficiencyRows(data, intelState).map((x) => (
              <div key={x.season.id} className="intel-leader-row">
                <div>
                  <b>{x.season.name || x.season.id}</b>
                  <small>{x.bait} • best {x.sum.big.length || 0}"</small>
                </div>
                <div>
                  <div className="pattern-track"><div className="pattern-fill" style={{ width: Math.min(96, Math.round((x.sum.fpt / 20) * 100)) + '%' }} /></div>
                  <small>{x.sum.success || 0}% trip success</small>
                </div>
                <span className="rank-pill">{x.c.length} fish</span>
                <span className="rank-pill">{x.sum.scopedTrips} trips</span>
                <span className="rank-pill">{x.sum.fpt.toFixed(1)}/trip</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Species Pattern Finder */}
      <div className="glass panel span12">
        <h3>Species Pattern Finder</h3>
        <p className="muted">Species patterns are still shown, but the main recommendation engine now weighs trips and repeatability.</p>
        {c.length ? (
          <div className="intel-grid">
            {speciesEntries(c).map((sp) => (
              <div key={sp.species} className={'pattern-card ' + speciesClass(sp.species)}>
                <span>{sp.species}</span>
                <h4>{sp.color.label} {sp.lure.label}</h4>
                <strong>{sp.count}</strong>
                <small>{sp.waterType.label} • {sp.time.label} • {sp.cond.label}</small>
                <small>Best fish {sp.big.length || 0}" • Avg {sp.avg}"</small>
              </div>
            ))}
          </div>
        ) : (
          <p className="muted">No species patterns yet.</p>
        )}
      </div>
    </div>
  );
}
