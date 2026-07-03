import { useData } from '../lib/DataContext.jsx';
import { esc } from '../lib/fishDisplay.js';
import { storyFor } from '../lib/story.js';
import {
  chapterStats, chapterIcon, chapterSeasonType, chapterSubtitle, chapterYear,
  chapterSessions, tripCoverClass, tripCoverIcon, seasonDisplayName,
} from '../lib/seasons.js';

// Journal (Campfire) — the "Your Fishing Journal" library. Ported from the
// canonical renderCampfire() (the override at index.html ~line 1699): a hero,
// the Bookshelf (seasons shelved by year as chapter "books"), the active-season
// story cover, and a story-cover card per trip in the active chapter. Wording
// and markup preserved; the journal-* / story-cover CSS is already in app.css.
//
// Setting a chapter active drives the whole app off that season (setChapter);
// here that's an activeSeason change through the profile-synced data layer.
//
// Props:
//   onStartSeason(): open the Start Season sheet
//   onManageChapters(): go to Rig Box
//   onOpenLivewell(sessionId): open a trip's livewell
//   onRemember(session): open the River Remembers modal for a trip
//   onToast(msg): toast
export default function Journal({ onStartSeason, onManageChapters, onOpenLivewell, onRemember, onEndTrip, onToast }) {
  const { data, updateProfile } = useData();

  const ch = data.seasons.find((s) => s.id === data.activeSeason) || data.seasons[0] || {};
  const st = chapterStats(data, ch.id);
  const sessions = chapterSessions(data, ch.id).slice()
    .sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));

  // setChapter(id): make a season active (drives every room). Syncs via profile.
  const setChapter = (id) => {
    updateProfile((prev) => ({ ...prev, activeSeason: id }));
    const s = data.seasons.find((x) => x.id === id) || { id };
    onToast && onToast('Opened chapter: ' + seasonDisplayName(s));
  };

  // Bookshelf: seasons grouped by year, newest year first (journalShelvesHTML).
  const byYear = {};
  data.seasons.forEach((s) => {
    const y = chapterYear(data, s);
    (byYear[y] = byYear[y] || []).push(s);
  });
  const years = Object.keys(byYear).sort((a, b) => b.localeCompare(a));

  return (
    <div className="grid">
      {/* Journal Library hero */}
      <div className="glass panel span12 journal-hero">
        <span className="eyebrow">Journal Library</span>
        <h2 className="journal-title">Your Fishing Journal</h2>
        <p className="journal-subtitle">
          Open a season like a book. The active chapter drives Boathouse,
          Livewell, Intelligence, Waters, Tackle, and the Lodge.
        </p>
        <div className="actions" style={{ marginTop: 18 }}>
          <button className="btn primary" onClick={onStartSeason}>Start New Season</button>
          <button className="btn" onClick={onManageChapters}>Manage Chapters</button>
        </div>
      </div>

      {/* Bookshelf */}
      <div className="glass panel span12">
        <h3>Bookshelf</h3>
        {years.length ? (
          <div className="journal-shelf">
            {years.map((y) => (
              <div key={y} style={{ display: 'contents' }}>
                <div className="journal-year">{y}</div>
                {byYear[y].map((s) => {
                  const bst = chapterStats(data, s.id);
                  const active = s.id === data.activeSeason;
                  return (
                    <button
                      key={s.id}
                      className={`chapter-book ${chapterSeasonType(s)} ${active ? 'active' : ''} ${s.archived ? 'archived' : ''}`}
                      onClick={() => setChapter(s.id)}
                    >
                      <span className="book-icon">{chapterIcon(s)}</span>
                      <span className={`chapter-pill ${active ? 'active' : ''} ${s.archived ? 'archived' : ''}`}>
                        {s.archived ? 'Archived' : active ? 'Active Season' : 'Open Season'}
                      </span>
                      <h4>{s.name || s.id}</h4>
                      <small>{chapterSubtitle(s, bst)}</small>
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
                        <span className="chip green">{bst.catches.length} fish</span>
                        <span className="chip">{bst.sessions.length} trips</span>
                        <span className="chip gold">
                          {bst.biggest ? `${bst.biggest.species} ${bst.biggest.length}"` : 'No legend yet'}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        ) : (
          <div className="journal-empty">No chapters yet. Start a season and the journal begins.</div>
        )}
      </div>

      {/* Active season story cover */}
      <div className={`glass panel span12 story-cover ${chapterSeasonType(ch)}`}>
        <span className="eyebrow">Active Season • {ch.name || ch.id}</span>
        <span className="cover-mark">{chapterIcon(ch)}</span>
        <h3 className="chapter-title">{chapterSubtitle(ch, st)}</h3>
        <div className="chapter-stats">
          <div className="chapter-stat"><span>Trips</span><strong>{st.sessions.length}</strong></div>
          <div className="chapter-stat"><span>Fish</span><strong>{st.catches.length}</strong></div>
          <div className="chapter-stat"><span>Waters</span><strong>{st.waters}</strong></div>
          <div className="chapter-stat"><span>Best</span><strong>{st.biggest ? `${st.biggest.length}"` : '—'}</strong></div>
        </div>
      </div>

      {/* Trip story covers */}
      {sessions.length ? (
        sessions.map((s) => {
          const c = data.catches.filter((x) => x.sessionId === s.id && !x.deleted);
          const b = c.slice().sort((a, z) => (+z.length || 0) - (+a.length || 0))[0] || {};
          const species = new Set(c.map((x) => x.species || 'Unknown')).size;
          return (
            <div key={s.id} className={`glass panel span6 story-cover ${tripCoverClass(s)}`}>
              <span className="eyebrow">{s.date} • {s.water}</span>
              <span className="cover-mark">{tripCoverIcon(s)}</span>
              <h3 className="chapter-title">{s.title || s.name}</h3>
              <p className="story" dangerouslySetInnerHTML={{ __html: storyFor(data, s) }} />
              <div className="chips">
                <span className="chip green">{c.length} fish</span>
                <span className="chip gold">Best {b.length || 0}"</span>
                <span className="chip">{species} species</span>
                <span className="chip">{(s.partners && s.partners.join)? (s.partners.join(', ') || 'Solo') : (s.partners || 'Solo')}</span>
              </div>
              <div className="actions">
                <button className="btn" onClick={() => onOpenLivewell && onOpenLivewell(s.id)}>Open Livewell</button>
                <button className="btn gold" onClick={() => onRemember && onRemember(s)}>The River Remembers</button>
                {s.active && (
                  <button className="btn end-trip-btn" onClick={() => onEndTrip && onEndTrip(s.id)}>End Trip</button>
                )}
              </div>
            </div>
          );
        })
      ) : (
        <div className="glass panel span12">
          <div className="journal-empty">This chapter has no trips yet. Launch one from the Boathouse.</div>
        </div>
      )}
    </div>
  );
}
