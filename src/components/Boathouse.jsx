import { useData } from '../lib/DataContext.jsx';

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
export default function Boathouse({ onLandFish, onNewTrip, onOpenLivewell, onSync, signedIn }) {
  const { data, activeSession, catchesForSession, currentSeason } = useData();

  const s = activeSession() || {};
  const c = catchesForSession(s.id);
  const seasonName = (currentSeason() || {}).name || 'Season';

  return (
    <>
      <div className="topbar">
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
              <button className="btn gold" disabled title="Coming soon in the new build">
                The River Remembers
              </button>
            </div>
          </div>
          <button className="land-orb" onClick={() => onLandFish && onLandFish()}>
            <div><span>🎣</span>LAND A FISH</div>
          </button>
        </div>
      </div>
    </>
  );
}
