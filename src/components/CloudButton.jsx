import { useState } from 'react';

// Sign in with Google when signed out; shows account when signed in.
// Sync wiring will attach once the sync engine module is ported.
export default function CloudButton({ auth }) {
  const [busy, setBusy] = useState(false);

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
      <button className="btn danger small" onClick={auth.signOut}>Sign Out</button>
    </div>
  );
}
