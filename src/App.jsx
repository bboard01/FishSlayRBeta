import { useState, useEffect } from 'react';
import { useAuth } from './lib/useAuth.js';
import { useData } from './lib/DataContext.jsx';
import Boathouse from './components/Boathouse.jsx';
import Livewell from './components/Livewell.jsx';
import CloudButton from './components/CloudButton.jsx';
import CatchSheet from './components/CatchSheet.jsx';
import LogCatch from './components/LogCatch.jsx';
import NewTrip from './components/NewTrip.jsx';
import TackleBox from './components/TackleBox.jsx';
import RigBox from './components/RigBox.jsx';
import RiverIntelligence from './components/RiverIntelligence.jsx';
import Journal from './components/Journal.jsx';
import Waters from './components/Waters.jsx';
import Legends from './components/Legends.jsx';
import RiverRemembers from './components/RiverRemembers.jsx';
import SeasonSheet from './components/SeasonSheet.jsx';

const NAV = [
  ['boathouse', '🛶', 'Boathouse'],
  ['livewell', '🐟', 'Livewell'],
  ['campfire', '📖', 'Journal'],
  ['intelligence', '🧠', 'River Intelligence'],
  ['waters', '🌊', 'Waters'],
  ['tackle', '🪝', 'Tackle Box'],
  ['legends', '🏆', 'Legends'],
  ['rigbox', '⚙', 'Rig Box'],
];

