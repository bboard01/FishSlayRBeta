import { useState, useEffect, useRef } from 'react';
import { useAuth } from './lib/useAuth.js';
import { useData } from './lib/DataContext.jsx';
import { fishEmoji } from './lib/fishDisplay.js';
import { FishAudio, haptic, unlock, setAudioSettings } from './lib/audio.js';
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
import Tournament from './components/Tournament.jsx';
import Waters from './components/Waters.jsx';
import Legends from './components/Legends.jsx';
import RiverRemembers from './components/RiverRemembers.jsx';
import TripCeremony from './components/TripCeremony.jsx';
import SeasonSheet from './components/SeasonSheet.jsx';
import AudioLab from './components/AudioLab.jsx';
import SonarModal, { playSonar } from './components/SonarModal.jsx';

const NAV = [
  ['boathouse', '🛶', 'Boathouse'],
  ['livewell', '🐟', 'Livewell'],
  ['campfire', '📖', 'Journal'],
  ['intelligence', '🧠', 'River Intelligence'],
  ['waters', '🌊', 'Waters'],
  ['tackle', '🪝', 'Tackle Box'],
  ['legends', '🏆', 'Legends'],
  ['tournament', '🎣', 'Tournament'],
  ['rigbox', '⚙', 'Rig Box'],
];

// Spawn two expanding ripple rings at the click point — ported verbatim from
// the single-file app's wideRipple(). Purely decorative; removed after ~1.4s.
function wideRipple(e) {
  let x = window.innerWidth / 2, y = window.innerHeight / 2;
  if (e && e.clientX) { x = e.clientX; y = e.clientY; }
  const r = document.createElement('span');
  r.className = 'ripple-ring';
  r.style.left = x + 'px';
  r.style.top = y + 'px';
  document.body.appendChild(r);
  const r2 = r.cloneNode();
  r2.className = 'ripple-ring second';
  document.body.appendChild(r2);
  setTimeout(() => { r.remove(); r2.remove(); }, 1400);
}

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
  // The hidden FishAudio Lab easter egg — unlocked by five logo taps (or the Rig
  // Box "Audio Lab" button). null = closed.
  const [audioLab, setAudioLab] = useState(false);
  // The catch whose Sonar Fix GPS modal is open (null = closed).
  const [sonarCatchId, setSonarCatchId] = useState(null);
  const openSonar = (id) => { setSonarCatchId(id); playSonar(); };
  const logoTaps = useRef(0);
  const tapTimer = useRef(null);

  // Ported from the original's logo click listener: five quick taps on the
  // FishSlayR logo open the Audio Lab and play the PB fanfare.
  const onLogoTap = () => {
    logoTaps.current += 1;
    clearTimeout(tapTimer.current);
    tapTimer.current = setTimeout(() => { logoTaps.current = 0; }, 1200);
    if (logoTaps.current >= 5) {
      logoTaps.current = 0;
      unlock();
      setAudioLab(true);
      showToast('FishAudio Lab unlocked');
      FishAudio.play('pb');
    }
  };

  // Open the Livewell on a specific trip (or the active one when id is null).
  const openLivewellFor = (id) => { setViewedSessionId(id || null); setPage('livewell'); FishAudio.play('sonar'); };

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
    FishAudio.play('chapter');
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

  // Expose the current page on the body so water-mode CSS can reveal the right
  // full-screen page (the original water-mode rules hide every .page but the
  // Boathouse; per-page guards keyed on this attribute opt specific pages back
  // in — e.g. the tournament water view).
  useEffect(() => {
    document.body.dataset.activePage = page;
  }, [page]);

  useEffect(() => {
    if (prevMode.current !== 'water' && isWater) {
      // Entering water mode: remember where we were. With an active tournament,
      // the on-the-water view IS the tournament (LAND A FISH + your team's
      // standing), so land on the tournament page; otherwise the Boathouse orb.
      lastDockPage.current = page || 'boathouse';
      setPage(data.activeTournament ? 'tournament' : 'boathouse');
    } else if (prevMode.current === 'water' && !isWater) {
      // Leaving water mode: restore the last dock page.
      setPage(lastDockPage.current || 'boathouse');
    }
    // Mode changes played the sonar sweep in the original (setMode).
    if (prevMode.current !== data.mode) FishAudio.play('sonar');
    prevMode.current = data.mode;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.mode]);

  // --- FishAudio wiring (ported from the single-file app) ---------------------
  // Keep the sound engine's settings snapshot in step with data.sound so mute,
  // master/effects levels, and the haptics preference take effect immediately.
  useEffect(() => {
    setAudioSettings(data.sound);
  }, [data.sound]);

  // Global click handler — the original played a soft "button" click and threw a
  // ripple on every button press (document.addEventListener('click', …)). The
  // first user gesture also unlocks the AudioContext (browser autoplay policy),
  // so sound can start the moment it's enabled.
  useEffect(() => {
    const onClick = (e) => {
      unlock();
      if (e.target.closest && e.target.closest('button')) {
        FishAudio.play('button');
        wideRipple(e);
      }
    };
    document.addEventListener('click', onClick);
    return () => document.removeEventListener('click', onClick);
  }, []);

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
    if (!ok) FishAudio.play('error');
    showToast(ok ? '☁️ Synced' : 'Sync failed');
  };

  // A landed fish emoji that arcs across the screen — ported from landedSwim().
  const [swimGhost, setSwimGhost] = useState(null);

  // Called by LogCatch after a fish is saved — mirror landFish()'s tail: play
  // the right toast, fling the swim-ghost, mark the new catch so the Living
  // Livewell drops it in with a splash, and drop the user into the livewell.
  const onLanded = (obj, isPB) => {
    // Ported from landFish()'s tail: PB fanfare vs the splash, plus the matching
    // haptic pattern.
    FishAudio.play(isPB ? 'pb' : 'splash');
    haptic(isPB ? [40, 40, 100] : [20, 30, 20]);
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
        <div className="logo" onClick={onLogoTap}>
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
        {/* Mobile-only cloud bar — the .rail (which holds sign-in / sync / sign
            out) is hidden under 760px, so on phones the installed WebAPK had no
            way to authenticate or sync. This surfaces the same CloudButton at the
            top of every screen on mobile; CSS hides it on desktop. */}
        <div className="mobile-cloud">
          {pulling && <div className="muted" style={{ fontSize: '.75rem', marginBottom: 8 }}>☁️ Syncing…</div>}
          <CloudButton auth={auth} onSync={doSync} />
        </div>
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
            isWater={isWater}
            onExitWater={() => updateProfile((prev) => ({ ...prev, mode: 'dock' }))}
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
            onOpenAudioLab={() => setAudioLab(true)}
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
        {page === 'tournament' && <Tournament onToast={showToast} onOpenCatch={openCatch} />}
        {page !== 'boathouse' && page !== 'livewell' && page !== 'tackle' && page !== 'rigbox' && page !== 'intelligence' && page !== 'campfire' && page !== 'waters' && page !== 'legends' && page !== 'tournament' && (
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
          onSonar={(id) => openSonar(id)}
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

      {audioLab && <AudioLab onClose={() => setAudioLab(false)} />}

      {sonarCatchId && (
        <SonarModal
          catchId={sonarCatchId}
          onClose={() => setSonarCatchId(null)}
          onToast={showToast}
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
