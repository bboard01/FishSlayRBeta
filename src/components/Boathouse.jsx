// First ported screen — a real React component using the existing CSS classes,
// so it looks identical to the single-file app. Data wiring (seasons, sessions,
// catches) gets connected as we port the data layer in the next steps.
export default function Boathouse() {
  return (
    <>
      <div className="topbar">
        <span className="eyebrow">v2.0 • Season Journal</span>
      </div>

      <div className="hero">
        <div className="hero-grid">
          <div>
            <span className="eyebrow">Active Season</span>
            <h2>The river remembers.</h2>
            <p className="subtitle">
              FishSlayR is now running on the new build. This Boathouse screen is
              live in React with the original look intact. The rest of the app is
              being ported over screen by screen.
            </p>
            <div className="chips">
              <span className="chip green">React + Vite</span>
              <span className="chip gold">Supabase connected</span>
              <span className="chip">Offline-first</span>
            </div>
          </div>
          <div className="land-orb"><span>🐟</span></div>
        </div>
      </div>

      <div className="grid">
        <div className="glass panel span4">
          <h3>Season Fish</h3>
          <div className="metric"><strong>—</strong><span>Total</span></div>
        </div>
        <div className="glass panel span4">
          <h3>Trips</h3>
          <div className="metric"><strong>—</strong><span>In book</span></div>
        </div>
        <div className="glass panel span4">
          <h3>Waters</h3>
          <div className="metric"><strong>—</strong><span>Visited</span></div>
        </div>
      </div>
    </>
  );
}
