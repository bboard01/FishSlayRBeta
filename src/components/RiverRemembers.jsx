import { useData } from '../lib/DataContext.jsx';
import { storyFor, storyBeats, recapFor, tripStoryText } from '../lib/story.js';

// The "River Remembers" recap modal — ported from openRemember(). Shows a trip's
// story, the Morning/Midday/Moment beats, a fish/best/pattern/crew recap grid,
// and Close / Export actions. Read-only. Rendered when a session is selected;
// pass `session={null}` closed.
//
// storyFor/storyBeats build bolded HTML, rendered via dangerouslySetInnerHTML to
// match the original markup exactly.
const H = (html) => ({ __html: html });

export default function RiverRemembers({ session, onClose }) {
  const { data } = useData();
  if (!session) return null;

  const s = session;
  const recap = recapFor(data, s);

  // Export the trip story as a .txt (exportTripStory()).
  const exportStory = () => {
    const b = new Blob([tripStoryText(data, s)], { type: 'text/plain' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(b);
    a.download = 'FishSlayR_The_River_Remembers.txt';
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <div className="remember-backdrop active" onClick={onClose}>
      <div className="remember-card" onClick={(e) => e.stopPropagation()}>
        <span className="eyebrow">The River Remembers</span>
        <h2>{s.title || s.name}</h2>
        <p className="story" dangerouslySetInnerHTML={H(storyFor(data, s))} />
        <div dangerouslySetInnerHTML={H(storyBeats(data, s))} />
        <div className="recap-grid">
          <div className="recap-stat"><strong>{recap.count}</strong><span className="muted">Fish</span></div>
          <div className="recap-stat"><strong>{recap.best}"</strong><span className="muted">Best</span></div>
          <div className="recap-stat"><strong>{recap.lure}</strong><span className="muted">Pattern</span></div>
          <div className="recap-stat"><strong>{recap.crew}</strong><span className="muted">Crew</span></div>
        </div>
        <p className="story"><em>Every cast tells a story. Today's chapter has been written.</em></p>
        <div className="actions">
          <button className="btn gold" onClick={onClose}>Close Chapter</button>
          <button className="btn" onClick={exportStory}>Export Story</button>
        </div>
      </div>
    </div>
  );
}
