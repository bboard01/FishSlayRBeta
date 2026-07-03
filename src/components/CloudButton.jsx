import { useState } from 'react';

// Sign in with Google when signed out; when signed in, shows the account plus a
// manual "Sync Now" (the sync engine is ported, so this runs a full push+pull).
// Automatic background sync still happens on changes/reconnect; this is the same
// on-demand trigger the original's topbar "☁️ Sync" gave.
export default function CloudButton({ auth, onSync }) {
  const [busy, setBusy] = useState(false);
  const [syncing, setSyncing] = useState(false);

  if (!auth.ready) {
    return <div className="dock-card"><span className="muted">Cloud…</span></div>;
  }

  if (!auth.signedIn) {
    return (
      <div className="dock-card">
        <span className="label">Cloud Sync</span>
        <button
          className="btn primary"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            const { error } = await auth.signIn();
            if (error) setBusy(false); // otherwise the page redirects to Google
          }}
        >
          {busy ? 'Opening Google…' : 'Sign In with Google'}
        </button>
      </div>
    );
  }

  return (
    <div className="dock-card">
      <span className="label">☁️ {auth.email}</span>
      <div className="actions" style={{ marginTop: 8 }}>
        <button
          className="btn small"
          disabled={syncing}
          onClick={async () => {
            setSyncing(true);
            try { await (onSync && onSync()); } finally { setSyncing(false); }
          }}
        >
          {syncing ? '☁️ Syncing…' : '☁️ Sync Now'}
        </button>
        <button className="btn danger small" onClick={auth.signOut}>Sign Out</button>
      </div>
    </div>
  );
}