export default function App() {
  const [page, setPage] = useState('boathouse');
  const auth = useAuth();
  const { setSignedIn, runSync, activeSession } = useData();
  const [pulling, setPulling] = useState(false);
  // Which catch card is open in the detail sheet (null = closed).
  const [openCatchId, setOpenCatchId] = useState(null);
  // Whether the multi-step "Land the Fish" logging flow is open.
  const [logging, setLogging] = useState(false);
  // The catch being edited (opens LogCatch pre-filled), or null.
  const [editingCatch, setEditingCatch] = useState(null);
  // Whether the New Trip sheet is open.
  const [newTrip, setNewTrip] = useState(false);
  // Season sheet: null, or { mode:'start' } / { mode:'rename', season }.
  const [seasonSheet, setSeasonSheet] = useState(null);
  // The session whose "River Remembers" recap is open (null = closed).
  const [remembering, setRemembering] = useState(null);
  // Which trip the Livewell is showing (null = the active trip). Lets Journal
  // and Waters open a specific past trip's livewell.
  const [viewedSessionId, setViewedSessionId] = useState(null);

  // Open the Livewell on a specific trip (or the active one when id is null).
  const openLivewellFor = (id) => { setViewedSessionId(id || null); setPage('livewell'); };
  // Lightweight toast — the original's toast(): a short message that fades.
  const [toast, setToast] = useState('');

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast((t) => (t === msg ? '' : t)), 2300);
  };

  // Offline-first: local data loads instantly. When auth resolves, tell the
  // data layer whether we're signed in — it handles first-sign-in server seeding
  // and background push+pull without ever blocking the UI.
  useEffect(() => {
    if (!auth.ready) return;
    let cancelled = false;
    setSignedIn(auth.signedIn);
    if (auth.signedIn && navigator.onLine) {
      setPulling(true);
      Promise.resolve(runSync()).finally(() => { if (!cancelled) setPulling(false); });
    }
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auth.ready, auth.signedIn]);

  const openCatch = (id) => {
    // A real id opens its catch card. `null` comes from "Land Another" — open
    // the logging flow. If no trip is active yet, start one first (logging
    // attaches catches to the active session).
    if (id) { setOpenCatchId(id); return; }
    startLogging();
  };

  const startLogging = () => {
    if (!activeSession()) { setNewTrip(true); showToast('Start a trip first'); return; }
    setLogging(true);
  };

  // Manual "Sync Now" — runs a full push+pull and reports the result, the same
  // on-demand sync the original's topbar "☁️ Sync" gave. Automatic background
  // sync still runs on changes and reconnect.
  const doSync = async () => {
    if (!auth.signedIn) { showToast('Sign in to sync'); return; }
    if (!navigator.onLine) { showToast('Offline — will sync when back online'); return; }
    const ok = await runSync();
    showToast(ok ? '☁️ Synced' : 'Sync failed');
  };

  // Called by LogCatch after a fish is saved — mirror landFish()'s tail: play
  // the right toast and drop the user into the livewell to see the new fish.
  const onLanded = (obj, isPB) => {
    showToast(isPB ? '🏆 A New Legend' : '🌊 The River Remembers');
    setViewedSessionId(null); // show the active trip so the new fish appears
    setPage('livewell');
  };

  return (
    <div className="app">
      <aside className="rail">
        <div className="logo">
          <div className="mark" />
          <div>
            <h1>FishSlayR</h1>
            <p>Season Journal</p>
          </div>
        </div>
        <nav className="nav">
          {NAV.map(([id, icon, label]) => (
            <button
              key={id}
              className={page === id ? 'active' : ''}
              onClick={() => setPage(id)}
            >
              <b>{icon}</b> {label}
            </button>
          ))}
        </nav>
        <div className="rail-bottom">
          {pulling && <div className="muted" style={{ fontSize: '.75rem', marginBottom: 8 }}>☁️ Syncing…</div>}
          <CloudButton auth={auth} onSync={doSync} />
        </div>
      </aside>

      <main className="main">
        {page === 'boathouse' && (
          <Boathouse
            onLandFish={startLogging}
            onNewTrip={() => setNewTrip(true)}
            onOpenLivewell={() => openLivewellFor(null)}
            onRemember={() => { const s = activeSession(); if (s && s.id) setRemembering(s); else showToast('Start a trip first'); }}
            onSync={doSync}
            signedIn={auth.signedIn}
          />
        )}
        {page === 'livewell' && (
          <Livewell
            viewedSessionId={viewedSessionId}
            onSelectSession={(id) => setViewedSessionId(id)}
            onOpenCatch={openCatch}
          />
        )}
        {page === 'tackle' && <TackleBox onToast={showToast} />}
        {page === 'rigbox' && (
          <RigBox
            onStartSeason={() => setSeasonSheet({ mode: 'start' })}
            onRenameSeason={(season) => setSeasonSheet({ mode: 'rename', season })}
            onStartTrip={() => setNewTrip(true)}
            onOpenLivewell={() => setPage('livewell')}
            onToast={showToast}
          />
        )}
        {page === 'intelligence' && <RiverIntelligence />}
        {page === 'campfire' && (
          <Journal
            onStartSeason={() => setSeasonSheet({ mode: 'start' })}
            onManageChapters={() => setPage('rigbox')}
            onOpenLivewell={(id) => openLivewellFor(id)}
            onRemember={(session) => setRemembering(session)}
            onToast={showToast}
          />
        )}
        {page === 'waters' && (
          <Waters
            onOpenLivewell={(id) => openLivewellFor(id)}
            onPlanTrip={() => setNewTrip(true)}
            onAskIntelligence={() => setPage('intelligence')}
            onOpenStories={() => setPage('campfire')}
            onToast={showToast}
          />
        )}
        {page === 'legends' && <Legends onOpenCatch={(id) => setOpenCatchId(id)} />}
        {page !== 'boathouse' && page !== 'livewell' && page !== 'tackle' && page !== 'rigbox' && page !== 'intelligence' && page !== 'campfire' && page !== 'waters' && page !== 'legends' && (
          <div className="glass panel">
            <span className="eyebrow">Coming soon</span>
            <h2 style={{ marginTop: 8 }}>{NAV.find((n) => n[0] === page)?.[2]}</h2>
            <p className="muted">
              This screen is being migrated to the new build. It still lives in
              the current app while we port it over.
            </p>
          </div>
        )}
      </main>

      {openCatchId && (
        <CatchSheet
          catchId={openCatchId}
          onClose={() => setOpenCatchId(null)}
          onEdit={(c) => { setOpenCatchId(null); setEditingCatch(c); }}
          onRemember={(session) => setRemembering(session)}
        />
      )}

      {logging && (
        <LogCatch onClose={() => setLogging(false)} onLanded={onLanded} onToast={showToast} />
      )}

      {editingCatch && (
        <LogCatch
          editCatch={editingCatch}
          onClose={() => setEditingCatch(null)}
          onToast={showToast}
        />
      )}

      {newTrip && (
        <NewTrip
          onClose={() => setNewTrip(false)}
          onLaunched={() => { showToast('The boat is in the water'); setPage('boathouse'); }}
        />
      )}

      {seasonSheet && (
        <SeasonSheet
          mode={seasonSheet.mode}
          season={seasonSheet.season}
          onClose={() => setSeasonSheet(null)}
          onDone={showToast}
        />
      )}

      {remembering && (
        <RiverRemembers session={remembering} onClose={() => setRemembering(null)} />
      )}

      {toast && (
        <div
          className="toast"
          style={{
            position: 'fixed',
            right: 20,
            bottom: 20,
            zIndex: 160,
            border: '1px solid rgba(125,231,255,.3)',
            background: 'rgba(3,17,30,.92)',
            color: '#dff8ff',
            borderRadius: 18,
            padding: '13px 16px',
            fontWeight: 950,
            boxShadow: 'var(--shadow)',
          }}
        >
          {toast}
        </div>
      )}
    </div>
  );
}
