import { useState, useEffect } from 'react';
import { useAuth } from './lib/useAuth.js';
import { useData } from './lib/DataContext.jsx';
import { pullFromCloud } from './lib/sync.js';
import Boathouse from './components/Boathouse.jsx';
import Livewell from './components/Livewell.jsx';
import CloudButton from './components/CloudButton.jsx';

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
  const { data, replaceData } = useData();
  const [pulling, setPulling] = useState(false);

  // Offline-first: local data loads instantly. When signed in AND online, pull
  // newer cloud records in the background and merge them into local. On a fresh
  // device this is what brings the real journal down; otherwise it just tops up.
  useEffect(() => {
    if (!auth.signedIn || !navigator.onLine) return;
    let cancelled = false;
    setPulling(true);
    pullFromCloud(data)
      .then((next) => { if (next && !cancelled) replaceData(next); })
      .catch(() => { /* offline / transient — local still works */ })
      .finally(() => { if (!cancelled) setPulling(false); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auth.signedIn]);

  const openCatch = (id) => {
    console.log('open catch', id);
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
          <CloudButton auth={auth} />
        </div>
      </aside>

      <main className="main">
        {page === 'boathouse' && <Boathouse />}
        {page === 'livewell' && <Livewell onOpenCatch={openCatch} />}
        {page !== 'boathouse' && page !== 'livewell' && (
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
    </div>
  );
}
