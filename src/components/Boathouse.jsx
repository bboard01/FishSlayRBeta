import { useData } from '../lib/DataContext.jsx';
import { chapterStats, chapterSubtitle } from '../lib/seasons.js';
import { memoryText, patternText } from '../lib/story.js';
import { tripStats } from '../lib/livewell.js';
import { esc } from '../lib/fishDisplay.js';
import LivingLivewell from './LivingLivewell.jsx';

const H = (html) => ({ __html: html });

// The greeting line under the hero heading — ported 1:1 from the original
// greeting(). Speaks to how the day is going based on the active session and
// how many fish are in the livewell.
function greeting(session, catchCount) {
  const s = session || {};
  if (!s.id) return 'The river is waiting. Start a trip to write a chapter.';
  if (catchCount === 0)
    return `The river's been waiting. ${s.name || 'Today'} is ready for its first fish.`;
  if (catchCount < 5)
    return `The day has started. ${catchCount} fish logged and the pattern is beginning to speak.`;
  return `Look at the day you're having. ${catchCount} fish in, and the river is telling a story.`;
}

// The Boathouse hero — restored to match the original hero(). Reads the active
// session and its catches from the data context so the eyebrow, heading, chips,
// and greeting are all live again (the port had replaced them with static
// migration copy). "Land a Fish" opens the catch flow; the other actions jump
// to their screens as those ports land.
export default function Boathouse({ onLandFish, onNewTrip, onOpenLivewell, onRemember, onSync, signedIn, onOpenJournal, onStartSeason, onOpenCatch, onEndTrip, lastCatchId }) {
  const { data, activeSession, catchesForSession, currentSeason, biggest } = useData();

  const s = activeSession() || {};
  const c = catchesForSession(s.id);
  const season = currentSeason() || {};
  const seasonName = season.name || 'Season';

  // Below-hero grid data — the active chapter's rollup (ported from the
  // canonical renderBoathouse, index.html ~line 1698).
  const st = chapterStats(data, season.id);
  const big = st.biggest || {};
  // Today's Livewell embed: the active trip's fish, shown as the animated
  // Living Livewell tank (same as the main Livewell screen).
  const liveBig = biggest(c) || {};
  const liveTopLure = tripStats(c).topLure;

  return (
    <div className="boathouse-page">
      <div className="topbar dock-only">
        <span className="eyebrow">v2.0 • Season Journal</span>
        <div className="actions">
          <button className="btn" onClick={() => onNewTrip && onNewTrip()}>New Trip</button>
          <button className="btn primary" onClick={() => onLandFish && onLandFish()}>Land a Fish</button>
          {signedIn && (
            <button className="btn" onClick={() => onSync && onSync()}>☁️ Sync</button>
          )}
        </div>
      </div>

      <div className="hero">
        <div className="hero-grid">
          <div>
            <span className="eyebrow">
              {seasonName} • {s.active ? 'Current Trip' : 'Latest Chapter'}
            </span>
            <h2>{s.water || 'Your Boathouse'}</h2>
            <p className="subtitle">
              {greeting(s, c.length)} {s.area ? `• ${s.area}` : ''}
            </p>
            <div className="chips">
              <span className="chip">📍 {s.state || 'PA'}</span>
              <span className="chip">🌡 {s.waterTemp || '--'}° water</span>
              <span className="chip">🌤 {s.weather || '--'}</span>
              <span className="chip">🌊 {s.flow || '--'}</span>
              <span className="chip green">🐟 {c.length} in the livewell</span>
            </div>
            <div className="actions">
              <button className="btn primary" onClick={() => onLandFish && onLandFish()}>
                Land a Fish
              </button>
              <button className="btn" onClick={() => onOpenLivewell && onOpenLivewell()}>
                Today's Livewell
              </button>
              <button
                className="btn gold"
                onClick={() => onRemember && onRemember()}
                disabled={!s.id}
                title={s.id ? 'Open the trip story' : 'Start a trip first'}
              >
                The River Remembers
              </button>
              {s.active && (
                <button className="btn end-trip-btn" onClick={() => onEndTrip && onEndTrip()}>
                  End Trip
                </button>
              )}
            </div>
          </div>
          <button className="land-orb" onClick={() => onLandFish && onLandFish()}>
            <div><span>🎣</span>LAND A FISH</div>
          </button>
        </div>
      </div>

      {/* Below-hero grid — ported from the canonical renderBoathouse (index.html
          ~line 1698): the active-season journal panel, Today's Livewell embed,
          the Season Memory card, and four metric tiles. Reads the chapter
          rollup from chapterStats so every tile matches the active Season. */}
      <div className="grid">
        <div className="glass panel span12 journal-hero">
          <span className="eyebrow">Active Season</span>
          <h2 className="journal-title">{season.name || season.id || 'Season'}</h2>
          <p className="journal-subtitle">
            {chapterSubtitle(season, st)}. FishSlayR is now organized as a fishing journal:
            Seasons contain trips, trips contain fish, and every room reads from the active Season.
          </p>
          <div className="chapter-stats">
            <div className="chapter-stat"><span>Trips</span><strong>{st.sessions.length}</strong></div>
            <div className="chapter-stat"><span>Fish</span><strong>{st.catches.length}</strong></div>
            <div className="chapter-stat"><span>Waters</span><strong>{st.waters}</strong></div>
            <div className="chapter-stat"><span>Best</span><strong>{st.biggest ? `${esc(st.biggest.length)}"` : '—'}</strong></div>
          </div>
          <div className="actions" style={{ marginTop: 18 }}>
            <button className="btn primary" onClick={() => onNewTrip && onNewTrip()}>Launch Trip in This Season</button>
            <button className="btn" onClick={() => onOpenJournal && onOpenJournal()}>Open Journal</button>
            <button className="btn gold" onClick={() => onStartSeason && onStartSeason()}>Start New Season</button>
          </div>
        </div>

        <div className="glass panel span6">
          <h3>Today's Livewell</h3>
          <div className="boathouse-tank">
            <LivingLivewell
              catches={c}
              session={s}
              biggest={biggest}
              topLure={liveTopLure}
              newFishId={lastCatchId}
              onOpenCatch={(id) => onOpenCatch && onOpenCatch(id)}
              onLandFish={() => onLandFish && onLandFish()}
              onTripStory={() => onRemember && onRemember()}
            />
          </div>
          <p className="muted">Every catch belongs to {esc(season.name || 'this chapter')}.</p>
        </div>

        <div className="glass panel span6 memory-card">
          <span className="eyebrow">Season Memory</span>
          <h3 className="chapter-title">
            {st.sessions.length
              ? `The ${esc(st.topWater || 'water')} chapter is writing itself.`
              : 'A blank page is waiting.'}
          </h3>
          <p className="story" dangerouslySetInnerHTML={H(
            st.catches.length
              ? patternText(data, st.catches)
              : 'Start a trip and land the first fish. The journal, intelligence, waters, and lodge will all build from that chapter.'
          )} />
        </div>

        <div className="glass panel span3">
          <h3>Season Fish</h3>
          <div className="metric"><strong>{st.catches.length}</strong><span>Total</span></div>
        </div>
        <div className="glass panel span3">
          <h3>Trips</h3>
          <div className="metric"><strong>{st.sessions.length}</strong><span>In book</span></div>
        </div>
        <div className="glass panel span3">
          <h3>Legend Fish</h3>
          <div className="metric"><strong>{big.length || 0}"</strong><span>{esc(big.species || '—')}</span></div>
        </div>
        <div className="glass panel span3">
          <h3>Waters</h3>
          <div className="metric"><strong>{st.waters}</strong><span>Visited</span></div>
        </div>
      </div>
    </div>
  );
}
