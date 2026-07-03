import { useData } from '../lib/DataContext.jsx';
import { bestBySpecies, trophyPlaques } from '../lib/legends.js';

// Legends (Trophy Room / Lodge) — ported from the single-file app's
// renderLegends(). "Not records. Legends." The Legend Wall (trophyWall's six
// plaques + the Century Club and River Explorer plaques), then Best by Species
// cards that open the fish's catch card. Read-only; no mutations. Wording and
// markup preserved; legend-*/lodge-*/profile-* CSS already lives in app.css.
//
// Props:
//   onOpenCatch(id): open a catch card (openFishCard)
export default function Legends({ onOpenCatch }) {
  const { data, seasonCatches, seasonSessions } = useData();

  const c = seasonCatches();
  const by = bestBySpecies(c);
  const total = c.length;
  const speciesCount = Object.keys(by).length;
  const plaques = trophyPlaques(data, c, seasonSessions());

  const sessionFor = (id) => data.sessions.find((s) => s.id === id) || {};
  const bestList = Object.values(by).sort((a, b) => (+b.length || 0) - (+a.length || 0));

  return (
    <div className="grid">
      {/* Trophy Room hero */}
      <div className="glass panel span12 memory-card lodge-wall">
        <span className="eyebrow">Trophy Room</span>
        <h2 className="chapter-title">Not records. Legends.</h2>
        <p className="story">A fishing lodge for the moments worth talking about forever.</p>
      </div>

      {/* Legend Wall */}
      <div className="glass panel span12 lodge-wall">
        <h3>Legend Wall</h3>
        <div className="legend-wall">
          {plaques.map((p) => (
            <div key={p.title} className={`legend-plaque ${p.unlocked ? '' : 'locked'}`}>
              <div className="medal">{p.medal}</div>
              <h4>{p.title}</h4>
              <strong>{p.value}</strong>
              <small className="muted">{p.sub}</small>
            </div>
          ))}
        </div>
        <div className="legend-wall">
          <div className={`legend-plaque ${total >= 100 ? '' : 'locked'}`}>
            <div className="medal">🏆</div>
            <h4>The Century Club</h4>
            <strong>{total}/100</strong>
            <p className="muted">Unlocked when the season hits 100 fish.</p>
          </div>
          <div className={`legend-plaque ${speciesCount >= 5 ? '' : 'locked'}`}>
            <div className="medal">🌎</div>
            <h4>River Explorer</h4>
            <strong>{speciesCount}</strong>
            <p className="muted">Species remembered this season.</p>
          </div>
        </div>
      </div>

      {/* Best by Species */}
      <div className="glass panel span12">
        <h3>Best by Species</h3>
        <div className="profile-grid">
          {bestList.map((x) => {
            const s = sessionFor(x.sessionId);
            return (
              <div key={x.id} className="profile-card gold">
                <span className="eyebrow">{x.species}</span>
                <h4>{s.title || s.name || 'Trip'}</h4>
                <strong>{x.length}"</strong>
                <small>{x.color} {x.lure} • {s.water}</small>
                <button
                  className="btn small"
                  style={{ marginTop: 10 }}
                  onClick={() => onOpenCatch && onOpenCatch(x.id)}
                >
                  Open Legend
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
