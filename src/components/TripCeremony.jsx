import { useData } from '../lib/DataContext.jsx';
import { storyFor } from '../lib/story.js';
import { tripStats } from '../lib/livewell.js';
import { esc } from '../lib/fishDisplay.js';

// The Trip Ceremony — ported from the single-file app's openTripCeremony().
// A full-screen "Close Chapter" moment shown when ending an active trip: the
// trip's story, a four-stat recap (Fish / Species / Best Fish / Best Pattern),
// and three actions — Close Chapter (finishTrip), Keep Fishing (dismiss), and
// View Livewell. Story text is bolded HTML, rendered via dangerouslySetInnerHTML
// to match the original markup.
const H = (html) => ({ __html: html });

export default function TripCeremony({ session, onClose, onFinish, onViewLivewell }) {
  const { data, catchesForSession } = useData();
  if (!session) return null;

  const s = session;
  const c = catchesForSession(s.id);
  const st = tripStats(c); // { fish, best, species, topLure }

  return (
    <div className="ceremony-backdrop active" onClick={onClose}>
      <div className="ceremony-card" onClick={(e) => e.stopPropagation()}>
        <span className="eyebrow">Close Chapter</span>
        <h2>The River Remembers</h2>
        <p className="story" dangerouslySetInnerHTML={H(storyFor(data, s))} />

        <div className="ceremony-stats">
          <div className="ceremony-stat"><strong>{st.fish}</strong><span className="muted">Fish</span></div>
          <div className="ceremony-stat"><strong>{st.species}</strong><span className="muted">Species</span></div>
          <div className="ceremony-stat"><strong>{st.best || 0}"</strong><span className="muted">Best Fish</span></div>
          <div className="ceremony-stat"><strong>{esc(st.topLure || '—')}</strong><span className="muted">Best Pattern</span></div>
        </div>

        <p className="micro-delight">
          Today's chapter will stay in the Livewell, Campfire, Trophy Room, and River Intelligence.
        </p>

        <div className="ceremony-actions">
          <button className="btn gold" onClick={() => onFinish && onFinish(s.id)}>Close Chapter</button>
          <button className="btn" onClick={onClose}>Keep Fishing</button>
          <button className="btn primary" onClick={() => onViewLivewell && onViewLivewell(s.id)}>View Livewell</button>
        </div>
      </div>
    </div>
  );
}
