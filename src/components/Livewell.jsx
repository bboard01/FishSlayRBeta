import { useData } from '../lib/DataContext.jsx';
import FishCard from './FishCard.jsx';

// First fully data-driven screen. Reads today's session and its catches from
// the data context and renders the memory wall. Filters, timeline, pattern
// analysis, and the past-livewell archive are follow-up ports; this is the
// core loop (see the catches, open a card).
export default function Livewell({ onOpenCatch }) {
  const { activeSession, catchesForSession, biggest, avg } = useData();

  const session = activeSession() || {};
  const catches = catchesForSession(session.id);
  const big = biggest(catches) || {};

  const topColor = (() => {
    const counts = {};
    catches.forEach((c) => { if (c.color) counts[c.color] = (counts[c.color] || 0) + 1; });
    const top = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
    return top ? top[0] : '—';
  })();

  return (
    <div className="grid">
      <div className="glass panel span12 story-cover">
        <span className="eyebrow">Today’s Livewell • {session.date || ''}</span>
        <h2 className="chapter-title">{session.title || session.name || 'Trip Livewell'}</h2>
        <p className="story">
          {session.water || 'Unknown water'}{session.area ? ' • ' + session.area : ''}
        </p>
        <div className="actions" style={{ marginTop: 14 }}>
          <button className="btn primary" onClick={() => onOpenCatch && onOpenCatch(null)}>
            Land Another
          </button>
        </div>
      </div>

      <div className="glass panel span12">
        <div className="livewell-toolbar">
          <div>
            <h3>Fish-by-Fish Memory Wall</h3>
            <p className="muted">Every catch from this trip. Tap any fish to open its card.</p>
          </div>
          <div className="livewell-summary">
            <span className="chip">Avg {avg(catches)}"</span>
            <span className="chip">Top {topColor}</span>
            <span className="chip gold">{big.species ? big.species : 'No legend yet'}</span>
          </div>
        </div>

        <div className="livewell polished">
          {catches.length ? (
            catches.map((c) => (
              <FishCard
                key={c.id}
                c={c}
                isBig={big && c.id === big.id}
                onOpen={(id) => onOpenCatch && onOpenCatch(id)}
              />
            ))
          ) : (
            <div className="livewell-empty">
              <strong>No fish in the livewell yet.</strong>
              <br />
              <span>Land your first fish to start the day’s chapter.</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
