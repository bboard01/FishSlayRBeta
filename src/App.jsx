import { useState, useEffect, useRef } from 'react';
import { useAuth } from './lib/useAuth.js';
import { useData } from './lib/DataContext.jsx';
import { fishEmoji } from './lib/fishDisplay.js';
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
import TripCeremony from './components/TripCeremony.jsx';
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
  const { data, setSignedIn, runSync, activeSession, sessionFor, update, updateProfile } = useData();
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
  // The session being closed via the Trip Ceremony (null = closed).
  const [ceremony, setCeremony] = useState(null);
  // Which trip the Livewell is showing (null = the active trip). Lets Journal
  // and Waters open a specific past trip's livewell.
  const [viewedSessionId, setViewedSessionId] = useState(null);
  // The just-landed catch id — drives the Living Livewell's drop-in animation
  // and the tank's splash pulse. Cleared shortly after so it only plays once.
  const [lastCatchId, setLastCatchId] = useState(null);

  // Open the Livewell on a specific trip (or the active one when id is null).
  const openLivewellFor = (id) => { setViewedSessionId(id || null); setPage('livewell'); };

  // Open the Trip Ceremony for a session (End Trip button). Falls back to the
  // active session when no id is given.
  const openCeremony = (id) => {
    const s = id ? sessionFor(id) : activeSession();
    if (s && s.id) setCeremony(s); else showToast('Start a trip first');
  };

  // Ported from finishTrip(): close the chapter — deactivate the session, stamp
  // an end time, mark it dirty for sync, then drop into its livewell and open
  // the River Remembers recap.
  const finishTrip = (id) => {
    update((prev) => ({
      ...prev,
      sessions: prev.sessions.map((s) =>
        s.id === id
          ? { ...s, active: false, end: s.end || new Date().toTimeString().slice(0, 5), updated_at: new Date().toISOString(), _dirty: true }
          : s
      ),
    }));
    const s = sessionFor(id);
    setCeremony(null);
    setViewedSessionId(id);
    setPage('livewell');
    if (s && s.id) setRemembering(s);
    showToast('🌅 Chapter closed. The River Remembers.');
  };
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

  // --- Dock / Water mode (ported from setMode + renderShell's body toggle) ---
  // Water Mode is a full-screen "on the water" view: the rail, topbar, and nav
  // collapse (all via the .water-mode body class, whose CSS is already in
  // app.css) and only the Boathouse orb shows. Entering water mode jumps to the
  // Boathouse and remembers the page you were on; leaving restores it. A
  // floating "↩ Dock Mode" button (rendered below) returns to dock.
  const isWater = data.mode === 'water';
  const lastDockPage = useRef('boathouse');
  const prevMode = useRef(data.mode);

  useEffect(() => {
    document.body.classList.toggle('water-mode', isWater);
  }, [isWater]);

  useEffect(() => {
    if (prevMode.current !== 'water' && isWater) {
      // Entering water mode: remember where we were, force the Boathouse.
      lastDockPage.current = page || 'boathouse';
      setPage('boathouse');
    } else if (prevMode.current === 'water' && !isWater) {
      // Leaving water mode: restore the last dock page.
      setPage(lastDockPage.current || 'boathouse');
    }
    prevMode.current = data.mode;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.mode]);

  // Toggle back to dock from the floating water-return button.
  const exitWaterMode = () => updateProfile((prev) => ({ ...prev, mode: 'dock' }));

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

  // A landed fish emoji that arcs across the screen — ported from landedSwim().
  const [swimGhost, setSwimGhost] = useState(null);

  // Called by LogCatch after a fish is saved — mirror landFish()'s tail: play
  // the right toast, fling the swim-ghost, mark the new catch so the Living
  // Livewell drops it in with a splash, and drop the user into the livewell.
  const onLanded = (obj, isPB) => {
    showToast(isPB ? '🏆 A New Legend' : '🌊 The River Remembers');
    setViewedSessionId(null); // show the active trip so the new fish appears
    setLastCatchId(obj.id);
    setPage('livewell');
    // swim-ghost: a single emoji arc, removed after the animation (~1.3s).
    const ghost = { id: obj.id + ':' + Date.now(), emoji: fishEmoji(obj.species) };
    setSwimGhost(ghost);
    setTimeout(() => setSwimGhost((g) => (g && g.id === ghost.id ? null : g)), 1300);
    // Let the drop-in / splash play once, then clear so it doesn't re-fire.
    setTimeout(() => setLastCatchId((id) => (id === obj.id ? null : id)), 1400);
  };

  return (
    <div className="app">
      {/* Water Mode return button — CSS shows it only when .water-mode is on
          the body (ported from the original's #waterReturn). */}
      <button className="water-return" onClick={exitWaterMode}>↩ Dock Mode</button>
      {/* Ambient underwater layer behind the whole app — drifting fish
          silhouettes + rising bubbles. Ported from the original's <div
          class="world"> block. Purely decorative (pointer-events:none). */}
      <div className="world">
        <div className="fish-sil one" />
        <div className="fish-sil two" />
        <i className="bubble" />
        <i className="bubble" />
        <i className="bubble" />
        <i className="bubble" />
        <i className="bubble" />
      </div>

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
            onOpenJournal={() => setPage('campfire')}
            onStartSeason={() => setSeasonSheet({ mode: 'start' })}
            onOpenCatch={(id) => setOpenCatchId(id)}
            onEndTrip={() => openCeremony(null)}
            lastCatchId={lastCatchId}
          />
        )}
        {page === 'livewell' && (
          <Livewell
            viewedSessionId={viewedSessionId}
            onSelectSession={(id) => setViewedSessionId(id)}
            onOpenCatch={openCatch}
            lastCatchId={lastCatchId}
            onRemember={(id) => {
              const s = id ? sessionFor(id) : activeSession();
              if (s && s.id) setRemembering(s); else showToast('Start a trip first');
            }}
            onEndTrip={(id) => openCeremony(id)}
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
            onEndTrip={(id) => openCeremony(id)}
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

      {/* Mobile bottom nav — the phone-only scrollable tab bar (the .rail is
          hidden under 760px). Ported from the original's #mobileNav: icon over a
          short label, active state, horizontal scroll. CSS shows it only on
          mobile and hides it in water mode. */}
      <nav className="mobile-nav">
        {NAV.map(([id, icon, label]) => (
          <button
            key={id}
            className={page === id ? 'active' : ''}
            onClick={() => setPage(id)}
          >
            <div>{icon}</div>
            <small>{label.split(' ')[0]}</small>
          </button>
        ))}
      </nav>

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

      {ceremony && (
        <TripCeremony
          session={ceremony}
          onClose={() => setCeremony(null)}
          onFinish={finishTrip}
          onViewLivewell={(id) => { setCeremony(null); openLivewellFor(id); }}
        />
      )}

      {swimGhost && (
        <div className="swim-ghost" key={swimGhost.id}>{swimGhost.emoji}</div>
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
