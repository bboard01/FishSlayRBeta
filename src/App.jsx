import { useState } from 'react';
import { useAuth } from './lib/useAuth.js';
import Boathouse from './components/Boathouse.jsx';
import CloudButton from './components/CloudButton.jsx';

// The nav items from the single-file app. Only Boathouse is ported so far;
// the rest are placeholders we'll fill in screen by screen.
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
          <CloudButton auth={auth} />
        </div>
      </aside>

      <main className="main">
        {page === 'boathouse' && <Boathouse />}
        {page !== 'boathouse' && (
          <div className="glass panel">
            <span className="eyebrow">Coming soon</span>
            <h2 style={{ marginTop: 8 }}>
              {NAV.find((n) => n[0] === page)?.[2]}
            </h2>
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
