import { esc } from '../lib/fishDisplay.js';
import {
  filterLivewellCatches, livewellFishColors, livewellSize, livewellPosition,
} from '../lib/livewell.js';

// LivingLivewell — the animated tank, ported from the single-file app's
// livingLivewellHTML() + livingFishHTML(). This is the headline visual of the
// Livewell screen: every fish is a positioned, continuously-cruising element,
// sized and tinted by species, with a water-top header, a live count bubble,
// rising tank bubbles, and dock actions. The `splashing` class fires the
// brightness pulse when a fish was just landed, and the just-landed fish drops
// in via the `.new-fish` animation.
//
// Heavy when the tank is full — this is exactly why the Memory Wall toggle
// exists as a lightweight escape valve.
//
// All class names and the styling are the original's (already carried into
// app.css verbatim); this only rebuilds the markup + geometry in React.

// A single swimming fish — ported from livingFishHTML().
function LiveFish({ c, i, total, big, isNew, onOpen }) {
  const [x, y] = livewellPosition(i, total, c);
  const [c1, c2] = livewellFishColors(c.species);
  const w = livewellSize(c);
  const mw = Math.max(58, Math.min(w, 120));
  const dir = i % 2 ? 'left' : 'right';
  const dur = 8 + (i % 7) * 1.25;
  const delay = -(i % 11) * 0.7;
  const scale = (c.id === big?.id ? 1.12 : 1).toFixed(2);
  const released = String(c.disposition || '').toLowerCase().includes('released') ? 'released' : '';
  const isPB = c.id === big?.id ? 'pb' : '';
  const label = `${c.length || 0}" ${c.species || 'Fish'}`;

  return (
    <button
      className={`live-fish ${released} ${isNew ? 'new-fish' : ''} ${isPB}`}
      data-dir={dir}
      style={{
        '--x': `${x}%`,
        '--y': `${y}%`,
        '--w': `${w}px`,
        '--mw': `${mw}px`,
        '--fish1': c1,
        '--fish2': c2,
        '--dur': `${dur}s`,
        '--delay': `${delay}s`,
        '--scale': scale,
      }}
      onClick={() => onOpen && onOpen(c.id)}
      aria-label={`Open ${esc(label)} catch card`}
    >
      <span className="fish-tail" />
      <span className="fish-body" />
      <span className="fish-fin" />
      <span className="fish-label">{label}</span>
    </button>
  );
}

export default function LivingLivewell({
  catches, session, biggest, topLure, newFishId, onOpenCatch, onLandFish, onTripStory,
}) {
  const filtered = filterLivewellCatches(catches, 'all', 'time');
  const big = biggest(catches) || {};
  const water = session?.water || "Today's water";
  const bait = topLure || 'pattern pending';
  const splashing = newFishId ? 'splashing' : '';

  // Rising bubbles behind the fish — ported from the tank's bubble array.
  const bubbles = Array.from({ length: 10 }, (_, i) => (
    <span
      key={i}
      className={`tank-bubble ${i % 3 === 0 ? 'b2' : i % 4 === 0 ? 'b3' : ''}`}
      style={{ left: `${8 + ((i * 17) % 86)}%`, animationDelay: `${-(i * 0.9)}s` }}
    />
  ));

  return (
    <div className={`living-livewell-wrap ${splashing}`}>
      <div className="livewell-water-top">
        <div>
          <span className="eyebrow">{session?.active ? "Today's Livewell" : 'Past Livewell'}</span>
          <h3>{session?.title || session?.name || 'Trip Livewell'}</h3>
          <p>{water} • {filtered.length} fish swimming • {bait}</p>
        </div>
        <div className="livewell-count-bubble">
          <div>
            <strong>{filtered.length}</strong>
            <span>Fish</span>
          </div>
        </div>
      </div>

      <div className="livewell-pond">
        {bubbles}
        {filtered.length ? (
          filtered.map((c, i) => (
            <LiveFish
              key={c.id}
              c={c}
              i={i}
              total={filtered.length}
              big={big}
              isNew={c.id === newFishId}
              onOpen={onOpenCatch}
            />
          ))
        ) : (
          <div className="livewell-empty-water">
            <div>
              <strong>The livewell is quiet.</strong>
              <span>Land the first fish and watch it drop in.</span>
            </div>
          </div>
        )}
      </div>

      <div className="livewell-dock-actions">
        <button className="btn primary" onClick={() => onLandFish && onLandFish()}>Land Fish</button>
        <button className="btn" onClick={() => onTripStory && onTripStory(session?.id)}>Trip Story</button>
      </div>
    </div>
  );
}
